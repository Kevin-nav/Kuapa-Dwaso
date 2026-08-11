import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const claimPending = mutation({
  args: { limit: v.optional(v.number()), retryProcessingBefore: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 25, 100);
    const pending = await ctx.db.query("webPushDeliveries").withIndex("by_status_created_at", (q) => q.eq("status", "pending")).take(limit);
    const retry = pending.length >= limit || args.retryProcessingBefore === undefined ? [] : (await ctx.db.query("webPushDeliveries").withIndex("by_status_created_at", (q) => q.eq("status", "processing")).take(limit - pending.length)).filter((item) => item.updatedAt <= args.retryProcessingBefore!);
    const claimed = [];
    for (const delivery of [...pending, ...retry]) {
      const [subscription, notification] = await Promise.all([ctx.db.get(delivery.subscriptionId), ctx.db.get(delivery.notificationId)]);
      if (subscription === null || notification === null || subscription.status !== "active") {
        await ctx.db.patch(delivery._id, { status: "failed", lastError: "Subscription is unavailable.", updatedAt: Date.now() });
        continue;
      }
      await ctx.db.patch(delivery._id, { status: "processing", attemptCount: delivery.attemptCount + 1, updatedAt: Date.now() });
      claimed.push({ deliveryId: delivery._id, subscriptionId: subscription._id, endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth }, actionUrl: notification.actionUrl ?? "/", idempotencyKey: delivery.idempotencyKey });
    }
    return claimed;
  },
});

export const updateStatus = mutation({
  args: { deliveryId: v.id("webPushDeliveries"), status: v.union(v.literal("sent"), v.literal("failed")), error: v.optional(v.string()) },
  returns: v.id("webPushDeliveries"),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deliveryId, { status: args.status, ...(args.error === undefined ? {} : { lastError: args.error.slice(0, 500) }), ...(args.status === "sent" ? { sentAt: Date.now() } : {}), updatedAt: Date.now() });
    return args.deliveryId;
  },
});
