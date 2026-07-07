import {
  canCreateSaleRecord,
  canTransitionBuyerOrderStatus,
  canTransitionInventoryBatchStatus,
  canTransitionInventoryReservationStatus,
  canTransitionSalePaymentStatus,
  canUpdateSalePaymentStatus,
  isActiveReservationStatus,
} from "@kuapa-dwaso/permissions";
import {
  allocateStorageFeeDeductions,
  calculateFarmerSaleDeductions,
  calculateNetAmountDueToFarmer,
  roundMoneyAmount,
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
  getActor,
  insertAuditLog,
  requireAdminPermission,
  requireWarehouseAgentAssignedToWarehouse,
  saleScopeTarget,
  warehouseScopeTarget,
  type Actor,
} from "./workflowHelpers";

const salePaymentStatus = v.union(
  v.literal("pending"),
  v.literal("part_paid"),
  v.literal("paid"),
  v.literal("withheld"),
  v.literal("disputed"),
);

const saleLineInput = v.object({
  reservationId: v.id("inventoryReservations"),
  quantitySold: v.optional(v.number()),
  pricePerUnit: v.optional(v.number()),
  adjustmentAmount: v.optional(v.number()),
  transportFeeDeducted: v.optional(v.number()),
});

type InventoryBatchStatus = Doc<"inventoryBatches">["status"];

const orderStatusesEligibleForSale = new Set<Doc<"buyerOrders">["status"]>([
  "confirmed",
  "matched_to_inventory",
  "reserved",
  "preparing",
  "ready_for_dispatch",
]);

const inventoryStatusesEligibleForSale = new Set<Doc<"inventoryBatches">["status"]>([
  "available",
  "partially_reserved",
  "reserved",
  "partially_sold",
]);

function assertPositiveNumber(value: number, label: string): void {
  assertAllowed(Number.isFinite(value) && value > 0, `${label} must be a positive number.`);
}

function assertNonNegativeNumber(value: number, label: string): void {
  assertAllowed(Number.isFinite(value) && value >= 0, `${label} must be a non-negative number.`);
}

async function getSaleQuantityForBatch(
  ctx: QueryCtx | MutationCtx,
  inventoryBatchId: Id<"inventoryBatches">,
): Promise<number> {
  const sales = await ctx.db
    .query("saleRecords")
    .withIndex("by_batch", (q) => q.eq("inventoryBatchId", inventoryBatchId))
    .collect();

  return sales.reduce((total, sale) => total + sale.quantitySold, 0);
}

async function getActiveReservationsForBatch(
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

function activeReservationOutstanding(reservation: Doc<"inventoryReservations">): number {
  return reservation.quantityReserved - reservation.quantityReleased - reservation.quantityFulfilled;
}

function nextBatchStatus(args: {
  quantityReceived: number;
  totalSoldQuantity: number;
  quantityAvailable: number;
  activeReservedQuantity: number;
}): InventoryBatchStatus {
  if (args.totalSoldQuantity >= args.quantityReceived || (args.quantityAvailable <= 0 && args.activeReservedQuantity <= 0)) {
    return "sold";
  }
  if (args.totalSoldQuantity > 0) {
    return "partially_sold";
  }
  if (args.activeReservedQuantity <= 0) {
    return "available";
  }
  return args.quantityAvailable <= 0 ? "reserved" : "partially_reserved";
}

function classifyFarmerFee(deduction: { label: string; appliedRuleSnapshot: { calculationType: string } }): "handling" | "commission" | "transport" | "other" {
  const label = deduction.label.toLowerCase();
  if (deduction.appliedRuleSnapshot.calculationType === "percentage_of_transport_cost" || label.includes("transport")) {
    return "transport";
  }
  if (deduction.appliedRuleSnapshot.calculationType === "percentage_of_gross_sale" || label.includes("commission") || label.includes("platform")) {
    return "commission";
  }
  if (label.includes("handling")) {
    return "handling";
  }
  return "handling";
}

async function assertCanOperateBatch(
  ctx: QueryCtx | MutationCtx,
  actor: Actor,
  batch: Doc<"inventoryBatches">,
): Promise<void> {
  if (actor.role === "warehouse_agent") {
    await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, batch.warehouseId);
    return;
  }
  assertAllowed(actor.role === "admin", "Only admins and assigned warehouse agents can operate sales.");
  await requireAdminPermission(ctx, actor._id, "orders:manage", await warehouseScopeTarget(ctx, batch.warehouseId));
}

async function insertFarmerSaleNotification(
  ctx: MutationCtx,
  sale: Doc<"saleRecords">,
  batch: Doc<"inventoryBatches">,
): Promise<void> {
  const farmer = await ctx.db.get(sale.farmerId);
  await insertNotificationRecord(ctx, {
    recipientId: sale.farmerId,
    recipientUserId: farmer?.userId,
    recipientRole: "farmer",
    channel: "sms",
    title: "Produce sold",
    message: `${sale.quantitySold} ${sale.unit} of your ${batch.cropType} has been sold. Gross: GHS ${sale.grossAmount}. Deductions: GHS ${roundMoneyAmount(sale.grossAmount - sale.netAmountDueToFarmer)}. Net: GHS ${sale.netAmountDueToFarmer}.`,
    relatedEntityType: "sale_record",
    relatedEntityId: sale._id,
  });
}

async function settleStorageFeesForSale(
  ctx: MutationCtx,
  actor: Actor,
  args: {
    saleRecordId: Id<"saleRecords">;
    batch: Doc<"inventoryBatches">;
    quantitySold: number;
    sellableQuantityBeforeSale: number;
  },
): Promise<number> {
  const ledgerEntries = (
    await ctx.db
      .query("storageFeeLedger")
      .withIndex("by_batch_date", (q) => q.eq("inventoryBatchId", args.batch._id))
      .collect()
  )
    .filter((entry) => entry.status === "accrued" || entry.status === "partially_deducted_from_sale")
    .sort((left, right) => left.feeDate - right.feeDate);

  const settlements = allocateStorageFeeDeductions(
    ledgerEntries.map((entry) => ({
      ledgerId: entry._id,
      amount: entry.amount,
      amountAlreadyDeducted: entry.amountDeducted,
    })),
    args.quantitySold,
    args.sellableQuantityBeforeSale,
  );
  const ledgerById = new Map(ledgerEntries.map((entry) => [entry._id, entry]));
  let storageFeeDeducted = 0;

  for (const settlement of settlements) {
    const ledger = ledgerById.get(settlement.ledgerId as Id<"storageFeeLedger">);
    if (ledger === undefined) {
      continue;
    }
    storageFeeDeducted = roundMoneyAmount(storageFeeDeducted + settlement.amountDeducted);
    await ctx.db.patch(ledger._id, {
      amountDeducted: settlement.nextAmountDeducted,
      deductedSaleRecordIds: [...(ledger.deductedSaleRecordIds ?? []), args.saleRecordId],
      status: settlement.fullySettled ? "deducted_from_sale" : "partially_deducted_from_sale",
    });
    const afterLedger = await ctx.db.get(ledger._id);
    await insertAuditLog(ctx, {
      actor,
      action: "storage_fee_ledger.deducted_from_sale",
      entityType: "storage_fee_ledger",
      entityId: ledger._id,
      before: auditSnapshot(ledger),
      after: afterLedger === null ? undefined : auditSnapshot(afterLedger),
      metadata: {
        saleRecordId: args.saleRecordId,
        amountDeducted: settlement.amountDeducted,
      },
    });

    const deductionId = await ctx.db.insert("saleDeductions", {
      saleRecordId: args.saleRecordId,
      farmerId: args.batch.farmerId,
      inventoryBatchId: args.batch._id,
      storageFeeLedgerId: ledger._id,
      label: `Storage fee (${ledger._id})`,
      amount: settlement.amountDeducted,
      appliedRuleSnapshot: ledger.appliedRuleSnapshot,
      createdAt: Date.now(),
    });
    const deduction = await ctx.db.get(deductionId);
    await insertAuditLog(ctx, {
      actor,
      action: "sale_deduction.created",
      entityType: "sale_deduction",
      entityId: deductionId,
      after: deduction === null ? undefined : auditSnapshot(deduction),
    });
  }

  return storageFeeDeducted;
}

export const createFromBuyerOrder = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerOrderId: v.id("buyerOrders"),
    lines: v.optional(v.array(saleLineInput)),
  },
  returns: v.array(v.id("saleRecords")),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canCreateSaleRecord(actor.role), "Actor cannot create sale records.");
    const order = await ctx.db.get(args.buyerOrderId);
    assertAllowed(order !== null, "Buyer order was not found.");
    assertAllowed(orderStatusesEligibleForSale.has(order.status), "Buyer order cannot be converted to sales from its current status.");

    const reservations = await ctx.db
      .query("inventoryReservations")
      .withIndex("by_order", (q) => q.eq("buyerOrderId", args.buyerOrderId))
      .collect();
    const lineByReservationId = new Map(
      (args.lines ?? []).map((line) => [line.reservationId, line]),
    );
    const selectedReservations = args.lines === undefined
      ? reservations.filter((reservation) => isActiveReservationStatus(reservation.status))
      : args.lines.map((line) => {
          const reservation = reservations.find((candidate) => candidate._id === line.reservationId);
          assertAllowed(reservation !== undefined, "Sale line reservation does not belong to the buyer order.");
          return reservation;
        });
    assertAllowed(selectedReservations.length > 0, "At least one active reservation is required to create sales.");

    const now = Date.now();
    const saleRecordIds: Id<"saleRecords">[] = [];

    for (const reservation of selectedReservations) {
      assertAllowed(isActiveReservationStatus(reservation.status), "Only active reservations can be converted to sales.");
      const batch = await ctx.db.get(reservation.inventoryBatchId);
      assertAllowed(batch !== null, "Inventory batch was not found.");
      await assertCanOperateBatch(ctx, actor, batch);
      assertAllowed(inventoryStatusesEligibleForSale.has(batch.status), "Inventory batch is not sellable.");
      assertAllowed(batch.unit === reservation.unit && batch.unit === order.unit, "Sale unit must match the reservation and order.");
      assertAllowed(batch.cropType === order.cropType, "Sale crop must match the buyer order.");

      const line = lineByReservationId.get(reservation._id);
      const outstandingReservedQuantity = activeReservationOutstanding(reservation);
      const quantitySold = line?.quantitySold ?? outstandingReservedQuantity;
      assertPositiveNumber(quantitySold, "Quantity sold");
      assertAllowed(quantitySold <= outstandingReservedQuantity, "Quantity sold cannot exceed unfulfilled reserved quantity.");
      assertAllowed(quantitySold <= batch.quantityAvailable, "Quantity sold cannot exceed available batch quantity.");
      const pricePerUnit = line?.pricePerUnit ?? batch.askingPricePerUnit ?? order.maxPricePerUnit;
      assertAllowed(pricePerUnit !== undefined, "A sale price is required when batch pricing is missing.");
      assertPositiveNumber(pricePerUnit, "Price per unit");
      if (line?.adjustmentAmount !== undefined) {
        assertAllowed(Number.isFinite(line.adjustmentAmount), "Adjustment amount must be finite.");
      }
      if (line?.transportFeeDeducted !== undefined) {
        assertNonNegativeNumber(line.transportFeeDeducted, "Transport fee deducted");
      }

      const grossAmount = roundMoneyAmount(quantitySold * pricePerUnit);
      const saleRecordId = await ctx.db.insert("saleRecords", {
        buyerOrderId: order._id,
        inventoryBatchId: batch._id,
        farmerId: batch.farmerId,
        warehouseId: batch.warehouseId,
        quantitySold,
        unit: batch.unit,
        pricePerUnit,
        grossAmount,
        storageFeeDeducted: 0,
        transportFeeDeducted: line?.transportFeeDeducted,
        adjustmentAmount: line?.adjustmentAmount,
        netAmountDueToFarmer: grossAmount,
        paymentStatus: "pending",
        createdAt: now,
        updatedAt: now,
      });

      const storageFeeDeducted = await settleStorageFeesForSale(ctx, actor, {
        saleRecordId,
        batch,
        quantitySold,
        sellableQuantityBeforeSale: batch.quantityAvailable,
      });

      const feeRules = await listApplicableFeeRules(ctx, {
        warehouseId: batch.warehouseId,
        cropType: batch.cropType,
        unit: batch.unit,
        grade: batch.grade,
        destinationMarket: order.destinationMarket,
        asOf: now,
      });
      const farmerDeductions = calculateFarmerSaleDeductions(
        feeRules.map((rule) => ({
          snapshot: snapshotFeeRule(rule, now),
          quantity: quantitySold,
          grossSaleAmount: grossAmount,
          transportCost: line?.transportFeeDeducted,
        })),
      );
      let handlingFeeDeducted = 0;
      let commissionDeducted = 0;
      let transportFeeDeducted = line?.transportFeeDeducted ?? 0;

      for (const deduction of farmerDeductions) {
        const classification = classifyFarmerFee(deduction);
        if (classification === "commission") {
          commissionDeducted = roundMoneyAmount(commissionDeducted + deduction.amount);
        } else if (classification === "transport") {
          transportFeeDeducted = roundMoneyAmount(transportFeeDeducted + deduction.amount);
        } else {
          handlingFeeDeducted = roundMoneyAmount(handlingFeeDeducted + deduction.amount);
        }

        const deductionId = await ctx.db.insert("saleDeductions", {
          saleRecordId,
          farmerId: batch.farmerId,
          inventoryBatchId: batch._id,
          label: deduction.label,
          amount: deduction.amount,
          appliedRuleSnapshot: deduction.appliedRuleSnapshot,
          createdAt: now,
        });
        const deductionDoc = await ctx.db.get(deductionId);
        await insertAuditLog(ctx, {
          actor,
          action: "sale_deduction.created",
          entityType: "sale_deduction",
          entityId: deductionId,
          after: deductionDoc === null ? undefined : auditSnapshot(deductionDoc),
        });
      }

      const netAmountDueToFarmer = calculateNetAmountDueToFarmer({
        grossAmount,
        storageFeeDeducted,
        handlingFeeDeducted,
        commissionDeducted,
        transportFeeDeducted,
        adjustmentAmount: line?.adjustmentAmount,
      });
      const beforeSale = await ctx.db.get(saleRecordId);
      await ctx.db.patch(saleRecordId, {
        storageFeeDeducted,
        handlingFeeDeducted: handlingFeeDeducted > 0 ? handlingFeeDeducted : undefined,
        commissionDeducted: commissionDeducted > 0 ? commissionDeducted : undefined,
        transportFeeDeducted: transportFeeDeducted > 0 ? transportFeeDeducted : undefined,
        netAmountDueToFarmer,
        updatedAt: Date.now(),
      });
      const afterSale = await ctx.db.get(saleRecordId);
      await insertAuditLog(ctx, {
        actor,
        action: "sale_record.created",
        entityType: "sale_record",
        entityId: saleRecordId,
        before: beforeSale === null ? undefined : auditSnapshot(beforeSale),
        after: afterSale === null ? undefined : auditSnapshot(afterSale),
      });

      const nextReservationStatus = quantitySold === outstandingReservedQuantity ? "fulfilled" : reservation.status;
      const nextQuantityFulfilled = reservation.quantityFulfilled + quantitySold;
      if (nextReservationStatus === "fulfilled") {
        assertAllowed(
          canTransitionInventoryReservationStatus(reservation.status, "fulfilled"),
          "Reservation cannot be fulfilled from its current status.",
        );
      }
      await ctx.db.patch(reservation._id, {
        quantityFulfilled: nextQuantityFulfilled,
        status: nextReservationStatus,
        updatedAt: Date.now(),
      });
      const afterReservation = await ctx.db.get(reservation._id);
      await insertAuditLog(ctx, {
        actor,
        action: nextReservationStatus === "fulfilled" ? "inventory_reservation.fulfilled" : "inventory_reservation.partially_fulfilled",
        entityType: "inventory_reservation",
        entityId: reservation._id,
        before: auditSnapshot(reservation),
        after: afterReservation === null ? undefined : auditSnapshot(afterReservation),
        metadata: { saleRecordId },
      });

      const activeReservations = await getActiveReservationsForBatch(ctx, batch._id);
      const activeReservedQuantityAfter = activeReservations.reduce(
        (total, activeReservation) => total + activeReservationOutstanding(activeReservation),
        0,
      );
      const totalSoldQuantity = (await getSaleQuantityForBatch(ctx, batch._id));
      const nextQuantityAvailable = roundMoneyAmount(Math.max(0, batch.quantityAvailable - quantitySold), 6);
      const status = nextBatchStatus({
        quantityReceived: batch.quantityReceived,
        totalSoldQuantity,
        quantityAvailable: nextQuantityAvailable,
        activeReservedQuantity: activeReservedQuantityAfter,
      });
      assertAllowed(
        batch.status === status || canTransitionInventoryBatchStatus(batch.status, status),
        "Inventory batch status transition is not allowed.",
      );
      await ctx.db.patch(batch._id, {
        quantityAvailable: nextQuantityAvailable,
        storageFeeAccrued: roundMoneyAmount(Math.max(0, batch.storageFeeAccrued - storageFeeDeducted)),
        status,
        updatedAt: Date.now(),
      });
      const afterBatch = await ctx.db.get(batch._id);
      await insertAuditLog(ctx, {
        actor,
        action: "inventory_batch.sale_quantity_applied",
        entityType: "inventory_batch",
        entityId: batch._id,
        before: auditSnapshot(batch),
        after: afterBatch === null ? undefined : auditSnapshot(afterBatch),
        metadata: { saleRecordId },
      });

      if (afterSale !== null) {
        await insertFarmerSaleNotification(ctx, afterSale, batch);
      }
      saleRecordIds.push(saleRecordId);
    }

    if (order.status !== "preparing" && canTransitionBuyerOrderStatus(order.status, "preparing")) {
      await ctx.db.patch(order._id, {
        status: "preparing",
        updatedAt: Date.now(),
      });
      const buyer = await ctx.db.get(order.buyerId);
      if (buyer !== null) {
        await insertNotificationRecord(ctx, {
          recipientId: buyer._id,
          recipientUserId: buyer.userId,
          recipientRole: "buyer",
          channel: "sms",
          title: "Order preparing",
          message: `Your order for ${order.requestedQuantity} ${order.unit} of ${order.cropType} is being prepared.`,
          relatedEntityType: "buyer_order",
          relatedEntityId: order._id,
        });
      }
      const afterOrder = await ctx.db.get(order._id);
      await insertAuditLog(ctx, {
        actor,
        action: "buyer_order.preparing_after_sale",
        entityType: "buyer_order",
        entityId: order._id,
        before: auditSnapshot(order),
        after: afterOrder === null ? undefined : auditSnapshot(afterOrder),
        metadata: { saleRecordIds },
      });
    }

    return saleRecordIds;
  },
});

export const updatePaymentStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    saleRecordId: v.id("saleRecords"),
    paymentStatus: salePaymentStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("saleRecords"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canUpdateSalePaymentStatus(actor.role), "Actor cannot update sale payment status.");
    const sale = await ctx.db.get(args.saleRecordId);
    assertAllowed(sale !== null, "Sale record was not found.");
    await requireAdminPermission(ctx, args.actorUserId, "sales:managePaymentStatus", await saleScopeTarget(ctx, sale));
    assertAllowed(
      canTransitionSalePaymentStatus(sale.paymentStatus, args.paymentStatus),
      "Sale payment status transition is not allowed.",
    );

    await ctx.db.patch(args.saleRecordId, {
      paymentStatus: args.paymentStatus,
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.saleRecordId);
    await insertAuditLog(ctx, {
      actor,
      action: "sale_record.payment_status_updated",
      entityType: "sale_record",
      entityId: args.saleRecordId,
      before: auditSnapshot(sale),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    const farmer = await ctx.db.get(sale.farmerId);
    await insertNotificationRecord(ctx, {
      recipientId: sale.farmerId,
      recipientUserId: farmer?.userId,
      recipientRole: "farmer",
      channel: "sms",
      title: "Sale payment updated",
      message: `Payment for your sale of ${sale.quantitySold} ${sale.unit} is now ${args.paymentStatus}. Net amount: GHS ${sale.netAmountDueToFarmer}.`,
      relatedEntityType: "sale_record",
      relatedEntityId: args.saleRecordId,
    });

    return args.saleRecordId;
  },
});

async function saleDetail(ctx: QueryCtx, sale: Doc<"saleRecords">) {
  const [batch, farmer, warehouse, order, deductions] = await Promise.all([
    ctx.db.get(sale.inventoryBatchId),
    ctx.db.get(sale.farmerId),
    ctx.db.get(sale.warehouseId),
    ctx.db.get(sale.buyerOrderId),
    ctx.db
      .query("saleDeductions")
      .withIndex("by_sale", (q) => q.eq("saleRecordId", sale._id))
      .collect(),
  ]);
  return { ...sale, batch, farmer, warehouse, order, deductions };
}

export const getById = query({
  args: {
    actorUserId: v.id("users"),
    saleRecordId: v.id("saleRecords"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const sale = await ctx.db.get(args.saleRecordId);
    if (sale === null) {
      return null;
    }
    if (actor.role === "farmer") {
      const farmer = await ctx.db.get(sale.farmerId);
      assertAllowed(farmer !== null && farmer.userId === actor._id, "Farmers can only view their own sales.");
    } else if (actor.role === "warehouse_agent") {
      await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, sale.warehouseId);
    } else {
      assertAllowed(actor.role === "admin", "Actor cannot view this sale.");
      await requireAdminPermission(ctx, args.actorUserId, "sales:read", await saleScopeTarget(ctx, sale));
    }

    return await saleDetail(ctx, sale);
  },
});

export const listForFarmer = query({
  args: {
    actorUserId: v.id("users"),
    farmerId: v.id("farmers"),
    paymentStatus: v.optional(salePaymentStatus),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const farmer = await ctx.db.get(args.farmerId);
    assertAllowed(farmer !== null, "Farmer was not found.");
    if (actor.role === "farmer") {
      assertAllowed(farmer.userId === actor._id, "Farmers can only view their own sales.");
    } else {
      assertAllowed(actor.role === "admin" || actor.role === "warehouse_agent", "Actor cannot list farmer sales.");
      if (actor.role === "admin") {
        await requireAdminPermission(ctx, args.actorUserId, "sales:read", {
          warehouseId: farmer.preferredWarehouseId,
          region: farmer.region,
          district: farmer.community,
        });
      }
    }

    const limit = Math.min(args.limit ?? 50, 100);
    const sales =
      args.paymentStatus === undefined
        ? await ctx.db.query("saleRecords").withIndex("by_farmer_payment_status", (q) => q.eq("farmerId", args.farmerId)).take(limit)
        : await ctx.db.query("saleRecords").withIndex("by_farmer_payment_status", (q) => q.eq("farmerId", args.farmerId).eq("paymentStatus", args.paymentStatus!)).take(limit);

    return await Promise.all(sales.map((sale) => saleDetail(ctx, sale)));
  },
});

export const listForOperations = query({
  args: {
    actorUserId: v.id("users"),
    warehouseId: v.optional(v.id("warehouses")),
    farmerId: v.optional(v.id("farmers")),
    buyerOrderId: v.optional(v.id("buyerOrders")),
    paymentStatus: v.optional(salePaymentStatus),
    cropType: v.optional(v.string()),
    createdAtFrom: v.optional(v.number()),
    createdAtTo: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin" || actor.role === "warehouse_agent", "Only admins and warehouse agents can list operational sales.");
    if (actor.role === "warehouse_agent" && args.warehouseId !== undefined) {
      await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, args.warehouseId);
    } else if (actor.role === "admin" && args.warehouseId !== undefined) {
      await requireAdminPermission(
        ctx,
        args.actorUserId,
        "sales:read",
        await warehouseScopeTarget(ctx, args.warehouseId),
      );
    }

    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.warehouseId !== undefined && args.paymentStatus !== undefined
        ? await ctx.db.query("saleRecords").withIndex("by_warehouse_payment_status", (q) => q.eq("warehouseId", args.warehouseId!).eq("paymentStatus", args.paymentStatus!)).take(limit * 4)
        : args.farmerId !== undefined && args.paymentStatus !== undefined
          ? await ctx.db.query("saleRecords").withIndex("by_farmer_payment_status", (q) => q.eq("farmerId", args.farmerId!).eq("paymentStatus", args.paymentStatus!)).take(limit * 4)
          : args.buyerOrderId !== undefined
            ? await ctx.db.query("saleRecords").withIndex("by_order", (q) => q.eq("buyerOrderId", args.buyerOrderId!)).take(limit * 4)
            : args.paymentStatus !== undefined
              ? await ctx.db.query("saleRecords").withIndex("by_payment_status", (q) => q.eq("paymentStatus", args.paymentStatus!)).take(limit * 4)
              : await ctx.db.query("saleRecords").take(limit * 4);

    const filtered = [];
    for (const sale of candidates) {
      if (args.warehouseId !== undefined && sale.warehouseId !== args.warehouseId) {
        continue;
      }
      if (args.farmerId !== undefined && sale.farmerId !== args.farmerId) {
        continue;
      }
      if (args.paymentStatus !== undefined && sale.paymentStatus !== args.paymentStatus) {
        continue;
      }
      if (args.createdAtFrom !== undefined && sale.createdAt < args.createdAtFrom) {
        continue;
      }
      if (args.createdAtTo !== undefined && sale.createdAt > args.createdAtTo) {
        continue;
      }
      const batch = await ctx.db.get(sale.inventoryBatchId);
      if (args.cropType !== undefined && batch?.cropType !== args.cropType.trim()) {
        continue;
      }
      if (actor.role === "warehouse_agent") {
        await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, sale.warehouseId);
      } else if (actor.role === "admin") {
        await requireAdminPermission(ctx, args.actorUserId, "sales:read", await saleScopeTarget(ctx, sale));
      }
      filtered.push(await saleDetail(ctx, sale));
      if (filtered.length >= limit) {
        break;
      }
    }

    return filtered;
  },
});
