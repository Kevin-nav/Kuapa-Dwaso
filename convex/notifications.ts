import { v } from "convex/values";
import { assertNotificationActionAllowed } from "@kuapa-dwaso/utils";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  adminAccessHasPermissionForScope,
  assertAllowed,
  buyerOrderScopeTarget,
  dispatchScopeTarget,
  getActor,
  getEffectiveAdminAccess,
  omitUndefinedValues,
  requireAdminPermission,
  warehouseScopeTarget,
  type AdminScopeTarget,
} from "./workflowHelpers";

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
  v.literal("notification"),
  v.literal("otp"),
  v.literal("transactional"),
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
  v.literal("market_run_update"),
  v.literal("dispute_update"),
  v.literal("promotional"),
  v.literal("invite"),
  v.literal("warehouse_agent_invite"),
);
const smsTemplateKey = v.union(
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
  v.literal("warehouse_agent_invite"),
);
const rawPayload = v.record(v.string(), v.any());
const notificationPriority = v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent"));

export async function insertNotificationRecord(
  ctx: MutationCtx,
  args: {
    recipientId?: string | undefined;
    recipientUserId?: Id<"users"> | undefined;
    recipientRole: "farmer" | "warehouse_agent" | "buyer" | "transporter" | "admin";
    channel: "sms" | "in_app" | "email";
    title: string;
    message: string;
    messageKind?: "notification" | "otp" | "transactional" | "farmer_receipt" | "storage_fee_reminder" | "reservation_alert" | "sale_payment_update" | "payout_update" | "buyer_order_update" | "buyer_reservation_update" | "buyer_cancellation_update" | "dispatch_assignment" | "dispatch_status_update" | "market_run_update" | "dispute_update" | "promotional" | "invite" | "warehouse_agent_invite" | undefined;
    templateKey?: "farmer_receipt" | "storage_fee_reminder" | "reservation_alert" | "sale_payment_update" | "payout_update" | "buyer_order_update" | "buyer_reservation_update" | "buyer_cancellation_update" | "dispatch_assignment" | "dispatch_status_update" | "dispute_update" | "generic_notification" | "warehouse_agent_invite" | undefined;
    templateData?: Record<string, unknown> | undefined;
    relatedEntityType?: string | undefined;
    relatedEntityId?: string | undefined;
    marketDeliveryRunId?: Id<"marketDeliveryRuns"> | undefined;
    actionUrl?: string | undefined;
    actionRequired?: boolean | undefined;
    priority?: "low" | "normal" | "high" | "urgent" | undefined;
    dueAt?: number | undefined;
    deduplicationKey?: string | undefined;
    escalationLevel?: number | undefined;
    expiresAt?: number | undefined;
    pushEligible?: boolean | undefined;
  },
): Promise<Id<"notifications">> {
  if (args.deduplicationKey !== undefined && args.recipientUserId !== undefined) {
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_deduplication", (q) =>
        q.eq("recipientUserId", args.recipientUserId).eq("deduplicationKey", args.deduplicationKey),
      )
      .collect();
    const active = existing.find((notification) => notification.status !== "archived" && (notification.expiresAt === undefined || notification.expiresAt > Date.now()));
    if (active !== undefined) {
      return active._id;
    }
  }
  const pushEligible = args.pushEligible ?? (args.channel === "in_app" && args.recipientUserId !== undefined && args.messageKind !== "promotional");
  const notificationId = await ctx.db.insert("notifications", omitUndefinedValues({
    ...args,
    pushEligible,
    status: "pending",
    createdAt: Date.now(),
  }));
  if (pushEligible && args.recipientUserId !== undefined) {
    const surface = args.recipientRole === "warehouse_agent" ? "ops" : args.recipientRole === "admin" ? "admin" : "app";
    const subscriptions = await ctx.db.query("pushSubscriptions").withIndex("by_user_surface_status", (q) => q.eq("userId", args.recipientUserId!).eq("surface", surface).eq("status", "active")).collect();
    const now = Date.now();
    for (const subscription of subscriptions) {
      await ctx.db.insert("webPushDeliveries", {
        notificationId,
        subscriptionId: subscription._id,
        status: "pending",
        idempotencyKey: `web-push:${notificationId}:${subscription._id}`,
        attemptCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return notificationId;
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
    marketDeliveryRunId: v.optional(v.id("marketDeliveryRuns")),
    actionUrl: v.optional(v.string()),
    actionRequired: v.optional(v.boolean()),
    priority: v.optional(notificationPriority),
    dueAt: v.optional(v.number()),
    deduplicationKey: v.optional(v.string()),
    escalationLevel: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    pushEligible: v.optional(v.boolean()),
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
        messageKind: "notification" | "otp" | "transactional" | "farmer_receipt" | "storage_fee_reminder" | "reservation_alert" | "sale_payment_update" | "payout_update" | "buyer_order_update" | "buyer_reservation_update" | "buyer_cancellation_update" | "dispatch_assignment" | "dispatch_status_update" | "market_run_update" | "dispute_update" | "promotional" | "invite" | "warehouse_agent_invite";
        templateKey?: "farmer_receipt" | "storage_fee_reminder" | "reservation_alert" | "sale_payment_update" | "payout_update" | "buyer_order_update" | "buyer_reservation_update" | "buyer_cancellation_update" | "dispatch_assignment" | "dispatch_status_update" | "dispute_update" | "generic_notification" | "warehouse_agent_invite";
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

export const updateStatus = internalMutation({
  args: {
    notificationId: v.id("notifications"),
    status: notificationStatus,
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    assertAllowed(args.status === "queued" || args.status === "sent" || args.status === "failed", "Use the actor-scoped notification actions for read and archive state.");
    await ctx.db.patch(args.notificationId, omitUndefinedValues({
      status: args.status,
      updatedAt: Date.now(),
      sentAt: args.status === "sent" ? Date.now() : undefined,
    }));

    return args.notificationId;
  },
});

async function requireOwnedNotification(ctx: MutationCtx, actorUserId: Id<"users">, notificationId: Id<"notifications">, action: "read" | "acknowledge" | "archive") {
  const actor = await getActor(ctx, actorUserId);
  const notification = await ctx.db.get(notificationId);
  assertAllowed(notification !== null, "Notification was not found.");
  assertNotificationActionAllowed({
    actorUserId: actor._id,
    recipientUserId: notification.recipientUserId,
    action,
    actionRequired: notification.actionRequired,
    acknowledgedAt: notification.acknowledgedAt,
    expiresAt: notification.expiresAt,
  });
  return notification;
}

export const markRead = mutation({
  args: { actorUserId: v.id("users"), notificationId: v.id("notifications") },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    const notification = await requireOwnedNotification(ctx, args.actorUserId, args.notificationId, "read");
    if (notification.status !== "archived") {
      const now = Date.now();
      await ctx.db.patch(args.notificationId, { status: "read", readAt: notification.readAt ?? now, updatedAt: now });
    }
    return args.notificationId;
  },
});

export const acknowledge = mutation({
  args: { actorUserId: v.id("users"), notificationId: v.id("notifications") },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    const notification = await requireOwnedNotification(ctx, args.actorUserId, args.notificationId, "acknowledge");
    if (notification.acknowledgedAt === undefined) {
      const now = Date.now();
      await ctx.db.patch(args.notificationId, {
        acknowledgedAt: now,
        acknowledgedByUserId: args.actorUserId,
        status: "read",
        readAt: notification.readAt ?? now,
        updatedAt: now,
      });
    }
    return args.notificationId;
  },
});

export const archive = mutation({
  args: { actorUserId: v.id("users"), notificationId: v.id("notifications") },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    await requireOwnedNotification(ctx, args.actorUserId, args.notificationId, "archive");
    await ctx.db.patch(args.notificationId, { status: "archived", updatedAt: Date.now() });
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
    const access = await getEffectiveAdminAccess(ctx, args.actorUserId);
    assertAllowed(access.permissions.has("notifications:read"), "Admin lacks notifications:read permission.");

    const limit = Math.min(args.limit ?? 50, 100);
    const scoped = [];
    let cursor: string | null = null;
    while (scoped.length < limit) {
      const page = await (
        args.relatedEntityType !== undefined && args.relatedEntityId !== undefined
          ? ctx.db.query("notifications").withIndex("by_related_entity", (q) => q.eq("relatedEntityType", args.relatedEntityType!).eq("relatedEntityId", args.relatedEntityId!))
          : args.recipientRole !== undefined && args.status !== undefined
            ? ctx.db.query("notifications").withIndex("by_role_status", (q) => q.eq("recipientRole", args.recipientRole!).eq("status", args.status!))
            : args.status !== undefined
              ? ctx.db.query("notifications").withIndex("by_status", (q) => q.eq("status", args.status!))
              : ctx.db.query("notifications")
      ).order("desc").paginate({ cursor, numItems: 100 });
      const filtered = page.page
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
      .sort((left, right) => right.createdAt - left.createdAt);
      for (const notification of filtered) {
      if (notification.recipientUserId === actor._id) {
        scoped.push(notification);
      } else {
        let target: AdminScopeTarget = {};
        if (notification.marketDeliveryRunId !== undefined) {
          const run = await ctx.db.get(notification.marketDeliveryRunId);
          if (run === null) continue;
          target = await warehouseScopeTarget(ctx, run.originWarehouseId);
        } else if (notification.relatedEntityType === "dispatch" && notification.relatedEntityId !== undefined) {
          const dispatch = await ctx.db.get(notification.relatedEntityId as Id<"dispatches">);
          if (dispatch === null) continue;
          target = await dispatchScopeTarget(ctx, dispatch);
        } else if (notification.relatedEntityType === "buyer_order" && notification.relatedEntityId !== undefined) {
          const order = await ctx.db.get(notification.relatedEntityId as Id<"buyerOrders">);
          if (order === null) continue;
          target = await buyerOrderScopeTarget(ctx, order);
        }
        if (!adminAccessHasPermissionForScope(access, "notifications:read", target)) continue;
        scoped.push(notification);
      }
      if (scoped.length >= limit) break;
      }
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    return scoped.sort((left, right) => right.createdAt - left.createdAt).slice(0, limit);
  },
});
