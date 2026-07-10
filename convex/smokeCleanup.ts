import { v } from "convex/values";
import type { Id, TableNames } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { assertAllowed } from "./workflowHelpers";

const confirmationToken = "DELETE_SMOKE_BACKEND_RECORDS";

const inventoryStatuses = [
  "received",
  "verified",
  "available",
  "partially_reserved",
  "reserved",
  "partially_sold",
  "sold",
  "prepared_for_dispatch",
  "dispatched",
  "withdrawn",
  "expired",
  "spoiled",
  "disputed",
] as const;
const reservationStatuses = [
  "active",
  "partially_released",
  "fulfilled",
  "released",
  "expired",
  "cancelled",
] as const;
const dispatchStatuses = [
  "planned",
  "loading",
  "departed",
  "in_transit",
  "arrived",
  "delivered",
  "closed",
  "cancelled",
  "issue_reported",
] as const;
const feeRuleStatuses = ["draft", "active", "inactive", "archived"] as const;
const adminRoleAssignmentStatuses = ["active", "revoked", "expired"] as const;
const profileLinkStatuses = ["pending", "linked", "rejected", "revoked"] as const;

export const cleanupBackendRun = mutation({
  args: {
    runId: v.string(),
    confirm: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    assertAllowed(args.confirm === confirmationToken, "Smoke cleanup confirmation token is required.");
    const runId = cleanRunId(args.runId);
    assertAllowed(runId.length >= 8, "Smoke cleanup requires an exact run id with at least 8 safe characters.");
    const smoke = smokeNames(runId);
    const dryRun = args.dryRun ?? false;
    const matched: Record<string, number> = {};
    const deleted: Record<string, number> = {};

    const warehouses = new Set<Id<"warehouses">>();
    const users = new Set<Id<"users">>();
    const warehouseAgents = new Set<Id<"warehouseAgents">>();
    const farmers = new Set<Id<"farmers">>();
    const buyers = new Set<Id<"buyers">>();
    const adminRoleAssignments = new Set<Id<"adminRoleAssignments">>();
    const profileLinks = new Set<Id<"profileLinks">>();
    const inventoryBatches = new Set<Id<"inventoryBatches">>();
    const storageFeeLedger = new Set<Id<"storageFeeLedger">>();
    const reservations = new Set<Id<"inventoryReservations">>();
    const buyerOrders = new Set<Id<"buyerOrders">>();
    const buyerOrderCharges = new Set<Id<"buyerOrderCharges">>();
    const saleRecords = new Set<Id<"saleRecords">>();
    const saleDeductions = new Set<Id<"saleDeductions">>();
    const dispatches = new Set<Id<"dispatches">>();
    const notifications = new Set<Id<"notifications">>();
    const auditLogs = new Set<Id<"auditLogs">>();
    const feeRules = new Set<Id<"feeRules">>();
    const storageRateRules = new Set<Id<"storageRateRules">>();

    const warehouse = await ctx.db
      .query("warehouses")
      .withIndex("by_code", (q) => q.eq("code", smoke.warehouseCode))
      .unique();
    if (warehouse !== null) {
      warehouses.add(warehouse._id);
    }
    const outOfScopeWarehouse = await ctx.db
      .query("warehouses")
      .withIndex("by_code", (q) => q.eq("code", smoke.outOfScopeWarehouseCode))
      .unique();
    if (outOfScopeWarehouse !== null) {
      warehouses.add(outOfScopeWarehouse._id);
    }

    for (const authProviderId of [
      smoke.agentAuthProviderId,
      smoke.buyerAuthProviderId,
      smoke.scopedAdminAuthProviderId,
    ]) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", authProviderId))
        .unique();
      if (user !== null) {
        users.add(user._id);
      }
    }

    const farmer = await ctx.db
      .query("farmers")
      .withIndex("by_phone_number", (q) => q.eq("phoneNumber", smoke.farmerPhoneNumber))
      .unique();
    if (farmer !== null) {
      farmers.add(farmer._id);
    }

    for (const userId of users) {
      const agent = await ctx.db
        .query("warehouseAgents")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (agent !== null) {
        warehouseAgents.add(agent._id);
      }
      const buyer = await ctx.db
        .query("buyers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (buyer !== null) {
        buyers.add(buyer._id);
      }
      for (const status of adminRoleAssignmentStatuses) {
        for (const assignment of await ctx.db
          .query("adminRoleAssignments")
          .withIndex("by_admin_user_status", (q) => q.eq("adminUserId", userId).eq("status", status))
          .collect()) {
          adminRoleAssignments.add(assignment._id);
        }
      }
      for (const status of profileLinkStatuses) {
        for (const link of await ctx.db
          .query("profileLinks")
          .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", status))
          .collect()) {
          profileLinks.add(link._id);
        }
      }
    }

    for (const warehouseId of warehouses) {
      for (const status of inventoryStatuses) {
        for (const batch of await ctx.db
          .query("inventoryBatches")
          .withIndex("by_warehouse_status", (q) => q.eq("warehouseId", warehouseId).eq("status", status))
          .collect()) {
          if (batch.cropType === smoke.cropType) {
            inventoryBatches.add(batch._id);
          }
        }
      }
      for (const status of dispatchStatuses) {
        for (const dispatch of await ctx.db
          .query("dispatches")
          .withIndex("by_warehouse_status", (q) => q.eq("warehouseId", warehouseId).eq("status", status))
          .collect()) {
          if (dispatch.destination === smoke.destinationMarket || dispatch.driverName === smoke.driverName) {
            dispatches.add(dispatch._id);
          }
        }
      }
      for (const status of feeRuleStatuses) {
        for (const rule of await ctx.db
          .query("storageRateRules")
          .withIndex("by_warehouse_status_effective", (q) => q.eq("warehouseId", warehouseId).eq("status", status))
          .collect()) {
          if (rule.cropType === smoke.cropType) {
            storageRateRules.add(rule._id);
          }
        }
      }
    }

    for (const code of [smoke.handlingFeeCode, smoke.serviceFeeCode]) {
      for (const rule of await ctx.db
        .query("feeRules")
        .withIndex("by_code_version", (q) => q.eq("code", code))
        .collect()) {
        feeRules.add(rule._id);
      }
    }

    for (const batchId of inventoryBatches) {
      for (const fee of await ctx.db
        .query("storageFeeLedger")
        .withIndex("by_batch_date", (q) => q.eq("inventoryBatchId", batchId))
        .collect()) {
        storageFeeLedger.add(fee._id);
      }
      for (const status of reservationStatuses) {
        for (const reservation of await ctx.db
          .query("inventoryReservations")
          .withIndex("by_batch_status", (q) => q.eq("inventoryBatchId", batchId).eq("status", status))
          .collect()) {
          reservations.add(reservation._id);
        }
      }
      for (const sale of await ctx.db
        .query("saleRecords")
        .withIndex("by_batch", (q) => q.eq("inventoryBatchId", batchId))
        .collect()) {
        saleRecords.add(sale._id);
      }
    }

    for (const buyerId of buyers) {
      for (const order of await ctx.db
        .query("buyerOrders")
        .withIndex("by_buyer", (q) => q.eq("buyerId", buyerId))
        .collect()) {
        if (order.cropType === smoke.cropType && order.destinationMarket === smoke.destinationMarket) {
          buyerOrders.add(order._id);
        }
      }
    }

    for (const orderId of buyerOrders) {
      for (const charge of await ctx.db
        .query("buyerOrderCharges")
        .withIndex("by_order", (q) => q.eq("buyerOrderId", orderId))
        .collect()) {
        buyerOrderCharges.add(charge._id);
      }
      for (const reservation of await ctx.db
        .query("inventoryReservations")
        .withIndex("by_order", (q) => q.eq("buyerOrderId", orderId))
        .collect()) {
        reservations.add(reservation._id);
      }
      for (const sale of await ctx.db
        .query("saleRecords")
        .withIndex("by_order", (q) => q.eq("buyerOrderId", orderId))
        .collect()) {
        saleRecords.add(sale._id);
      }
    }

    for (const saleRecordId of saleRecords) {
      for (const deduction of await ctx.db
        .query("saleDeductions")
        .withIndex("by_sale", (q) => q.eq("saleRecordId", saleRecordId))
        .collect()) {
        saleDeductions.add(deduction._id);
      }
    }

    for (const [entityType, ids] of [
      ["inventory_batch", inventoryBatches],
      ["inventory_reservation", reservations],
      ["sale_record", saleRecords],
      ["dispatch", dispatches],
      ["buyer_order", buyerOrders],
      ["warehouse", warehouses],
      ["warehouse_agent", warehouseAgents],
      ["farmer", farmers],
      ["buyer", buyers],
    ] as const) {
      for (const id of ids) {
        for (const notification of await ctx.db
          .query("notifications")
          .withIndex("by_related_entity", (q) => q.eq("relatedEntityType", entityType).eq("relatedEntityId", id))
          .collect()) {
          notifications.add(notification._id);
        }
        for (const auditLog of await ctx.db
          .query("auditLogs")
          .withIndex("by_entity", (q) => q.eq("entityType", entityType).eq("entityId", id))
          .collect()) {
          auditLogs.add(auditLog._id);
        }
      }
    }

    for (const userId of users) {
      for (const auditLog of await ctx.db
        .query("auditLogs")
        .withIndex("by_actor", (q) => q.eq("actorId", userId))
        .collect()) {
        auditLogs.add(auditLog._id);
      }
    }

    await deleteSet(ctx, "notifications", notifications, matched, deleted, dryRun);
    await deleteSet(ctx, "auditLogs", auditLogs, matched, deleted, dryRun);
    await deleteSet(ctx, "saleDeductions", saleDeductions, matched, deleted, dryRun);
    await deleteSet(ctx, "buyerOrderCharges", buyerOrderCharges, matched, deleted, dryRun);
    await deleteSet(ctx, "dispatches", dispatches, matched, deleted, dryRun);
    await deleteSet(ctx, "saleRecords", saleRecords, matched, deleted, dryRun);
    await deleteSet(ctx, "inventoryReservations", reservations, matched, deleted, dryRun);
    await deleteSet(ctx, "buyerOrders", buyerOrders, matched, deleted, dryRun);
    await deleteSet(ctx, "storageFeeLedger", storageFeeLedger, matched, deleted, dryRun);
    await deleteSet(ctx, "inventoryBatches", inventoryBatches, matched, deleted, dryRun);
    await deleteSet(ctx, "feeRules", feeRules, matched, deleted, dryRun);
    await deleteSet(ctx, "storageRateRules", storageRateRules, matched, deleted, dryRun);
    await deleteSet(ctx, "profileLinks", profileLinks, matched, deleted, dryRun);
    await deleteSet(ctx, "adminRoleAssignments", adminRoleAssignments, matched, deleted, dryRun);
    await deleteSet(ctx, "buyers", buyers, matched, deleted, dryRun);
    await deleteSet(ctx, "farmers", farmers, matched, deleted, dryRun);
    await deleteSet(ctx, "warehouseAgents", warehouseAgents, matched, deleted, dryRun);
    await deleteSet(ctx, "warehouses", warehouses, matched, deleted, dryRun);
    await deleteSet(ctx, "users", users, matched, deleted, dryRun);

    return { dryRun, runId, matched, deleted };
  },
});

export const cleanupAllBackendSmokeRecords = mutation({
  args: {
    confirm: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    assertAllowed(args.confirm === confirmationToken, "Smoke cleanup confirmation token is required.");
    const dryRun = args.dryRun ?? false;
    const smokeAdmin = await ctx.db
      .query("users")
      .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", "smoke-backend-admin"))
      .unique();
    const auditLogs = new Set<Id<"auditLogs">>();
    const buyerOrderCharges = new Set<Id<"buyerOrderCharges">>();
    const adminRoleAssignments = new Set<Id<"adminRoleAssignments">>();
    const inventoryBatches = new Set<Id<"inventoryBatches">>();
    const inventoryReservations = new Set<Id<"inventoryReservations">>();
    const buyerOrders = new Set<Id<"buyerOrders">>();
    const storageFeeLedger = new Set<Id<"storageFeeLedger">>();
    const storageRateRules = new Set<Id<"storageRateRules">>();
    const paymentTransactions = new Set<Id<"paymentTransactions">>();
    const payoutLedger = new Set<Id<"payoutLedger">>();
    const notifications = new Set<Id<"notifications">>();
    const smsDeliveries = new Set<Id<"smsDeliveries">>();
    let repairedAssignments = 0;

    for (const log of await ctx.db.query("auditLogs").collect()) {
      if (
        containsExplicitSmokeMarker(log) ||
        (smokeAdmin !== null && log.actorId === smokeAdmin._id)
      ) {
        auditLogs.add(log._id);
      }
    }
    for (const charge of await ctx.db.query("buyerOrderCharges").collect()) {
      if (containsExplicitSmokeMarker(charge)) {
        buyerOrderCharges.add(charge._id);
      }
    }
    for (const batch of await ctx.db.query("inventoryBatches").collect()) {
      if (containsExplicitSmokeMarker(batch)) {
        inventoryBatches.add(batch._id);
      }
    }
    for (const order of await ctx.db.query("buyerOrders").collect()) {
      if (containsExplicitSmokeMarker(order)) {
        buyerOrders.add(order._id);
      }
    }
    for (const fee of await ctx.db.query("storageFeeLedger").collect()) {
      if (containsExplicitSmokeMarker(fee) || inventoryBatches.has(fee.inventoryBatchId)) {
        storageFeeLedger.add(fee._id);
      }
    }
    for (const rule of await ctx.db.query("storageRateRules").collect()) {
      if (containsExplicitSmokeMarker(rule)) {
        storageRateRules.add(rule._id);
      }
    }
    for (const reservation of await ctx.db.query("inventoryReservations").collect()) {
      if (
        containsExplicitSmokeMarker(reservation) ||
        inventoryBatches.has(reservation.inventoryBatchId) ||
        (reservation.buyerOrderId !== undefined && buyerOrders.has(reservation.buyerOrderId))
      ) {
        inventoryReservations.add(reservation._id);
      }
    }
    for (const payment of await ctx.db.query("paymentTransactions").collect()) {
      if (containsExplicitSmokeMarker(payment)) {
        paymentTransactions.add(payment._id);
      }
    }
    for (const payout of await ctx.db.query("payoutLedger").collect()) {
      if (
        containsExplicitSmokeMarker(payout) ||
        (payout.sourcePaymentTransactionId !== undefined &&
          paymentTransactions.has(payout.sourcePaymentTransactionId))
      ) {
        payoutLedger.add(payout._id);
      }
    }
    const relatedSmokeIds = new Set<string>([
      ...inventoryBatches,
      ...inventoryReservations,
      ...buyerOrders,
      ...paymentTransactions,
      ...payoutLedger,
    ]);
    for (const notification of await ctx.db.query("notifications").collect()) {
      if (
        containsExplicitSmokeMarker(notification) ||
        (notification.relatedEntityId !== undefined && relatedSmokeIds.has(notification.relatedEntityId))
      ) {
        notifications.add(notification._id);
      }
    }
    for (const delivery of await ctx.db.query("smsDeliveries").collect()) {
      const notificationMissing =
        delivery.notificationId !== undefined &&
        !notifications.has(delivery.notificationId) &&
        (await ctx.db.get(delivery.notificationId)) === null;
      if (
        containsExplicitSmokeMarker(delivery) ||
        (delivery.notificationId !== undefined && notifications.has(delivery.notificationId)) ||
        (delivery.relatedEntityId !== undefined && relatedSmokeIds.has(delivery.relatedEntityId)) ||
        notificationMissing
      ) {
        smsDeliveries.add(delivery._id);
      }
    }
    if (smokeAdmin !== null) {
      for (const status of adminRoleAssignmentStatuses) {
        for (const assignment of await ctx.db
          .query("adminRoleAssignments")
          .withIndex("by_admin_user_status", (q) => q.eq("adminUserId", smokeAdmin._id).eq("status", status))
          .collect()) {
          adminRoleAssignments.add(assignment._id);
        }
      }
      for (const assignment of await ctx.db.query("adminRoleAssignments").collect()) {
        if (assignment.assignedBy === smokeAdmin._id && assignment.adminUserId !== smokeAdmin._id) {
          repairedAssignments += 1;
          if (!dryRun) {
            await ctx.db.patch(assignment._id, { assignedBy: assignment.adminUserId });
          }
        }
      }
    }

    const matched = {
      auditLogs: auditLogs.size,
      buyerOrderCharges: buyerOrderCharges.size,
      inventoryBatches: inventoryBatches.size,
      inventoryReservations: inventoryReservations.size,
      buyerOrders: buyerOrders.size,
      storageFeeLedger: storageFeeLedger.size,
      storageRateRules: storageRateRules.size,
      paymentTransactions: paymentTransactions.size,
      payoutLedger: payoutLedger.size,
      notifications: notifications.size,
      smsDeliveries: smsDeliveries.size,
      adminRoleAssignments: adminRoleAssignments.size,
      users: smokeAdmin === null ? 0 : 1,
      repairedAssignments,
    };
    if (!dryRun) {
      for (const id of auditLogs) {
        await ctx.db.delete(id);
      }
      for (const id of buyerOrderCharges) {
        await ctx.db.delete(id);
      }
      for (const id of smsDeliveries) {
        await ctx.db.delete(id);
      }
      for (const id of notifications) {
        await ctx.db.delete(id);
      }
      for (const id of inventoryReservations) {
        await ctx.db.delete(id);
      }
      for (const id of payoutLedger) {
        await ctx.db.delete(id);
      }
      for (const id of paymentTransactions) {
        await ctx.db.delete(id);
      }
      for (const id of storageFeeLedger) {
        await ctx.db.delete(id);
      }
      for (const id of inventoryBatches) {
        await ctx.db.delete(id);
      }
      for (const id of storageRateRules) {
        await ctx.db.delete(id);
      }
      for (const id of buyerOrders) {
        await ctx.db.delete(id);
      }
      for (const id of adminRoleAssignments) {
        await ctx.db.delete(id);
      }
      if (smokeAdmin !== null) {
        await ctx.db.delete(smokeAdmin._id);
      }
    }
    return {
      dryRun,
      matched,
      deleted: dryRun
        ? Object.fromEntries(Object.keys(matched).filter((key) => key !== "repairedAssignments").map((key) => [key, 0]))
        : {
            auditLogs: auditLogs.size,
            buyerOrderCharges: buyerOrderCharges.size,
            inventoryBatches: inventoryBatches.size,
            inventoryReservations: inventoryReservations.size,
            buyerOrders: buyerOrders.size,
            storageFeeLedger: storageFeeLedger.size,
            storageRateRules: storageRateRules.size,
            paymentTransactions: paymentTransactions.size,
            payoutLedger: payoutLedger.size,
            notifications: notifications.size,
            smsDeliveries: smsDeliveries.size,
            adminRoleAssignments: adminRoleAssignments.size,
            users: smokeAdmin === null ? 0 : 1,
          },
    };
  },
});

function containsExplicitSmokeMarker(value: unknown): boolean {
  return /smoke|backend-smoke|example\.test/i.test(JSON.stringify(value));
}

function cleanRunId(runId: string): string {
  return runId.replace(/[^0-9A-Za-z]+/g, "").slice(0, 32);
}

function smokeNames(runId: string) {
  const codeRunId = runId.toUpperCase();
  const plusDigits = runId.replace(/\D/g, "").padEnd(12, "0").slice(-12);
  return {
    warehouseCode: `SMOKE-${codeRunId}`.slice(0, 24),
    outOfScopeWarehouseCode: `SMOKE-OOS-${codeRunId}`.slice(0, 24),
    cropType: `Smoke Tomatoes ${runId}`,
    destinationMarket: "Smoke Tarkwa Market",
    agentAuthProviderId: `smoke-backend-agent-${runId}`,
    buyerAuthProviderId: `smoke-backend-buyer-${runId}`,
    scopedAdminAuthProviderId: `smoke-backend-scoped-admin-${runId}`,
    farmerPhoneNumber: `+23359${plusDigits.slice(-7)}`,
    handlingFeeCode: `SMOKE-HANDLING-${codeRunId}`,
    serviceFeeCode: `SMOKE-SERVICE-${codeRunId}`,
    driverName: `Smoke Driver ${runId}`,
  };
}

async function deleteSet(
  ctx: MutationCtx,
  label: string,
  ids: ReadonlySet<Id<TableNames>>,
  matched: Record<string, number>,
  deleted: Record<string, number>,
  dryRun: boolean,
): Promise<void> {
  matched[label] = ids.size;
  if (dryRun) {
    deleted[label] = 0;
    return;
  }
  for (const id of ids) {
    await ctx.db.delete(id);
    deleted[label] = (deleted[label] ?? 0) + 1;
  }
  deleted[label] = deleted[label] ?? 0;
}
