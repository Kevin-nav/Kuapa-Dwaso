import { canViewAdminObservability } from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { resolveRequestingRole } from "./observabilityAccess";

const marketplaceRole = v.union(
  v.literal("farmer"),
  v.literal("agent"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("admin"),
);

const activeBulkLotStatuses = [
  "active",
  "buyer_interest",
  "negotiation",
] as const;
const activeDealStatuses = [
  "offer_received",
  "countered",
  "accepted_pending_farmer_approval",
  "accepted",
  "transport_pending",
  "in_transit",
] as const;
const activeTransportRequestStatuses = [
  "requested",
  "matched",
  "accepted",
  "at_pickup",
  "picked_up",
  "in_transit",
] as const;

type HotspotBucket = {
  cropType: string;
  area: string;
  unit: string;
  supplyScore: number;
  demandScore: number;
  activeListings: number;
  activeBulkLots: number;
  activeDeals: number;
  activeTransportRequests: number;
  explanation: string[];
};

function assertCanViewAdminObservability(
  role: "farmer" | "agent" | "buyer" | "transporter" | "admin",
): void {
  if (!canViewAdminObservability(role)) {
    throw new Error("Only admins can view hotspot scoring.");
  }
}

function bucketKey(cropType: string, area: string, unit: string): string {
  return `${cropType.trim().toLowerCase()}|${area.trim().toLowerCase()}|${unit.trim().toLowerCase()}`;
}

function getBucket(
  buckets: Map<string, HotspotBucket>,
  cropType: string,
  area: string,
  unit: string,
): HotspotBucket {
  const key = bucketKey(cropType, area, unit);
  const existing = buckets.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const bucket = {
    cropType: cropType.trim(),
    area: area.trim(),
    unit: unit.trim(),
    supplyScore: 0,
    demandScore: 0,
    activeListings: 0,
    activeBulkLots: 0,
    activeDeals: 0,
    activeTransportRequests: 0,
    explanation: [],
  };
  buckets.set(key, bucket);
  return bucket;
}

export const list = query({
  args: {
    requestingUserId: v.optional(v.id("users")),
    requestingActorRole: v.optional(marketplaceRole),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      cropType: v.string(),
      area: v.string(),
      unit: v.string(),
      supplyScore: v.number(),
      demandScore: v.number(),
      opportunityScore: v.number(),
      activeListings: v.number(),
      activeBulkLots: v.number(),
      activeDeals: v.number(),
      activeTransportRequests: v.number(),
      explanation: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    assertCanViewAdminObservability(await resolveRequestingRole(ctx.db, args));

    const now = Date.now();
    const buckets = new Map<string, HotspotBucket>();

    const activeListings = await ctx.db
      .query("produceListings")
      .withIndex("by_status_available_until", (q) =>
        q.eq("status", "active").gte("availableUntil", now),
      )
      .collect();

    for (const listing of activeListings) {
      const bucket = getBucket(
        buckets,
        listing.cropType,
        listing.locationArea,
        listing.unit,
      );
      bucket.supplyScore += listing.quantity;
      bucket.activeListings += 1;
    }

    for (const status of activeBulkLotStatuses) {
      const lots = await ctx.db
        .query("bulkLots")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();

      for (const lot of lots) {
        const bucket = getBucket(
          buckets,
          lot.cropType,
          lot.locationArea,
          lot.unit,
        );
        bucket.supplyScore += lot.totalQuantity;
        bucket.activeBulkLots += 1;
      }
    }

    const activeDeals = [];
    for (const status of activeDealStatuses) {
      activeDeals.push(
        ...(await ctx.db
          .query("deals")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect()),
      );
    }

    for (const deal of activeDeals) {
      const lot = await ctx.db.get(deal.bulkLotId);
      const area = lot?.locationArea ?? "Unknown area";
      const bucket = getBucket(buckets, deal.cropType, area, deal.unit);
      bucket.demandScore += deal.quantity;
      bucket.activeDeals += 1;
    }

    for (const status of activeTransportRequestStatuses) {
      const requests = await ctx.db
        .query("transportRequests")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();

      for (const request of requests) {
        const deal = await ctx.db.get(request.dealId);
        if (deal === null) {
          continue;
        }

        const lot = await ctx.db.get(deal.bulkLotId);
        const area = lot?.locationArea ?? "Unknown area";
        const bucket = getBucket(buckets, deal.cropType, area, request.unit);
        bucket.activeTransportRequests += 1;
      }
    }

    const records = Array.from(buckets.values()).map((bucket) => ({
      ...bucket,
      opportunityScore: bucket.demandScore - bucket.supplyScore,
      explanation: [
        `Supply score is active listing quantity plus active bulk lot quantity in ${bucket.area}.`,
        "Demand score currently uses active deal quantities because buyer search events are not in the Wave 0 schema.",
        "Opportunity score is demand score minus supply score; positive values mean demand exceeds visible supply.",
      ],
    }));

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return records
      .sort((left, right) => {
        if (right.opportunityScore !== left.opportunityScore) {
          return right.opportunityScore - left.opportunityScore;
        }

        return right.demandScore - left.demandScore;
      })
      .slice(0, limit);
  },
});
