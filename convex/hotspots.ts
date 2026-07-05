import { canViewAuditLogs } from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { resolveRequestingRole } from "./observabilityAccess";

const marketplaceRole = v.union(
  v.literal("farmer"),
  v.literal("warehouse_agent"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("admin"),
);

type InventoryBucket = {
  warehouseId: string;
  warehouseName: string;
  cropType: string;
  unit: string;
  grade?: "A" | "B" | "C" | "mixed" | "ungraded";
  quantityAvailable: number;
  quantityReserved: number;
  quantitySold: number;
  quantitySpoiled: number;
  destinationMarketsServed: string[];
  explanation: string[];
};

function assertCanViewInventoryIntelligence(
  role: "farmer" | "warehouse_agent" | "buyer" | "transporter" | "admin",
): void {
  if (!canViewAuditLogs(role)) {
    throw new Error("Only admins can view warehouse inventory intelligence.");
  }
}

function bucketKey(warehouseId: string, cropType: string, unit: string, grade: string): string {
  return `${warehouseId}:${cropType}:${unit}:${grade}`;
}

export const listWarehouseInventoryIntelligence = query({
  args: {
    requestingUserId: v.optional(v.id("users")),
    requestingActorRole: v.optional(marketplaceRole),
    warehouseId: v.optional(v.id("warehouses")),
    cropType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      warehouseId: v.string(),
      warehouseName: v.string(),
      cropType: v.string(),
      unit: v.string(),
      grade: v.optional(v.union(v.literal("A"), v.literal("B"), v.literal("C"), v.literal("mixed"), v.literal("ungraded"))),
      quantityAvailable: v.number(),
      quantityReserved: v.number(),
      quantitySold: v.number(),
      quantitySpoiled: v.number(),
      destinationMarketsServed: v.array(v.string()),
      explanation: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    assertCanViewInventoryIntelligence(await resolveRequestingRole(ctx.db, args));

    const batches =
      args.warehouseId === undefined
        ? await ctx.db.query("inventoryBatches").collect()
        : await ctx.db
            .query("inventoryBatches")
            .withIndex("by_warehouse_status", (q) => q.eq("warehouseId", args.warehouseId!))
            .collect();

    const buckets = new Map<string, InventoryBucket>();

    for (const batch of batches) {
      if (args.cropType !== undefined && batch.cropType !== args.cropType) {
        continue;
      }

      const warehouse = await ctx.db.get(batch.warehouseId);
      if (warehouse === null) {
        continue;
      }

      const key = bucketKey(batch.warehouseId, batch.cropType, batch.unit, batch.grade);
      let bucket = buckets.get(key);
      if (bucket === undefined) {
        bucket = {
          warehouseId: batch.warehouseId,
          warehouseName: warehouse.name,
          cropType: batch.cropType,
          unit: batch.unit,
          grade: batch.grade,
          quantityAvailable: 0,
          quantityReserved: 0,
          quantitySold: 0,
          quantitySpoiled: 0,
          destinationMarketsServed: warehouse.destinationMarketsServed,
          explanation: [],
        };
        buckets.set(key, bucket);
      }

      if (batch.status === "available" || batch.status === "partially_reserved" || batch.status === "partially_sold") {
        bucket.quantityAvailable += batch.quantityAvailable;
      }
      if (batch.status === "reserved" || batch.status === "partially_reserved") {
        bucket.quantityReserved += Math.max(0, batch.quantityReceived - batch.quantityAvailable);
      }
      if (batch.status === "sold" || batch.status === "partially_sold") {
        bucket.quantitySold += Math.max(0, batch.quantityReceived - batch.quantityAvailable);
      }
      if (batch.status === "spoiled") {
        bucket.quantitySpoiled += batch.quantityReceived;
      }
    }

    return Array.from(buckets.values())
      .map((bucket) => ({
        ...bucket,
        explanation: [
          "Available quantity comes from warehouse inventory batches still sellable to buyers.",
          "Reserved and sold quantities are derived from batch status and remaining quantity.",
          "Destination markets come from the warehouse configuration.",
        ],
      }))
      .sort((a, b) => b.quantityAvailable - a.quantityAvailable)
      .slice(0, Math.min(Math.max(args.limit ?? 50, 1), 100));
  },
});
