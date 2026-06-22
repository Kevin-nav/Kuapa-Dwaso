import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const actorRole = v.union(
  v.literal("farmer"),
  v.literal("agent"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("admin"),
  v.literal("system")
);

const genericRecord = v.record(v.string(), v.any());

export const create = mutation({
  args: {
    actorId: v.string(),
    actorRole,
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    before: v.optional(genericRecord),
    after: v.optional(genericRecord),
    metadata: v.optional(genericRecord)
  },
  returns: v.id("auditLogs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditLogs", {
      ...args,
      createdAt: Date.now()
    });
  }
});

export const listByEntity = query({
  args: {
    entityType: v.string(),
    entityId: v.string()
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) => q.eq("entityType", args.entityType).eq("entityId", args.entityId))
      .order("desc")
      .take(100);
  }
});

export const listRecent = query({
  args: {
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_created_at")
      .order("desc")
      .take(args.limit ?? 50);
  }
});
