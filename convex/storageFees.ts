import { calculateFeeAmountFromSnapshot } from "@kuapa-dwaso/utils";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  adminAccessHasPermissionForScope,
  assertAllowed,
  auditSnapshot,
  getEffectiveAdminAccess,
  getActor,
  insertAuditLog,
  inventoryScopeTarget,
  requireAdminPermission,
  requireWarehouseAgentAssignedToWarehouse,
  warehouseScopeTarget,
} from "./workflowHelpers";

const storageFeeLedgerStatus = v.union(
  v.literal("accrued"),
  v.literal("partially_deducted_from_sale"),
  v.literal("deducted_from_sale"),
  v.literal("paid"),
  v.literal("waived"),
  v.literal("disputed"),
);

export const accrueForBatch = mutation({
  args: {
    actorUserId: v.id("users"),
    inventoryBatchId: v.id("inventoryBatches"),
    feeDate: v.optional(v.number()),
    days: v.optional(v.number()),
  },
  returns: v.id("storageFeeLedger"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin", "Only admins can accrue storage fees manually.");
    const batch = await ctx.db.get(args.inventoryBatchId);
    assertAllowed(batch !== null, "Inventory batch was not found.");
    await requireAdminPermission(ctx, args.actorUserId, "fees:manage", await inventoryScopeTarget(ctx, batch));
    const days = args.days ?? 1;
    assertAllowed(days > 0, "Storage fee days must be positive.");

    const amount = calculateFeeAmountFromSnapshot(batch.storageRateSnapshot, {
      quantity: batch.quantityAvailable,
      days,
    });
    const now = Date.now();
    const feeDate = args.feeDate ?? now;
    const ledgerId = await ctx.db.insert("storageFeeLedger", {
      inventoryBatchId: args.inventoryBatchId,
      farmerId: batch.farmerId,
      warehouseId: batch.warehouseId,
      feeDate,
      quantityCharged: batch.quantityAvailable,
      unit: batch.unit,
      appliedRuleSnapshot: batch.storageRateSnapshot,
      amount,
      status: "accrued",
      createdAt: now,
    });

    await ctx.db.patch(args.inventoryBatchId, {
      storageFeeAccrued: batch.storageFeeAccrued + amount,
      lastFeeCalculatedAt: feeDate,
      updatedAt: now,
    });

    const after = await ctx.db.get(ledgerId);
    await insertAuditLog(ctx, {
      actor,
      action: "storage_fee_ledger.accrued",
      entityType: "storage_fee_ledger",
      entityId: ledgerId,
      after: after === null ? undefined : auditSnapshot(after),
    });

    return ledgerId;
  },
});

export const updateLedgerStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    storageFeeLedgerId: v.id("storageFeeLedger"),
    status: storageFeeLedgerStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("storageFeeLedger"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin", "Only admins can update storage fee ledger status.");
    const ledger = await ctx.db.get(args.storageFeeLedgerId);
    assertAllowed(ledger !== null, "Storage fee ledger entry was not found.");
    await requireAdminPermission(ctx, args.actorUserId, "fees:manage", await warehouseScopeTarget(ctx, ledger.warehouseId));

    await ctx.db.patch(args.storageFeeLedgerId, {
      status: args.status,
    });

    const after = await ctx.db.get(args.storageFeeLedgerId);
    await insertAuditLog(ctx, {
      actor,
      action: "storage_fee_ledger.status_updated",
      entityType: "storage_fee_ledger",
      entityId: args.storageFeeLedgerId,
      before: auditSnapshot(ledger),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.storageFeeLedgerId;
  },
});

export const listByBatch = query({
  args: {
    actorUserId: v.id("users"),
    inventoryBatchId: v.id("inventoryBatches"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const batch = await ctx.db.get(args.inventoryBatchId);
    assertAllowed(batch !== null, "Inventory batch was not found.");
    if (actor.role === "farmer") {
      const farmer = await ctx.db.get(batch.farmerId);
      assertAllowed(farmer !== null && farmer.userId === actor._id, "Actor cannot view these fees.");
    } else if (actor.role === "warehouse_agent") {
      await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, batch.warehouseId);
    } else {
      assertAllowed(actor.role === "admin", "Actor cannot view these fees.");
      await requireAdminPermission(ctx, args.actorUserId, "fees:read", await inventoryScopeTarget(ctx, batch));
    }

    return await ctx.db
      .query("storageFeeLedger")
      .withIndex("by_batch_date", (q) => q.eq("inventoryBatchId", args.inventoryBatchId))
      .order("desc")
      .take(Math.min(args.limit ?? 50, 100));
  },
});

export const listForAdmin = query({
  args: {
    actorUserId: v.id("users"),
    warehouseId: v.optional(v.id("warehouses")),
    inventoryBatchId: v.optional(v.id("inventoryBatches")),
    status: v.optional(storageFeeLedgerStatus),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin", "Only admins can inspect storage fee ledgers.");
    const access = await getEffectiveAdminAccess(ctx, args.actorUserId);
    if (args.warehouseId !== undefined) {
      await requireAdminPermission(ctx, args.actorUserId, "fees:read", await warehouseScopeTarget(ctx, args.warehouseId));
    }

    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.inventoryBatchId !== undefined
        ? await ctx.db
            .query("storageFeeLedger")
            .withIndex("by_batch_date", (q) => q.eq("inventoryBatchId", args.inventoryBatchId!))
            .order("desc")
            .take(limit * 4)
        : args.warehouseId !== undefined && args.status !== undefined
          ? await ctx.db
              .query("storageFeeLedger")
              .withIndex("by_warehouse_status_date", (q) =>
                q.eq("warehouseId", args.warehouseId!).eq("status", args.status!),
              )
              .order("desc")
              .take(limit * 4)
          : args.status !== undefined
            ? await ctx.db
                .query("storageFeeLedger")
                .withIndex("by_status_date", (q) => q.eq("status", args.status!))
                .order("desc")
                .take(limit * 4)
            : await ctx.db.query("storageFeeLedger").take(limit * 4);

    const results = [];
    for (const ledger of candidates) {
      if (args.warehouseId !== undefined && ledger.warehouseId !== args.warehouseId) {
        continue;
      }
      if (args.inventoryBatchId !== undefined && ledger.inventoryBatchId !== args.inventoryBatchId) {
        continue;
      }
      if (args.status !== undefined && ledger.status !== args.status) {
        continue;
      }
      if (adminAccessHasPermissionForScope(access, "fees:read", await warehouseScopeTarget(ctx, ledger.warehouseId))) {
        results.push(ledger);
      }
      if (results.length >= limit) {
        break;
      }
    }
    return results;
  },
});
