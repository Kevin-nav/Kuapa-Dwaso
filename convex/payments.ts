import { roundMoneyAmount } from "@kuapa-dwaso/utils";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { insertNotificationRecord } from "./notifications";
import {
  assertAllowed,
  auditSnapshot,
  buyerOrderScopeTarget,
  getActor,
  insertAuditLog,
  omitUndefinedValues,
  requireAdminPermission,
} from "./workflowHelpers";

const paymentProvider = v.union(v.literal("mock"), v.literal("paystack"));
const paymentTransactionStatus = v.union(
  v.literal("initialized"),
  v.literal("pending"),
  v.literal("processing"),
  v.literal("successful"),
  v.literal("failed"),
  v.literal("abandoned"),
  v.literal("reversed"),
  v.literal("refunded"),
  v.literal("manual_review"),
);

const payoutLedgerStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("processing"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("manual_review"),
);

const genericRecord = v.record(v.string(), v.any());

type PaymentStatus = Doc<"paymentTransactions">["status"];
type PaymentProvider = Doc<"paymentTransactions">["provider"];

function cleanText(value: string, label: string): string {
  const cleaned = value.trim();
  assertAllowed(cleaned.length > 0, `${label} is required.`);
  return cleaned;
}

function orderIsPaymentEligible(order: Doc<"buyerOrders">): boolean {
  return (
    ["submitted", "awaiting_payment", "confirmed", "reserved", "preparing", "ready_for_dispatch"].includes(order.status) &&
    ["awaiting_payment", "failed", "deposit_paid"].includes(order.paymentStatus)
  );
}

function buildProviderReference(args: {
  provider: PaymentProvider;
  buyerOrderId: Id<"buyerOrders">;
  idempotencyKey: string;
}): string {
  const compactOrder = args.buyerOrderId.replace(/[^A-Za-z0-9]/g, "").slice(-14);
  const compactKey = args.idempotencyKey.replace(/[^A-Za-z0-9]/g, "").slice(0, 18);
  return `KD-${args.provider.toUpperCase()}-${compactOrder}-${compactKey}`.slice(0, 50);
}

async function requirePaymentActorForOrder(
  ctx: QueryCtx | MutationCtx,
  actorUserId: Id<"users">,
  order: Doc<"buyerOrders">,
): Promise<Doc<"users">> {
  const actor = await getActor(ctx, actorUserId);
  const buyer = await ctx.db.get(order.buyerId);
  assertAllowed(buyer !== null, "Buyer profile was not found.");
  if (actor.role === "buyer") {
    assertAllowed(buyer.userId === actor._id, "Buyers can only pay for their own orders.");
    return actor;
  }
  assertAllowed(actor.role === "admin", "Only buyers and admins can initialize buyer payments.");
  await requireAdminPermission(ctx, actorUserId, "payments:manage", await buyerOrderScopeTarget(ctx, order));
  return actor;
}

export const prepareBuyerPayment = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerOrderId: v.id("buyerOrders"),
    provider: paymentProvider,
    idempotencyKey: v.string(),
    correlationId: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const idempotencyKey = cleanText(args.idempotencyKey, "Idempotency key");
    const order = await ctx.db.get(args.buyerOrderId);
    assertAllowed(order !== null, "Buyer order was not found.");
    const actor = await requirePaymentActorForOrder(ctx, args.actorUserId, order);
    assertAllowed(orderIsPaymentEligible(order), "Buyer order is not eligible for payment.");
    assertAllowed(order.totalAmount !== undefined && order.totalAmount > 0, "Buyer order total is required before payment.");

    const existing = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
      .first();
    if (existing !== null) {
      assertAllowed(existing.buyerOrderId === args.buyerOrderId, "Idempotency key belongs to a different buyer order.");
      return await paymentInitializationDetail(ctx, existing);
    }

    const now = Date.now();
    const providerReference = buildProviderReference({
      provider: args.provider,
      buyerOrderId: args.buyerOrderId,
      idempotencyKey,
    });
    const paymentTransactionId = await ctx.db.insert("paymentTransactions", omitUndefinedValues({
      buyerOrderId: args.buyerOrderId,
      buyerId: order.buyerId,
      provider: args.provider,
      providerReference,
      amount: roundMoneyAmount(order.totalAmount),
      currency: args.currency ?? "GHS",
      status: "initialized",
      idempotencyKey,
      correlationId: args.correlationId,
      initializedByUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    }));
    await ctx.db.patch(args.buyerOrderId, {
      paymentStatus: "awaiting_payment",
      status: order.status === "submitted" ? "awaiting_payment" : order.status,
      updatedAt: now,
    });
    const transaction = await ctx.db.get(paymentTransactionId);
    await insertAuditLog(ctx, {
      actor,
      action: "payment_transaction.initialized",
      entityType: "payment_transaction",
      entityId: paymentTransactionId,
      after: transaction === null ? undefined : auditSnapshot(transaction),
    });

    return await paymentInitializationDetail(ctx, transaction!);
  },
});

export const recordProviderInitialization = mutation({
  args: {
    provider: paymentProvider,
    providerReference: v.string(),
    providerAccessCode: v.optional(v.string()),
    authorizationUrl: v.optional(v.string()),
    providerStatus: v.optional(v.string()),
    providerMessage: v.optional(v.string()),
    rawProviderData: v.optional(genericRecord),
  },
  returns: v.id("paymentTransactions"),
  handler: async (ctx, args) => {
    const transaction = await findTransaction(ctx, args.provider, args.providerReference);
    assertAllowed(transaction !== null, "Payment transaction was not found.");
    await ctx.db.patch(transaction._id, omitUndefinedValues({
      providerAccessCode: args.providerAccessCode,
      authorizationUrl: args.authorizationUrl,
      providerStatus: args.providerStatus,
      providerMessage: args.providerMessage,
      rawProviderData: args.rawProviderData,
      status: transaction.status === "initialized" ? "pending" : transaction.status,
      updatedAt: Date.now(),
    }));
    return transaction._id;
  },
});

export const reconcileProviderPayment = mutation({
  args: {
    provider: paymentProvider,
    providerReference: v.string(),
    status: paymentTransactionStatus,
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    providerStatus: v.optional(v.string()),
    providerMessage: v.optional(v.string()),
    rawProviderData: v.optional(genericRecord),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const transaction = await findTransaction(ctx, args.provider, args.providerReference);
    assertAllowed(transaction !== null, "Payment transaction was not found.");
    return await applyPaymentReconciliation(ctx, transaction, args);
  },
});

export const recordProviderEvent = mutation({
  args: {
    provider: paymentProvider,
    providerEventId: v.string(),
    providerReference: v.optional(v.string()),
    eventType: v.string(),
    normalizedStatus: paymentTransactionStatus,
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    providerStatus: v.optional(v.string()),
    providerMessage: v.optional(v.string()),
    rawPayload: genericRecord,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const providerEventId = cleanText(args.providerEventId, "Provider event id");
    const existing = await ctx.db
      .query("paymentWebhookEvents")
      .withIndex("by_provider_event", (q) => q.eq("provider", args.provider).eq("providerEventId", providerEventId))
      .first();
    if (existing !== null) {
      return { eventId: existing._id, status: existing.status, duplicate: true };
    }

    const now = Date.now();
    const eventId = await ctx.db.insert("paymentWebhookEvents", omitUndefinedValues({
      provider: args.provider,
      providerEventId,
      providerReference: args.providerReference,
      eventType: cleanText(args.eventType, "Event type"),
      status: "received",
      rawPayload: args.rawPayload,
      createdAt: now,
      updatedAt: now,
    }));

    if (args.providerReference === undefined) {
      await ctx.db.patch(eventId, {
        status: "ignored",
        processedAt: now,
        updatedAt: now,
      });
      return { eventId, status: "ignored", duplicate: false };
    }

    const transaction = await findTransaction(ctx, args.provider, args.providerReference);
    if (transaction === null) {
      await ctx.db.patch(eventId, {
        status: "ignored",
        processedAt: now,
        updatedAt: now,
      });
      return { eventId, status: "ignored", duplicate: false };
    }

    try {
      const reconciliation = await applyPaymentReconciliation(ctx, transaction, omitUndefinedValues({
        provider: args.provider,
        providerReference: args.providerReference,
        status: args.normalizedStatus,
        amount: args.amount,
        currency: args.currency,
        providerStatus: args.providerStatus,
        providerMessage: args.providerMessage,
        rawProviderData: args.rawPayload,
      }));
      await ctx.db.patch(eventId, {
        status: "processed",
        paymentTransactionId: transaction._id,
        processedAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { eventId, status: "processed", duplicate: false, reconciliation };
    } catch (error) {
      await ctx.db.patch(eventId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Payment webhook processing failed.",
        updatedAt: Date.now(),
      });
      throw error;
    }
  },
});

export const listPaymentsForFinance = query({
  args: {
    actorUserId: v.id("users"),
    status: v.optional(paymentTransactionStatus),
    buyerOrderId: v.optional(v.id("buyerOrders")),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, args.actorUserId, "payments:read", {});
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.buyerOrderId !== undefined
        ? await ctx.db
            .query("paymentTransactions")
            .withIndex("by_order", (q) => q.eq("buyerOrderId", args.buyerOrderId!))
            .take(limit * 3)
        : args.status !== undefined
          ? await ctx.db
              .query("paymentTransactions")
              .withIndex("by_status_created_at", (q) => q.eq("status", args.status!))
              .take(limit * 3)
          : await ctx.db.query("paymentTransactions").take(limit * 3);
    return candidates
      .filter((payment) => args.status === undefined || payment.status === args.status)
      .slice(0, limit);
  },
});

export const listPayoutLedgerForFinance = query({
  args: {
    actorUserId: v.id("users"),
    status: v.optional(payoutLedgerStatus),
    farmerId: v.optional(v.id("farmers")),
    buyerOrderId: v.optional(v.id("buyerOrders")),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, args.actorUserId, "payouts:read", {});
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.farmerId !== undefined && args.status !== undefined
        ? await ctx.db
            .query("payoutLedger")
            .withIndex("by_farmer_status", (q) => q.eq("farmerId", args.farmerId!).eq("status", args.status!))
            .take(limit * 3)
        : args.buyerOrderId !== undefined
          ? await ctx.db
              .query("payoutLedger")
              .withIndex("by_order", (q) => q.eq("buyerOrderId", args.buyerOrderId!))
              .take(limit * 3)
          : args.status !== undefined
            ? await ctx.db
                .query("payoutLedger")
                .withIndex("by_status_created_at", (q) => q.eq("status", args.status!))
                .take(limit * 3)
            : await ctx.db.query("payoutLedger").take(limit * 3);
    return candidates
      .filter((entry) => args.status === undefined || entry.status === args.status)
      .filter((entry) => args.farmerId === undefined || entry.farmerId === args.farmerId)
      .slice(0, limit);
  },
});

async function paymentInitializationDetail(
  ctx: QueryCtx | MutationCtx,
  transaction: Doc<"paymentTransactions">,
) {
  const [order, buyer] = await Promise.all([
    ctx.db.get(transaction.buyerOrderId),
    ctx.db.get(transaction.buyerId),
  ]);
  return { ...transaction, order, buyer };
}

async function findTransaction(
  ctx: QueryCtx | MutationCtx,
  provider: PaymentProvider,
  providerReference: string,
): Promise<Doc<"paymentTransactions"> | null> {
  return await ctx.db
    .query("paymentTransactions")
    .withIndex("by_provider_reference", (q) =>
      q.eq("provider", provider).eq("providerReference", providerReference),
    )
    .first();
}

async function applyPaymentReconciliation(
  ctx: MutationCtx,
  transaction: Doc<"paymentTransactions">,
  args: {
    provider: PaymentProvider;
    providerReference: string;
    status: PaymentStatus;
    amount?: number;
    currency?: string;
    providerStatus?: string;
    providerMessage?: string;
    rawProviderData?: Record<string, unknown>;
  },
) {
  if (transaction.status === "successful" && args.status === "successful") {
    return { paymentTransactionId: transaction._id, status: "successful", alreadyReconciled: true };
  }
  assertAllowed(args.amount === undefined || roundMoneyAmount(args.amount) === transaction.amount, "Payment amount does not match the buyer order total.");
  assertAllowed(args.currency === undefined || args.currency === transaction.currency, "Payment currency does not match the buyer order currency.");

  const now = Date.now();
  await ctx.db.patch(transaction._id, omitUndefinedValues({
    status: args.status,
    verifiedAt: now,
    paidAt: args.status === "successful" ? now : undefined,
    failedAt: ["failed", "abandoned", "reversed", "refunded"].includes(args.status) ? now : undefined,
    providerStatus: args.providerStatus,
    providerMessage: args.providerMessage,
    rawProviderData: args.rawProviderData,
    updatedAt: now,
  }));

  if (args.status === "successful") {
    await reconcileSuccessfulBuyerPayment(ctx, transaction, now);
  } else if (["failed", "abandoned"].includes(args.status)) {
    const order = await ctx.db.get(transaction.buyerOrderId);
    if (order !== null && order.paymentStatus !== "fully_paid") {
      await ctx.db.patch(order._id, {
        paymentStatus: "failed",
        updatedAt: now,
      });
      const buyer = await ctx.db.get(order.buyerId);
      await insertNotificationRecord(ctx, {
        recipientId: order.buyerId,
        recipientUserId: buyer?.userId,
        recipientRole: "buyer",
        channel: "sms",
        title: "Payment failed",
        message: `Payment for your ${order.cropType} order failed. Please try again or contact support.`,
        messageKind: "buyer_order_update",
        templateKey: "buyer_order_update",
        templateData: {
          orderCode: order._id,
          status: "payment failed",
        },
        relatedEntityType: "buyer_order",
        relatedEntityId: order._id,
      });
    }
  }

  return { paymentTransactionId: transaction._id, status: args.status, alreadyReconciled: false };
}

async function reconcileSuccessfulBuyerPayment(
  ctx: MutationCtx,
  transaction: Doc<"paymentTransactions">,
  now: number,
): Promise<void> {
  const order = await ctx.db.get(transaction.buyerOrderId);
  assertAllowed(order !== null, "Buyer order was not found.");
  await ctx.db.patch(order._id, {
    paymentStatus: "fully_paid",
    status: order.status === "awaiting_payment" || order.status === "submitted" ? "confirmed" : order.status,
    updatedAt: now,
  });
  const buyer = await ctx.db.get(order.buyerId);
  await insertNotificationRecord(ctx, {
    recipientId: order.buyerId,
    recipientUserId: buyer?.userId,
    recipientRole: "buyer",
    channel: "sms",
    title: "Payment received",
    message: `Payment received for your ${order.cropType} order. Amount: ${transaction.currency} ${transaction.amount}.`,
    messageKind: "buyer_order_update",
    templateKey: "buyer_order_update",
    templateData: {
      orderCode: order._id,
      status: "paid",
    },
    relatedEntityType: "buyer_order",
    relatedEntityId: order._id,
  });

  const sales = await ctx.db
    .query("saleRecords")
    .withIndex("by_order", (q) => q.eq("buyerOrderId", order._id))
    .collect();
  for (const sale of sales) {
    if (sale.paymentStatus === "pending") {
      await ctx.db.patch(sale._id, {
        paymentStatus: "withheld",
        updatedAt: now,
      });
    }
    const existingLedger = await ctx.db
      .query("payoutLedger")
      .withIndex("by_sale", (q) => q.eq("saleRecordId", sale._id))
      .first();
    if (existingLedger !== null) {
      continue;
    }
    const payoutLedgerId = await ctx.db.insert("payoutLedger", {
      saleRecordId: sale._id,
      farmerId: sale.farmerId,
      buyerOrderId: order._id,
      amount: sale.netAmountDueToFarmer,
      currency: transaction.currency,
      status: "pending",
      sourcePaymentTransactionId: transaction._id,
      createdAt: now,
      updatedAt: now,
    });
    const farmer = await ctx.db.get(sale.farmerId);
    await insertNotificationRecord(ctx, {
      recipientId: sale.farmerId,
      recipientUserId: farmer?.userId,
      recipientRole: "farmer",
      channel: "sms",
      title: "Payout pending",
      message: `Payout pending for your sale. Amount: ${transaction.currency} ${sale.netAmountDueToFarmer}.`,
      messageKind: "payout_update",
      templateKey: "payout_update",
      templateData: {
        amount: `${transaction.currency} ${sale.netAmountDueToFarmer}`,
        receiptCode: sale._id,
      },
      relatedEntityType: "payout_ledger",
      relatedEntityId: payoutLedgerId,
    });
  }
}
