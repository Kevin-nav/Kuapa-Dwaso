import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isApprovedWebPushEndpoint } from "@kuapa-dwaso/validators";
import { assertAllowed, getActor } from "./workflowHelpers";
import { assertNotificationServiceSecret } from "./notificationServiceAuth";

const surface = v.union(v.literal("app"), v.literal("ops"), v.literal("admin"));

function surfaceAllowsRole(value: "app" | "ops" | "admin", role: string) {
  return value === "app" ? ["farmer", "buyer", "transporter"].includes(role) : value === "ops" ? role === "warehouse_agent" : role === "admin";
}

export const upsert = mutation({
  args: { serviceSecret: v.string(), actorUserId: v.id("users"), surface, endpoint: v.string(), endpointHash: v.string(), p256dh: v.string(), auth: v.string(), expirationTime: v.optional(v.number()) },
  returns: v.id("pushSubscriptions"),
  handler: async (ctx, args) => {
    assertNotificationServiceSecret(args.serviceSecret);
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(surfaceAllowsRole(args.surface, actor.role), "This account cannot subscribe on this application surface.");
    assertAllowed(isApprovedWebPushEndpoint(args.endpoint), "Push endpoint is not an approved browser push service.");
    const existing = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint_hash", (q) => q.eq("endpointHash", args.endpointHash)).unique();
    const now = Date.now();
    if (existing !== null) {
      assertAllowed(existing.userId === actor._id, "This browser subscription belongs to another account.");
      await ctx.db.patch(existing._id, { surface: args.surface, endpoint: args.endpoint, p256dh: args.p256dh, auth: args.auth, ...(args.expirationTime === undefined ? {} : { expirationTime: args.expirationTime }), status: "active", updatedAt: now, lastSeenAt: now });
      return existing._id;
    }
    return await ctx.db.insert("pushSubscriptions", { userId: actor._id, surface: args.surface, endpoint: args.endpoint, endpointHash: args.endpointHash, p256dh: args.p256dh, auth: args.auth, ...(args.expirationTime === undefined ? {} : { expirationTime: args.expirationTime }), status: "active", createdAt: now, updatedAt: now, lastSeenAt: now });
  },
});

export const revoke = mutation({
  args: { serviceSecret: v.string(), actorUserId: v.id("users"), endpointHash: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    assertNotificationServiceSecret(args.serviceSecret);
    const actor = await getActor(ctx, args.actorUserId);
    const existing = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint_hash", (q) => q.eq("endpointHash", args.endpointHash)).unique();
    if (existing === null) return false;
    assertAllowed(existing.userId === actor._id, "This browser subscription belongs to another account.");
    await ctx.db.patch(existing._id, { status: "revoked", updatedAt: Date.now() });
    return true;
  },
});

export const revokeByProvider = mutation({
  args: { serviceSecret: v.string(), subscriptionId: v.id("pushSubscriptions") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    assertNotificationServiceSecret(args.serviceSecret);
    const subscription = await ctx.db.get(args.subscriptionId);
    if (subscription === null) return false;
    await ctx.db.patch(args.subscriptionId, { status: "revoked", updatedAt: Date.now() });
    return true;
  },
});

export const getStatus = query({
  args: { serviceSecret: v.string(), actorUserId: v.id("users"), endpointHash: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    assertNotificationServiceSecret(args.serviceSecret);
    const actor = await getActor(ctx, args.actorUserId);
    const subscription = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint_hash", (q) => q.eq("endpointHash", args.endpointHash)).unique();
    return subscription !== null && subscription.userId === actor._id && subscription.status === "active";
  },
});
