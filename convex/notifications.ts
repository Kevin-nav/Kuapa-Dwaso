import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { assertAllowed, getActor, omitUndefinedValues, requireAdminPermission } from "./workflowHelpers";

const marketplaceRole = v.union(
  v.literal("farmer"),
  v.literal("warehouse_agent"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("admin"),
);

const notificationChannel = v.union(
  v.literal("sms"),
  v.literal("in_app"),
  v.literal("email"),
);

const notificationStatus = v.union(
  v.literal("pending"),
  v.literal("sent"),
  v.literal("read"),
  v.literal("failed"),
  v.literal("archived"),
);

export async function insertNotificationRecord(
  ctx: MutationCtx,
  args: {
    recipientId?: string | undefined;
    recipientUserId?: Id<"users"> | undefined;
    recipientRole: "farmer" | "warehouse_agent" | "buyer" | "transporter" | "admin";
    channel: "sms" | "in_app" | "email";
    title: string;
    message: string;
    relatedEntityType?: string | undefined;
    relatedEntityId?: string | undefined;
  },
): Promise<Id<"notifications">> {
  return await ctx.db.insert("notifications", omitUndefinedValues({
    ...args,
    status: "pending",
    createdAt: Date.now(),
  }));
}

export const createRecord = mutation({
  args: {
    recipientId: v.optional(v.string()),
    recipientUserId: v.optional(v.id("users")),
    recipientRole: marketplaceRole,
    channel: notificationChannel,
    title: v.string(),
    message: v.string(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    return await insertNotificationRecord(ctx, args);
  },
});

export const updateStatus = mutation({
  args: {
    notificationId: v.id("notifications"),
    status: notificationStatus,
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, omitUndefinedValues({
      status: args.status,
      updatedAt: Date.now(),
      sentAt: args.status === "sent" ? Date.now() : undefined,
      readAt: args.status === "read" ? Date.now() : undefined,
    }));

    return args.notificationId;
  },
});

export const listForActor = query({
  args: {
    actorUserId: v.id("users"),
    status: v.optional(notificationStatus),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.status === undefined
        ? await ctx.db
            .query("notifications")
            .withIndex("by_recipient_status", (q) => q.eq("recipientUserId", actor._id))
            .take(limit)
        : await ctx.db
            .query("notifications")
            .withIndex("by_recipient_status", (q) =>
              q.eq("recipientUserId", actor._id).eq("status", args.status!),
            )
            .take(limit);

    return candidates;
  },
});

export const listByRelatedEntity = query({
  args: {
    actorUserId: v.id("users"),
    relatedEntityType: v.string(),
    relatedEntityId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin", "Only admins can inspect related notifications.");
    await requireAdminPermission(ctx, args.actorUserId, "notifications:read", {});

    return await ctx.db
      .query("notifications")
      .withIndex("by_related_entity", (q) =>
        q
          .eq("relatedEntityType", args.relatedEntityType)
          .eq("relatedEntityId", args.relatedEntityId),
      )
      .take(Math.min(args.limit ?? 50, 100));
  },
});

export const listForAdmin = query({
  args: {
    actorUserId: v.id("users"),
    status: v.optional(notificationStatus),
    recipientRole: v.optional(marketplaceRole),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin", "Only admins can inspect platform notifications.");
    await requireAdminPermission(ctx, args.actorUserId, "notifications:read", {});

    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.relatedEntityType !== undefined && args.relatedEntityId !== undefined
        ? await ctx.db
            .query("notifications")
            .withIndex("by_related_entity", (q) =>
              q.eq("relatedEntityType", args.relatedEntityType!).eq("relatedEntityId", args.relatedEntityId!),
            )
            .take(limit * 4)
        : args.recipientRole !== undefined && args.status !== undefined
          ? await ctx.db
              .query("notifications")
              .withIndex("by_role_status", (q) => q.eq("recipientRole", args.recipientRole!).eq("status", args.status!))
              .take(limit * 4)
          : args.status !== undefined
            ? await ctx.db
                .query("notifications")
                .withIndex("by_status", (q) => q.eq("status", args.status!))
                .take(limit * 4)
            : await ctx.db.query("notifications").take(limit * 4);

    return candidates
      .filter((notification) => args.status === undefined || notification.status === args.status)
      .filter((notification) => args.recipientRole === undefined || notification.recipientRole === args.recipientRole)
      .filter(
        (notification) =>
          args.relatedEntityType === undefined ||
          notification.relatedEntityType === args.relatedEntityType,
      )
      .filter(
        (notification) =>
          args.relatedEntityId === undefined ||
          notification.relatedEntityId === args.relatedEntityId,
      )
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, limit);
  },
});
