import { canCreateFarmerProfile, canVerifyFarmer } from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  adminAccessHasPermissionForScope,
  assertAllowed,
  auditSnapshot,
  cleanOptionalText,
  farmerScopeTarget,
  getActor,
  getEffectiveAdminAccess,
  insertAuditLog,
  normalizeCodeSegment,
  requireAdminPermission,
  requireWarehouseAgentAssignedToWarehouse,
  warehouseScopeTarget,
} from "./workflowHelpers";

const verificationStatus = v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"));
const farmerStatus = v.union(v.literal("active"), v.literal("suspended"), v.literal("deactivated"));
const registrationSource = v.union(v.literal("self_app"), v.literal("agent_assisted"), v.literal("admin"));

function makeFarmerCode(community: string, phoneNumber: string, timestamp: number, attempt: number): string {
  const communitySegment = normalizeCodeSegment(community, 3).padEnd(3, "X");
  const phoneTail = phoneNumber.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const timeTail = String(timestamp).slice(-4);
  const suffix = attempt === 0 ? "" : `-${attempt + 1}`;

  return `FM-${communitySegment}-${phoneTail}-${timeTail}${suffix}`;
}

async function makeUniqueFarmerCode(ctx: Parameters<typeof getActor>[0], community: string, phoneNumber: string, timestamp: number): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const farmerCode = makeFarmerCode(community, phoneNumber, timestamp, attempt);
    const existing = await ctx.db
      .query("farmers")
      .withIndex("by_farmer_code", (q) => q.eq("farmerCode", farmerCode))
      .unique();

    if (existing === null) {
      return farmerCode;
    }
  }

  throw new Error("Could not generate a unique farmer code.");
}

export const createProfile = mutation({
  args: {
    actorUserId: v.id("users"),
    fullName: v.string(),
    phoneNumber: v.string(),
    community: v.string(),
    region: v.optional(v.string()),
    householdPhoneOwnerName: v.optional(v.string()),
    preferredWarehouseId: v.optional(v.id("warehouses")),
    registrationSource: v.optional(registrationSource),
    userId: v.optional(v.id("users")),
  },
  returns: v.id("farmers"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canCreateFarmerProfile(actor.role), "Actor cannot create farmer profiles.");

    const existingByPhone = await ctx.db
      .query("farmers")
      .withIndex("by_phone_number", (q) => q.eq("phoneNumber", args.phoneNumber))
      .unique();
    assertAllowed(existingByPhone === null, "A farmer with this phone number already exists.");

    if (actor.role === "warehouse_agent") {
      assertAllowed(args.preferredWarehouseId !== undefined, "Warehouse agents must choose a warehouse.");
      await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, args.preferredWarehouseId);
    } else {
      assertAllowed(actor.role === "admin", "Only admins and warehouse agents can create farmer profiles.");
      await requireAdminPermission(ctx, actor._id, "farmers:manage", {
        warehouseId: args.preferredWarehouseId,
        region: args.region,
        district: args.community,
      });
    }

    const now = Date.now();
    const farmerId = await ctx.db.insert("farmers", {
      userId: args.userId,
      farmerCode: await makeUniqueFarmerCode(ctx, args.community, args.phoneNumber, now),
      fullName: args.fullName,
      phoneNumber: args.phoneNumber,
      community: args.community,
      region: cleanOptionalText(args.region),
      householdPhoneOwnerName: cleanOptionalText(args.householdPhoneOwnerName),
      preferredWarehouseId: args.preferredWarehouseId,
      registrationSource: args.registrationSource ?? (actor.role === "warehouse_agent" ? "agent_assisted" : "admin"),
      verificationStatus: "pending",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const after = await ctx.db.get(farmerId);
    await insertAuditLog(ctx, {
      actor,
      action: "farmer.profile_created",
      entityType: "farmer",
      entityId: farmerId,
      after: after === null ? undefined : auditSnapshot(after),
    });

    return farmerId;
  },
});

export const updateStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    farmerId: v.id("farmers"),
    status: farmerStatus,
  },
  returns: v.id("farmers"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);

    const farmer = await ctx.db.get(args.farmerId);
    assertAllowed(farmer !== null, "Farmer was not found.");
    await requireAdminPermission(ctx, args.actorUserId, "farmers:manage", await farmerScopeTarget(ctx, farmer));

    await ctx.db.patch(args.farmerId, { status: args.status, updatedAt: Date.now() });
    const after = await ctx.db.get(args.farmerId);
    await insertAuditLog(ctx, {
      actor,
      action: "farmer.status_updated",
      entityType: "farmer",
      entityId: args.farmerId,
      before: auditSnapshot(farmer),
      after: after === null ? undefined : auditSnapshot(after),
    });

    return args.farmerId;
  },
});

export const updateVerificationStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    farmerId: v.id("farmers"),
    verificationStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("farmers"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin" && canVerifyFarmer(actor.role), "Only admins can update farmer verification.");

    const farmer = await ctx.db.get(args.farmerId);
    assertAllowed(farmer !== null, "Farmer was not found.");
    await requireAdminPermission(ctx, args.actorUserId, "farmers:verify", await farmerScopeTarget(ctx, farmer));

    await ctx.db.patch(args.farmerId, {
      verificationStatus: args.verificationStatus,
      updatedAt: Date.now(),
    });

    const after = await ctx.db.get(args.farmerId);
    await insertAuditLog(ctx, {
      actor,
      action: "farmer.verification_status_updated",
      entityType: "farmer",
      entityId: args.farmerId,
      before: auditSnapshot(farmer),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.farmerId;
  },
});

export const updatePreferredWarehouse = mutation({
  args: {
    actorUserId: v.id("users"),
    farmerId: v.id("farmers"),
    preferredWarehouseId: v.optional(v.id("warehouses")),
    reason: v.optional(v.string()),
  },
  returns: v.id("farmers"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);

    const farmer = await ctx.db.get(args.farmerId);
    assertAllowed(farmer !== null, "Farmer was not found.");
    await requireAdminPermission(ctx, args.actorUserId, "farmers:manage", await farmerScopeTarget(ctx, farmer));
    if (args.preferredWarehouseId !== undefined) {
      await requireAdminPermission(
        ctx,
        args.actorUserId,
        "farmers:manage",
        await warehouseScopeTarget(ctx, args.preferredWarehouseId),
      );
    }

    await ctx.db.patch(args.farmerId, {
      preferredWarehouseId: args.preferredWarehouseId,
      updatedAt: Date.now(),
    });

    const after = await ctx.db.get(args.farmerId);
    await insertAuditLog(ctx, {
      actor,
      action: "farmer.preferred_warehouse_updated",
      entityType: "farmer",
      entityId: args.farmerId,
      before: auditSnapshot(farmer),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.farmerId;
  },
});

export const getById = query({
  args: {
    actorUserId: v.id("users"),
    farmerId: v.id("farmers"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const farmer = await ctx.db.get(args.farmerId);
    if (farmer === null) {
      return null;
    }

    assertAllowed(
      actor.role === "admin" || farmer.userId === actor._id,
      "Actor cannot view this farmer.",
    );
    if (actor.role === "admin") {
      await requireAdminPermission(ctx, args.actorUserId, "farmers:read", await farmerScopeTarget(ctx, farmer));
    }

    return farmer;
  },
});

export const getByPhoneNumber = query({
  args: {
    actorUserId: v.id("users"),
    phoneNumber: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin" || actor.role === "warehouse_agent", "Only admins and warehouse agents can search farmers.");

    const farmer = await ctx.db
      .query("farmers")
      .withIndex("by_phone_number", (q) => q.eq("phoneNumber", args.phoneNumber))
      .unique();
    if (actor.role === "admin" && farmer !== null) {
      await requireAdminPermission(ctx, args.actorUserId, "farmers:read", await farmerScopeTarget(ctx, farmer));
    }
    return farmer;
  },
});

export const listByWarehouse = query({
  args: {
    actorUserId: v.id("users"),
    warehouseId: v.id("warehouses"),
    verificationStatus: v.optional(verificationStatus),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    if (actor.role === "warehouse_agent") {
      await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, args.warehouseId);
    } else {
      await requireAdminPermission(
        ctx,
        args.actorUserId,
        "farmers:read",
        await warehouseScopeTarget(ctx, args.warehouseId),
      );
    }

    const limit = Math.min(args.limit ?? 50, 100);
    if (args.verificationStatus !== undefined) {
      return await ctx.db
        .query("farmers")
        .withIndex("by_preferred_warehouse_verification_status", (q) =>
          q.eq("preferredWarehouseId", args.warehouseId).eq("verificationStatus", args.verificationStatus),
        )
        .take(limit);
    }

    return await ctx.db
      .query("farmers")
      .withIndex("by_preferred_warehouse", (q) => q.eq("preferredWarehouseId", args.warehouseId))
      .take(limit);
  },
});

export const list = query({
  args: {
    actorUserId: v.id("users"),
    verificationStatus: v.optional(verificationStatus),
    status: v.optional(farmerStatus),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const access = await getEffectiveAdminAccess(ctx, args.actorUserId);

    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.verificationStatus === undefined
        ? await ctx.db.query("farmers").take(limit * 3)
        : await ctx.db
            .query("farmers")
            .withIndex("by_verification_status", (q) =>
              q.eq("verificationStatus", args.verificationStatus!),
            )
            .take(limit * 3);

    const results = [];
    for (const farmer of candidates) {
      if (args.status !== undefined && farmer.status !== args.status) {
        continue;
      }
      if (adminAccessHasPermissionForScope(access, "farmers:read", await farmerScopeTarget(ctx, farmer))) {
        results.push(farmer);
      }
      if (results.length >= limit) {
        break;
      }
    }
    return results;
  },
});
