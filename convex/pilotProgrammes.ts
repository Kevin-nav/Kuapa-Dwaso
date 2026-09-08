import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  adminAccessHasPermissionForScope,
  cleanOptionalText,
  getEffectiveAdminAccess,
  requireAdminPermission,
} from "./workflowHelpers";
import {
  pilotProgrammeScopeTarget,
  requirePilotPrincipal,
  requirePilotAssignment,
} from "./pilotAccess";

function pageLimit(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("Page limit must be an integer from 1 to 50.");
  }
  return limit;
}

function pageOffset(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  const offset = Number(cursor);
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw new Error("Page cursor is invalid.");
  return offset;
}

function safeProgramme(programme: Doc<"pilotProgrammes">) {
  return {
    id: programme._id,
    code: programme.code,
    name: programme.name,
    countryCode: programme.countryCode,
    currency: programme.currency,
    timezone: programme.timezone,
    region: programme.region,
    district: programme.district,
    status: programme.status,
    datasetProvenance: programme.datasetProvenance,
    commercialConfigurationStatus: programme.commercialConfigurationStatus,
    demoContext: {
      programmeId: programme._id,
      programmeName: programme.name,
      dataMode: programme.datasetProvenance,
      ...(programme.datasetId === undefined ? {} : { datasetId: programme.datasetId }),
    },
    version: programme.version,
  };
}

async function canReadProgramme(
  ctx: Parameters<typeof requirePilotPrincipal>[0],
  principal: Awaited<ReturnType<typeof requirePilotPrincipal>>,
  programme: Doc<"pilotProgrammes">,
): Promise<boolean> {
  if (principal.role === "admin") {
    const access = await getEffectiveAdminAccess(ctx, principal._id);
    return adminAccessHasPermissionForScope(
      access,
      "pilotProgrammes:read",
      pilotProgrammeScopeTarget(programme._id),
    );
  }
  if (principal.role === "warehouse_agent") {
    try {
      await requirePilotAssignment(ctx, principal, programme._id, "pilot:read");
      return true;
    } catch {
      return false;
    }
  }
  if (principal.role === "buyer") {
    const buyer = await ctx.db
      .query("buyers")
      .withIndex("by_user", (q) => q.eq("userId", principal._id))
      .unique();
    if (buyer === null) return false;
    return (
      await ctx.db
        .query("pilotBuyerRequests")
        .withIndex("by_buyer_status", (q) => q.eq("buyerId", buyer._id))
        .collect()
    ).some((request) => request.programmeId === programme._id);
  }
  if (principal.role === "farmer") {
    const farmer = await ctx.db
      .query("farmers")
      .withIndex("by_user", (q) => q.eq("userId", principal._id))
      .unique();
    if (farmer === null) return false;
    return (
      await ctx.db
        .query("pilotSupplyDeclarations")
        .withIndex("by_farmer_status", (q) => q.eq("farmerId", farmer._id))
        .collect()
    ).some((declaration) => declaration.programmeId === programme._id);
  }
  return (
    await ctx.db
      .query("pilotFulfilmentPlans")
      .withIndex("by_driver_status", (q) => q.eq("driverUserId", principal._id))
      .collect()
  ).some((plan) => plan.programmeId === programme._id);
}

export const create = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    region: v.string(),
    district: v.optional(v.string()),
    datasetProvenance: v.union(v.literal("live"), v.literal("sample_only")),
    datasetId: v.optional(v.string()),
    idempotencyKey: v.string(),
  },
  returns: v.object({
    programmeId: v.id("pilotProgrammes"),
    version: v.number(),
  }),
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    await requireAdminPermission(
      ctx,
      principal._id,
      "pilotProgrammes:manage",
      {},
    );
    const code = args.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(code))
      throw new Error(
        "Programme code must contain 3 to 32 letters, numbers, underscores, or hyphens.",
      );
    if (args.name.trim().length === 0 || args.region.trim().length === 0)
      throw new Error("Programme name and region are required.");
    if (args.idempotencyKey.trim().length < 8)
      throw new Error("Idempotency key must contain at least 8 characters.");
    const existing = await ctx.db
      .query("pilotProgrammes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (existing !== null) {
      if (
        existing.name !== args.name.trim() ||
        existing.region !== args.region.trim() ||
        existing.datasetProvenance !== args.datasetProvenance
      ) {
        throw new Error(
          "Programme code already belongs to different programme terms.",
        );
      }
      return { programmeId: existing._id, version: existing.version };
    }
    if (
      args.datasetProvenance === "sample_only" &&
      cleanOptionalText(args.datasetId) === undefined
    )
      throw new Error("Sample programmes require a dataset ID.");
    const district = cleanOptionalText(args.district);
    const datasetId = cleanOptionalText(args.datasetId);
    const now = Date.now();
    const programmeId = await ctx.db.insert("pilotProgrammes", {
      code,
      name: args.name.trim(),
      countryCode: "GH",
      currency: "GHS",
      timezone: "Africa/Accra",
      region: args.region.trim(),
      ...(district === undefined ? {} : { district }),
      status: "draft",
      datasetProvenance: args.datasetProvenance,
      ...(datasetId === undefined ? {} : { datasetId }),
      commercialConfigurationStatus: "missing",
      version: 0,
      createdByUserId: principal._id,
      createdAt: now,
      updatedAt: now,
    });
    return { programmeId, version: 0 };
  },
});

export const listAvailable = query({
  args: { cursor: v.optional(v.string()), limit: v.number() },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const limit = pageLimit(args.limit);
    const offset = pageOffset(args.cursor);
    const programmes = await ctx.db.query("pilotProgrammes").collect();
    const visible: Doc<"pilotProgrammes">[] = [];
    for (const programme of programmes) {
      if (await canReadProgramme(ctx, principal, programme))
        visible.push(programme);
    }
    const page = visible.slice(offset, offset + limit).map(safeProgramme);
    const nextOffset = offset + page.length;
    return {
      page,
      ...(nextOffset < visible.length
        ? { nextCursor: String(nextOffset) }
        : {}),
      isDone: nextOffset >= visible.length,
    };
  },
});

export const get = query({
  args: { programmeId: v.id("pilotProgrammes") },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const programme = await ctx.db.get(args.programmeId);
    if (
      programme === null ||
      !(await canReadProgramme(ctx, principal, programme))
    )
      return null;
    return safeProgramme(programme);
  },
});
