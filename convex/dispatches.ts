import {
  canAssignDispatchTransporter,
  canCreateDispatch,
  canTransitionBuyerOrderStatus,
  canTransitionDispatchStatus,
  canUpdateDispatchStatus,
} from "@kuapa-dwaso/permissions";
import { calculateDispatchQuantityAggregation } from "@kuapa-dwaso/utils";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { insertNotificationRecord } from "./notifications";
import {
  adminScopeTarget,
  assertAllowed,
  auditSnapshot,
  cleanOptionalText,
  dispatchScopeTarget,
  getActor,
  insertAuditLog,
  omitUndefinedValues,
  requireAdminPermission,
  requireWarehouseAgentAssignedToWarehouse,
  type Actor,
  warehouseScopeTarget,
} from "./workflowHelpers";

const dispatchStatus = v.union(
  v.literal("planned"),
  v.literal("loading"),
  v.literal("departed"),
  v.literal("in_transit"),
  v.literal("arrived"),
  v.literal("delivered"),
  v.literal("closed"),
  v.literal("cancelled"),
  v.literal("issue_reported"),
);

const feePayer = v.union(
  v.literal("farmer"),
  v.literal("buyer"),
  v.literal("platform"),
  v.literal("shared"),
  v.literal("included_in_price"),
);

type DispatchStatus = Doc<"dispatches">["status"];
type BuyerOrderStatus = Doc<"buyerOrders">["status"];

const orderStatusesEligibleForDispatch = new Set<BuyerOrderStatus>([
  "preparing",
  "ready_for_dispatch",
]);

const statusesThatNotify = new Set<DispatchStatus>([
  "planned",
  "loading",
  "departed",
  "in_transit",
  "arrived",
  "delivered",
  "cancelled",
  "issue_reported",
]);

function cleanText(value: string, label: string): string {
  const cleaned = value.trim();
  assertAllowed(cleaned.length > 0, `${label} is required.`);
  return cleaned;
}

function assertNonNegativeNumber(value: number | undefined, label: string): void {
  if (value !== undefined) {
    assertAllowed(Number.isFinite(value) && value >= 0, `${label} must be a non-negative number.`);
  }
}

function uniqueIds<T extends string>(ids: T[]): T[] {
  return [...new Set(ids)];
}

async function assertCanOperateWarehouse(
  ctx: QueryCtx | MutationCtx,
  actor: Actor,
  warehouseId: Id<"warehouses">,
): Promise<void> {
  if (actor.role === "warehouse_agent") {
    await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, warehouseId);
    return;
  }
  assertAllowed(actor.role === "admin", "Only admins and assigned warehouse agents can operate dispatches.");
  await requireAdminPermission(ctx, actor._id, "dispatches:manage", await warehouseScopeTarget(ctx, warehouseId));
}

async function getSalesForOrder(
  ctx: QueryCtx | MutationCtx,
  buyerOrderId: Id<"buyerOrders">,
): Promise<Doc<"saleRecords">[]> {
  return await ctx.db
    .query("saleRecords")
    .withIndex("by_order", (q) => q.eq("buyerOrderId", buyerOrderId))
    .collect();
}

async function getReservationsForOrder(
  ctx: QueryCtx | MutationCtx,
  buyerOrderId: Id<"buyerOrders">,
): Promise<Doc<"inventoryReservations">[]> {
  return await ctx.db
    .query("inventoryReservations")
    .withIndex("by_order", (q) => q.eq("buyerOrderId", buyerOrderId))
    .collect();
}

async function maybeAdvanceOrderStatus(
  ctx: MutationCtx,
  actor: Actor,
  order: Doc<"buyerOrders">,
  nextStatus: BuyerOrderStatus,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (order.status === nextStatus) {
    return;
  }
  if (!canTransitionBuyerOrderStatus(order.status, nextStatus)) {
    return;
  }

  await ctx.db.patch(order._id, {
    status: nextStatus,
    updatedAt: Date.now(),
  });
  const after = await ctx.db.get(order._id);
  await insertAuditLog(ctx, {
    actor,
    action: "buyer_order.status_updated_from_dispatch",
    entityType: "buyer_order",
    entityId: order._id,
    before: auditSnapshot(order),
    after: after === null ? undefined : auditSnapshot(after),
    metadata,
  });
}

function orderStatusForDispatchStatus(status: DispatchStatus): BuyerOrderStatus | undefined {
  switch (status) {
    case "planned":
    case "loading":
      return "ready_for_dispatch";
    case "departed":
    case "in_transit":
    case "arrived":
      return "in_transit";
    case "delivered":
      return "delivered";
    case "closed":
      return "completed";
    case "cancelled":
    case "issue_reported":
      return undefined;
  }
}

async function notifyDispatchParticipants(
  ctx: MutationCtx,
  dispatch: Doc<"dispatches">,
  status: DispatchStatus,
): Promise<void> {
  if (!statusesThatNotify.has(status)) {
    return;
  }

  const title = `Dispatch ${status.replaceAll("_", " ")}`;
  const message = `Dispatch to ${dispatch.destination} is now ${status.replaceAll("_", " ")}.`;
  const related = {
    relatedEntityType: "dispatch",
    relatedEntityId: dispatch._id,
  };

  await insertNotificationRecord(ctx, {
    recipientRole: "admin",
    channel: "in_app",
    title,
    message,
    ...related,
  });

  if (dispatch.transporterId !== undefined) {
    const transporter = await ctx.db.get(dispatch.transporterId);
    await insertNotificationRecord(ctx, {
      recipientId: dispatch.transporterId,
      recipientUserId: transporter?.userId,
      recipientRole: "transporter",
      channel: "sms",
      title,
      message,
      ...related,
    });
  }

  const notifiedBuyers = new Set<string>();
  for (const buyerOrderId of dispatch.buyerOrderIds) {
    const order = await ctx.db.get(buyerOrderId);
    if (order === null || notifiedBuyers.has(order.buyerId)) {
      continue;
    }
    notifiedBuyers.add(order.buyerId);
    const buyer = await ctx.db.get(order.buyerId);
    await insertNotificationRecord(ctx, {
      recipientId: order.buyerId,
      recipientUserId: buyer?.userId,
      recipientRole: "buyer",
      channel: "sms",
      title,
      message: `Your order dispatch to ${dispatch.destination} is now ${status.replaceAll("_", " ")}.`,
      ...related,
    });
  }

  const notifiedFarmers = new Set<string>();
  const sales =
    dispatch.saleRecordIds === undefined
      ? []
      : await Promise.all(dispatch.saleRecordIds.map((saleRecordId) => ctx.db.get(saleRecordId)));
  for (const sale of sales) {
    if (sale === null || notifiedFarmers.has(sale.farmerId)) {
      continue;
    }
    notifiedFarmers.add(sale.farmerId);
    const farmer = await ctx.db.get(sale.farmerId);
    await insertNotificationRecord(ctx, {
      recipientId: sale.farmerId,
      recipientUserId: farmer?.userId,
      recipientRole: "farmer",
      channel: "sms",
      title,
      message: `Produce from your sale is now ${status.replaceAll("_", " ")} for dispatch to ${dispatch.destination}.`,
      ...related,
    });
  }
}

async function dispatchDetail(ctx: QueryCtx, dispatch: Doc<"dispatches">) {
  const [warehouse, transporter] = await Promise.all([
    ctx.db.get(dispatch.warehouseId),
    dispatch.transporterId === undefined ? null : ctx.db.get(dispatch.transporterId),
  ]);
  const [orders, batches, sales, reservations] = await Promise.all([
    Promise.all(dispatch.buyerOrderIds.map((id) => ctx.db.get(id))),
    Promise.all(dispatch.inventoryBatchIds.map((id) => ctx.db.get(id))),
    Promise.all((dispatch.saleRecordIds ?? []).map((id) => ctx.db.get(id))),
    Promise.all((dispatch.reservationIds ?? []).map((id) => ctx.db.get(id))),
  ]);

  return {
    ...dispatch,
    warehouse,
    transporter,
    buyerOrders: orders.filter((order) => order !== null),
    inventoryBatches: batches.filter((batch) => batch !== null),
    saleRecords: sales.filter((sale) => sale !== null),
    reservations: reservations.filter((reservation) => reservation !== null),
  };
}

export const create = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerOrderIds: v.array(v.id("buyerOrders")),
    destination: v.optional(v.string()),
    transporterId: v.optional(v.id("transporterProfiles")),
    driverName: v.optional(v.string()),
    driverPhoneNumber: v.optional(v.string()),
    vehicleType: v.optional(v.string()),
    vehicleCapacity: v.optional(v.number()),
    vehicleCapacityUnit: v.optional(v.string()),
    plannedDepartureAt: v.optional(v.number()),
    expectedArrivalAt: v.optional(v.number()),
    transportCost: v.optional(v.number()),
    transportPayer: feePayer,
    clientRequestId: v.optional(v.string()),
  },
  returns: v.id("dispatches"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canCreateDispatch(actor.role), "Actor cannot create dispatches.");
    assertAllowed(args.buyerOrderIds.length > 0, "At least one buyer order is required.");
    assertNonNegativeNumber(args.transportCost, "Transport cost");
    assertNonNegativeNumber(args.vehicleCapacity, "Vehicle capacity");
    if (args.plannedDepartureAt !== undefined) {
      assertAllowed(Number.isFinite(args.plannedDepartureAt), "Planned departure must be a timestamp.");
    }
    if (args.expectedArrivalAt !== undefined) {
      assertAllowed(Number.isFinite(args.expectedArrivalAt), "Expected arrival must be a timestamp.");
    }

    const buyerOrderIds = uniqueIds(args.buyerOrderIds);
    const orders = await Promise.all(buyerOrderIds.map((buyerOrderId) => ctx.db.get(buyerOrderId)));
    assertAllowed(orders.every((order) => order !== null), "Every buyer order must exist.");
    const nonNullOrders = orders.filter((order): order is Doc<"buyerOrders"> => order !== null);
    const destination = cleanText(args.destination ?? nonNullOrders[0]!.destinationMarket, "Destination");
    const saleRecords = (await Promise.all(nonNullOrders.map((order) => getSalesForOrder(ctx, order._id)))).flat();
    assertAllowed(saleRecords.length > 0, "Dispatches require completed sale records.");
    const reservationRecords = (
      await Promise.all(nonNullOrders.map((order) => getReservationsForOrder(ctx, order._id)))
    ).flat();

    for (const order of nonNullOrders) {
      assertAllowed(
        orderStatusesEligibleForDispatch.has(order.status),
        "Buyer order is not ready for dispatch.",
      );
      assertAllowed(order.destinationMarket === destination, "All buyer orders must share the dispatch destination.");
    }

    const aggregation = calculateDispatchQuantityAggregation(
      saleRecords.map((sale) => ({
        warehouseId: sale.warehouseId,
        destination,
        quantity: sale.quantitySold,
        unit: sale.unit,
      })),
    );
    const warehouseId = aggregation.warehouseId as Id<"warehouses">;
    await assertCanOperateWarehouse(ctx, actor, warehouseId);
    const inventoryBatchIds = uniqueIds(saleRecords.map((sale) => sale.inventoryBatchId));
    const saleRecordIds = uniqueIds(saleRecords.map((sale) => sale._id));
    const reservationIds = uniqueIds(reservationRecords.map((reservation) => reservation._id));

    let transporter: Doc<"transporterProfiles"> | null = null;
    if (args.transporterId !== undefined) {
      transporter = await ctx.db.get(args.transporterId);
      assertAllowed(transporter !== null, "Transporter profile was not found.");
      assertAllowed(transporter.status === "active", "Transporter profile must be active.");
      assertAllowed(transporter.verificationStatus === "verified", "Transporter profile must be verified.");
      assertAllowed(
        transporter.destinationsServed.some(
          (servedDestination) => servedDestination.toLowerCase() === destination.toLowerCase(),
        ) ||
          transporter.routesServed.some((route) => route.toLowerCase().includes(destination.toLowerCase())),
        "Transporter does not serve this destination.",
      );
    }

    const now = Date.now();
    // Financial settlement extension point: dispatch records transport cost and
    // payer now, but later slices should decide whether/how to post buyer
    // charges or farmer deductions without rewriting existing sale records here.
    const dispatchId = await ctx.db.insert("dispatches", omitUndefinedValues({
      warehouseId,
      destination,
      transporterId: args.transporterId,
      driverName: cleanOptionalText(args.driverName) ?? transporter?.fullName,
      driverPhoneNumber: cleanOptionalText(args.driverPhoneNumber) ?? transporter?.phoneNumber,
      vehicleType: cleanOptionalText(args.vehicleType) ?? transporter?.vehicleType,
      vehicleCapacity: args.vehicleCapacity ?? transporter?.vehicleCapacity,
      vehicleCapacityUnit: cleanOptionalText(args.vehicleCapacityUnit) ?? transporter?.vehicleCapacityUnit,
      buyerOrderIds,
      inventoryBatchIds,
      saleRecordIds,
      reservationIds,
      totalQuantity: aggregation.totalQuantity,
      unit: aggregation.unit,
      plannedDepartureAt: args.plannedDepartureAt,
      expectedArrivalAt: args.expectedArrivalAt,
      transportCost: args.transportCost,
      transportPayer: args.transportPayer,
      status: "planned",
      createdAt: now,
      updatedAt: now,
    }));
    const after = await ctx.db.get(dispatchId);
    await insertAuditLog(ctx, {
      actor,
      action: "dispatch.created",
      entityType: "dispatch",
      entityId: dispatchId,
      after: after === null ? undefined : auditSnapshot(after),
      metadata: { clientRequestId: args.clientRequestId },
    });

    for (const order of nonNullOrders) {
      await maybeAdvanceOrderStatus(ctx, actor, order, "ready_for_dispatch", { dispatchId });
    }
    if (after !== null) {
      await notifyDispatchParticipants(ctx, after, "planned");
    }

    return dispatchId;
  },
});

export const updateStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    dispatchId: v.id("dispatches"),
    status: dispatchStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("dispatches"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canUpdateDispatchStatus(actor.role), "Actor cannot update dispatch status.");
    const dispatch = await ctx.db.get(args.dispatchId);
    assertAllowed(dispatch !== null, "Dispatch was not found.");
    if (actor.role === "transporter") {
      const transporter = await ctx.db
        .query("transporterProfiles")
        .withIndex("by_user", (q) => q.eq("userId", actor._id))
        .unique();
      assertAllowed(
        transporter !== null && dispatch.transporterId === transporter._id,
        "Transporters can only update their assigned dispatches.",
      );
    } else {
      await assertCanOperateWarehouse(ctx, actor, dispatch.warehouseId);
    }
    assertAllowed(
      canTransitionDispatchStatus(dispatch.status, args.status),
      "Dispatch status transition is not allowed.",
    );

    const patch: {
      status: DispatchStatus;
      updatedAt: number;
      departedAt?: number;
      arrivedAt?: number;
    } = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.status === "departed" || args.status === "in_transit") {
      patch.departedAt = dispatch.departedAt ?? Date.now();
    }
    if (args.status === "arrived" || args.status === "delivered" || args.status === "closed") {
      patch.arrivedAt = dispatch.arrivedAt ?? Date.now();
    }

    await ctx.db.patch(args.dispatchId, patch);
    const after = await ctx.db.get(args.dispatchId);
    await insertAuditLog(ctx, {
      actor,
      action: "dispatch.status_updated",
      entityType: "dispatch",
      entityId: args.dispatchId,
      before: auditSnapshot(dispatch),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    const nextOrderStatus = orderStatusForDispatchStatus(args.status);
    if (nextOrderStatus !== undefined) {
      for (const buyerOrderId of dispatch.buyerOrderIds) {
        const order = await ctx.db.get(buyerOrderId);
        if (order !== null) {
          await maybeAdvanceOrderStatus(ctx, actor, order, nextOrderStatus, {
            dispatchId: args.dispatchId,
            dispatchStatus: args.status,
          });
        }
      }
    }
    if (after !== null) {
      await notifyDispatchParticipants(ctx, after, args.status);
    }

    return args.dispatchId;
  },
});

export const assignTransporter = mutation({
  args: {
    actorUserId: v.id("users"),
    dispatchId: v.id("dispatches"),
    transporterId: v.id("transporterProfiles"),
    driverName: v.optional(v.string()),
    driverPhoneNumber: v.optional(v.string()),
    vehicleType: v.optional(v.string()),
    vehicleCapacity: v.optional(v.number()),
    vehicleCapacityUnit: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  returns: v.id("dispatches"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canAssignDispatchTransporter(actor.role), "Actor cannot assign dispatch transporters.");
    const dispatch = await ctx.db.get(args.dispatchId);
    assertAllowed(dispatch !== null, "Dispatch was not found.");
    await assertCanOperateWarehouse(ctx, actor, dispatch.warehouseId);
    assertAllowed(
      dispatch.status === "planned" || dispatch.status === "loading" || dispatch.status === "issue_reported",
      "Transporter can only be assigned before departure or while resolving an issue.",
    );
    const transporter = await ctx.db.get(args.transporterId);
    assertAllowed(transporter !== null, "Transporter profile was not found.");
    assertAllowed(transporter.status === "active", "Transporter profile must be active.");
    assertAllowed(transporter.verificationStatus === "verified", "Transporter profile must be verified.");
    assertAllowed(
      transporter.destinationsServed.some(
        (destination) => destination.toLowerCase() === dispatch.destination.toLowerCase(),
      ) ||
        transporter.routesServed.some((route) => route.toLowerCase().includes(dispatch.destination.toLowerCase())),
      "Transporter does not serve this destination.",
    );
    assertNonNegativeNumber(args.vehicleCapacity, "Vehicle capacity");

    await ctx.db.patch(args.dispatchId, {
      transporterId: args.transporterId,
      driverName: cleanOptionalText(args.driverName) ?? transporter.fullName,
      driverPhoneNumber: cleanOptionalText(args.driverPhoneNumber) ?? transporter.phoneNumber,
      vehicleType: cleanOptionalText(args.vehicleType) ?? transporter.vehicleType,
      vehicleCapacity: args.vehicleCapacity ?? transporter.vehicleCapacity,
      vehicleCapacityUnit: cleanOptionalText(args.vehicleCapacityUnit) ?? transporter.vehicleCapacityUnit,
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.dispatchId);
    await insertAuditLog(ctx, {
      actor,
      action: "dispatch.transporter_assigned",
      entityType: "dispatch",
      entityId: args.dispatchId,
      before: auditSnapshot(dispatch),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });
    if (after !== null) {
      await insertNotificationRecord(ctx, {
        recipientId: args.transporterId,
        recipientUserId: transporter.userId,
        recipientRole: "transporter",
        channel: "sms",
        title: "Dispatch assigned",
        message: `You have been assigned to a dispatch to ${dispatch.destination}.`,
        relatedEntityType: "dispatch",
        relatedEntityId: args.dispatchId,
      });
    }

    return args.dispatchId;
  },
});

export const unassignTransporter = mutation({
  args: {
    actorUserId: v.id("users"),
    dispatchId: v.id("dispatches"),
    reason: v.optional(v.string()),
  },
  returns: v.id("dispatches"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canAssignDispatchTransporter(actor.role), "Actor cannot unassign dispatch transporters.");
    const dispatch = await ctx.db.get(args.dispatchId);
    assertAllowed(dispatch !== null, "Dispatch was not found.");
    await assertCanOperateWarehouse(ctx, actor, dispatch.warehouseId);
    assertAllowed(
      dispatch.status === "planned" || dispatch.status === "loading" || dispatch.status === "issue_reported",
      "Transporter can only be unassigned before departure or while resolving an issue.",
    );

    await ctx.db.patch(args.dispatchId, {
      transporterId: undefined,
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.dispatchId);
    await insertAuditLog(ctx, {
      actor,
      action: "dispatch.transporter_unassigned",
      entityType: "dispatch",
      entityId: args.dispatchId,
      before: auditSnapshot(dispatch),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.dispatchId;
  },
});

export const getById = query({
  args: {
    actorUserId: v.id("users"),
    dispatchId: v.id("dispatches"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const dispatch = await ctx.db.get(args.dispatchId);
    if (dispatch === null) {
      return null;
    }
    if (actor.role === "warehouse_agent") {
      await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, dispatch.warehouseId);
    } else if (actor.role === "transporter") {
      const transporter = await ctx.db
        .query("transporterProfiles")
        .withIndex("by_user", (q) => q.eq("userId", actor._id))
        .unique();
      assertAllowed(
        transporter !== null && dispatch.transporterId === transporter._id,
        "Transporters can only view assigned dispatches.",
      );
    } else {
      assertAllowed(actor.role === "admin", "Actor cannot view dispatch details.");
      await requireAdminPermission(ctx, args.actorUserId, "dispatches:read", await dispatchScopeTarget(ctx, dispatch));
    }

    return await dispatchDetail(ctx, dispatch);
  },
});

export const listForOperations = query({
  args: {
    actorUserId: v.id("users"),
    warehouseId: v.optional(v.id("warehouses")),
    destination: v.optional(v.string()),
    status: v.optional(dispatchStatus),
    transporterId: v.optional(v.id("transporterProfiles")),
    createdAtFrom: v.optional(v.number()),
    createdAtTo: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(
      actor.role === "admin" || actor.role === "warehouse_agent",
      "Only admins and warehouse agents can list dispatches.",
    );
    if (actor.role === "warehouse_agent" && args.warehouseId !== undefined) {
      await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, args.warehouseId);
    } else if (actor.role === "admin" && args.warehouseId !== undefined) {
      await requireAdminPermission(
        ctx,
        args.actorUserId,
        "dispatches:read",
        await warehouseScopeTarget(ctx, args.warehouseId),
      );
    }
    const limit = Math.min(args.limit ?? 50, 100);
    const destination = args.destination?.trim();
    const candidates =
      args.warehouseId !== undefined && destination !== undefined && args.status !== undefined
        ? await ctx.db
            .query("dispatches")
            .withIndex("by_warehouse_destination_status", (q) =>
              q.eq("warehouseId", args.warehouseId!).eq("destination", destination).eq("status", args.status!),
            )
            .take(limit * 4)
        : args.warehouseId !== undefined && args.status !== undefined
          ? await ctx.db
              .query("dispatches")
              .withIndex("by_warehouse_status", (q) =>
                q.eq("warehouseId", args.warehouseId!).eq("status", args.status!),
              )
              .take(limit * 4)
          : args.transporterId !== undefined && args.status !== undefined
            ? await ctx.db
                .query("dispatches")
                .withIndex("by_transporter_status", (q) =>
                  q.eq("transporterId", args.transporterId!).eq("status", args.status!),
                )
                .take(limit * 4)
            : destination !== undefined && args.status !== undefined
              ? await ctx.db
                  .query("dispatches")
                  .withIndex("by_destination_status", (q) => q.eq("destination", destination).eq("status", args.status!))
                  .take(limit * 4)
              : args.status !== undefined
                ? await ctx.db
                    .query("dispatches")
                    .withIndex("by_status", (q) => q.eq("status", args.status!))
                    .take(limit * 4)
                : await ctx.db.query("dispatches").take(limit * 4);

    const results = [];
    for (const dispatch of candidates) {
      if (args.warehouseId !== undefined && dispatch.warehouseId !== args.warehouseId) {
        continue;
      }
      if (destination !== undefined && dispatch.destination !== destination) {
        continue;
      }
      if (args.status !== undefined && dispatch.status !== args.status) {
        continue;
      }
      if (args.transporterId !== undefined && dispatch.transporterId !== args.transporterId) {
        continue;
      }
      if (args.createdAtFrom !== undefined && dispatch.createdAt < args.createdAtFrom) {
        continue;
      }
      if (args.createdAtTo !== undefined && dispatch.createdAt > args.createdAtTo) {
        continue;
      }
      if (actor.role === "warehouse_agent") {
        await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, dispatch.warehouseId);
      } else if (actor.role === "admin") {
        await requireAdminPermission(ctx, args.actorUserId, "dispatches:read", await dispatchScopeTarget(ctx, dispatch));
      }
      results.push(await dispatchDetail(ctx, dispatch));
      if (results.length >= limit) {
        break;
      }
    }

    return results;
  },
});

export const listAssignedToTransporter = query({
  args: {
    actorUserId: v.id("users"),
    transporterId: v.optional(v.id("transporterProfiles")),
    status: v.optional(dispatchStatus),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    let transporterId = args.transporterId;
    if (actor.role === "transporter") {
      const transporter = await ctx.db
        .query("transporterProfiles")
        .withIndex("by_user", (q) => q.eq("userId", actor._id))
        .unique();
      assertAllowed(transporter !== null, "Transporter profile was not found.");
      transporterId = transporter._id;
    } else {
      assertAllowed(actor.role === "admin" || actor.role === "warehouse_agent", "Actor cannot list transporter dispatches.");
      assertAllowed(transporterId !== undefined, "Transporter id is required.");
      if (actor.role === "admin") {
        await requireAdminPermission(ctx, args.actorUserId, "dispatches:read", {});
      }
    }

    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.status === undefined
        ? await ctx.db
            .query("dispatches")
            .withIndex("by_transporter_status", (q) => q.eq("transporterId", transporterId!))
            .take(limit * 4)
        : await ctx.db
            .query("dispatches")
            .withIndex("by_transporter_status", (q) =>
              q.eq("transporterId", transporterId!).eq("status", args.status!),
            )
            .take(limit * 4);

    return candidates
      .filter((dispatch) => args.status === undefined || dispatch.status === args.status)
      .slice(0, limit);
  },
});

export const getBuyerOrderDispatchStatus = query({
  args: {
    actorUserId: v.id("users"),
    buyerOrderId: v.id("buyerOrders"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const order = await ctx.db.get(args.buyerOrderId);
    assertAllowed(order !== null, "Buyer order was not found.");
    const buyer = await ctx.db.get(order.buyerId);
    if (actor.role === "buyer") {
      assertAllowed(buyer?.userId === actor._id, "Buyers can only view their own dispatch status.");
    } else {
      assertAllowed(actor.role === "admin" || actor.role === "warehouse_agent", "Actor cannot view buyer dispatch status.");
    }
    const dispatches = await ctx.db.query("dispatches").collect();
    const dispatch = dispatches.find((candidate) =>
      candidate.buyerOrderIds.some((buyerOrderId) => buyerOrderId === args.buyerOrderId),
    );
    if (dispatch === undefined) {
      return null;
    }
    if (actor.role === "admin") {
      await requireAdminPermission(ctx, args.actorUserId, "dispatches:read", await dispatchScopeTarget(ctx, dispatch));
    }

    return {
      dispatchId: dispatch._id,
      buyerOrderId: args.buyerOrderId,
      destination: dispatch.destination,
      status: dispatch.status,
      totalQuantity: dispatch.totalQuantity,
      unit: dispatch.unit,
      plannedDepartureAt: dispatch.plannedDepartureAt,
      departedAt: dispatch.departedAt,
      expectedArrivalAt: dispatch.expectedArrivalAt,
      arrivedAt: dispatch.arrivedAt,
      driverName: dispatch.driverName,
      driverPhoneNumber: dispatch.driverPhoneNumber,
      vehicleType: dispatch.vehicleType,
    };
  },
});

export const listForFarmer = query({
  args: {
    actorUserId: v.id("users"),
    farmerId: v.id("farmers"),
    status: v.optional(dispatchStatus),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const farmer = await ctx.db.get(args.farmerId);
    assertAllowed(farmer !== null, "Farmer was not found.");
    if (actor.role === "farmer") {
      assertAllowed(farmer.userId === actor._id, "Farmers can only view their own dispatches.");
    } else {
      assertAllowed(actor.role === "admin" || actor.role === "warehouse_agent", "Actor cannot list farmer dispatches.");
      if (actor.role === "admin") {
        await requireAdminPermission(ctx, args.actorUserId, "dispatches:read", adminScopeTarget({
          warehouseId: farmer.preferredWarehouseId,
          region: farmer.region,
          district: farmer.community,
        }));
      }
    }
    const sales = await ctx.db
      .query("saleRecords")
      .withIndex("by_farmer_payment_status", (q) => q.eq("farmerId", args.farmerId))
      .collect();
    const saleIds = new Set(sales.map((sale) => sale._id));
    const saleById = new Map(sales.map((sale) => [sale._id, sale]));
    const dispatches = await ctx.db.query("dispatches").collect();
    const limit = Math.min(args.limit ?? 50, 100);
    const results = [];

    for (const dispatch of dispatches) {
      if (args.status !== undefined && dispatch.status !== args.status) {
        continue;
      }
      const matchingSaleIds = (dispatch.saleRecordIds ?? []).filter((saleRecordId) => saleIds.has(saleRecordId));
      if (matchingSaleIds.length === 0) {
        continue;
      }
      const sale = saleById.get(matchingSaleIds[0]!);
      const batch = sale === undefined ? null : await ctx.db.get(sale.inventoryBatchId);
      results.push({
        dispatchId: dispatch._id,
        destination: dispatch.destination,
        status: dispatch.status,
        plannedDepartureAt: dispatch.plannedDepartureAt,
        departedAt: dispatch.departedAt,
        expectedArrivalAt: dispatch.expectedArrivalAt,
        arrivedAt: dispatch.arrivedAt,
        cropType: batch?.cropType,
        quantity: matchingSaleIds.reduce((total, saleRecordId) => total + (saleById.get(saleRecordId)?.quantitySold ?? 0), 0),
        unit: sale?.unit ?? dispatch.unit,
      });
      if (results.length >= limit) {
        break;
      }
    }

    return results;
  },
});

export const getTransporterDispatchDetail = query({
  args: {
    actorUserId: v.id("users"),
    dispatchId: v.id("dispatches"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const dispatch = await ctx.db.get(args.dispatchId);
    if (dispatch === null) {
      return null;
    }
    const transporter = await ctx.db
      .query("transporterProfiles")
      .withIndex("by_user", (q) => q.eq("userId", actor._id))
      .unique();
    if (actor.role === "transporter") {
      assertAllowed(
        transporter !== null && dispatch.transporterId === transporter._id,
        "Transporters can only view assigned dispatches.",
      );
    } else {
      assertAllowed(actor.role === "admin" || actor.role === "warehouse_agent", "Actor cannot view transporter dispatch details.");
      if (actor.role === "admin") {
        await requireAdminPermission(ctx, args.actorUserId, "dispatches:read", await dispatchScopeTarget(ctx, dispatch));
      }
    }

    return {
      dispatchId: dispatch._id,
      warehouseId: dispatch.warehouseId,
      destination: dispatch.destination,
      status: dispatch.status,
      totalQuantity: dispatch.totalQuantity,
      unit: dispatch.unit,
      plannedDepartureAt: dispatch.plannedDepartureAt,
      departedAt: dispatch.departedAt,
      expectedArrivalAt: dispatch.expectedArrivalAt,
      arrivedAt: dispatch.arrivedAt,
      driverName: dispatch.driverName,
      driverPhoneNumber: dispatch.driverPhoneNumber,
      vehicleType: dispatch.vehicleType,
      vehicleCapacity: dispatch.vehicleCapacity,
      vehicleCapacityUnit: dispatch.vehicleCapacityUnit,
      buyerOrderCount: dispatch.buyerOrderIds.length,
    };
  },
});
