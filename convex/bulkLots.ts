import { canCreateBulkLot, canUpdateBulkLot, canUpdateBulkLotStatus } from "@kuapa-dwaso/permissions";
import type { BulkLotStatus, MarketplaceRole } from "@kuapa-dwaso/types";
import {
  assertListingCanEnterBulkLot,
  calculateBulkLotFromListings,
  type BulkLotListingSnapshot
} from "@kuapa-dwaso/utils";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const marketplaceRole = v.union(
  v.literal("farmer"),
  v.literal("agent"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("admin")
);

const actor = v.object({
  actorId: v.string(),
  actorRole: marketplaceRole
});

const produceGrade = v.union(v.literal("A"), v.literal("B"), v.literal("C"), v.literal("mixed"));

const bulkLotStatus = v.union(
  v.literal("forming"),
  v.literal("active"),
  v.literal("buyer_interest"),
  v.literal("negotiation"),
  v.literal("reserved"),
  v.literal("transport_pending"),
  v.literal("in_transit"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("disputed")
);

type AuditActor = {
  actorId: string;
  actorRole: MarketplaceRole;
};

const activeMembershipBulkLotStatuses = new Set([
  "forming",
  "active",
  "buyer_interest",
  "negotiation",
  "reserved",
  "transport_pending",
  "in_transit"
]);

function assertPermission(allowed: boolean, message: string): void {
  if (!allowed) {
    throw new Error(message);
  }
}

function uniqueListingIds(listingIds: Id<"produceListings">[]): Id<"produceListings">[] {
  return Array.from(new Set(listingIds));
}

function assertNoDuplicateListingIds(listingIds: Id<"produceListings">[]): void {
  if (uniqueListingIds(listingIds).length !== listingIds.length) {
    throw new Error("Bulk lot listing ids must be unique.");
  }
}

function assertPickupWindow(pickupWindowStart: number, pickupWindowEnd: number): void {
  if (pickupWindowEnd < pickupWindowStart) {
    throw new Error("Bulk lot pickup window end must be after the start.");
  }
}

function toBulkLotListingSnapshot(listing: Doc<"produceListings">): BulkLotListingSnapshot {
  const snapshot: BulkLotListingSnapshot = {
    farmerId: listing.farmerId,
    cropType: listing.cropType,
    quantity: listing.quantity,
    unit: listing.unit,
    grade: listing.grade,
    locationArea: listing.locationArea,
    availableFrom: listing.availableFrom,
    availableUntil: listing.availableUntil,
    status: listing.status
  };

  if (listing.askingPrice !== undefined) {
    snapshot.askingPrice = listing.askingPrice;
  }

  return snapshot;
}

function calculateBulkLot(
  listings: Doc<"produceListings">[],
  pickupWindowStart: number,
  pickupWindowEnd: number,
  requestedGrade?: Doc<"bulkLots">["grade"]
) {
  return calculateBulkLotFromListings(
    listings.map((listing) => toBulkLotListingSnapshot(listing)),
    pickupWindowStart,
    pickupWindowEnd,
    requestedGrade
  );
}

async function getRequiredBulkLot(ctx: MutationCtx, bulkLotId: Id<"bulkLots">): Promise<Doc<"bulkLots">> {
  const bulkLot = await ctx.db.get(bulkLotId);

  if (bulkLot === null) {
    throw new Error("Bulk lot not found.");
  }

  return bulkLot;
}

async function getRequiredListings(
  ctx: MutationCtx,
  listingIds: Id<"produceListings">[]
): Promise<Doc<"produceListings">[]> {
  const listings = await Promise.all(listingIds.map((listingId) => ctx.db.get(listingId)));

  for (const listing of listings) {
    if (listing === null) {
      throw new Error("One or more produce listings were not found.");
    }
  }

  return listings as Doc<"produceListings">[];
}

async function assertApprovedAgent(ctx: MutationCtx, agentId: Id<"agents">): Promise<void> {
  const agent = await ctx.db.get(agentId);

  if (agent === null) {
    throw new Error("Agent not found.");
  }

  if (agent.status !== "approved") {
    throw new Error("Only approved agents can manage bulk lots.");
  }
}

async function createAuditLog(
  ctx: MutationCtx,
  auditActor: AuditActor,
  action: string,
  entityType: "bulk_lot" | "produce_listing",
  entityId: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  metadata?: Record<string, unknown>
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    actorId: auditActor.actorId,
    actorRole: auditActor.actorRole,
    action,
    entityType,
    entityId,
    before,
    after,
    metadata,
    createdAt: Date.now()
  });
}

async function assertListingsAreNotInOtherActiveBulkLots(
  ctx: MutationCtx,
  listingIds: Id<"produceListings">[],
  allowedBulkLotId?: Id<"bulkLots">
): Promise<void> {
  const activeLots = await ctx.db.query("bulkLots").take(1000);

  for (const lot of activeLots) {
    if (allowedBulkLotId !== undefined && lot._id === allowedBulkLotId) {
      continue;
    }

    if (!activeMembershipBulkLotStatuses.has(lot.status)) {
      continue;
    }

    if (lot.listingIds.some((listingId) => listingIds.includes(listingId))) {
      throw new Error("One or more listings already belong to another active bulk lot.");
    }
  }
}

async function recalculateAndPatchBulkLot(
  ctx: MutationCtx,
  bulkLot: Doc<"bulkLots">,
  listingIds: Id<"produceListings">[]
): Promise<Doc<"bulkLots">> {
  const listings = await getRequiredListings(ctx, listingIds);
  const calculation = calculateBulkLot(listings, bulkLot.pickupWindowStart, bulkLot.pickupWindowEnd, bulkLot.grade);

  await ctx.db.patch(bulkLot._id, {
    listingIds,
    totalQuantity: calculation.totalQuantity,
    farmerCount: calculation.farmerCount,
    priceRange: calculation.priceRange,
    updatedAt: Date.now()
  });

  return await getRequiredBulkLot(ctx, bulkLot._id);
}

export const createBulkLot = mutation({
  args: {
    actor,
    agentId: v.id("agents"),
    listingIds: v.array(v.id("produceListings")),
    grade: v.optional(produceGrade),
    pickupWindowStart: v.number(),
    pickupWindowEnd: v.number(),
    status: v.optional(bulkLotStatus),
    transportReady: v.optional(v.boolean())
  },
  returns: v.id("bulkLots"),
  handler: async (ctx, args) => {
    assertPermission(canCreateBulkLot(args.actor.actorRole), "You do not have permission to create bulk lots.");
    assertNoDuplicateListingIds(args.listingIds);
    assertPickupWindow(args.pickupWindowStart, args.pickupWindowEnd);
    await assertApprovedAgent(ctx, args.agentId);
    await assertListingsAreNotInOtherActiveBulkLots(ctx, args.listingIds);

    const listings = await getRequiredListings(ctx, args.listingIds);
    for (const listing of listings) {
      assertListingCanEnterBulkLot(toBulkLotListingSnapshot(listing));
    }

    const calculation = calculateBulkLot(listings, args.pickupWindowStart, args.pickupWindowEnd, args.grade);
    const now = Date.now();

    const bulkLotId = await ctx.db.insert("bulkLots", {
      cropType: calculation.cropType,
      locationArea: calculation.locationArea,
      totalQuantity: calculation.totalQuantity,
      unit: calculation.unit,
      farmerCount: calculation.farmerCount,
      listingIds: args.listingIds,
      agentId: args.agentId,
      grade: calculation.grade,
      priceRange: calculation.priceRange,
      pickupWindowStart: args.pickupWindowStart,
      pickupWindowEnd: args.pickupWindowEnd,
      status: args.status ?? "forming",
      transportReady: args.transportReady ?? false,
      createdAt: now,
      updatedAt: now
    });

    for (const listing of listings) {
      await ctx.db.patch(listing._id, {
        status: "in_bulk_lot",
        updatedAt: now
      });
      const after = await ctx.db.get(listing._id);
      await createAuditLog(ctx, args.actor, "listing.added_to_bulk_lot", "produce_listing", listing._id, listing, after ?? undefined, {
        bulkLotId
      });
    }

    const bulkLot = await getRequiredBulkLot(ctx, bulkLotId);
    await createAuditLog(ctx, args.actor, "bulk_lot.created", "bulk_lot", bulkLotId, undefined, bulkLot);

    return bulkLotId;
  }
});

export const addListingToBulkLot = mutation({
  args: {
    actor,
    bulkLotId: v.id("bulkLots"),
    listingId: v.id("produceListings")
  },
  returns: v.id("bulkLots"),
  handler: async (ctx, args) => {
    assertPermission(canUpdateBulkLot(args.actor.actorRole), "You do not have permission to update bulk lots.");

    const beforeBulkLot = await getRequiredBulkLot(ctx, args.bulkLotId);
    if (beforeBulkLot.listingIds.includes(args.listingId)) {
      throw new Error("Listing is already in this bulk lot.");
    }

    await assertApprovedAgent(ctx, beforeBulkLot.agentId);
    await assertListingsAreNotInOtherActiveBulkLots(ctx, [args.listingId], args.bulkLotId);

    const listing = (await ctx.db.get(args.listingId)) ?? null;
    if (listing === null) {
      throw new Error("Produce listing not found.");
    }
    assertListingCanEnterBulkLot(toBulkLotListingSnapshot(listing));

    const nextListingIds = [...beforeBulkLot.listingIds, args.listingId];
    const listings = await getRequiredListings(ctx, nextListingIds);
    calculateBulkLot(listings, beforeBulkLot.pickupWindowStart, beforeBulkLot.pickupWindowEnd, beforeBulkLot.grade);

    await ctx.db.patch(args.listingId, {
      status: "in_bulk_lot",
      updatedAt: Date.now()
    });
    const afterListing = await ctx.db.get(args.listingId);
    const afterBulkLot = await recalculateAndPatchBulkLot(ctx, beforeBulkLot, nextListingIds);

    await createAuditLog(
      ctx,
      args.actor,
      "listing.added_to_bulk_lot",
      "produce_listing",
      args.listingId,
      listing,
      afterListing ?? undefined,
      { bulkLotId: args.bulkLotId }
    );
    await createAuditLog(ctx, args.actor, "bulk_lot.listing_added", "bulk_lot", args.bulkLotId, beforeBulkLot, afterBulkLot, {
      listingId: args.listingId
    });

    return args.bulkLotId;
  }
});

export const removeListingFromBulkLot = mutation({
  args: {
    actor,
    bulkLotId: v.id("bulkLots"),
    listingId: v.id("produceListings"),
    reason: v.optional(v.string())
  },
  returns: v.id("bulkLots"),
  handler: async (ctx, args) => {
    assertPermission(canUpdateBulkLot(args.actor.actorRole), "You do not have permission to update bulk lots.");

    const beforeBulkLot = await getRequiredBulkLot(ctx, args.bulkLotId);
    if (beforeBulkLot.status !== "forming" && beforeBulkLot.status !== "active") {
      throw new Error("Listings can only be removed from forming or active bulk lots.");
    }

    if (!beforeBulkLot.listingIds.includes(args.listingId)) {
      throw new Error("Listing is not in this bulk lot.");
    }

    const activeDeals = await ctx.db
      .query("deals")
      .withIndex("by_bulk_lot", (q) => q.eq("bulkLotId", args.bulkLotId))
      .take(1);
    if (activeDeals.length > 0) {
      throw new Error("Cannot remove listings from a bulk lot that already has deal activity.");
    }

    const listing = await ctx.db.get(args.listingId);
    if (listing === null) {
      throw new Error("Produce listing not found.");
    }

    const nextListingIds = beforeBulkLot.listingIds.filter((listingId) => listingId !== args.listingId);
    if (nextListingIds.length === 0) {
      throw new Error("Cannot remove the final listing from a bulk lot.");
    }

    const now = Date.now();
    const nextListingStatus = listing.availableUntil < now ? "expired" : "active";
    await ctx.db.patch(args.listingId, {
      status: nextListingStatus,
      updatedAt: now
    });
    const afterListing = await ctx.db.get(args.listingId);
    const afterBulkLot = await recalculateAndPatchBulkLot(ctx, beforeBulkLot, nextListingIds);

    await createAuditLog(
      ctx,
      args.actor,
      "listing.removed_from_bulk_lot",
      "produce_listing",
      args.listingId,
      listing,
      afterListing ?? undefined,
      { bulkLotId: args.bulkLotId, reason: args.reason ?? "" }
    );
    await createAuditLog(
      ctx,
      args.actor,
      "bulk_lot.listing_removed",
      "bulk_lot",
      args.bulkLotId,
      beforeBulkLot,
      afterBulkLot,
      { listingId: args.listingId, reason: args.reason ?? "" }
    );

    return args.bulkLotId;
  }
});

export const recalculateBulkLot = mutation({
  args: {
    actor,
    bulkLotId: v.id("bulkLots")
  },
  returns: v.id("bulkLots"),
  handler: async (ctx, args) => {
    assertPermission(canUpdateBulkLot(args.actor.actorRole), "You do not have permission to update bulk lots.");

    const beforeBulkLot = await getRequiredBulkLot(ctx, args.bulkLotId);
    const afterBulkLot = await recalculateAndPatchBulkLot(ctx, beforeBulkLot, beforeBulkLot.listingIds);
    await createAuditLog(ctx, args.actor, "bulk_lot.recalculated", "bulk_lot", args.bulkLotId, beforeBulkLot, afterBulkLot);

    return args.bulkLotId;
  }
});

export const updateBulkLotStatus = mutation({
  args: {
    actor,
    bulkLotId: v.id("bulkLots"),
    status: bulkLotStatus,
    reason: v.optional(v.string())
  },
  returns: v.id("bulkLots"),
  handler: async (ctx, args) => {
    assertPermission(canUpdateBulkLotStatus(args.actor.actorRole), "You do not have permission to update bulk lot status.");

    const before = await getRequiredBulkLot(ctx, args.bulkLotId);
    await ctx.db.patch(args.bulkLotId, {
      status: args.status,
      updatedAt: Date.now()
    });
    const after = await getRequiredBulkLot(ctx, args.bulkLotId);
    await createAuditLog(ctx, args.actor, "bulk_lot.status_updated", "bulk_lot", args.bulkLotId, before, after, {
      reason: args.reason ?? ""
    });

    return args.bulkLotId;
  }
});

export const listBulkLotsForBuyers = query({
  args: {
    cropType: v.optional(v.string()),
    locationArea: v.optional(v.string()),
    status: v.optional(bulkLotStatus),
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const status = args.status ?? "active";
    const limit = args.limit ?? 100;
    let bulkLots: Doc<"bulkLots">[];

    if (args.cropType !== undefined && args.locationArea !== undefined) {
      bulkLots = await ctx.db
        .query("bulkLots")
        .withIndex("by_crop_location_status", (q) =>
          q.eq("cropType", args.cropType as string).eq("locationArea", args.locationArea as string).eq("status", status as BulkLotStatus)
        )
        .take(limit);
    } else if (args.status !== undefined) {
      bulkLots = await ctx.db
        .query("bulkLots")
        .withIndex("by_status", (q) => q.eq("status", status as BulkLotStatus))
        .take(limit);
    } else {
      bulkLots = await ctx.db
        .query("bulkLots")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .take(limit);
    }

    return bulkLots
      .filter((bulkLot) => bulkLot.status === status)
      .filter((bulkLot) => args.cropType === undefined || bulkLot.cropType === args.cropType)
      .filter((bulkLot) => args.locationArea === undefined || bulkLot.locationArea === args.locationArea);
  }
});
