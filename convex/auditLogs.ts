import { canViewAuditLogs } from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { resolveRequestingRole } from "./observabilityAccess";
import {
  adminAccessHasPermissionForScope,
  buyerOrderScopeTarget,
  dispatchScopeTarget,
  farmerScopeTarget,
  getEffectiveAdminAccess,
  inventoryScopeTarget,
  requireAdminPermission,
  saleScopeTarget,
  warehouseScopeTarget,
} from "./workflowHelpers";

const actorRole = v.union(
  v.literal("farmer"),
  v.literal("warehouse_agent"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("admin"),
  v.literal("system"),
);

const marketplaceRole = v.union(
  v.literal("farmer"),
  v.literal("warehouse_agent"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("admin"),
);

const auditEntityType = v.union(
  v.literal("user"),
  v.literal("farmer"),
  v.literal("warehouse_agent"),
  v.literal("warehouse"),
  v.literal("inventory_batch"),
  v.literal("storage_receipt"),
  v.literal("inventory_reservation"),
  v.literal("storage_fee_ledger"),
  v.literal("storage_rate_rule"),
  v.literal("fee_rule"),
  v.literal("buyer"),
  v.literal("buyer_order"),
  v.literal("buyer_order_charge"),
  v.literal("sale_record"),
  v.literal("sale_deduction"),
  v.literal("dispatch"),
  v.literal("dispute"),
  v.literal("notification"),
  v.literal("app_setting"),
  v.literal("admin_role_assignment"),
  v.literal("admin_access_group"),
  v.literal("admin_access_group_member"),
  v.literal("admin_access_group_role_assignment"),
);

const genericRecord = v.record(v.string(), v.any());
const maxAuditLogLimit = 200;

function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 50, 1), maxAuditLogLimit);
}

function assertCanViewAuditLogs(
  role: "farmer" | "warehouse_agent" | "buyer" | "transporter" | "admin",
): void {
  if (!canViewAuditLogs(role)) {
    throw new Error("Only admins can view audit logs.");
  }
}

async function auditLogScopeTarget(ctx: Parameters<typeof requireAdminPermission>[0], log: {
  entityType: string;
  entityId: string;
}) {
  if (log.entityType === "warehouse") {
    return await warehouseScopeTarget(ctx, log.entityId as Id<"warehouses">);
  }
  if (log.entityType === "inventory_batch" || log.entityType === "storage_receipt") {
    const batch = await ctx.db.get(log.entityId as Id<"inventoryBatches">);
    return batch === null ? {} : await inventoryScopeTarget(ctx, batch);
  }
  if (log.entityType === "farmer") {
    const farmer = await ctx.db.get(log.entityId as Id<"farmers">);
    return farmer === null ? {} : await farmerScopeTarget(ctx, farmer);
  }
  if (log.entityType === "buyer_order") {
    const order = await ctx.db.get(log.entityId as Id<"buyerOrders">);
    return order === null ? {} : await buyerOrderScopeTarget(ctx, order);
  }
  if (log.entityType === "sale_record") {
    const sale = await ctx.db.get(log.entityId as Id<"saleRecords">);
    return sale === null ? {} : await saleScopeTarget(ctx, sale);
  }
  if (log.entityType === "dispatch") {
    const dispatch = await ctx.db.get(log.entityId as Id<"dispatches">);
    return dispatch === null ? {} : await dispatchScopeTarget(ctx, dispatch);
  }
  return {};
}

export const create = mutation({
  args: {
    actorId: v.string(),
    actorRole,
    action: v.string(),
    entityType: auditEntityType,
    entityId: v.string(),
    before: v.optional(genericRecord),
    after: v.optional(genericRecord),
    metadata: v.optional(genericRecord),
  },
  returns: v.id("auditLogs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditLogs", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const listByEntity = query({
  args: {
    requestingUserId: v.optional(v.id("users")),
    requestingActorRole: v.optional(marketplaceRole),
    entityType: auditEntityType,
    entityId: v.string(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const role = await resolveRequestingRole(ctx.db, args);
    assertCanViewAuditLogs(role);
    if (role === "admin") {
      if (args.requestingUserId === undefined) {
        throw new Error("Admin audit log access requires requestingUserId.");
      }
      await requireAdminPermission(ctx, args.requestingUserId, "auditLogs:read", await auditLogScopeTarget(ctx, {
        entityType: args.entityType,
        entityId: args.entityId,
      }));
    }

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId),
      )
      .order("desc")
      .take(100);
    if (role !== "admin") {
      return logs;
    }
    const access = await getEffectiveAdminAccess(ctx, args.requestingUserId!);
    const results = [];
    for (const log of logs) {
      if (adminAccessHasPermissionForScope(access, "auditLogs:read", await auditLogScopeTarget(ctx, log))) {
        results.push(log);
      }
    }
    return results;
  },
});

export const listRecent = query({
  args: {
    requestingUserId: v.optional(v.id("users")),
    requestingActorRole: v.optional(marketplaceRole),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const role = await resolveRequestingRole(ctx.db, args);
    assertCanViewAuditLogs(role);
    if (role === "admin") {
      if (args.requestingUserId === undefined) {
        throw new Error("Admin audit log access requires requestingUserId.");
      }
      await requireAdminPermission(ctx, args.requestingUserId, "auditLogs:read", {});
    }

    return await ctx.db
      .query("auditLogs")
      .withIndex("by_created_at")
      .order("desc")
      .take(clampLimit(args.limit));
  },
});

export const list = query({
  args: {
    requestingUserId: v.optional(v.id("users")),
    requestingActorRole: v.optional(marketplaceRole),
    actorId: v.optional(v.string()),
    actorRole: v.optional(actorRole),
    entityType: v.optional(auditEntityType),
    entityId: v.optional(v.string()),
    action: v.optional(v.string()),
    createdFrom: v.optional(v.number()),
    createdTo: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const role = await resolveRequestingRole(ctx.db, args);
    assertCanViewAuditLogs(role);
    if (role === "admin" && args.requestingUserId === undefined) {
      throw new Error("Admin audit log access requires requestingUserId.");
    }

    const limit = clampLimit(args.limit);
    const { actorId, action, entityId, entityType } = args;
    const candidates =
      entityType !== undefined && entityId !== undefined
        ? await ctx.db
            .query("auditLogs")
            .withIndex("by_entity", (q) =>
              q.eq("entityType", entityType).eq("entityId", entityId),
            )
            .order("desc")
            .take(maxAuditLogLimit * 3)
        : actorId !== undefined
          ? await ctx.db
              .query("auditLogs")
              .withIndex("by_actor", (q) => q.eq("actorId", actorId))
              .order("desc")
              .take(maxAuditLogLimit * 3)
          : action !== undefined
            ? await ctx.db
                .query("auditLogs")
                .withIndex("by_action", (q) => q.eq("action", action))
                .order("desc")
                .take(maxAuditLogLimit * 3)
            : await ctx.db
                .query("auditLogs")
                .withIndex("by_created_at")
                .order("desc")
                .take(maxAuditLogLimit * 3);

    const filtered = candidates
      .filter((log) => actorId === undefined || log.actorId === actorId)
      .filter(
        (log) =>
          args.actorRole === undefined || log.actorRole === args.actorRole,
      )
      .filter(
        (log) => entityType === undefined || log.entityType === entityType,
      )
      .filter((log) => entityId === undefined || log.entityId === entityId)
      .filter((log) => action === undefined || log.action === action)
      .filter(
        (log) =>
          args.createdFrom === undefined || log.createdAt >= args.createdFrom,
      )
      .filter(
        (log) =>
          args.createdTo === undefined || log.createdAt <= args.createdTo,
      );
    if (role !== "admin") {
      return filtered.slice(0, limit);
    }
    const access = await getEffectiveAdminAccess(ctx, args.requestingUserId!);
    const results = [];
    for (const log of filtered) {
      if (adminAccessHasPermissionForScope(access, "auditLogs:read", await auditLogScopeTarget(ctx, log))) {
        results.push(log);
      }
      if (results.length >= limit) {
        break;
      }
    }
    return results;
  },
});
