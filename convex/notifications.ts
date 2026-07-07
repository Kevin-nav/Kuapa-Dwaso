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
  v.literal("queued"),
  v.literal("sent"),
  v.literal("read"),
  v.literal("failed"),
  v.literal("archived"),
);
const smsMessageKind = v.union(
  v.literal("invite"),
  v.literal("notification"),
  v.literal("otp"),
  v.literal("transactional"),
  v.literal("warehouse_agent_invite"),
  v.literal("farmer_receipt"),
  v.literal("storage_fee_reminder"),
  v.literal("reservation_alert"),
  v.literal("sale_payment_update"),
  v.literal("payout_update"),
  v.literal("buyer_order_update"),
  v.literal("buyer_reservation_update"),
  v.literal("buyer_cancellation_update"),
  v.literal("dispatch_assignment"),
  v.literal("dispatch_status_update"),
  v.literal("dispute_update"),
  v.literal("promotional"),
);
const smsTemplateKey = v.union(
  v.literal("warehouse_agent_invite"),
  v.literal("farmer_receipt"),
  v.literal("storage_fee_reminder"),
  v.literal("reservation_alert"),
  v.literal("sale_payment_update"),
  v.literal("payout_update"),
  v.literal("buyer_order_update"),
  v.literal("buyer_reservation_update"),
  v.literal("buyer_cancellation_update"),
  v.literal("dispatch_assignment"),
  v.literal("dispatch_status_update"),
  v.literal("dispute_update"),
  v.literal("generic_notification"),
);
const rawPayload = v.record(v.string(), v.any());

export async function insertNotificationRecord(
  ctx: MutationCtx,
  args: {
    recipientId?: string | undefined;
    recipientUserId?: Id<"users"> | undefined;
    recipientRole: "farmer" | "warehouse_agent" | "buyer" | "transporter" | "admin";
    channel: "sms" | "in_app" | "email";
    title: string;
    message: string;
    messageKind?: "invite" | "notification" | "otp" | "transactional" | "warehouse_agent_invite" | "farmer_receipt" | "storage_fee_reminder" | "reservation_alert" | "sale_payment_update" | "payout_update" | "buyer_order_update" | "buyer_reservation_update" | "buyer_cancellation_update" | "dispatch_assignment" | "dispatch_status_update" | "dispute_update" | "promotional" | undefined;
    templateKey?: "warehouse_agent_invite" | "farmer_receipt" | "storage_fee_reminder" | "reservation_alert" | "sale_payment_update" | "payout_update" | "buyer_order_update" | "buyer_reservation_update" | "buyer_cancellation_update" | "dispatch_assignment" | "dispatch_status_update" | "dispute_update" | "generic_notification" | undefined;
    templateData?: Record<string, unknown> | undefined;
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
    messageKind: v.optional(smsMessageKind),
    templateKey: v.optional(smsTemplateKey),
    templateData: v.optional(rawPayload),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    return await insertNotificationRecord(ctx, args);
  },
});

export const claimPendingSmsDeliveries = mutation({
  args: {
    limit: v.optional(v.number()),
    retryQueuedBefore: v.optional(v.number()),
  },
  returns: v.array(v.object({
    notificationId: v.id("notifications"),
    recipient: v.string(),
    title: v.string(),
    message: v.string(),
    messageKind: smsMessageKind,
    templateKey: v.optional(smsTemplateKey),
    templateData: v.optional(rawPayload),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    idempotencyKey: v.string(),
  })),
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = Math.min(args.limit ?? 25, 100);
    const pending = await ctx.db
      .query("notifications")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(limit);
    const retryQueued =
      pending.length >= limit || args.retryQueuedBefore === undefined
        ? []
        : (
            await ctx.db
              .query("notifications")
              .withIndex("by_status", (q) => q.eq("status", "queued"))
              .take(limit - pending.length)
          ).filter((notification) => (notification.updatedAt ?? notification.createdAt) <= args.retryQueuedBefore!);
    const notifications = [...pending, ...retryQueued].filter((notification) => notification.channel === "sms");
    const claimed = [];

    for (const notification of notifications) {
      const recipient = await resolveNotificationSmsRecipient(ctx, notification);
      if (recipient === undefined) {
        await ctx.db.patch(notification._id, {
          status: "failed",
          updatedAt: now,
        });
        continue;
      }
      const existingDelivery = await ctx.db
        .query("smsDeliveries")
        .withIndex("by_notification_status", (q) => q.eq("notificationId", notification._id))
        .first();
      if (existingDelivery !== null && (existingDelivery.status === "queued" || existingDelivery.status === "sent" || existingDelivery.status === "delivered")) {
        continue;
      }
      await ctx.db.patch(notification._id, {
        status: "queued",
        updatedAt: now,
      });
      const item: {
        notificationId: Id<"notifications">;
        recipient: string;
        title: string;
        message: string;
        messageKind: "invite" | "notification" | "otp" | "transactional" | "warehouse_agent_invite" | "farmer_receipt" | "storage_fee_reminder" | "reservation_alert" | "sale_payment_update" | "payout_update" | "buyer_order_update" | "buyer_reservation_update" | "buyer_cancellation_update" | "dispatch_assignment" | "dispatch_status_update" | "dispute_update" | "promotional";
        templateKey?: "warehouse_agent_invite" | "farmer_receipt" | "storage_fee_reminder" | "reservation_alert" | "sale_payment_update" | "payout_update" | "buyer_order_update" | "buyer_reservation_update" | "buyer_cancellation_update" | "dispatch_assignment" | "dispatch_status_update" | "dispute_update" | "generic_notification";
        templateData?: Record<string, unknown>;
        relatedEntityType?: string;
        relatedEntityId?: string;
        idempotencyKey: string;
      } = {
        notificationId: notification._id,
        recipient,
        title: notification.title,
        message: notification.message,
        messageKind: notification.messageKind ?? "notification",
        idempotencyKey: `notification:${notification._id}:${recipient}`,
      };
      if (notification.templateKey !== undefined) {
        item.templateKey = notification.templateKey;
      }
      if (notification.templateData !== undefined) {
        item.templateData = notification.templateData;
      }
      if (notification.relatedEntityType !== undefined) {
        item.relatedEntityType = notification.relatedEntityType;
      }
      if (notification.relatedEntityId !== undefined) {
        item.relatedEntityId = notification.relatedEntityId;
      }
      claimed.push(item);
    }

    return claimed;
  },
});

async function resolveNotificationSmsRecipient(
  ctx: MutationCtx,
  notification: {
    recipientId?: string;
    recipientUserId?: Id<"users">;
  },
): Promise<string | undefined> {
  if (notification.recipientUserId !== undefined) {
    const user = await ctx.db.get(notification.recipientUserId);
    if (user?.phoneNumber !== undefined) {
      return user.phoneNumber;
    }
  }
  if (notification.recipientId !== undefined && notification.recipientId.trim().length >= 8) {
    return notification.recipientId;
  }
  return undefined;
}

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
