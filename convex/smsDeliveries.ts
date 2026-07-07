import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAllowed, getActor, omitUndefinedValues, requireAdminPermission } from "./workflowHelpers";

const smsProvider = v.union(v.literal("mock"), v.literal("arkesel"));
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
const smsDeliveryStatus = v.union(
  v.literal("pending"),
  v.literal("queued"),
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("failed"),
  v.literal("expired"),
  v.literal("rejected"),
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

function terminalDeliveryTime(status: "pending" | "queued" | "sent" | "delivered" | "failed" | "expired" | "rejected", now: number) {
  return status === "delivered" ? now : undefined;
}

function sentDeliveryTime(status: "pending" | "queued" | "sent" | "delivered" | "failed" | "expired" | "rejected", now: number) {
  return status === "sent" || status === "delivered" ? now : undefined;
}

export const recordSend = mutation({
  args: {
    provider: smsProvider,
    providerMessageId: v.string(),
    recipient: v.string(),
    status: smsDeliveryStatus,
    idempotencyKey: v.optional(v.string()),
    messageKind: v.optional(smsMessageKind),
    templateKey: v.optional(smsTemplateKey),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    notificationId: v.optional(v.id("notifications")),
    creditsUsed: v.optional(v.number()),
    rawCode: v.optional(v.string()),
    rawMessage: v.optional(v.string()),
    errorClass: v.optional(v.string()),
  },
  returns: v.id("smsDeliveries"),
  handler: async (ctx, args) => {
    const existingByIdempotency =
      args.idempotencyKey === undefined
        ? null
        : await ctx.db
            .query("smsDeliveries")
            .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
            .first();
    const existing =
      existingByIdempotency ??
      (await ctx.db
        .query("smsDeliveries")
        .withIndex("by_provider_message_recipient", (q) =>
          q
            .eq("provider", args.provider)
            .eq("providerMessageId", args.providerMessageId)
            .eq("recipient", args.recipient),
        )
        .first());
    const now = Date.now();
    if (existing !== null) {
      await ctx.db.patch(existing._id, omitUndefinedValues({
        status: args.status,
        providerMessageId: args.providerMessageId,
        idempotencyKey: args.idempotencyKey,
        messageKind: args.messageKind,
        templateKey: args.templateKey,
        relatedEntityType: args.relatedEntityType,
        relatedEntityId: args.relatedEntityId,
        notificationId: args.notificationId,
        creditsUsed: args.creditsUsed,
        rawCode: args.rawCode,
        rawMessage: args.rawMessage,
        errorClass: args.errorClass,
        attemptedAt: now,
        sentAt: sentDeliveryTime(args.status, now),
        deliveredAt: terminalDeliveryTime(args.status, now),
        updatedAt: now,
      }));
      if (args.notificationId !== undefined && (args.status === "sent" || args.status === "delivered" || args.status === "failed" || args.status === "expired" || args.status === "rejected")) {
        await ctx.db.patch(args.notificationId, omitUndefinedValues({
          status: args.status === "sent" || args.status === "delivered" ? "sent" : "failed",
          updatedAt: now,
          sentAt: args.status === "sent" || args.status === "delivered" ? now : undefined,
        }));
      }
      return existing._id;
    }

    const deliveryId = await ctx.db.insert("smsDeliveries", omitUndefinedValues({
      ...args,
      attemptedAt: now,
      sentAt: sentDeliveryTime(args.status, now),
      deliveredAt: terminalDeliveryTime(args.status, now),
      createdAt: now,
      updatedAt: now,
    }));
    if (args.notificationId !== undefined && (args.status === "sent" || args.status === "delivered" || args.status === "failed" || args.status === "expired" || args.status === "rejected")) {
      await ctx.db.patch(args.notificationId, omitUndefinedValues({
        status: args.status === "sent" || args.status === "delivered" ? "sent" : "failed",
        updatedAt: now,
        sentAt: args.status === "sent" || args.status === "delivered" ? now : undefined,
      }));
    }
    return deliveryId;
  },
});

export const recordDeliveryReport = mutation({
  args: {
    provider: smsProvider,
    providerMessageId: v.string(),
    recipient: v.string(),
    status: smsDeliveryStatus,
    network: v.optional(v.string()),
    providerTimestamp: v.optional(v.number()),
    creditsCharged: v.optional(v.number()),
    rawPayload: v.optional(rawPayload),
  },
  returns: v.id("smsDeliveries"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("smsDeliveries")
      .withIndex("by_provider_message_recipient", (q) =>
        q
          .eq("provider", args.provider)
          .eq("providerMessageId", args.providerMessageId)
          .eq("recipient", args.recipient),
      )
      .first();
    const now = Date.now();
    if (existing !== null) {
      await ctx.db.patch(existing._id, omitUndefinedValues({
        status: args.status,
        network: args.network,
        providerTimestamp: args.providerTimestamp,
        creditsCharged: args.creditsCharged,
        rawPayload: args.rawPayload,
        deliveredAt: terminalDeliveryTime(args.status, args.providerTimestamp ?? now),
        updatedAt: now,
      }));
      if (existing.notificationId !== undefined && (args.status === "delivered" || args.status === "failed" || args.status === "expired" || args.status === "rejected")) {
        await ctx.db.patch(existing.notificationId, omitUndefinedValues({
          status: args.status === "delivered" ? "sent" : "failed",
          updatedAt: now,
          sentAt: args.status === "delivered" ? (args.providerTimestamp ?? now) : existing.sentAt,
        }));
      }
      return existing._id;
    }

    return await ctx.db.insert("smsDeliveries", omitUndefinedValues({
      ...args,
      createdAt: now,
      updatedAt: now,
    }));
  },
});

export const listForAdmin = query({
  args: {
    actorUserId: v.id("users"),
    status: v.optional(smsDeliveryStatus),
    messageKind: v.optional(smsMessageKind),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin", "Only admins can inspect SMS deliveries.");
    await requireAdminPermission(ctx, args.actorUserId, "notifications:read", {});
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.relatedEntityType !== undefined && args.relatedEntityId !== undefined
        ? await ctx.db
            .query("smsDeliveries")
            .withIndex("by_related_entity", (q) =>
              q.eq("relatedEntityType", args.relatedEntityType!).eq("relatedEntityId", args.relatedEntityId!),
            )
            .take(limit * 4)
        : args.status !== undefined
          ? await ctx.db
              .query("smsDeliveries")
              .withIndex("by_status_created_at", (q) => q.eq("status", args.status!))
              .take(limit * 4)
          : await ctx.db.query("smsDeliveries").take(limit * 4);

    return candidates
      .filter((delivery) => args.status === undefined || delivery.status === args.status)
      .filter((delivery) => args.messageKind === undefined || delivery.messageKind === args.messageKind)
      .filter((delivery) => args.relatedEntityType === undefined || delivery.relatedEntityType === args.relatedEntityType)
      .filter((delivery) => args.relatedEntityId === undefined || delivery.relatedEntityId === args.relatedEntityId)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, limit);
  },
});
