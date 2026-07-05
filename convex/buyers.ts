import { canCreateBuyerOrder } from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { resolveActor } from "./auth";
import { auditSnapshot, insertAuditLog, type Actor } from "./workflowHelpers";

const buyerType = v.union(
  v.literal("market_trader"),
  v.literal("retailer"),
  v.literal("restaurant"),
  v.literal("hotel"),
  v.literal("school"),
  v.literal("processor"),
  v.literal("exporter"),
  v.literal("institution"),
  v.literal("other"),
);
const verificationStatus = v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"));
const buyerStatus = v.union(v.literal("active"), v.literal("suspended"), v.literal("deactivated"));

async function auditBuyerChange(
  ctx: MutationCtx,
  actor: Actor,
  action: string,
  buyerId: Id<"buyers">,
  before: Doc<"buyers"> | null,
  after: Doc<"buyers">,
): Promise<void> {
  await insertAuditLog(ctx, {
    actor,
    action,
    entityType: "buyer",
    entityId: buyerId,
    before: before === null ? undefined : auditSnapshot(before),
    after: auditSnapshot(after),
  });
}

export const createOrUpdateProfile = mutation({
  args: {
    actorUserId: v.id("users"),
    userId: v.optional(v.id("users")),
    fullName: v.string(),
    phoneNumber: v.string(),
    buyerType,
    organizationName: v.optional(v.string()),
    destinationMarket: v.optional(v.string()),
    verificationStatus: v.optional(verificationStatus),
    status: v.optional(buyerStatus),
  },
  returns: v.id("buyers"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);

    if (!canCreateBuyerOrder(actor.role) && actor.role !== "admin") {
      throw new Error("Actor is not allowed to manage buyer profiles.");
    }

    if (actor.role !== "admin" && args.userId !== undefined && actor._id !== args.userId) {
      throw new Error("Buyers can only manage their own buyer profile.");
    }

    const userId = args.userId ?? (actor.role === "buyer" ? actor._id : undefined);
    if (userId !== undefined) {
      const user = await ctx.db.get(userId);
      if (user === null) {
        throw new Error("Buyer user was not found.");
      }
      if (user.role !== "buyer" && actor.role !== "admin") {
        throw new Error("Buyer profiles must be linked to a buyer user.");
      }
    }

    const now = Date.now();
    const existing =
      userId === undefined
        ? await ctx.db
            .query("buyers")
            .withIndex("by_phone_number", (q) => q.eq("phoneNumber", args.phoneNumber))
            .unique()
        : await ctx.db
            .query("buyers")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .unique();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        userId,
        fullName: args.fullName,
        phoneNumber: args.phoneNumber,
        buyerType: args.buyerType,
        organizationName: args.organizationName,
        destinationMarket: args.destinationMarket,
        verificationStatus: args.verificationStatus ?? existing.verificationStatus,
        status: args.status ?? existing.status,
        updatedAt: now,
      });

      const after = await ctx.db.get(existing._id);
      if (after === null) {
        throw new Error("Updated buyer profile could not be loaded.");
      }

      await auditBuyerChange(ctx, actor, "buyer.profile_updated", existing._id, existing, after);
      return existing._id;
    }

    const buyerId = await ctx.db.insert("buyers", {
      userId,
      fullName: args.fullName,
      phoneNumber: args.phoneNumber,
      buyerType: args.buyerType,
      organizationName: args.organizationName,
      destinationMarket: args.destinationMarket,
      verificationStatus: args.verificationStatus ?? "pending",
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });

    const after = await ctx.db.get(buyerId);
    if (after === null) {
      throw new Error("Created buyer profile could not be loaded.");
    }

    await auditBuyerChange(ctx, actor, "buyer.profile_created", buyerId, null, after);
    return buyerId;
  },
});

export const getByUserId = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("buyers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const getById = query({
  args: {
    buyerId: v.id("buyers"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.buyerId);
  },
});
