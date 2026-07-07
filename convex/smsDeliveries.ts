import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { omitUndefinedValues } from "./workflowHelpers";

const smsProvider = v.union(v.literal("mock"), v.literal("arkesel"));
const smsMessageKind = v.union(
  v.literal("invite"),
  v.literal("notification"),
  v.literal("otp"),
  v.literal("transactional"),
  v.literal("promotional"),
);
const smsDeliveryStatus = v.union(
  v.literal("pending"),
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("failed"),
  v.literal("expired"),
  v.literal("rejected"),
);
const rawPayload = v.record(v.string(), v.any());

export const recordSend = mutation({
  args: {
    provider: smsProvider,
    providerMessageId: v.string(),
    recipient: v.string(),
    status: smsDeliveryStatus,
    messageKind: v.optional(smsMessageKind),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    notificationId: v.optional(v.id("notifications")),
    creditsUsed: v.optional(v.number()),
    rawCode: v.optional(v.string()),
    rawMessage: v.optional(v.string()),
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
        messageKind: args.messageKind,
        relatedEntityType: args.relatedEntityType,
        relatedEntityId: args.relatedEntityId,
        notificationId: args.notificationId,
        creditsUsed: args.creditsUsed,
        rawCode: args.rawCode,
        rawMessage: args.rawMessage,
        updatedAt: now,
      }));
      return existing._id;
    }

    return await ctx.db.insert("smsDeliveries", omitUndefinedValues({
      ...args,
      createdAt: now,
      updatedAt: now,
    }));
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
        updatedAt: now,
      }));
      return existing._id;
    }

    return await ctx.db.insert("smsDeliveries", omitUndefinedValues({
      ...args,
      createdAt: now,
      updatedAt: now,
    }));
  },
});
