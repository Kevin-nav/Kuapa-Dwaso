import { v } from "convex/values";
import { calculateBulkLotAvailableQuantity, isQuantityHoldingDealStatus } from "@kuapa-dwaso/permissions";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const produceGrade = v.union(v.literal("A"), v.literal("B"), v.literal("C"), v.literal("mixed"));

const buyerVisibleStatuses = new Set(["active", "buyer_interest", "negotiation"]);

async function getAvailableQuantity(ctx: QueryCtx, bulkLot: Doc<"bulkLots">): Promise<number> {
  const deals = await ctx.db
    .query("deals")
    .withIndex("by_bulk_lot", (q) => q.eq("bulkLotId", bulkLot._id))
    .collect();
  const quantityHoldingDeals = deals.filter((deal) => isQuantityHoldingDealStatus(deal.status));

  return calculateBulkLotAvailableQuantity(bulkLot.totalQuantity, quantityHoldingDeals);
}

function toBuyerSummary(bulkLot: Doc<"bulkLots">, availableQuantity: number) {
  return {
    id: bulkLot._id,
    cropType: bulkLot.cropType,
    locationArea: bulkLot.locationArea,
    totalQuantity: bulkLot.totalQuantity,
    availableQuantity,
    unit: bulkLot.unit,
    farmerCount: bulkLot.farmerCount,
    grade: bulkLot.grade,
    priceRange: bulkLot.priceRange,
    pickupWindowStart: bulkLot.pickupWindowStart,
    pickupWindowEnd: bulkLot.pickupWindowEnd,
    status: bulkLot.status,
    transportReady: bulkLot.transportReady,
    agentId: bulkLot.agentId
  };
}

export const searchActiveForBuyers = query({
  args: {
    cropType: v.optional(v.string()),
    locationArea: v.optional(v.string()),
    minimumQuantity: v.optional(v.number()),
    grade: v.optional(produceGrade),
    maximumPricePerUnit: v.optional(v.number()),
    availableOnOrAfter: v.optional(v.number()),
    availableOnOrBefore: v.optional(v.number()),
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);
    const cropType = args.cropType;
    const locationArea = args.locationArea;
    const candidates =
      cropType !== undefined && locationArea !== undefined
        ? await ctx.db
            .query("bulkLots")
            .withIndex("by_crop_location_status", (q) =>
              q.eq("cropType", cropType).eq("locationArea", locationArea)
            )
            .collect()
        : await ctx.db.query("bulkLots").withIndex("by_status", (q) => q.eq("status", "active")).collect();

    const summaries = [];

    for (const bulkLot of candidates) {
      if (!buyerVisibleStatuses.has(bulkLot.status)) {
        continue;
      }

      const availableQuantity = await getAvailableQuantity(ctx, bulkLot);

      if (args.minimumQuantity !== undefined && availableQuantity < args.minimumQuantity) {
        continue;
      }

      summaries.push(toBuyerSummary(bulkLot, availableQuantity));
    }

    return summaries
      .filter((bulkLot) => buyerVisibleStatuses.has(bulkLot.status))
      .filter((bulkLot) => (args.cropType === undefined ? true : bulkLot.cropType === args.cropType))
      .filter((bulkLot) => (args.locationArea === undefined ? true : bulkLot.locationArea === args.locationArea))
      .filter((bulkLot) => (args.minimumQuantity === undefined ? true : bulkLot.availableQuantity >= args.minimumQuantity))
      .filter((bulkLot) => (args.grade === undefined ? true : bulkLot.grade === args.grade))
      .filter((bulkLot) =>
        args.maximumPricePerUnit === undefined || bulkLot.priceRange === undefined
          ? true
          : bulkLot.priceRange.min <= args.maximumPricePerUnit
      )
      .filter((bulkLot) =>
        args.availableOnOrAfter === undefined ? true : bulkLot.pickupWindowEnd >= args.availableOnOrAfter
      )
      .filter((bulkLot) =>
        args.availableOnOrBefore === undefined ? true : bulkLot.pickupWindowStart <= args.availableOnOrBefore
      )
      .slice(0, limit)
      ;
  }
});
