import { canManageBuyerProfile } from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { resolveActor } from "./auth";

const userStatus = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("suspended"),
  v.literal("rejected"),
  v.literal("deactivated")
);

async function auditBuyerChange(
  ctx: MutationCtx,
  actor: Doc<"users">,
  action: string,
  buyerId: Id<"buyers">,
  before: Doc<"buyers"> | null,
  after: Doc<"buyers">
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    actorId: actor._id,
    actorRole: actor.role,
    action,
    entityType: "buyer",
    entityId: buyerId,
    after,
    metadata: {
      source: "convex.buyers.createOrUpdateProfile",
      profileUserId: after.userId,
      previousStatus: before?.status,
      nextStatus: after.status
    },
    ...(before === null ? {} : { before }),
    createdAt: Date.now()
  });
}

export const createOrUpdateProfile = mutation({
  args: {
    actorUserId: v.id("users"),
    userId: v.id("users"),
    displayName: v.string(),
    phoneNumber: v.optional(v.string()),
    organizationName: v.optional(v.string()),
    preferredLocations: v.array(v.string()),
    status: v.optional(userStatus)
  },
  returns: v.id("buyers"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);

    if (!canManageBuyerProfile(actor.role)) {
      throw new Error("Actor is not allowed to manage buyer profiles.");
    }

    if (actor.role !== "admin" && actor._id !== args.userId) {
      throw new Error("Buyers can only manage their own buyer profile.");
    }

    const user = await ctx.db.get(args.userId);

    if (user === null) {
      throw new Error("Buyer user was not found.");
    }

    if (user.role !== "buyer" && actor.role !== "admin") {
      throw new Error("Buyer profiles must be linked to a buyer user.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("buyers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        displayName: args.displayName,
        phoneNumber: args.phoneNumber,
        organizationName: args.organizationName,
        preferredLocations: args.preferredLocations,
        status: args.status ?? existing.status,
        updatedAt: now
      });

      const after = await ctx.db.get(existing._id);

      if (after === null) {
        throw new Error("Updated buyer profile could not be loaded.");
      }

      await auditBuyerChange(ctx, actor, "buyer.profile_updated", existing._id, existing, after);
      return existing._id;
    }

    const buyerId = await ctx.db.insert("buyers", {
      userId: args.userId,
      displayName: args.displayName,
      preferredLocations: args.preferredLocations,
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
      ...(args.phoneNumber === undefined ? {} : { phoneNumber: args.phoneNumber }),
      ...(args.organizationName === undefined ? {} : { organizationName: args.organizationName })
    });

    const after = await ctx.db.get(buyerId);

    if (after === null) {
      throw new Error("Created buyer profile could not be loaded.");
    }

    await auditBuyerChange(ctx, actor, "buyer.profile_created", buyerId, null, after);
    return buyerId;
  }
});

export const getByUserId = query({
  args: {
    userId: v.id("users")
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("buyers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  }
});

export const getById = query({
  args: {
    buyerId: v.id("buyers")
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.buyerId);
  }
});
