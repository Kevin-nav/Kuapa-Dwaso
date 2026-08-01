import { canTransitionMarketDeliveryRunStatus, isActiveReservationStatus } from "@kuapa-dwaso/permissions";
import { aggregateMarketRunOrders, buildMarketRunBuyerNotification, calculateMarketRunOccurrence } from "@kuapa-dwaso/utils";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { insertNotificationRecord } from "./notifications";
import {
  adminAccessHasPermissionForScope,
  assertAllowed,
  auditSnapshot,
  cleanOptionalText,
  getActor,
  getEffectiveAdminAccess,
  insertAuditLog,
  omitUndefinedValues,
  requireAdminPermission,
  requireWarehouseAgentAssignedToWarehouse,
  warehouseScopeTarget,
} from "./workflowHelpers";

const runStatus = v.union(
  v.literal("draft"),
  v.literal("accepting_orders"),
  v.literal("cutoff_reached"),
  v.literal("ready"),
  v.literal("confirmed"),
  v.literal("cancelled"),
  v.literal("dispatched"),
  v.literal("completed"),
);

function timingForSchedule(schedule: Doc<"marketServiceSchedules">, deliveryDate: string) {
  return calculateMarketRunOccurrence(
    {
      timezone: schedule.timezone,
      deliveryWeekday: schedule.deliveryWeekday,
      cutoffDaysBefore: schedule.cutoffDaysBefore,
      cutoffLocalTime: schedule.cutoffLocalTime,
      arrivalStartLocalTime: schedule.arrivalStartLocalTime,
      arrivalEndLocalTime: schedule.arrivalEndLocalTime,
      effectiveDate: schedule.effectiveDate,
      ...(schedule.endDate === undefined ? {} : { endDate: schedule.endDate }),
    },
    deliveryDate,
  );
}

async function insertRun(
  ctx: MutationCtx,
  actorUserId: Id<"users">,
  schedule: Doc<"marketServiceSchedules">,
  deliveryDate: string,
  postponedFromRunId?: Id<"marketDeliveryRuns">,
): Promise<Id<"marketDeliveryRuns">> {
  const existing = await ctx.db
    .query("marketDeliveryRuns")
    .withIndex("by_schedule_delivery_date", (q) => q.eq("scheduleId", schedule._id).eq("deliveryDate", deliveryDate))
    .unique();
  assertAllowed(existing === null, "A delivery run already exists for this schedule and date.");
  const timing = timingForSchedule(schedule, deliveryDate);
  assertAllowed(timing.expectedArrivalEndAt > Date.now(), "Delivery run must be upcoming.");
  const now = Date.now();
  return await ctx.db.insert("marketDeliveryRuns", omitUndefinedValues({
    scheduleId: schedule._id,
    originWarehouseId: schedule.originWarehouseId,
    destinationName: schedule.destinationName,
    destinationInstructions: schedule.destinationInstructions,
    timezone: schedule.timezone,
    ...timing,
    status: "draft",
    minimumLoadQuantity: schedule.minimumLoadQuantity,
    minimumLoadUnit: schedule.minimumLoadUnit,
    capacityQuantity: schedule.capacityQuantity,
    capacityUnit: schedule.capacityUnit,
    buyerOrderIds: [],
    dispatchIds: [],
    postponedFromRunId,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId,
    createdAt: now,
    updatedAt: now,
  }));
}

export const createFromSchedule = mutation({
  args: { actorUserId: v.id("users"), scheduleId: v.id("marketServiceSchedules"), deliveryDate: v.string() },
  returns: v.id("marketDeliveryRuns"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const schedule = await ctx.db.get(args.scheduleId);
    assertAllowed(schedule !== null, "Market service schedule was not found.");
    assertAllowed(schedule.status === "active", "Only active schedules can generate delivery runs.");
    await requireAdminPermission(ctx, args.actorUserId, "marketRuns:manage", await warehouseScopeTarget(ctx, schedule.originWarehouseId));
    const runId = await insertRun(ctx, args.actorUserId, schedule, args.deliveryDate);
    const run = await ctx.db.get(runId);
    await insertAuditLog(ctx, { actor, action: "market_delivery_run.created", entityType: "market_delivery_run", entityId: runId, after: run === null ? undefined : auditSnapshot(run) });
    return runId;
  },
});

async function notifyBuyersForRun(
  ctx: MutationCtx,
  run: Doc<"marketDeliveryRuns">,
  event: "opened" | "cancelled" | "postponed",
  reason?: string,
): Promise<void> {
  const buyers = event === "opened"
    ? await ctx.db.query("buyers").withIndex("by_destination_market", (q) => q.eq("destinationMarket", run.destinationName)).collect()
    : await Promise.all(run.buyerOrderIds.map(async (orderId) => {
        const order = await ctx.db.get(orderId);
        return order === null ? null : await ctx.db.get(order.buyerId);
      }));
  const unique = new Map<string, NonNullable<(typeof buyers)[number]>>();
  for (const buyer of buyers) if (buyer !== null && buyer.userId !== undefined) unique.set(String(buyer._id), buyer);
  const deliveryLabel = new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: run.timezone }).format(new Date(run.expectedArrivalStartAt));
  for (const buyer of unique.values()) {
    const notification = buildMarketRunBuyerNotification({ event, runId: run._id, destination: run.destinationName, deliveryLabel, reason });
    await insertNotificationRecord(ctx, {
      recipientId: buyer._id,
      recipientUserId: buyer.userId,
      recipientRole: "buyer",
      channel: "in_app",
      title: notification.title,
      message: notification.message,
      messageKind: "market_run_update",
      relatedEntityType: "market_delivery_run",
      relatedEntityId: run._id,
      marketDeliveryRunId: run._id,
      actionUrl: notification.actionUrl,
      actionRequired: notification.actionRequired,
      priority: notification.priority,
      dueAt: event === "opened" ? run.orderCutoffAt : undefined,
      deduplicationKey: notification.deduplicationKey,
      expiresAt: run.expectedArrivalEndAt + 7 * 86_400_000,
    });
    if (event !== "opened") {
      await insertNotificationRecord(ctx, {
        recipientId: buyer.phoneNumber,
        recipientUserId: buyer.userId,
        recipientRole: "buyer",
        channel: "sms",
        title: notification.title,
        message: `${notification.title}: ${run.destinationName}, ${deliveryLabel}. Check Kuapa Dwaso for details.`,
        messageKind: "market_run_update",
        templateKey: "generic_notification",
        relatedEntityType: "market_delivery_run",
        relatedEntityId: run._id,
        marketDeliveryRunId: run._id,
        deduplicationKey: `run:${run._id}:${event}:sms`,
      });
    }
  }
}

export const updateStatus = mutation({
  args: { actorUserId: v.id("users"), runId: v.id("marketDeliveryRuns"), status: runStatus, reason: v.optional(v.string()) },
  returns: v.id("marketDeliveryRuns"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const run = await ctx.db.get(args.runId);
    assertAllowed(run !== null, "Market delivery run was not found.");
    await requireAdminPermission(ctx, args.actorUserId, "marketRuns:manage", await warehouseScopeTarget(ctx, run.originWarehouseId));
    assertAllowed(canTransitionMarketDeliveryRunStatus(run.status, args.status), "Market delivery run status transition is not allowed.");
    if (args.status === "cutoff_reached") assertAllowed(Date.now() >= run.orderCutoffAt, "The published order cutoff has not been reached.");
    if (args.status === "cancelled") assertAllowed(cleanOptionalText(args.reason) !== undefined, "A cancellation reason is required.");
    if (args.status === "ready") assertAllowed(run.buyerOrderIds.length > 0, "A run with no orders cannot be marked ready.");
    await ctx.db.patch(args.runId, omitUndefinedValues({
      status: args.status,
      cancellationReason: args.status === "cancelled" ? cleanOptionalText(args.reason) : undefined,
      updatedByUserId: args.actorUserId,
      updatedAt: Date.now(),
    }));
    const after = await ctx.db.get(args.runId);
    await insertAuditLog(ctx, { actor, action: "market_delivery_run.status_updated", entityType: "market_delivery_run", entityId: args.runId, before: auditSnapshot(run), after: after === null ? undefined : auditSnapshot(after), metadata: args.reason === undefined ? undefined : { reason: args.reason } });
    if (after !== null && args.status === "accepting_orders") await notifyBuyersForRun(ctx, after, "opened");
    if (after !== null && args.status === "cancelled") await notifyBuyersForRun(ctx, after, "cancelled", args.reason);
    return args.runId;
  },
});

export const editUnstarted = mutation({
  args: { actorUserId: v.id("users"), runId: v.id("marketDeliveryRuns"), deliveryDate: v.string(), destinationInstructions: v.optional(v.string()) },
  returns: v.id("marketDeliveryRuns"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const run = await ctx.db.get(args.runId);
    assertAllowed(run !== null, "Market delivery run was not found.");
    assertAllowed(run.status === "draft" && run.buyerOrderIds.length === 0, "Only an unstarted draft run can be edited.");
    await requireAdminPermission(ctx, args.actorUserId, "marketRuns:manage", await warehouseScopeTarget(ctx, run.originWarehouseId));
    const schedule = await ctx.db.get(run.scheduleId);
    assertAllowed(schedule !== null, "Source market schedule was not found.");
    const duplicate = await ctx.db.query("marketDeliveryRuns").withIndex("by_schedule_delivery_date", (q) => q.eq("scheduleId", run.scheduleId).eq("deliveryDate", args.deliveryDate)).unique();
    assertAllowed(duplicate === null || duplicate._id === run._id, "A delivery run already exists for this schedule and date.");
    const timing = timingForSchedule(schedule, args.deliveryDate);
    await ctx.db.patch(args.runId, {
      ...timing,
      destinationInstructions: cleanOptionalText(args.destinationInstructions) ?? run.destinationInstructions,
      updatedByUserId: args.actorUserId,
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.runId);
    await insertAuditLog(ctx, { actor, action: "market_delivery_run.edited", entityType: "market_delivery_run", entityId: args.runId, before: auditSnapshot(run), after: after === null ? undefined : auditSnapshot(after) });
    return args.runId;
  },
});

export const postpone = mutation({
  args: { actorUserId: v.id("users"), runId: v.id("marketDeliveryRuns"), newDeliveryDate: v.string(), reason: v.string() },
  returns: v.id("marketDeliveryRuns"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const run = await ctx.db.get(args.runId);
    assertAllowed(run !== null, "Market delivery run was not found.");
    assertAllowed(["draft", "accepting_orders", "cutoff_reached", "ready", "confirmed"].includes(run.status), "This run can no longer be postponed.");
    const reason = cleanOptionalText(args.reason);
    assertAllowed(reason !== undefined, "A postponement reason is required.");
    await requireAdminPermission(ctx, args.actorUserId, "marketRuns:manage", await warehouseScopeTarget(ctx, run.originWarehouseId));
    const schedule = await ctx.db.get(run.scheduleId);
    assertAllowed(schedule !== null, "Source market schedule was not found.");
    const replacementId = await insertRun(ctx, args.actorUserId, schedule, args.newDeliveryDate, run._id);
    await ctx.db.patch(run._id, { status: "cancelled", postponementReason: reason, cancellationReason: `Postponed: ${reason}`, updatedByUserId: args.actorUserId, updatedAt: Date.now() });
    const replacement = await ctx.db.get(replacementId);
    const after = await ctx.db.get(run._id);
    await insertAuditLog(ctx, { actor, action: "market_delivery_run.postponed", entityType: "market_delivery_run", entityId: run._id, before: auditSnapshot(run), after: after === null ? undefined : auditSnapshot(after), metadata: { replacementRunId: replacementId, reason } });
    if (after !== null) await notifyBuyersForRun(ctx, after, "postponed", reason);
    if (replacement !== null && run.status !== "draft") {
      await ctx.db.patch(replacementId, { status: "accepting_orders", updatedAt: Date.now() });
      await notifyBuyersForRun(ctx, { ...replacement, status: "accepting_orders" }, "opened");
    }
    return replacementId;
  },
});

function runCanAcceptOrders(run: Doc<"marketDeliveryRuns">, now: number): boolean {
  return run.status === "accepting_orders" && run.orderCutoffAt > now;
}

export const listUpcomingForBuyer = query({
  args: { actorUserId: v.id("users"), destinationName: v.optional(v.string()), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "buyer", "Only buyers can browse available market delivery runs.");
    const now = Date.now();
    const limit = Math.min(args.limit ?? 20, 50);
    const destination = cleanOptionalText(args.destinationName);
    const candidates = destination === undefined
      ? await ctx.db.query("marketDeliveryRuns").withIndex("by_status_date", (q) => q.eq("status", "accepting_orders").gt("deliveryDateAt", now)).take(limit * 4)
      : await ctx.db.query("marketDeliveryRuns").withIndex("by_destination_status_date", (q) => q.eq("destinationName", destination).eq("status", "accepting_orders").gt("deliveryDateAt", now)).take(limit * 4);
    return candidates.filter((run) => runCanAcceptOrders(run, now)).sort((a, b) => a.deliveryDateAt - b.deliveryDateAt).slice(0, limit);
  },
});

export const listForOperations = query({
  args: { actorUserId: v.id("users"), warehouseId: v.optional(v.id("warehouses")), status: v.optional(runStatus), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin" || actor.role === "warehouse_agent", "Only operations users can list market delivery runs.");
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates = args.warehouseId === undefined
      ? await ctx.db.query("marketDeliveryRuns").take(limit * 5)
      : await ctx.db.query("marketDeliveryRuns").withIndex("by_warehouse_status_date", (q) => args.status === undefined ? q.eq("originWarehouseId", args.warehouseId!) : q.eq("originWarehouseId", args.warehouseId!).eq("status", args.status!)).take(limit * 5);
    const access = actor.role === "admin" ? await getEffectiveAdminAccess(ctx, args.actorUserId) : undefined;
    const visible = [];
    for (const run of candidates) {
      if (args.status !== undefined && run.status !== args.status) continue;
      if (actor.role === "warehouse_agent") {
        try { await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, run.originWarehouseId); } catch { continue; }
      } else if (access !== undefined && !adminAccessHasPermissionForScope(access, "marketRuns:read", await warehouseScopeTarget(ctx, run.originWarehouseId))) continue;
      visible.push(run);
      if (visible.length >= limit) break;
    }
    return visible.sort((a, b) => a.deliveryDateAt - b.deliveryDateAt);
  },
});

export const getReadiness = query({
  args: { actorUserId: v.id("users"), runId: v.id("marketDeliveryRuns") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const run = await ctx.db.get(args.runId);
    if (run === null) return null;
    if (actor.role === "warehouse_agent") await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, run.originWarehouseId);
    else {
      assertAllowed(actor.role === "admin", "Only operations users can inspect run readiness.");
      await requireAdminPermission(ctx, args.actorUserId, "marketRuns:read", await warehouseScopeTarget(ctx, run.originWarehouseId));
    }
    const orders = await ctx.db.query("buyerOrders").withIndex("by_market_delivery_run", (q) => q.eq("marketDeliveryRunId", run._id)).collect();
    const aggregationInputs = [];
    const blockers = [];
    for (const order of orders) {
      const reservations = await ctx.db.query("inventoryReservations").withIndex("by_order", (q) => q.eq("buyerOrderId", order._id)).collect();
      const activeReservations = reservations.filter((reservation) => isActiveReservationStatus(reservation.status));
      const reservedQuantity = activeReservations.reduce((total, reservation) => total + reservation.quantityReserved - reservation.quantityReleased - reservation.quantityFulfilled, 0);
      const expiries = activeReservations.flatMap((reservation) => reservation.expiresAt === undefined ? [] : [reservation.expiresAt]);
      aggregationInputs.push({ cropType: order.cropType, unit: order.unit, requestedQuantity: order.requestedQuantity, reservedQuantity, paymentStatus: order.paymentStatus, ...(expiries.length === 0 ? {} : { reservationExpiresAt: Math.min(...expiries) }) });
      if (order.paymentStatus !== "fully_paid") {
        const buyer = await ctx.db.get(order.buyerId);
        blockers.push({ buyerOrderId: order._id, buyerName: buyer?.displayName ?? buyer?.fullName ?? "Buyer", paymentStatus: order.paymentStatus, paymentDeadline: order.paymentDeadline, reservationExpiry: expiries.length === 0 ? undefined : Math.min(...expiries) });
      }
    }
    const aggregation = aggregateMarketRunOrders(aggregationInputs, omitUndefinedValues({ capacityQuantity: run.capacityQuantity, capacityUnit: run.capacityUnit, minimumLoadQuantity: run.minimumLoadQuantity, minimumLoadUnit: run.minimumLoadUnit }));
    const dispatches = await Promise.all(run.dispatchIds.map((dispatchId) => ctx.db.get(dispatchId)));
    return { ...run, aggregation, blockers, linkedDispatches: dispatches.filter((dispatch) => dispatch !== null), operationalConfirmationRequired: !aggregation.capacity.compatible || !aggregation.minimumLoad.compatible };
  },
});
