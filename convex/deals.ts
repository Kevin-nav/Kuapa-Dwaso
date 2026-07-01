import {
  calculateBulkLotAvailableQuantity,
  canNegotiateDeal,
  canReviewBuyerOffer,
  canSubmitOffer,
  canTransitionDealStatus,
  canUpdateDealStatus,
  isQuantityHoldingDealStatus
} from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { resolveActor } from "./auth";
import { auditSnapshot, insertAuditLog, type Actor } from "./workflowHelpers";

const dealStatus = v.union(
  v.literal("offer_received"),
  v.literal("countered"),
  v.literal("accepted_pending_farmer_approval"),
  v.literal("accepted"),
  v.literal("transport_pending"),
  v.literal("in_transit"),
  v.literal("delivered"),
  v.literal("completed"),
  v.literal("rejected"),
  v.literal("cancelled"),
  v.literal("disputed")
);

type DealStatus =
  | "offer_received"
  | "countered"
  | "accepted_pending_farmer_approval"
  | "accepted"
  | "transport_pending"
  | "in_transit"
  | "delivered"
  | "completed"
  | "rejected"
  | "cancelled"
  | "disputed";

type DealCounterActorRole = "buyer" | "agent" | "admin";

async function getBuyerForUser(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<Doc<"buyers"> | null> {
  return await ctx.db
    .query("buyers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function getAgentForUser(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<Doc<"agents"> | null> {
  return await ctx.db
    .query("agents")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function assertBuyerCanAccessDeal(
  ctx: QueryCtx | MutationCtx,
  actor: Doc<"users">,
  deal: Doc<"deals">
): Promise<void> {
  if (actor.role === "admin") {
    return;
  }

  if (actor.role === "buyer") {
    const buyer = await ctx.db.get(deal.buyerId);

    if (buyer !== null && buyer.userId === actor._id) {
      return;
    }
  }

  if (actor.role === "agent") {
    const agent = await ctx.db.get(deal.agentId);

    if (agent !== null && agent.userId === actor._id) {
      return;
    }
  }

  throw new Error("Actor is not allowed to access this deal.");
}

function assertPositive(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be greater than zero.`);
  }
}

function calculateTotal(quantity: number, pricePerUnit: number | undefined): number | undefined {
  return pricePerUnit === undefined ? undefined : quantity * pricePerUnit;
}

function normalizeClientRequestId(clientRequestId: string | undefined): string | undefined {
  if (clientRequestId === undefined) {
    return undefined;
  }

  const normalized = clientRequestId.trim();

  if (normalized.length === 0) {
    throw new Error("Client request id must not be empty.");
  }

  return normalized;
}

async function getBulkLotAvailableQuantity(
  ctx: QueryCtx | MutationCtx,
  bulkLot: Doc<"bulkLots">,
  excludeDealId?: Id<"deals">
): Promise<number> {
  const deals = await ctx.db
    .query("deals")
    .withIndex("by_bulk_lot", (q) => q.eq("bulkLotId", bulkLot._id))
    .collect();
  const quantityHoldingDeals = deals.filter(
    (deal) => deal._id !== excludeDealId && isQuantityHoldingDealStatus(deal.status)
  );

  return calculateBulkLotAvailableQuantity(bulkLot.totalQuantity, quantityHoldingDeals);
}

function getCounterActorRole(actor: Doc<"users">): DealCounterActorRole {
  if (actor.role !== "buyer" && actor.role !== "agent" && actor.role !== "admin") {
    throw new Error("Actor is not allowed to counter deals.");
  }

  return actor.role;
}

async function auditDealChange(
  ctx: MutationCtx,
  actor: Actor,
  action: string,
  dealId: Id<"deals">,
  before: Doc<"deals"> | null,
  after: Doc<"deals">,
  metadata?: Record<string, unknown>
): Promise<void> {
  await insertAuditLog(ctx, {
    actor,
    action,
    entityType: "deal",
    entityId: dealId,
    before: before === null ? undefined : auditSnapshot(before),
    after: auditSnapshot(after),
    metadata
  });
}

async function auditBulkLotStatusChange(
  ctx: MutationCtx,
  actor: Actor,
  before: Doc<"bulkLots">,
  after: Doc<"bulkLots">,
  metadata?: Record<string, unknown>
): Promise<void> {
  await insertAuditLog(ctx, {
    actor,
    action: "bulk_lot.status_updated",
    entityType: "bulk_lot",
    entityId: before._id,
    before: auditSnapshot(before),
    after: auditSnapshot(after),
    metadata
  });
}

export const createOffer = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerId: v.optional(v.id("buyers")),
    bulkLotId: v.id("bulkLots"),
    quantity: v.number(),
    offerPricePerUnit: v.optional(v.number()),
    clientRequestId: v.optional(v.string()),
    buyerNote: v.optional(v.string())
  },
  returns: v.id("deals"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);
    const clientRequestId = normalizeClientRequestId(args.clientRequestId);

    if (!canSubmitOffer(actor.role)) {
      throw new Error("Actor is not allowed to submit buyer offers.");
    }

    assertPositive(args.quantity, "Offer quantity");

    if (args.offerPricePerUnit !== undefined) {
      assertPositive(args.offerPricePerUnit, "Offer price per unit");
    }

    const buyer =
      args.buyerId === undefined
        ? await getBuyerForUser(ctx, actor._id)
        : await ctx.db.get(args.buyerId);

    if (buyer === null) {
      throw new Error("Buyer profile was not found.");
    }

    if (actor.role !== "admin" && buyer.userId !== actor._id) {
      throw new Error("Buyers can only submit offers from their own profile.");
    }

    if (buyer.status !== "active") {
      throw new Error("Buyer profile is not active.");
    }

    if (clientRequestId !== undefined) {
      const existingDeal = await ctx.db
        .query("deals")
        .withIndex("by_buyer_bulk_lot_client_request", (q) =>
          q
            .eq("buyerId", buyer._id)
            .eq("bulkLotId", args.bulkLotId)
            .eq("clientRequestId", clientRequestId)
        )
        .unique();

      if (existingDeal !== null) {
        return existingDeal._id;
      }
    }

    const bulkLot = await ctx.db.get(args.bulkLotId);

    if (bulkLot === null) {
      throw new Error("Bulk lot was not found.");
    }

    if (bulkLot.status !== "active" && bulkLot.status !== "buyer_interest" && bulkLot.status !== "negotiation") {
      throw new Error("Offers can only be created for active buyer-visible bulk lots.");
    }

    const availableQuantityBeforeOffer = await getBulkLotAvailableQuantity(ctx, bulkLot);

    if (args.quantity > availableQuantityBeforeOffer) {
      throw new Error("Offer quantity exceeds the bulk lot available quantity.");
    }

    const now = Date.now();
    const totalAmount = calculateTotal(args.quantity, args.offerPricePerUnit);
    const dealId = await ctx.db.insert("deals", {
      buyerId: buyer._id,
      bulkLotId: bulkLot._id,
      agentId: bulkLot.agentId,
      cropType: bulkLot.cropType,
      quantity: args.quantity,
      unit: bulkLot.unit,
      status: "offer_received",
      paymentStatus: "not_required",
      createdAt: now,
      updatedAt: now,
      ...(clientRequestId === undefined ? {} : { clientRequestId }),
      ...(args.offerPricePerUnit === undefined ? {} : { offerPricePerUnit: args.offerPricePerUnit }),
      ...(args.buyerNote === undefined ? {} : { buyerNote: args.buyerNote }),
      ...(totalAmount === undefined ? {} : { totalAmount })
    });

    if (bulkLot.status === "active") {
      await ctx.db.patch(bulkLot._id, {
        status: "buyer_interest",
        updatedAt: now
      });
      const afterBulkLot = await ctx.db.get(bulkLot._id);
      if (afterBulkLot !== null) {
        await auditBulkLotStatusChange(ctx, actor, bulkLot, afterBulkLot, {
          source: "convex.deals.createOffer",
          reason: "buyer_offer_received",
          dealId
        });
      }
    }

    const after = await ctx.db.get(dealId);

    if (after === null) {
      throw new Error("Created deal could not be loaded.");
    }

    await auditDealChange(ctx, actor, "deal.offer_created", dealId, null, after, {
      source: "convex.deals.createOffer",
      clientRequestId,
      bulkLotStatusBefore: bulkLot.status,
      availableQuantityBeforeOffer,
      offeredQuantity: args.quantity,
      nextStatus: after.status
    });

    return dealId;
  }
});

export const listDeals = query({
  args: {
    actorUserId: v.id("users"),
    buyerId: v.optional(v.id("buyers")),
    agentId: v.optional(v.id("agents")),
    bulkLotId: v.optional(v.id("bulkLots")),
    status: v.optional(dealStatus),
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);
    const limit = Math.min(args.limit ?? 50, 100);
    const actorBuyer = actor.role === "buyer" ? await getBuyerForUser(ctx, actor._id) : null;
    const actorAgent = actor.role === "agent" ? await getAgentForUser(ctx, actor._id) : null;
    const buyerId = args.buyerId ?? actorBuyer?._id;
    const agentId = args.agentId ?? actorAgent?._id;

    const deals =
      buyerId !== undefined
        ? await ctx.db.query("deals").withIndex("by_buyer", (q) => q.eq("buyerId", buyerId)).collect()
        : agentId !== undefined
          ? await ctx.db.query("deals").withIndex("by_agent", (q) => q.eq("agentId", agentId)).collect()
          : args.bulkLotId !== undefined
            ? await ctx.db.query("deals").withIndex("by_bulk_lot", (q) => q.eq("bulkLotId", args.bulkLotId!)).collect()
            : args.status !== undefined
              ? await ctx.db.query("deals").withIndex("by_status", (q) => q.eq("status", args.status!)).collect()
              : await ctx.db.query("deals").take(limit);

    const filtered = deals
      .filter((deal) => (args.buyerId === undefined ? true : deal.buyerId === args.buyerId))
      .filter((deal) => (args.agentId === undefined ? true : deal.agentId === args.agentId))
      .filter((deal) => (args.bulkLotId === undefined ? true : deal.bulkLotId === args.bulkLotId))
      .filter((deal) => (args.status === undefined ? true : deal.status === args.status))
      .slice(0, limit);

    const visibleDeals = [];

    for (const deal of filtered) {
      try {
        await assertBuyerCanAccessDeal(ctx, actor, deal);
        visibleDeals.push(deal);
      } catch {
        continue;
      }
    }

    return visibleDeals;
  }
});

export const counterOffer = mutation({
  args: {
    actorUserId: v.id("users"),
    dealId: v.id("deals"),
    quantity: v.optional(v.number()),
    counterPricePerUnit: v.number(),
    note: v.optional(v.string())
  },
  returns: v.id("deals"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);

    if (!canNegotiateDeal(actor.role)) {
      throw new Error("Actor is not allowed to negotiate deals.");
    }

    assertPositive(args.counterPricePerUnit, "Counter price per unit");

    const deal = await ctx.db.get(args.dealId);

    if (deal === null) {
      throw new Error("Deal was not found.");
    }

    await assertBuyerCanAccessDeal(ctx, actor, deal);

    if (deal.status !== "offer_received" && deal.status !== "countered") {
      throw new Error("Only active offers can be countered.");
    }

    const quantity = args.quantity ?? deal.quantity;
    const counteredByRole = getCounterActorRole(actor);
    assertPositive(quantity, "Counter quantity");

    const bulkLot = await ctx.db.get(deal.bulkLotId);

    if (bulkLot === null) {
      throw new Error("Bulk lot was not found.");
    }

    const availableQuantityBeforeCounter = await getBulkLotAvailableQuantity(ctx, bulkLot, deal._id);

    if (quantity > availableQuantityBeforeCounter) {
      throw new Error("Counter quantity exceeds the bulk lot available quantity.");
    }

    await ctx.db.patch(deal._id, {
      quantity,
      counterPricePerUnit: args.counterPricePerUnit,
      counteredByRole,
      totalAmount: calculateTotal(quantity, args.counterPricePerUnit),
      status: "countered",
      updatedAt: Date.now(),
      ...(args.note === undefined || actor.role === "buyer" ? {} : { agentNote: args.note }),
      ...(args.note === undefined || actor.role !== "buyer" ? {} : { buyerNote: args.note })
    });

    const after = await ctx.db.get(deal._id);

    if (after === null) {
      throw new Error("Updated deal could not be loaded.");
    }

    await auditDealChange(ctx, actor, "deal.countered", deal._id, deal, after, {
      source: "convex.deals.counterOffer",
      previousStatus: deal.status,
      nextStatus: after.status,
      availableQuantityBeforeCounter,
      previousQuantity: deal.quantity,
      nextQuantity: after.quantity
    });
    return deal._id;
  }
});

export const markAcceptedPendingFarmerApproval = mutation({
  args: {
    actorUserId: v.id("users"),
    dealId: v.id("deals"),
    finalPricePerUnit: v.optional(v.number()),
    note: v.optional(v.string())
  },
  returns: v.object({
    dealId: v.id("deals"),
    approvalRequired: v.boolean(),
    approvalActionType: v.literal("ACCEPT_DEAL"),
    requestedByAgentId: v.id("agents"),
    summary: v.string()
  }),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);

    if (!canReviewBuyerOffer(actor.role)) {
      throw new Error("Actor is not allowed to accept offers for farmer approval.");
    }

    if (args.finalPricePerUnit !== undefined) {
      assertPositive(args.finalPricePerUnit, "Final price per unit");
    }

    const deal = await ctx.db.get(args.dealId);

    if (deal === null) {
      throw new Error("Deal was not found.");
    }

    await assertBuyerCanAccessDeal(ctx, actor, deal);

    if (deal.status !== "offer_received" && deal.status !== "countered") {
      throw new Error("Only active offers can be moved to farmer approval.");
    }

    const finalPricePerUnit = args.finalPricePerUnit ?? deal.counterPricePerUnit ?? deal.offerPricePerUnit;

    if (finalPricePerUnit === undefined) {
      throw new Error("A final price per unit is required before farmer approval.");
    }

    await ctx.db.patch(deal._id, {
      finalPricePerUnit,
      totalAmount: calculateTotal(deal.quantity, finalPricePerUnit),
      status: "accepted_pending_farmer_approval",
      updatedAt: Date.now(),
      ...(args.note === undefined ? {} : { agentNote: args.note })
    });

    const after = await ctx.db.get(deal._id);

    if (after === null) {
      throw new Error("Updated deal could not be loaded.");
    }

    await auditDealChange(ctx, actor, "deal.accepted_pending_farmer_approval", deal._id, deal, after, {
      source: "convex.deals.markAcceptedPendingFarmerApproval",
      previousStatus: deal.status,
      nextStatus: after.status,
      approvalActionType: "ACCEPT_DEAL",
      finalPricePerUnit
    });

    return {
      dealId: deal._id,
      approvalRequired: true,
      approvalActionType: "ACCEPT_DEAL" as const,
      requestedByAgentId: deal.agentId,
      summary: `${deal.cropType}: ${deal.quantity} ${deal.unit} at ${finalPricePerUnit} per ${deal.unit}`
    };
  }
});

export const updateDealStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    dealId: v.id("deals"),
    status: dealStatus,
    reason: v.optional(v.string())
  },
  returns: v.id("deals"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);

    if (!canUpdateDealStatus(actor.role)) {
      throw new Error("Actor is not allowed to update deal statuses.");
    }

    const deal = await ctx.db.get(args.dealId);

    if (deal === null) {
      throw new Error("Deal was not found.");
    }

    await assertBuyerCanAccessDeal(ctx, actor, deal);

    if (!canTransitionDealStatus(deal.status, args.status)) {
      throw new Error(`Cannot move deal from ${deal.status} to ${args.status}.`);
    }

    await ctx.db.patch(deal._id, {
      status: args.status,
      updatedAt: Date.now(),
      ...(args.reason === undefined ? {} : { statusReason: args.reason })
    });

    const after = await ctx.db.get(deal._id);

    if (after === null) {
      throw new Error("Updated deal could not be loaded.");
    }

    await auditDealChange(ctx, actor, "deal.status_updated", deal._id, deal, after, {
      source: "convex.deals.updateDealStatus",
      previousStatus: deal.status,
      nextStatus: after.status,
      reason: args.reason
    });
    return deal._id;
  }
});

export const rejectOffer = mutation({
  args: {
    actorUserId: v.id("users"),
    dealId: v.id("deals"),
    reason: v.optional(v.string())
  },
  returns: v.id("deals"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);

    if (!canReviewBuyerOffer(actor.role)) {
      throw new Error("Actor is not allowed to reject buyer offers.");
    }

    const deal = await ctx.db.get(args.dealId);

    if (deal === null) {
      throw new Error("Deal was not found.");
    }

    await assertBuyerCanAccessDeal(ctx, actor, deal);

    if (deal.status !== "offer_received" && deal.status !== "countered") {
      throw new Error("Only active offers can be rejected.");
    }

    await ctx.db.patch(deal._id, {
      status: "rejected",
      updatedAt: Date.now(),
      ...(args.reason === undefined ? {} : { statusReason: args.reason })
    });

    const after = await ctx.db.get(deal._id);

    if (after === null) {
      throw new Error("Updated deal could not be loaded.");
    }

    await auditDealChange(ctx, actor, "deal.offer_rejected", deal._id, deal, after, {
      source: "convex.deals.rejectOffer",
      previousStatus: deal.status,
      nextStatus: after.status,
      reason: args.reason
    });
    return deal._id;
  }
});

export const cancelOffer = mutation({
  args: {
    actorUserId: v.id("users"),
    dealId: v.id("deals"),
    reason: v.optional(v.string())
  },
  returns: v.id("deals"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);
    const deal = await ctx.db.get(args.dealId);

    if (deal === null) {
      throw new Error("Deal was not found.");
    }

    await assertBuyerCanAccessDeal(ctx, actor, deal);

    if (actor.role !== "buyer" && actor.role !== "admin") {
      throw new Error("Only the buyer or an admin can cancel an offer.");
    }

    if (deal.status !== "offer_received" && deal.status !== "countered" && deal.status !== "accepted_pending_farmer_approval") {
      throw new Error("Only active or pending-approval offers can be cancelled.");
    }

    await ctx.db.patch(deal._id, {
      status: "cancelled",
      updatedAt: Date.now(),
      ...(args.reason === undefined ? {} : { statusReason: args.reason })
    });

    const after = await ctx.db.get(deal._id);

    if (after === null) {
      throw new Error("Updated deal could not be loaded.");
    }

    await auditDealChange(ctx, actor, "deal.offer_cancelled", deal._id, deal, after, {
      source: "convex.deals.cancelOffer",
      previousStatus: deal.status,
      nextStatus: after.status,
      reason: args.reason
    });
    return deal._id;
  }
});
