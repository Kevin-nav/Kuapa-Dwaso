import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Seed script for Western and Western North region warehouses.
 *
 * Usage (Convex dashboard or CLI):
 *   npx convex run seedWesternRegions:seed
 *   npx convex run seedWesternRegions:seed '{"dryRun": true}'
 *
 * Idempotent — skips warehouses whose code already exists.
 */
export const seed = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const now = Date.now();

    const warehouseData = [
      // ── Western Region ───────────────────────────────────────────
      {
        code: "WH-TKW-001",
        name: "Tarkwa Community Store",
        community: "Tarkwa",
        district: "Tarkwa-Nsuaem Municipal",
        region: "Western",
        servedCommunities: ["Tarkwa", "Bogoso", "Prestea", "Aboso"],
        supportedCrops: ["Cocoa", "Cassava", "Plantain", "Oil Palm", "Maize"],
        storageCapacity: 300,
        capacityUnit: "tonnes",
        assignedWarehouseAgentIds: [],
        destinationMarketsServed: ["Tarkwa Market", "Takoradi Market"],
        operatingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        dispatchDays: ["Wednesday", "Friday"],
        status: "active" as const,
        createdAt: now,
        updatedAt: now,
      },
      {
        code: "WH-TDI-002",
        name: "Takoradi Central Hub",
        community: "Sekondi-Takoradi",
        district: "Sekondi-Takoradi Metropolitan",
        region: "Western",
        servedCommunities: ["Sekondi-Takoradi", "Shama", "Effia", "Essikado"],
        supportedCrops: ["Cocoa", "Cassava", "Maize", "Tomato", "Pepper"],
        storageCapacity: 500,
        capacityUnit: "tonnes",
        assignedWarehouseAgentIds: [],
        destinationMarketsServed: ["Takoradi Market", "Kojokrom Market"],
        operatingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        dispatchDays: ["Tuesday", "Thursday"],
        status: "active" as const,
        createdAt: now,
        updatedAt: now,
      },
      {
        code: "WH-AXM-003",
        name: "Axim Coastal Store",
        community: "Axim",
        district: "Nzema East Municipal",
        region: "Western",
        servedCommunities: ["Axim", "Half Assini", "Essiama", "Elubo"],
        supportedCrops: ["Cocoa", "Coconut", "Cassava", "Plantain"],
        storageCapacity: 200,
        capacityUnit: "tonnes",
        assignedWarehouseAgentIds: [],
        destinationMarketsServed: ["Axim Market", "Takoradi Market"],
        operatingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        dispatchDays: ["Wednesday"],
        status: "active" as const,
        createdAt: now,
        updatedAt: now,
      },

      // ── Western North Region ─────────────────────────────────────
      {
        code: "WH-SFW-001",
        name: "Sefwi Wiawso Regional Hub",
        community: "Sefwi Wiawso",
        district: "Sefwi Wiawso Municipal",
        region: "Western North",
        servedCommunities: ["Sefwi Wiawso", "Bodi", "Juaboso", "Akontombra"],
        supportedCrops: ["Cocoa", "Cassava", "Plantain", "Oil Palm", "Cocoyam"],
        storageCapacity: 400,
        capacityUnit: "tonnes",
        assignedWarehouseAgentIds: [],
        destinationMarketsServed: ["Sefwi Wiawso Market", "Kumasi Market"],
        operatingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        dispatchDays: ["Tuesday", "Friday"],
        status: "active" as const,
        createdAt: now,
        updatedAt: now,
      },
      {
        code: "WH-BIB-002",
        name: "Bibiani Depot",
        community: "Bibiani",
        district: "Bibiani-Anhwiaso-Bekwai Municipal",
        region: "Western North",
        servedCommunities: ["Bibiani", "Anhwiaso", "Bekwai", "Sefwi Bekwai"],
        supportedCrops: ["Cocoa", "Cassava", "Maize", "Plantain"],
        storageCapacity: 250,
        capacityUnit: "tonnes",
        assignedWarehouseAgentIds: [],
        destinationMarketsServed: ["Bibiani Market", "Kumasi Market"],
        operatingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        dispatchDays: ["Wednesday"],
        status: "active" as const,
        createdAt: now,
        updatedAt: now,
      },
      {
        code: "WH-ENC-003",
        name: "Enchi Transit Store",
        community: "Enchi",
        district: "Aowin Municipal",
        region: "Western North",
        servedCommunities: ["Enchi", "Adabokrom", "Essam", "Dadieso"],
        supportedCrops: ["Cocoa", "Cassava", "Plantain", "Groundnut"],
        storageCapacity: 200,
        capacityUnit: "tonnes",
        assignedWarehouseAgentIds: [],
        destinationMarketsServed: ["Enchi Market", "Takoradi Market"],
        operatingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        dispatchDays: ["Thursday"],
        status: "active" as const,
        createdAt: now,
        updatedAt: now,
      },
    ];

    let inserted = 0;
    let skipped = 0;
    const details: string[] = [];

    for (const warehouse of warehouseData) {
      const existing = await ctx.db
        .query("warehouses")
        .withIndex("by_code", (q) => q.eq("code", warehouse.code))
        .unique();

      if (existing) {
        skipped++;
        details.push(`SKIPPED ${warehouse.code} — "${warehouse.name}" already exists`);
        continue;
      }

      if (!dryRun) {
        await ctx.db.insert("warehouses", warehouse);
      }

      inserted++;
      details.push(
        `${dryRun ? "WOULD INSERT" : "INSERTED"} ${warehouse.code} — "${warehouse.name}" (${warehouse.region})`
      );
    }

    return {
      inserted,
      skipped,
      dryRun,
      details,
    };
  },
});
