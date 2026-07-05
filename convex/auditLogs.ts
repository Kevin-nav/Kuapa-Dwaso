import { canViewAuditLogs } from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { resolveRequestingRole } from "./observabilityAccess";

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
    assertCanViewAuditLogs(await resolveRequestingRole(ctx.db, args));

    return await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId),
      )
      .order("desc")
      .take(100);
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
    assertCanViewAuditLogs(await resolveRequestingRole(ctx.db, args));

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
    assertCanViewAuditLogs(await resolveRequestingRole(ctx.db, args));

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

    return candidates
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
      )
      .slice(0, limit);
  },
});
