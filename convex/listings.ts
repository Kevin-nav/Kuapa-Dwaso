import { canCreateListing, canUpdateProduceListing, canUpdateProduceListingStatus } from "@kuapa-dwaso/permissions";
import type { ListingStatus, ProduceGrade } from "@kuapa-dwaso/types";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { auditSnapshot, getActor, insertAuditLog, type Actor } from "./workflowHelpers";

const produceGrade = v.union(v.literal("A"), v.literal("B"), v.literal("C"), v.literal("mixed"));

const listingStatus = v.union(
  v.literal("draft"),
  v.literal("pending_verification"),
  v.literal("active"),
  v.literal("in_bulk_lot"),
  v.literal("reserved"),
  v.literal("sold"),
  v.literal("expired"),
  v.literal("disputed"),
  v.literal("cancelled")
);

const listingWriteFields = {
  cropType: v.string(),
  quantity: v.number(),
  unit: v.string(),
  grade: produceGrade,
  askingPrice: v.optional(v.number()),
  negotiable: v.boolean(),
  locationArea: v.string(),
  approximatePickupArea: v.optional(v.string()),
  availableFrom: v.number(),
  availableUntil: v.number(),
  images: v.array(v.string()),
  lastVerifiedAt: v.optional(v.number())
};

type ListingPatch = Partial<{
  cropType: string;
  quantity: number;
  unit: string;
  grade: ProduceGrade;
  askingPrice: number;
  negotiable: boolean;
  locationArea: string;
  approximatePickupArea: string;
  availableFrom: number;
  availableUntil: number;
  images: string[];
  lastVerifiedAt: number;
}>;

function assertPermission(allowed: boolean, message: string): void {
  if (!allowed) {
    throw new Error(message);
  }
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Listing quantity must be greater than zero.");
  }
}

function assertAvailabilityWindow(availableFrom: number, availableUntil: number): void {
  if (availableUntil < availableFrom) {
    throw new Error("Listing availability end must be after the start.");
  }
}

function normalizeImages(images: string[]): string[] {
  const normalized = images.map((image) => image.trim()).filter((image) => image.length > 0);
  return Array.from(new Set(normalized));
}

async function getRequiredListing(ctx: MutationCtx, listingId: Id<"produceListings">) {
  const listing = await ctx.db.get(listingId);

  if (listing === null) {
    throw new Error("Produce listing not found.");
  }

  return listing;
}

async function assertFarmerAndAgentExist(
  ctx: MutationCtx | QueryCtx,
  farmerId: Id<"farmers">,
  agentId: Id<"agents">
): Promise<void> {
  const farmer = await ctx.db.get(farmerId);
  if (farmer === null) {
    throw new Error("Farmer not found.");
  }

  const agent = await ctx.db.get(agentId);
  if (agent === null) {
    throw new Error("Agent not found.");
  }

  if (agent.status !== "approved") {
    throw new Error("Only approved agents can manage produce listings.");
  }
}

async function assertActorCanManageAgent(ctx: QueryCtx | MutationCtx, actor: Actor, agentId: Id<"agents">): Promise<void> {
  if (actor.role === "admin") {
    return;
  }

  if (actor.role !== "agent") {
    throw new Error("Only admins and assigned agents can manage produce listings.");
  }

  const agent = await ctx.db.get(agentId);
  if (agent === null || agent.userId !== actor._id || agent.status !== "approved") {
    throw new Error("Agents can only manage listings for their own approved agent profile.");
  }
}

async function auditListingChange(
  ctx: MutationCtx,
  actor: Actor,
  action: string,
  entityId: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  metadata?: Record<string, unknown>
): Promise<void> {
  await insertAuditLog(ctx, {
    actor,
    action,
    entityType: "produce_listing",
    entityId,
    before,
    after,
    metadata
  });
}

function publicListing(listing: Doc<"produceListings">): Doc<"produceListings"> {
  return listing;
}

function isExpiredCandidate(status: ListingStatus): boolean {
  return status === "active" || status === "pending_verification" || status === "draft";
}

export const createListing = mutation({
  args: {
    actorUserId: v.id("users"),
    farmerId: v.id("farmers"),
    agentId: v.id("agents"),
    ...listingWriteFields,
    status: v.optional(listingStatus)
  },
  returns: v.id("produceListings"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertPermission(canCreateListing(actor.role), "You do not have permission to create listings.");
    assertPositiveQuantity(args.quantity);
    assertAvailabilityWindow(args.availableFrom, args.availableUntil);
    await assertFarmerAndAgentExist(ctx, args.farmerId, args.agentId);
    await assertActorCanManageAgent(ctx, actor, args.agentId);

    const now = Date.now();
    const images = normalizeImages(args.images);
    const status = args.status ?? (args.lastVerifiedAt === undefined ? "pending_verification" : "active");

    const listingId = await ctx.db.insert("produceListings", {
      farmerId: args.farmerId,
      agentId: args.agentId,
      cropType: args.cropType,
      quantity: args.quantity,
      unit: args.unit,
      grade: args.grade,
      askingPrice: args.askingPrice,
      negotiable: args.negotiable,
      locationArea: args.locationArea,
      approximatePickupArea: args.approximatePickupArea,
      availableFrom: args.availableFrom,
      availableUntil: args.availableUntil,
      images,
      status,
      lastVerifiedAt: args.lastVerifiedAt,
      createdAt: now,
      updatedAt: now
    });

    const listing = await ctx.db.get(listingId);
    await auditListingChange(ctx, actor, "listing.created", listingId, undefined, listing ?? undefined, {
      imageCount: images.length
    });

    return listingId;
  }
});

export const updateListing = mutation({
  args: {
    actorUserId: v.id("users"),
    listingId: v.id("produceListings"),
    cropType: v.optional(v.string()),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    grade: v.optional(produceGrade),
    askingPrice: v.optional(v.number()),
    negotiable: v.optional(v.boolean()),
    locationArea: v.optional(v.string()),
    approximatePickupArea: v.optional(v.string()),
    availableFrom: v.optional(v.number()),
    availableUntil: v.optional(v.number()),
    images: v.optional(v.array(v.string())),
    lastVerifiedAt: v.optional(v.number())
  },
  returns: v.id("produceListings"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertPermission(canUpdateProduceListing(actor.role), "You do not have permission to update listings.");

    const before = await getRequiredListing(ctx, args.listingId);
    await assertActorCanManageAgent(ctx, actor, before.agentId);
    const quantity = args.quantity ?? before.quantity;
    const availableFrom = args.availableFrom ?? before.availableFrom;
    const availableUntil = args.availableUntil ?? before.availableUntil;

    assertPositiveQuantity(quantity);
    assertAvailabilityWindow(availableFrom, availableUntil);

    const patch: ListingPatch & { updatedAt: number } = {
      updatedAt: Date.now()
    };

    if (args.cropType !== undefined) patch.cropType = args.cropType;
    if (args.quantity !== undefined) patch.quantity = args.quantity;
    if (args.unit !== undefined) patch.unit = args.unit;
    if (args.grade !== undefined) patch.grade = args.grade;
    if (args.askingPrice !== undefined) patch.askingPrice = args.askingPrice;
    if (args.negotiable !== undefined) patch.negotiable = args.negotiable;
    if (args.locationArea !== undefined) patch.locationArea = args.locationArea;
    if (args.approximatePickupArea !== undefined) patch.approximatePickupArea = args.approximatePickupArea;
    if (args.availableFrom !== undefined) patch.availableFrom = args.availableFrom;
    if (args.availableUntil !== undefined) patch.availableUntil = args.availableUntil;
    if (args.images !== undefined) patch.images = normalizeImages(args.images);
    if (args.lastVerifiedAt !== undefined) patch.lastVerifiedAt = args.lastVerifiedAt;

    await ctx.db.patch(args.listingId, patch);
    const after = await getRequiredListing(ctx, args.listingId);
    await auditListingChange(ctx, actor, "listing.updated", args.listingId, auditSnapshot(before), auditSnapshot(after));

    return args.listingId;
  }
});

export const updateListingStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    listingId: v.id("produceListings"),
    status: listingStatus,
    reason: v.optional(v.string())
  },
  returns: v.id("produceListings"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertPermission(
      canUpdateProduceListingStatus(actor.role),
      "You do not have permission to update listing status."
    );

    const before = await getRequiredListing(ctx, args.listingId);
    await assertActorCanManageAgent(ctx, actor, before.agentId);
    await ctx.db.patch(args.listingId, {
      status: args.status,
      updatedAt: Date.now()
    });
    const after = await getRequiredListing(ctx, args.listingId);
    await auditListingChange(ctx, actor, "listing.status_updated", args.listingId, auditSnapshot(before), auditSnapshot(after), {
      reason: args.reason ?? ""
    });

    return args.listingId;
  }
});

export const expireListing = mutation({
  args: {
    actorUserId: v.id("users"),
    listingId: v.id("produceListings"),
    now: v.optional(v.number())
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertPermission(
      canUpdateProduceListingStatus(actor.role),
      "You do not have permission to expire listings."
    );

    const listing = await getRequiredListing(ctx, args.listingId);
    await assertActorCanManageAgent(ctx, actor, listing.agentId);
    const timestamp = args.now ?? Date.now();

    if (!isExpiredCandidate(listing.status) || listing.availableUntil >= timestamp) {
      return false;
    }

    await ctx.db.patch(args.listingId, {
      status: "expired",
      updatedAt: timestamp
    });
    const after = await getRequiredListing(ctx, args.listingId);
    await auditListingChange(ctx, actor, "listing.expired", args.listingId, auditSnapshot(listing), auditSnapshot(after));

    return true;
  }
});

export const markExpiredListings = mutation({
  args: {
    actorUserId: v.id("users"),
    now: v.optional(v.number()),
    limit: v.optional(v.number())
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertPermission(
      canUpdateProduceListingStatus(actor.role),
      "You do not have permission to expire listings."
    );

    const timestamp = args.now ?? Date.now();
    const candidates = await ctx.db
      .query("produceListings")
      .withIndex("by_status_available_until", (q) => q.eq("status", "active").lt("availableUntil", timestamp))
      .take(args.limit ?? 100);

    for (const listing of candidates) {
      await assertActorCanManageAgent(ctx, actor, listing.agentId);
      await ctx.db.patch(listing._id, {
        status: "expired",
        updatedAt: timestamp
      });
      const after = await ctx.db.get(listing._id);
      await auditListingChange(ctx, actor, "listing.expired", listing._id, auditSnapshot(listing), after ?? undefined);
    }

    return candidates.length;
  }
});

export const listListings = query({
  args: {
    agentId: v.optional(v.id("agents")),
    farmerId: v.optional(v.id("farmers")),
    status: v.optional(listingStatus),
    cropType: v.optional(v.string()),
    locationArea: v.optional(v.string()),
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    let listings: Doc<"produceListings">[];

    if (args.cropType !== undefined && args.locationArea !== undefined && args.status !== undefined) {
      listings = await ctx.db
        .query("produceListings")
        .withIndex("by_crop_location_status", (q) =>
          q.eq("cropType", args.cropType as string).eq("locationArea", args.locationArea as string).eq("status", args.status as ListingStatus)
        )
        .take(limit);
    } else if (args.agentId !== undefined) {
      listings = await ctx.db
        .query("produceListings")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId as Id<"agents">))
        .take(limit);
    } else if (args.farmerId !== undefined) {
      listings = await ctx.db
        .query("produceListings")
        .withIndex("by_farmer", (q) => q.eq("farmerId", args.farmerId as Id<"farmers">))
        .take(limit);
    } else if (args.status !== undefined) {
      listings = await ctx.db
        .query("produceListings")
        .withIndex("by_status_available_until", (q) => q.eq("status", args.status as ListingStatus))
        .take(limit);
    } else {
      listings = await ctx.db.query("produceListings").take(limit);
    }

    return listings
      .filter((listing) => args.agentId === undefined || listing.agentId === args.agentId)
      .filter((listing) => args.farmerId === undefined || listing.farmerId === args.farmerId)
      .filter((listing) => args.status === undefined || listing.status === args.status)
      .filter((listing) => args.cropType === undefined || listing.cropType === args.cropType)
      .filter((listing) => args.locationArea === undefined || listing.locationArea === args.locationArea)
      .map(publicListing);
  }
});
