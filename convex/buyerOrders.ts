import {
  canCreateBuyerOrder,
  canReserveInventory,
  canTransitionBuyerOrderStatus,
  canTransitionInventoryBatchStatus,
  canTransitionInventoryReservationStatus,
  isActiveReservationStatus,
} from "@kuapa-dwaso/permissions";
import {
  allocateInventoryReservations,
  calculateBuyerOrderCharges,
  calculateReservableBatchQuantity,
  inventoryBatchStatusesVisibleToBuyers,
} from "@kuapa-dwaso/utils";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { listApplicableFeeRules, snapshotFeeRule } from "./feeRules";
import { insertNotificationRecord } from "./notifications";
import {
  assertAllowed,
  auditSnapshot,
  buyerOrderScopeTarget,
  getActor,
  insertAuditLog,
  omitUndefinedValues,
  requireAdminPermission,
  requireWarehouseAgentAssignedToWarehouse,
  type Actor,
} from "./workflowHelpers";

const produceGrade = v.union(
  v.literal("A"),
  v.literal("B"),
  v.literal("C"),
  v.literal("mixed"),
  v.literal("ungraded"),
);

const buyerOrderStatus = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("awaiting_payment"),
  v.literal("confirmed"),
  v.literal("matched_to_inventory"),
  v.literal("reserved"),
  v.literal("preparing"),
  v.literal("ready_for_dispatch"),
  v.literal("in_transit"),
  v.literal("delivered"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("unfulfilled"),
  v.literal("disputed"),
);

type BuyerOrderStatus = Doc<"buyerOrders">["status"];
type InventoryBatchStatus = Doc<"inventoryBatches">["status"];
type InventoryReservationStatus = Doc<"inventoryReservations">["status"];
type BuyerVisibleInventoryBatchStatus = Extract<
  InventoryBatchStatus,
  "available" | "partially_reserved" | "partially_sold"
>;

type ReservableBatch = Doc<"inventoryBatches"> & {
  warehouse: Doc<"warehouses">;
  reservableQuantity: number;
};

function cleanText(value: string, label: string): string {
  const cleaned = value.trim();
  assertAllowed(cleaned.length > 0, `${label} is required.`);
  return cleaned;
}

function assertPositiveNumber(value: number, label: string): void {
  assertAllowed(Number.isFinite(value) && value > 0, `${label} must be a positive number.`);
}

function buyerInventoryProjection(batch: ReservableBatch) {
  return {
    inventoryBatchId: batch._id,
    warehouseId: batch.warehouseId,
    warehouseName: batch.warehouse.name,
    warehouseCode: batch.warehouse.code,
    warehouseCommunity: batch.warehouse.community,
    destinationMarketsServed: batch.warehouse.destinationMarketsServed,
    dispatchDays: batch.warehouse.dispatchDays,
    cropType: batch.cropType,
    variety: batch.variety,
    grade: batch.grade,
    availableQuantity: batch.reservableQuantity,
    unit: batch.unit,
    askingPricePerUnit: batch.askingPricePerUnit,
    minimumPricePerUnit: batch.minimumPricePerUnit,
    sellByDate: batch.sellByDate,
    expectedShelfLifeDays: batch.expectedShelfLifeDays,
    status: batch.status,
    photos: batch.photos,
  };
}

async function getBatchReservations(
  ctx: QueryCtx | MutationCtx,
  inventoryBatchId: Id<"inventoryBatches">,
): Promise<Doc<"inventoryReservations">[]> {
  const active = await ctx.db
    .query("inventoryReservations")
    .withIndex("by_batch_status", (q) =>
      q.eq("inventoryBatchId", inventoryBatchId).eq("status", "active"),
    )
    .collect();
  const partiallyReleased = await ctx.db
    .query("inventoryReservations")
    .withIndex("by_batch_status", (q) =>
      q.eq("inventoryBatchId", inventoryBatchId).eq("status", "partially_released"),
    )
    .collect();

  return [...active, ...partiallyReleased];
}

async function getFulfilledSaleQuantity(
  ctx: QueryCtx | MutationCtx,
  inventoryBatchId: Id<"inventoryBatches">,
): Promise<number> {
  const sales = await ctx.db
    .query("saleRecords")
    .withIndex("by_batch", (q) => q.eq("inventoryBatchId", inventoryBatchId))
    .collect();

  return sales.reduce((total, sale) => total + sale.quantitySold, 0);
}

async function findReservableBatches(
  ctx: QueryCtx | MutationCtx,
  args: {
    cropType?: string;
    unit?: string;
    destinationMarket?: string;
    preferredGrade?: Doc<"inventoryBatches">["grade"];
    maxPricePerUnit?: number;
    warehouseId?: Id<"warehouses">;
    minimumQuantity?: number;
    sellByDateOnOrAfter?: number;
    sellByDateOnOrBefore?: number;
    limit?: number;
  },
): Promise<ReservableBatch[]> {
  const limit = Math.min(args.limit ?? 100, 200);
  const visibleStatuses = [...inventoryBatchStatusesVisibleToBuyers];
  const batchesByStatus = await Promise.all(
    visibleStatuses.map((status) =>
      ctx.db
        .query("inventoryBatches")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(limit * 4),
    ),
  );
  const candidates = batchesByStatus.flat();
  const results: ReservableBatch[] = [];

  for (const batch of candidates) {
    if (results.length >= limit) {
      break;
    }
    if (args.cropType !== undefined && batch.cropType !== args.cropType) {
      continue;
    }
    if (args.unit !== undefined && batch.unit !== args.unit) {
      continue;
    }
    if (args.warehouseId !== undefined && batch.warehouseId !== args.warehouseId) {
      continue;
    }
    if (
      args.preferredGrade !== undefined &&
      args.preferredGrade !== "mixed" &&
      batch.grade !== args.preferredGrade
    ) {
      continue;
    }
    if (
      args.maxPricePerUnit !== undefined &&
      batch.askingPricePerUnit !== undefined &&
      batch.askingPricePerUnit > args.maxPricePerUnit
    ) {
      continue;
    }
    if (
      args.sellByDateOnOrAfter !== undefined &&
      batch.sellByDate !== undefined &&
      batch.sellByDate < args.sellByDateOnOrAfter
    ) {
      continue;
    }
    if (
      args.sellByDateOnOrBefore !== undefined &&
      batch.sellByDate !== undefined &&
      batch.sellByDate > args.sellByDateOnOrBefore
    ) {
      continue;
    }

    const warehouse = await ctx.db.get(batch.warehouseId);
    if (warehouse === null || warehouse.status !== "active") {
      continue;
    }
    if (
      args.destinationMarket !== undefined &&
      !warehouse.destinationMarketsServed.includes(args.destinationMarket)
    ) {
      continue;
    }

    const reservations = await getBatchReservations(ctx, batch._id);
    const fulfilledSaleQuantity = await getFulfilledSaleQuantity(ctx, batch._id);
    const reservableQuantity = calculateReservableBatchQuantity(omitUndefinedValues({
      inventoryBatchId: batch._id,
      quantityReceived: batch.quantityReceived,
      quantityAvailable: batch.quantityAvailable,
      fulfilledSaleQuantity,
      reservations,
      unit: batch.unit,
      receivedAt: batch.receivedAt,
      sellByDate: batch.sellByDate,
    }));

    if (reservableQuantity <= 0) {
      continue;
    }
    if (args.minimumQuantity !== undefined && reservableQuantity < args.minimumQuantity) {
      continue;
    }

    results.push({ ...batch, warehouse, reservableQuantity });
  }

  return results.sort((left, right) => {
    const leftSellBy = left.sellByDate ?? Number.POSITIVE_INFINITY;
    const rightSellBy = right.sellByDate ?? Number.POSITIVE_INFINITY;
    if (leftSellBy !== rightSellBy) {
      return leftSellBy - rightSellBy;
    }
    return left.receivedAt - right.receivedAt;
  });
}

async function recomputeBatchStatus(
  ctx: MutationCtx,
  inventoryBatchId: Id<"inventoryBatches">,
  actor: Actor,
): Promise<void> {
  const batch = await ctx.db.get(inventoryBatchId);
  if (batch === null) {
    return;
  }
  if (!(inventoryBatchStatusesVisibleToBuyers as readonly InventoryBatchStatus[]).includes(batch.status)) {
    return;
  }

  const reservations = await getBatchReservations(ctx, inventoryBatchId);
  const fulfilledSaleQuantity = await getFulfilledSaleQuantity(ctx, inventoryBatchId);
  const reservableQuantity = calculateReservableBatchQuantity({
    inventoryBatchId,
    quantityReceived: batch.quantityReceived,
    quantityAvailable: batch.quantityAvailable,
    fulfilledSaleQuantity,
    reservations,
    unit: batch.unit,
  });
  const activeReservedQuantity = reservations
    .filter((reservation) => isActiveReservationStatus(reservation.status))
    .reduce(
      (total, reservation) =>
        total +
        reservation.quantityReserved -
        reservation.quantityReleased -
        reservation.quantityFulfilled,
      0,
    );
  const nextStatus: InventoryBatchStatus =
    activeReservedQuantity <= 0
      ? "available"
      : reservableQuantity <= 0
        ? "reserved"
        : "partially_reserved";

  if (batch.status === nextStatus) {
    return;
  }
  assertAllowed(
    canTransitionInventoryBatchStatus(batch.status as BuyerVisibleInventoryBatchStatus, nextStatus),
    "Inventory batch status transition is not allowed.",
  );

  await ctx.db.patch(inventoryBatchId, {
    status: nextStatus,
    updatedAt: Date.now(),
  });
  const after = await ctx.db.get(inventoryBatchId);
  await insertAuditLog(ctx, {
    actor,
    action: "inventory_batch.reservation_status_recomputed",
    entityType: "inventory_batch",
    entityId: inventoryBatchId,
    before: auditSnapshot(batch),
    after: after === null ? undefined : auditSnapshot(after),
  });
}

async function insertBuyerOrderNotification(
  ctx: MutationCtx,
  buyer: Doc<"buyers">,
  orderId: Id<"buyerOrders">,
  title: string,
  message: string,
): Promise<void> {
  await insertNotificationRecord(ctx, {
    recipientId: buyer._id,
    recipientUserId: buyer.userId,
    recipientRole: "buyer",
    channel: "sms",
    title,
    message,
    relatedEntityType: "buyer_order",
    relatedEntityId: orderId,
  });
}

export const listAvailableInventory = query({
  args: {
    cropType: v.optional(v.string()),
    unit: v.optional(v.string()),
    warehouseId: v.optional(v.id("warehouses")),
    destinationMarket: v.optional(v.string()),
    minimumQuantity: v.optional(v.number()),
    grade: v.optional(produceGrade),
    maximumPricePerUnit: v.optional(v.number()),
    sellByDateOnOrAfter: v.optional(v.number()),
    sellByDateOnOrBefore: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const cropType = args.cropType?.trim();
    const unit = args.unit?.trim();
    const batches = await findReservableBatches(ctx, omitUndefinedValues({
      cropType,
      unit,
      warehouseId: args.warehouseId,
      destinationMarket: args.destinationMarket?.trim(),
      preferredGrade: args.grade,
      maxPricePerUnit: args.maximumPricePerUnit,
      minimumQuantity: args.minimumQuantity,
      sellByDateOnOrAfter: args.sellByDateOnOrAfter,
      sellByDateOnOrBefore: args.sellByDateOnOrBefore,
      limit: args.limit,
    }));

    return batches.map(buyerInventoryProjection);
  },
});

export const summarizeAvailableInventory = query({
  args: {
    cropType: v.optional(v.string()),
    destinationMarket: v.optional(v.string()),
    grade: v.optional(produceGrade),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const visibleStatuses = [...inventoryBatchStatusesVisibleToBuyers];
    const batchesByStatus = await Promise.all(
      visibleStatuses.map((status) =>
        ctx.db
          .query("inventoryBatches")
          .withIndex("by_status", (q) => q.eq("status", status))
          .take(500),
      ),
    );
    const summaries = new Map<string, Record<string, unknown>>();

    for (const batch of batchesByStatus.flat()) {
      if (args.cropType !== undefined && batch.cropType !== args.cropType.trim()) {
        continue;
      }
      if (
        args.grade !== undefined &&
        args.grade !== "mixed" &&
        batch.grade !== args.grade
      ) {
        continue;
      }
      const warehouse = await ctx.db.get(batch.warehouseId);
      if (warehouse === null || warehouse.status !== "active") {
        continue;
      }
      const destinationMarkets =
        args.destinationMarket === undefined
          ? warehouse.destinationMarketsServed
          : warehouse.destinationMarketsServed.filter(
              (market) => market === args.destinationMarket!.trim(),
            );
      if (destinationMarkets.length === 0) {
        continue;
      }

      const reservations = await getBatchReservations(ctx, batch._id);
      const fulfilledSaleQuantity = await getFulfilledSaleQuantity(ctx, batch._id);
      const reservableQuantity = calculateReservableBatchQuantity({
        inventoryBatchId: batch._id,
        quantityReceived: batch.quantityReceived,
        quantityAvailable: batch.quantityAvailable,
        fulfilledSaleQuantity,
        reservations,
        unit: batch.unit,
      });
      if (reservableQuantity <= 0) {
        continue;
      }

      for (const destinationMarket of destinationMarkets) {
        const key = [
          batch.warehouseId,
          batch.cropType,
          batch.grade,
          batch.unit,
          destinationMarket,
        ].join("|");
        const existing = summaries.get(key);
        const prices = [
          ...((existing?.askingPrices as number[] | undefined) ?? []),
          ...(batch.askingPricePerUnit === undefined ? [] : [batch.askingPricePerUnit]),
        ];
        const sellByDates = [
          ...((existing?.sellByDates as number[] | undefined) ?? []),
          ...(batch.sellByDate === undefined ? [] : [batch.sellByDate]),
        ];

        summaries.set(key, {
          warehouseId: batch.warehouseId,
          warehouseName: warehouse.name,
          warehouseCode: warehouse.code,
          warehouseCommunity: warehouse.community,
          cropType: batch.cropType,
          grade: batch.grade,
          unit: batch.unit,
          destinationMarket,
          dispatchDays: warehouse.dispatchDays,
          availableQuantity:
            ((existing?.availableQuantity as number | undefined) ?? 0) + reservableQuantity,
          askingPriceRange:
            prices.length === 0
              ? undefined
              : { min: Math.min(...prices), max: Math.max(...prices) },
          earliestSellByDate:
            sellByDates.length === 0 ? undefined : Math.min(...sellByDates),
          askingPrices: prices,
          sellByDates,
        });
      }
    }

    return [...summaries.values()]
      .slice(0, Math.min(args.limit ?? 50, 100))
      .map(({ askingPrices, sellByDates, ...summary }) => summary);
  },
});

export const create = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerId: v.id("buyers"),
    destinationMarket: v.string(),
    cropType: v.string(),
    requestedQuantity: v.number(),
    unit: v.string(),
    warehouseId: v.optional(v.id("warehouses")),
    preferredGrade: v.optional(produceGrade),
    requestedDeliveryDate: v.optional(v.number()),
    maxPricePerUnit: v.optional(v.number()),
    reservationExpiresAt: v.optional(v.number()),
    clientRequestId: v.optional(v.string()),
  },
  returns: v.id("buyerOrders"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canCreateBuyerOrder(actor.role), "Actor cannot create buyer orders.");
    const buyer = await ctx.db.get(args.buyerId);
    assertAllowed(buyer !== null, "Buyer profile was not found.");
    assertAllowed(buyer.status === "active", "Buyer profile must be active.");
    if (actor.role === "buyer") {
      assertAllowed(buyer.userId === actor._id, "Buyers can only create their own orders.");
    } else {
      assertAllowed(actor.role === "admin", "Only buyers and admins can create buyer orders.");
    }

    const destinationMarket = cleanText(args.destinationMarket, "Destination market");
    const cropType = cleanText(args.cropType, "Crop type");
    const unit = cleanText(args.unit, "Unit");
    if (actor.role === "admin") {
      await requireAdminPermission(ctx, args.actorUserId, "orders:manage", { destinationMarket });
    }
    assertPositiveNumber(args.requestedQuantity, "Requested quantity");
    if (args.maxPricePerUnit !== undefined) {
      assertPositiveNumber(args.maxPricePerUnit, "Max price per unit");
    }
    if (args.requestedDeliveryDate !== undefined) {
      assertAllowed(
        Number.isFinite(args.requestedDeliveryDate),
        "Requested delivery date must be a timestamp.",
      );
    }

    const now = Date.now();
    const orderId = await ctx.db.insert("buyerOrders", omitUndefinedValues({
      buyerId: args.buyerId,
      destinationMarket,
      cropType,
      requestedQuantity: args.requestedQuantity,
      unit,
      preferredGrade: args.preferredGrade,
      requestedDeliveryDate: args.requestedDeliveryDate,
      maxPricePerUnit: args.maxPricePerUnit,
      matchedInventoryBatchIds: [],
      paymentStatus: "awaiting_payment",
      status: "submitted",
      createdAt: now,
      updatedAt: now,
    }));
    await insertBuyerOrderNotification(
      ctx,
      buyer,
      orderId,
      "Order submitted",
      `Your order for ${args.requestedQuantity} ${unit} of ${cropType} has been submitted.`,
    );

    const candidates = await findReservableBatches(ctx, omitUndefinedValues({
      cropType,
      unit,
      warehouseId: args.warehouseId,
      destinationMarket,
      preferredGrade: args.preferredGrade,
      maxPricePerUnit: args.maxPricePerUnit,
      limit: 200,
    }));

    let allocations;
    try {
      allocations = allocateInventoryReservations(
        candidates.map((batch) => omitUndefinedValues({
          inventoryBatchId: batch._id,
          quantityReceived: batch.quantityReceived,
          quantityAvailable: batch.reservableQuantity,
          unit: batch.unit,
          askingPricePerUnit: batch.askingPricePerUnit,
          receivedAt: batch.receivedAt,
          sellByDate: batch.sellByDate,
        })),
        args.requestedQuantity,
      );
    } catch {
      const before = await ctx.db.get(orderId);
      await ctx.db.patch(orderId, {
        status: "unfulfilled",
        updatedAt: Date.now(),
      });
      const after = await ctx.db.get(orderId);
      await insertBuyerOrderNotification(
        ctx,
        buyer,
        orderId,
        "Order unfulfilled",
        `We could not reserve ${args.requestedQuantity} ${unit} of ${cropType} for ${destinationMarket}.`,
      );
      await insertAuditLog(ctx, {
        actor,
        action: "buyer_order.unfulfilled",
        entityType: "buyer_order",
        entityId: orderId,
        before: before === null ? undefined : auditSnapshot(before),
        after: after === null ? undefined : auditSnapshot(after),
        metadata: { clientRequestId: args.clientRequestId },
      });
      return orderId;
    }

    const candidateById = new Map(candidates.map((batch) => [batch._id, batch]));
    const matchedInventoryBatchIds: Id<"inventoryBatches">[] = [];
    let subtotalAmount = 0;
    let hasCompletePricing = true;

    for (const allocation of allocations) {
      const batch = candidateById.get(allocation.inventoryBatchId as Id<"inventoryBatches">);
      assertAllowed(batch !== undefined, "Allocated batch was not found.");
      matchedInventoryBatchIds.push(batch._id);
      if (batch.askingPricePerUnit === undefined) {
        hasCompletePricing = false;
      } else {
        subtotalAmount += batch.askingPricePerUnit * allocation.quantityReserved;
      }

      const reservationId = await ctx.db.insert("inventoryReservations", omitUndefinedValues({
        buyerOrderId: orderId,
        inventoryBatchId: batch._id,
        warehouseId: batch.warehouseId,
        farmerId: batch.farmerId,
        quantityReserved: allocation.quantityReserved,
        quantityReleased: 0,
        quantityFulfilled: 0,
        unit: batch.unit,
        expiresAt: args.reservationExpiresAt,
        status: "active",
        createdAt: now,
        updatedAt: now,
      }));
      const reservation = await ctx.db.get(reservationId);
      await insertAuditLog(ctx, {
        actor,
        action: "inventory_reservation.created",
        entityType: "inventory_reservation",
        entityId: reservationId,
        after: reservation === null ? undefined : auditSnapshot(reservation),
      });

      const farmer = await ctx.db.get(batch.farmerId);
      await insertNotificationRecord(ctx, {
        recipientId: batch.farmerId,
        recipientUserId: farmer?.userId,
        recipientRole: "farmer",
        channel: "sms",
        title: "Produce reserved",
        message: `${allocation.quantityReserved} ${batch.unit} of your ${batch.cropType} has been reserved for a buyer order.`,
        relatedEntityType: "inventory_reservation",
        relatedEntityId: reservationId,
      });
      await recomputeBatchStatus(ctx, batch._id, actor);
    }

    const pricedSubtotal = hasCompletePricing ? subtotalAmount : undefined;
    const firstBatchId = matchedInventoryBatchIds[0];
    const firstBatch = firstBatchId === undefined ? undefined : candidateById.get(firstBatchId);
    const feeRules =
      firstBatch === undefined
        ? []
        : await listApplicableFeeRules(ctx, {
            warehouseId: firstBatch.warehouseId,
            cropType,
            unit,
            ...omitUndefinedValues({ grade: args.preferredGrade }),
            destinationMarket,
            asOf: now,
          });
    const chargeInputs = feeRules
      .filter((rule) => {
        if (rule.calculationType === "percentage_of_gross_sale") {
          return pricedSubtotal !== undefined;
        }
        if (
          rule.calculationType === "percentage_of_transport_cost" ||
          rule.calculationType === "per_unit_per_day"
        ) {
          return false;
        }
        return true;
      })
      .map((rule) => omitUndefinedValues({
        snapshot: snapshotFeeRule(rule, now),
        quantity: args.requestedQuantity,
        grossSaleAmount: pricedSubtotal,
      }));
    const charges = calculateBuyerOrderCharges(chargeInputs);

    for (const charge of charges) {
      const chargeId = await ctx.db.insert("buyerOrderCharges", {
        buyerOrderId: orderId,
        label: charge.label,
        amount: charge.amount,
        appliedRuleSnapshot: charge.appliedRuleSnapshot,
        createdAt: now,
      });
      const chargeDoc = await ctx.db.get(chargeId);
      await insertAuditLog(ctx, {
        actor,
        action: "buyer_order_charge.created",
        entityType: "buyer_order_charge",
        entityId: chargeId,
        after: chargeDoc === null ? undefined : auditSnapshot(chargeDoc),
      });
    }

    const serviceFee = charges.reduce((total, charge) => total + charge.amount, 0);
    const totalAmount = pricedSubtotal === undefined ? undefined : pricedSubtotal + serviceFee;
    const beforeOrder = await ctx.db.get(orderId);
    await ctx.db.patch(orderId, omitUndefinedValues({
      matchedInventoryBatchIds,
      subtotalAmount: pricedSubtotal,
      serviceFee: serviceFee > 0 ? serviceFee : undefined,
      totalAmount,
      status: "reserved",
      updatedAt: Date.now(),
    }));
    const afterOrder = await ctx.db.get(orderId);
    await insertBuyerOrderNotification(
      ctx,
      buyer,
      orderId,
      "Order reserved",
      `Your order for ${args.requestedQuantity} ${unit} of ${cropType} has been reserved for ${destinationMarket}.`,
    );
    await insertAuditLog(ctx, {
      actor,
      action: "buyer_order.created_and_reserved",
      entityType: "buyer_order",
      entityId: orderId,
      before: beforeOrder === null ? undefined : auditSnapshot(beforeOrder),
      after: afterOrder === null ? undefined : auditSnapshot(afterOrder),
      metadata: { clientRequestId: args.clientRequestId },
    });

    return orderId;
  },
});

export const updateStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerOrderId: v.id("buyerOrders"),
    status: buyerOrderStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("buyerOrders"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin", "Only admins can update buyer order status directly.");
    const order = await ctx.db.get(args.buyerOrderId);
    assertAllowed(order !== null, "Buyer order was not found.");
    await requireAdminPermission(ctx, args.actorUserId, "orders:manage", await buyerOrderScopeTarget(ctx, order));
    assertAllowed(
      canTransitionBuyerOrderStatus(order.status, args.status),
      "Buyer order status transition is not allowed.",
    );

    await ctx.db.patch(args.buyerOrderId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.buyerOrderId);
    if (args.status === "confirmed") {
      const buyer = await ctx.db.get(order.buyerId);
      if (buyer !== null) {
        await insertBuyerOrderNotification(
          ctx,
          buyer,
          args.buyerOrderId,
          "Order confirmed",
          `Your order for ${order.requestedQuantity} ${order.unit} of ${order.cropType} has been confirmed.`,
        );
      }
    }
    await insertAuditLog(ctx, {
      actor,
      action: "buyer_order.status_updated",
      entityType: "buyer_order",
      entityId: args.buyerOrderId,
      before: auditSnapshot(order),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.buyerOrderId;
  },
});

async function closeReservationsForOrder(
  ctx: MutationCtx,
  actor: Actor,
  order: Doc<"buyerOrders">,
  status: Extract<InventoryReservationStatus, "released" | "expired" | "cancelled">,
): Promise<void> {
  const reservations = await ctx.db
    .query("inventoryReservations")
    .withIndex("by_order", (q) => q.eq("buyerOrderId", order._id))
    .collect();

  for (const reservation of reservations) {
    if (!isActiveReservationStatus(reservation.status)) {
      continue;
    }
    assertAllowed(
      canTransitionInventoryReservationStatus(reservation.status, status),
      "Reservation status transition is not allowed.",
    );
    await ctx.db.patch(reservation._id, {
      quantityReleased:
        reservation.quantityReserved - reservation.quantityFulfilled,
      status,
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(reservation._id);
    await insertAuditLog(ctx, {
      actor,
      action: `inventory_reservation.${status}`,
      entityType: "inventory_reservation",
      entityId: reservation._id,
      before: auditSnapshot(reservation),
      after: after === null ? undefined : auditSnapshot(after),
    });
    await recomputeBatchStatus(ctx, reservation.inventoryBatchId, actor);
  }
}

export const cancel = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerOrderId: v.id("buyerOrders"),
    reason: v.optional(v.string()),
  },
  returns: v.id("buyerOrders"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const order = await ctx.db.get(args.buyerOrderId);
    assertAllowed(order !== null, "Buyer order was not found.");
    const buyer = await ctx.db.get(order.buyerId);
    assertAllowed(buyer !== null, "Buyer profile was not found.");
    if (actor.role === "buyer") {
      assertAllowed(buyer.userId === actor._id, "Buyers can only cancel their own orders.");
    } else {
      assertAllowed(actor.role === "admin", "Only buyers and admins can cancel buyer orders.");
      await requireAdminPermission(ctx, args.actorUserId, "orders:manage", await buyerOrderScopeTarget(ctx, order));
    }
    assertAllowed(
      canTransitionBuyerOrderStatus(order.status, "cancelled"),
      "Buyer order cannot be cancelled from its current status.",
    );

    await closeReservationsForOrder(ctx, actor, order, "cancelled");
    await ctx.db.patch(args.buyerOrderId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.buyerOrderId);
    await insertBuyerOrderNotification(
      ctx,
      buyer,
      args.buyerOrderId,
      "Order cancelled",
      `Your order for ${order.requestedQuantity} ${order.unit} of ${order.cropType} was cancelled.`,
    );
    await insertAuditLog(ctx, {
      actor,
      action: "buyer_order.cancelled",
      entityType: "buyer_order",
      entityId: args.buyerOrderId,
      before: auditSnapshot(order),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.buyerOrderId;
  },
});

export const releaseReservations = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerOrderId: v.id("buyerOrders"),
    reason: v.optional(v.string()),
  },
  returns: v.id("buyerOrders"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canReserveInventory(actor.role), "Actor cannot release reservations.");
    const order = await ctx.db.get(args.buyerOrderId);
    assertAllowed(order !== null, "Buyer order was not found.");
    if (actor.role === "warehouse_agent") {
      for (const inventoryBatchId of order.matchedInventoryBatchIds) {
        const batch = await ctx.db.get(inventoryBatchId);
        if (batch !== null) {
          await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, batch.warehouseId);
        }
      }
    } else {
      assertAllowed(actor.role === "admin", "Only admins and assigned warehouse agents can release reservations.");
      await requireAdminPermission(ctx, args.actorUserId, "orders:manage", await buyerOrderScopeTarget(ctx, order));
    }

    await closeReservationsForOrder(ctx, actor, order, "released");
    const nextOrderStatus: BuyerOrderStatus = "unfulfilled";
    assertAllowed(
      canTransitionBuyerOrderStatus(order.status, nextOrderStatus),
      "Buyer order cannot be marked unfulfilled from its current status.",
    );
    await ctx.db.patch(args.buyerOrderId, {
      status: nextOrderStatus,
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.buyerOrderId);
    const buyer = await ctx.db.get(order.buyerId);
    if (buyer !== null) {
      await insertBuyerOrderNotification(
        ctx,
        buyer,
        args.buyerOrderId,
        "Reservation released",
        `Your reservation for ${order.requestedQuantity} ${order.unit} of ${order.cropType} has been released.`,
      );
    }
    await insertAuditLog(ctx, {
      actor,
      action: "buyer_order.reservations_released",
      entityType: "buyer_order",
      entityId: args.buyerOrderId,
      before: auditSnapshot(order),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.buyerOrderId;
  },
});

export const expireReservations = mutation({
  args: {
    actorUserId: v.id("users"),
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin", "Only admins can expire reservations.");
    await requireAdminPermission(ctx, args.actorUserId, "orders:manage", {});
    const now = args.now ?? Date.now();
    const limit = Math.min(args.limit ?? 50, 100);
    const active = await ctx.db
      .query("inventoryReservations")
      .withIndex("by_status_expires_at", (q) => q.eq("status", "active"))
      .take(limit);
    const partiallyReleased = await ctx.db
      .query("inventoryReservations")
      .withIndex("by_status_expires_at", (q) => q.eq("status", "partially_released"))
      .take(limit);
    const expirable = [...active, ...partiallyReleased]
      .filter((reservation) => reservation.expiresAt !== undefined && reservation.expiresAt <= now)
      .slice(0, limit);
    const touchedOrders = new Set<Id<"buyerOrders">>();

    for (const reservation of expirable) {
      assertAllowed(
        canTransitionInventoryReservationStatus(reservation.status, "expired"),
        "Reservation cannot expire from its current status.",
      );
      await ctx.db.patch(reservation._id, {
        quantityReleased:
          reservation.quantityReserved - reservation.quantityFulfilled,
        status: "expired",
        updatedAt: now,
      });
      const after = await ctx.db.get(reservation._id);
      await insertAuditLog(ctx, {
        actor,
        action: "inventory_reservation.expired",
        entityType: "inventory_reservation",
        entityId: reservation._id,
        before: auditSnapshot(reservation),
        after: after === null ? undefined : auditSnapshot(after),
      });
      await recomputeBatchStatus(ctx, reservation.inventoryBatchId, actor);
      touchedOrders.add(reservation.buyerOrderId);
    }

    for (const orderId of touchedOrders) {
      const order = await ctx.db.get(orderId);
      if (order === null || !canTransitionBuyerOrderStatus(order.status, "unfulfilled")) {
        continue;
      }
      await ctx.db.patch(orderId, {
        status: "unfulfilled",
        updatedAt: now,
      });
      const buyer = await ctx.db.get(order.buyerId);
      if (buyer !== null) {
        await insertBuyerOrderNotification(
          ctx,
          buyer,
          orderId,
          "Reservation expired",
          `Your reservation for ${order.requestedQuantity} ${order.unit} of ${order.cropType} has expired.`,
        );
      }
      const after = await ctx.db.get(orderId);
      await insertAuditLog(ctx, {
        actor,
        action: "buyer_order.reservation_expired",
        entityType: "buyer_order",
        entityId: orderId,
        before: auditSnapshot(order),
        after: after === null ? undefined : auditSnapshot(after),
      });
    }

    return expirable.length;
  },
});

export const getById = query({
  args: {
    actorUserId: v.id("users"),
    buyerOrderId: v.id("buyerOrders"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const order = await ctx.db.get(args.buyerOrderId);
    if (order === null) {
      return null;
    }
    const buyer = await ctx.db.get(order.buyerId);
    if (actor.role === "buyer") {
      assertAllowed(buyer?.userId === actor._id, "Buyers can only view their own orders.");
    } else {
      assertAllowed(
        actor.role === "admin" || actor.role === "warehouse_agent",
        "Actor cannot view this order.",
      );
      if (actor.role === "admin") {
        await requireAdminPermission(ctx, args.actorUserId, "orders:read", await buyerOrderScopeTarget(ctx, order));
      }
    }

    const reservations = await ctx.db
      .query("inventoryReservations")
      .withIndex("by_order", (q) => q.eq("buyerOrderId", args.buyerOrderId))
      .collect();
    const charges = await ctx.db
      .query("buyerOrderCharges")
      .withIndex("by_order", (q) => q.eq("buyerOrderId", args.buyerOrderId))
      .collect();
    const payments = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_order", (q) => q.eq("buyerOrderId", args.buyerOrderId))
      .collect();

    return {
      ...order,
      buyer,
      reservations,
      charges,
      payments: payments.sort((left, right) => right.createdAt - left.createdAt),
    };
  },
});

export const listForBuyer = query({
  args: {
    actorUserId: v.id("users"),
    buyerId: v.id("buyers"),
    status: v.optional(buyerOrderStatus),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const buyer = await ctx.db.get(args.buyerId);
    assertAllowed(buyer !== null, "Buyer profile was not found.");
    if (actor.role === "buyer") {
      assertAllowed(buyer.userId === actor._id, "Buyers can only list their own orders.");
    } else {
      assertAllowed(actor.role === "admin", "Only buyers and admins can list buyer orders.");
      await requireAdminPermission(ctx, args.actorUserId, "orders:read", omitUndefinedValues({
        destinationMarket: buyer.destinationMarket,
      }));
    }
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.status === undefined
        ? await ctx.db
            .query("buyerOrders")
            .withIndex("by_buyer", (q) => q.eq("buyerId", args.buyerId))
            .take(limit)
        : await ctx.db
            .query("buyerOrders")
            .withIndex("by_buyer_status", (q) =>
              q.eq("buyerId", args.buyerId).eq("status", args.status!),
            )
            .take(limit);

    return candidates;
  },
});

export const listForOperations = query({
  args: {
    actorUserId: v.id("users"),
    status: v.optional(buyerOrderStatus),
    destinationMarket: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(
      actor.role === "admin" || actor.role === "warehouse_agent",
      "Only admins and warehouse agents can list operational orders.",
    );
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.destinationMarket !== undefined
        ? await ctx.db
            .query("buyerOrders")
            .withIndex("by_destination_status", (q) =>
              q.eq("destinationMarket", args.destinationMarket!.trim()),
            )
            .take(limit * 3)
        : args.status !== undefined
          ? await ctx.db
              .query("buyerOrders")
              .withIndex("by_status", (q) => q.eq("status", args.status!))
              .take(limit * 3)
          : await ctx.db.query("buyerOrders").take(limit * 3);

    const results = [];
    for (const order of candidates) {
      if (args.status !== undefined && order.status !== args.status) {
        continue;
      }
      if (args.destinationMarket !== undefined && order.destinationMarket !== args.destinationMarket.trim()) {
        continue;
      }
      if (actor.role === "admin") {
        await requireAdminPermission(ctx, args.actorUserId, "orders:read", await buyerOrderScopeTarget(ctx, order));
      }
      results.push(order);
      if (results.length >= limit) {
        break;
      }
    }
    return results;
  },
});
