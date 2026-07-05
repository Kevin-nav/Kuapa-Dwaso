import { canViewAuditLogs } from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { resolveRequestingRole } from "./observabilityAccess";

const marketplaceRole = v.union(
  v.literal("farmer"),
  v.literal("warehouse_agent"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("admin"),
);

function assertCanViewAdminObservability(
  role: "farmer" | "warehouse_agent" | "buyer" | "transporter" | "admin",
): void {
  if (!canViewAuditLogs(role)) {
    throw new Error("Only admins can view platform observability.");
  }
}

export const getPlatformSummaryCounts = query({
  args: {
    requestingUserId: v.optional(v.id("users")),
    requestingActorRole: v.optional(marketplaceRole),
  },
  returns: v.object({
    farmers: v.number(),
    warehouseAgents: v.number(),
    warehouses: v.number(),
    buyers: v.number(),
    inventoryBatches: v.number(),
    availableInventoryBatches: v.number(),
    buyerOrders: v.number(),
    saleRecords: v.number(),
    dispatches: v.number(),
    disputes: v.number(),
    openDisputes: v.number(),
  }),
  handler: async (ctx, args) => {
    assertCanViewAdminObservability(await resolveRequestingRole(ctx.db, args));

    const [
      farmers,
      warehouseAgents,
      warehouses,
      buyers,
      inventoryBatches,
      availableInventoryBatches,
      buyerOrders,
      saleRecords,
      dispatches,
      disputes,
      openDisputes,
    ] = await Promise.all([
      ctx.db.query("farmers").collect(),
      ctx.db.query("warehouseAgents").collect(),
      ctx.db.query("warehouses").collect(),
      ctx.db.query("buyers").collect(),
      ctx.db.query("inventoryBatches").collect(),
      ctx.db
        .query("inventoryBatches")
        .withIndex("by_status", (q) => q.eq("status", "available"))
        .collect(),
      ctx.db.query("buyerOrders").collect(),
      ctx.db.query("saleRecords").collect(),
      ctx.db.query("dispatches").collect(),
      ctx.db.query("disputes").collect(),
      ctx.db
        .query("disputes")
        .withIndex("by_status", (q) => q.eq("status", "open"))
        .collect(),
    ]);

    return {
      farmers: farmers.length,
      warehouseAgents: warehouseAgents.length,
      warehouses: warehouses.length,
      buyers: buyers.length,
      inventoryBatches: inventoryBatches.length,
      availableInventoryBatches: availableInventoryBatches.length,
      buyerOrders: buyerOrders.length,
      saleRecords: saleRecords.length,
      dispatches: dispatches.length,
      disputes: disputes.length,
      openDisputes: openDisputes.length,
    };
  },
});

export const listRecentActivity = query({
  args: {
    requestingUserId: v.optional(v.id("users")),
    requestingActorRole: v.optional(marketplaceRole),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    assertCanViewAdminObservability(await resolveRequestingRole(ctx.db, args));

    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
  },
});
