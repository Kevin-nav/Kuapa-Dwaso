import { canViewAdminObservability } from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { resolveRequestingRole } from "./observabilityAccess";

const marketplaceRole = v.union(
  v.literal("farmer"),
  v.literal("agent"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("admin"),
);

function assertCanViewAdminObservability(
  role: "farmer" | "agent" | "buyer" | "transporter" | "admin",
): void {
  if (!canViewAdminObservability(role)) {
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
    agents: v.number(),
    buyers: v.number(),
    listings: v.number(),
    bulkLots: v.number(),
    deals: v.number(),
    transportRequests: v.number(),
    disputes: v.number(),
    openDisputes: v.number(),
  }),
  handler: async (ctx, args) => {
    assertCanViewAdminObservability(await resolveRequestingRole(ctx.db, args));

    const [
      farmers,
      agents,
      buyers,
      listings,
      bulkLots,
      deals,
      transportRequests,
      disputes,
      openDisputes,
    ] = await Promise.all([
      ctx.db.query("farmers").collect(),
      ctx.db.query("agents").collect(),
      ctx.db.query("buyers").collect(),
      ctx.db.query("produceListings").collect(),
      ctx.db.query("bulkLots").collect(),
      ctx.db.query("deals").collect(),
      ctx.db.query("transportRequests").collect(),
      ctx.db.query("disputes").collect(),
      ctx.db
        .query("disputes")
        .withIndex("by_status", (q) => q.eq("status", "open"))
        .collect(),
    ]);

    return {
      farmers: farmers.length,
      agents: agents.length,
      buyers: buyers.length,
      listings: listings.length,
      bulkLots: bulkLots.length,
      deals: deals.length,
      transportRequests: transportRequests.length,
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
