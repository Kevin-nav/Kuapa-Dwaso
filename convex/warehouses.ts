import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  adminAccessHasPermissionForScope,
  adminScopeTarget,
  assertAllowed,
  auditSnapshot,
  cleanOptionalText,
  getActor,
  getEffectiveAdminAccess,
  insertAuditLog,
  omitUndefinedValues,
  requireAdminPermission,
  warehouseScopeTarget,
} from "./workflowHelpers";

const warehouseStatus = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("maintenance"),
  v.literal("closed"),
);

function normalizeWarehouseCode(code: string): string {
  return code.trim().toUpperCase();
}

async function requireAdminForWarehouseCreateOrUpdate(
  ctx: Parameters<typeof getActor>[0],
  actorUserId: Parameters<typeof getActor>[1],
  action: "create" | "update",
  target: {
    warehouseId?: Parameters<typeof warehouseScopeTarget>[1] | undefined;
    region?: string | undefined;
    district?: string | undefined;
  },
) {
  if (action === "create") {
    const access = await requireAdminPermission(ctx, actorUserId, "warehouses:manage", adminScopeTarget({
      region: target.region,
      district: target.district,
    }));
    return access.actor;
  }
  assertAllowed(target.warehouseId !== undefined, "Warehouse scope is required.");
  const access = await requireAdminPermission(
    ctx,
    actorUserId,
    "warehouses:manage",
    await warehouseScopeTarget(ctx, target.warehouseId),
  );
  return access.actor;
}

export const create = mutation({
  args: {
    actorUserId: v.id("users"),
    code: v.string(),
    name: v.string(),
    community: v.string(),
    district: v.optional(v.string()),
    region: v.optional(v.string()),
    servedCommunities: v.array(v.string()),
    supportedCrops: v.array(v.string()),
    storageCapacity: v.optional(v.number()),
    capacityUnit: v.optional(v.string()),
    assignedWarehouseAgentIds: v.optional(v.array(v.id("warehouseAgents"))),
    destinationMarketsServed: v.array(v.string()),
    operatingDays: v.array(v.string()),
    dispatchDays: v.optional(v.array(v.string())),
    status: v.optional(warehouseStatus),
  },
  returns: v.id("warehouses"),
  handler: async (ctx, args) => {
    const actor = await requireAdminForWarehouseCreateOrUpdate(ctx, args.actorUserId, "create", {
      region: args.region,
      district: args.district,
    });
    const code = normalizeWarehouseCode(args.code);
    const existing = await ctx.db
      .query("warehouses")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    assertAllowed(existing === null, "A warehouse with this code already exists.");

    const now = Date.now();
    const warehouseId = await ctx.db.insert("warehouses", omitUndefinedValues({
      code,
      name: args.name.trim(),
      community: args.community.trim(),
      district: cleanOptionalText(args.district),
      region: cleanOptionalText(args.region),
      servedCommunities: args.servedCommunities,
      supportedCrops: args.supportedCrops,
      storageCapacity: args.storageCapacity,
      capacityUnit: cleanOptionalText(args.capacityUnit),
      assignedWarehouseAgentIds: args.assignedWarehouseAgentIds ?? [],
      destinationMarketsServed: args.destinationMarketsServed,
      operatingDays: args.operatingDays,
      dispatchDays: args.dispatchDays,
      status: args.status ?? "inactive",
      createdAt: now,
      updatedAt: now,
    }));

    const after = await ctx.db.get(warehouseId);
    await insertAuditLog(ctx, {
      actor,
      action: "warehouse.created",
      entityType: "warehouse",
      entityId: warehouseId,
      after: after === null ? undefined : auditSnapshot(after),
    });

    return warehouseId;
  },
});

export const update = mutation({
  args: {
    actorUserId: v.id("users"),
    warehouseId: v.id("warehouses"),
    name: v.optional(v.string()),
    community: v.optional(v.string()),
    district: v.optional(v.string()),
    region: v.optional(v.string()),
    servedCommunities: v.optional(v.array(v.string())),
    supportedCrops: v.optional(v.array(v.string())),
    storageCapacity: v.optional(v.number()),
    capacityUnit: v.optional(v.string()),
    assignedWarehouseAgentIds: v.optional(v.array(v.id("warehouseAgents"))),
    destinationMarketsServed: v.optional(v.array(v.string())),
    operatingDays: v.optional(v.array(v.string())),
    dispatchDays: v.optional(v.array(v.string())),
  },
  returns: v.id("warehouses"),
  handler: async (ctx, args) => {
    const actor = await requireAdminForWarehouseCreateOrUpdate(ctx, args.actorUserId, "update", {
      warehouseId: args.warehouseId,
    });
    const warehouse = await ctx.db.get(args.warehouseId);
    assertAllowed(warehouse !== null, "Warehouse was not found.");

    await ctx.db.patch(args.warehouseId, omitUndefinedValues({
      name: args.name?.trim(),
      community: args.community?.trim(),
      district: cleanOptionalText(args.district),
      region: cleanOptionalText(args.region),
      servedCommunities: args.servedCommunities,
      supportedCrops: args.supportedCrops,
      storageCapacity: args.storageCapacity,
      capacityUnit: cleanOptionalText(args.capacityUnit),
      assignedWarehouseAgentIds: args.assignedWarehouseAgentIds,
      destinationMarketsServed: args.destinationMarketsServed,
      operatingDays: args.operatingDays,
      dispatchDays: args.dispatchDays,
      updatedAt: Date.now(),
    }));

    const after = await ctx.db.get(args.warehouseId);
    await insertAuditLog(ctx, {
      actor,
      action: "warehouse.updated",
      entityType: "warehouse",
      entityId: args.warehouseId,
      before: auditSnapshot(warehouse),
      after: after === null ? undefined : auditSnapshot(after),
    });

    return args.warehouseId;
  },
});

export const updateStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    warehouseId: v.id("warehouses"),
    status: warehouseStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("warehouses"),
  handler: async (ctx, args) => {
    const actor = await requireAdminForWarehouseCreateOrUpdate(ctx, args.actorUserId, "update", {
      warehouseId: args.warehouseId,
    });
    const warehouse = await ctx.db.get(args.warehouseId);
    assertAllowed(warehouse !== null, "Warehouse was not found.");

    await ctx.db.patch(args.warehouseId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    const after = await ctx.db.get(args.warehouseId);
    await insertAuditLog(ctx, {
      actor,
      action: "warehouse.status_updated",
      entityType: "warehouse",
      entityId: args.warehouseId,
      before: auditSnapshot(warehouse),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.warehouseId;
  },
});

export const getByCode = query({
  args: { code: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("warehouses")
      .withIndex("by_code", (q) => q.eq("code", normalizeWarehouseCode(args.code)))
      .unique();
  },
});

export const list = query({
  args: {
    actorUserId: v.optional(v.id("users")),
    status: v.optional(warehouseStatus),
    community: v.optional(v.string()),
    district: v.optional(v.string()),
    region: v.optional(v.string()),
    supportedCrop: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.community !== undefined && args.status !== undefined
        ? await ctx.db
            .query("warehouses")
            .withIndex("by_community_status", (q) =>
              q.eq("community", args.community!).eq("status", args.status!),
            )
            .take(limit * 3)
        : args.district !== undefined && args.status !== undefined
          ? await ctx.db
              .query("warehouses")
              .withIndex("by_district_status", (q) =>
                q.eq("district", args.district!).eq("status", args.status!),
              )
              .take(limit * 3)
          : args.region !== undefined && args.status !== undefined
            ? await ctx.db
                .query("warehouses")
                .withIndex("by_region_status", (q) =>
                  q.eq("region", args.region!).eq("status", args.status!),
                )
                .take(limit * 3)
            : args.status !== undefined
              ? await ctx.db
                  .query("warehouses")
                  .withIndex("by_status", (q) => q.eq("status", args.status!))
                  .take(limit * 3)
              : await ctx.db.query("warehouses").take(limit * 3);

    const access =
      args.actorUserId === undefined
        ? undefined
        : await getEffectiveAdminAccess(ctx, args.actorUserId);

    return candidates
      .filter((warehouse) => args.community === undefined || warehouse.community === args.community)
      .filter((warehouse) => args.district === undefined || warehouse.district === args.district)
      .filter((warehouse) => args.region === undefined || warehouse.region === args.region)
      .filter(
        (warehouse) =>
          args.supportedCrop === undefined ||
          warehouse.supportedCrops.some(
            (crop) => crop.toLowerCase() === args.supportedCrop!.toLowerCase(),
          ),
      )
      .filter(
        (warehouse) =>
          access === undefined ||
          adminAccessHasPermissionForScope(access, "warehouses:read", adminScopeTarget({
            warehouseId: warehouse._id,
            region: warehouse.region,
            district: warehouse.district,
          })),
      )
      .slice(0, limit);
  },
});
