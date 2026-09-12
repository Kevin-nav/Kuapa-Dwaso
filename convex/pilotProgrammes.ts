import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  assertExpectedVersion,
  assertPilotChargeTerm,
  assertPilotMaizeSpecification,
  assertPilotMoneyPesewas,
  assertPilotPaymentTerm,
} from "@kuapa-dwaso/validators/pilot";
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
import {
  beginPilotIdempotency,
  completePilotIdempotency,
  replayEntityId,
} from "./pilotIdempotency";
import { insertPilotActivityEvent } from "./pilotActivity";

const rate = v.object({
  numerator: v.number(),
  scale: v.number(),
  unit: v.union(v.literal("per_kg"), v.literal("percent"), v.literal("fixed")),
});
const chargeTerm = v.object({
  code: v.string(),
  label: v.string(),
  payer: v.union(v.literal("buyer"), v.literal("farmer"), v.literal("kuapa_dwaso")),
  calculation: v.union(v.literal("fixed"), v.literal("per_kg"), v.literal("percent_of_produce")),
  rate,
});
const paymentTerm = v.object({
  trigger: v.union(v.literal("buyer_acceptance"), v.literal("cleared_buyer_funds"), v.literal("purchase_collection_acceptance"), v.literal("fixed_date")),
  offsetCalendarDays: v.number(),
  fixedDueAt: v.optional(v.number()),
  timezone: v.literal("Africa/Accra"),
});
const maizeSpecification = v.object({
  maizeType: v.string(),
  moistureMaximumPermille: v.optional(v.number()),
  contaminationCheckRequired: v.boolean(),
  additionalCriteria: v.array(v.object({ code: v.string(), label: v.string(), required: v.boolean() })),
  policyProvenance: v.union(v.literal("live"), v.literal("sample_only")),
});
const termClause = v.object({ code: v.string(), label: v.string(), detail: v.string() });

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
    currentCommercialConfiguration: programme.currentCommercialConfiguration,
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
    if (buyer === null || buyer.status !== "active") return false;
    if (programme.status === "active") return true;
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
    if (farmer === null || farmer.status !== "active") return false;
    if (programme.status === "active") return true;
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

export const configure = mutation({
  args: {
    programmeId: v.id("pilotProgrammes"),
    configurationStatus: v.union(v.literal("draft"), v.literal("approved")),
    qualityPolicy: maizeSpecification,
    chargeTerms: v.array(chargeTerm),
    paymentTerms: v.array(paymentTerm),
    purchaseLimitPesewas: v.optional(v.number()),
    taxTerms: v.array(termClause),
    approvalReferences: v.array(v.string()),
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const programme = await ctx.db.get(args.programmeId);
    if (programme === null) throw new Error("Pilot programme was not found.");
    await requireAdminPermission(ctx, principal._id, "pilotProgrammes:manage", pilotProgrammeScopeTarget(programme._id));
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: programme._id,
      actorUserId: principal._id,
      operationName: "pilotProgrammes.configure",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const replayed = await ctx.db.get(replayEntityId<"pilotProgrammes">(receipt.receipt, "pilotProgrammes"));
      if (replayed === null) throw new Error("Programme configuration replay was not found.");
      return safeProgramme(replayed);
    }
    assertExpectedVersion(args.expectedVersion);
    if (programme.version !== args.expectedVersion) throw new Error("Pilot programme changed. Refresh and retry.");
    assertPilotMaizeSpecification(args.qualityPolicy);
    if (args.qualityPolicy.policyProvenance !== programme.datasetProvenance)
      throw new Error("Quality policy provenance must match the programme.");
    if (args.chargeTerms.length === 0 || args.paymentTerms.length === 0)
      throw new Error("At least one charge term and payment term are required.");
    args.chargeTerms.forEach(assertPilotChargeTerm);
    args.paymentTerms.forEach(assertPilotPaymentTerm);
    if (args.purchaseLimitPesewas !== undefined) assertPilotMoneyPesewas(args.purchaseLimitPesewas, "purchaseLimitPesewas");
    const approvalReferences = [...new Set(args.approvalReferences.map((item) => item.trim()).filter(Boolean))];
    if (args.configurationStatus === "approved" && approvalReferences.length === 0)
      throw new Error("Approved commercial configuration requires an approval reference.");
    for (const clause of args.taxTerms) {
      if (!clause.code.trim() || !clause.label.trim() || !clause.detail.trim())
        throw new Error("Tax terms require a code, label, and detail.");
    }
    const now = Date.now();
    await ctx.db.patch(programme._id, {
      commercialConfigurationStatus: args.configurationStatus,
      currentCommercialConfiguration: {
        qualityPolicy: args.qualityPolicy,
        chargeTerms: args.chargeTerms,
        paymentTerms: args.paymentTerms,
        ...(args.purchaseLimitPesewas === undefined ? {} : { purchaseLimitPesewas: args.purchaseLimitPesewas }),
        taxTerms: args.taxTerms,
        approvalReferences,
      },
      version: programme.version + 1,
      updatedAt: now,
    });
    await insertPilotActivityEvent(ctx, {
      programmeId: programme._id,
      entityType: "pilotProgrammes",
      entityId: programme._id,
      entityRevision: programme.version + 1,
      eventName: args.configurationStatus === "approved" ? "pilot.programme.configuration_approved" : "pilot.programme.configuration_saved",
      actorUserId: principal._id,
      recipientViews: [{ audience: "admin", title: "Pilot commercial configuration updated", detail: `${programme.name} is ${args.configurationStatus}.` }],
      createdAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [{ entityType: "pilotProgrammes", entityId: programme._id }]);
    return safeProgramme((await ctx.db.get(programme._id))!);
  },
});

export const setStatus = mutation({
  args: {
    programmeId: v.id("pilotProgrammes"),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("suspended"), v.literal("closed")),
    expectedVersion: v.number(),
    reason: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const programme = await ctx.db.get(args.programmeId);
    if (programme === null) throw new Error("Pilot programme was not found.");
    await requireAdminPermission(ctx, principal._id, "pilotProgrammes:manage", pilotProgrammeScopeTarget(programme._id));
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: programme._id,
      actorUserId: principal._id,
      operationName: "pilotProgrammes.setStatus",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const replayed = await ctx.db.get(replayEntityId<"pilotProgrammes">(receipt.receipt, "pilotProgrammes"));
      if (replayed === null) throw new Error("Programme status replay was not found.");
      return safeProgramme(replayed);
    }
    assertExpectedVersion(args.expectedVersion);
    if (programme.version !== args.expectedVersion) throw new Error("Pilot programme changed. Refresh and retry.");
    if (!args.reason.trim()) throw new Error("A programme status reason is required.");
    if (args.status === "active" && programme.commercialConfigurationStatus !== "approved")
      throw new Error("Approve the commercial configuration before enabling procurement.");
    const now = Date.now();
    await ctx.db.patch(programme._id, { status: args.status, version: programme.version + 1, updatedAt: now });
    await insertPilotActivityEvent(ctx, {
      programmeId: programme._id,
      entityType: "pilotProgrammes",
      entityId: programme._id,
      entityRevision: programme.version + 1,
      eventName: `pilot.programme.${args.status}`,
      actorUserId: principal._id,
      reasonCode: args.reason.trim(),
      recipientViews: [{ audience: "admin", title: `Pilot programme ${args.status}`, detail: args.reason.trim() }],
      createdAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [{ entityType: "pilotProgrammes", entityId: programme._id }]);
    return safeProgramme((await ctx.db.get(programme._id))!);
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
