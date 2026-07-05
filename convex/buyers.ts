import { canCreateBuyerOrder, canUpdateUsers } from "@kuapa-dwaso/permissions";
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
    displayName: v.optional(v.string()),
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
        fullName: args.fullName.trim(),
        displayName: args.displayName?.trim(),
        phoneNumber: args.phoneNumber.trim(),
        buyerType: args.buyerType,
        organizationName: args.organizationName?.trim(),
        destinationMarket: args.destinationMarket?.trim(),
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
      fullName: args.fullName.trim(),
      displayName: args.displayName?.trim(),
      phoneNumber: args.phoneNumber.trim(),
      buyerType: args.buyerType,
      organizationName: args.organizationName?.trim(),
      destinationMarket: args.destinationMarket?.trim(),
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

export const updateVerificationStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerId: v.id("buyers"),
    verificationStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("buyers"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);
    if (!canUpdateUsers(actor.role)) {
      throw new Error("Only admins can update buyer verification status.");
    }

    const buyer = await ctx.db.get(args.buyerId);
    if (buyer === null) {
      throw new Error("Buyer profile was not found.");
    }

    await ctx.db.patch(args.buyerId, {
      verificationStatus: args.verificationStatus,
      updatedAt: Date.now(),
    });

    const after = await ctx.db.get(args.buyerId);
    if (after === null) {
      throw new Error("Updated buyer profile could not be loaded.");
    }

    await insertAuditLog(ctx, {
      actor,
      action: "buyer.verification_status_updated",
      entityType: "buyer",
      entityId: args.buyerId,
      before: auditSnapshot(buyer),
      after: auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.buyerId;
  },
});

export const updateStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerId: v.id("buyers"),
    status: buyerStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("buyers"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);
    if (!canUpdateUsers(actor.role)) {
      throw new Error("Only admins can update buyer status.");
    }

    const buyer = await ctx.db.get(args.buyerId);
    if (buyer === null) {
      throw new Error("Buyer profile was not found.");
    }

    await ctx.db.patch(args.buyerId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    const after = await ctx.db.get(args.buyerId);
    if (after === null) {
      throw new Error("Updated buyer profile could not be loaded.");
    }

    await insertAuditLog(ctx, {
      actor,
      action: "buyer.status_updated",
      entityType: "buyer",
      entityId: args.buyerId,
      before: auditSnapshot(buyer),
      after: auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.buyerId;
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

export const getByPhoneNumber = query({
  args: {
    phoneNumber: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("buyers")
      .withIndex("by_phone_number", (q) => q.eq("phoneNumber", args.phoneNumber.trim()))
      .unique();
  },
});

export const list = query({
  args: {
    status: v.optional(buyerStatus),
    verificationStatus: v.optional(verificationStatus),
    destinationMarket: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.phoneNumber !== undefined
        ? await ctx.db
            .query("buyers")
            .withIndex("by_phone_number", (q) => q.eq("phoneNumber", args.phoneNumber!.trim()))
            .take(limit)
        : args.destinationMarket !== undefined
          ? await ctx.db
              .query("buyers")
              .withIndex("by_destination_market", (q) =>
                q.eq("destinationMarket", args.destinationMarket!.trim()),
              )
              .take(limit * 3)
          : args.verificationStatus !== undefined
            ? await ctx.db
                .query("buyers")
                .withIndex("by_verification_status", (q) =>
                  q.eq("verificationStatus", args.verificationStatus!),
                )
                .take(limit * 3)
            : args.status !== undefined
              ? await ctx.db
                  .query("buyers")
                  .withIndex("by_status", (q) => q.eq("status", args.status!))
                  .take(limit * 3)
              : await ctx.db.query("buyers").take(limit * 3);

    return candidates
      .filter((buyer) => args.status === undefined || buyer.status === args.status)
      .filter(
        (buyer) =>
          args.verificationStatus === undefined ||
          buyer.verificationStatus === args.verificationStatus,
      )
      .filter(
        (buyer) =>
          args.destinationMarket === undefined ||
          buyer.destinationMarket === args.destinationMarket.trim(),
      )
      .slice(0, limit);
  },
});
