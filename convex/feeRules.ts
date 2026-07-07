import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  adminAccessHasPermissionForScope,
  assertAllowed,
  auditSnapshot,
  getActor,
  getEffectiveAdminAccess,
  insertAuditLog,
  requireAdminPermission,
  warehouseScopeTarget,
  type Actor,
} from "./workflowHelpers";

const produceGrade = v.union(
  v.literal("A"),
  v.literal("B"),
  v.literal("C"),
  v.literal("mixed"),
  v.literal("ungraded"),
);

const feeRuleStatus = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("inactive"),
  v.literal("archived"),
);

const feeCalculationType = v.union(
  v.literal("fixed_amount"),
  v.literal("per_unit"),
  v.literal("per_unit_per_day"),
  v.literal("percentage_of_gross_sale"),
  v.literal("percentage_of_transport_cost"),
);

const feePayer = v.union(
  v.literal("farmer"),
  v.literal("buyer"),
  v.literal("platform"),
  v.literal("shared"),
  v.literal("included_in_price"),
);

const feeRuleScope = v.object({
  warehouseId: v.optional(v.string()),
  cropType: v.optional(v.string()),
  unit: v.optional(v.string()),
  grade: v.optional(produceGrade),
  destinationMarket: v.optional(v.string()),
});

type RuleScope = {
  warehouseId?: string;
  cropType?: string;
  unit?: string;
  grade?: "A" | "B" | "C" | "mixed" | "ungraded";
  destinationMarket?: string;
};

type RuleMatchInput = {
  warehouseId?: string;
  cropType?: string;
  unit?: string;
  grade?: "A" | "B" | "C" | "mixed" | "ungraded";
  destinationMarket?: string;
  asOf?: number;
};

function assertValidFeeRuleAmount(args: {
  calculationType:
    | "fixed_amount"
    | "per_unit"
    | "per_unit_per_day"
    | "percentage_of_gross_sale"
    | "percentage_of_transport_cost";
  amount?: number;
  percentage?: number;
  ratePerUnit?: number;
  ratePerUnitPerDay?: number;
}): void {
  switch (args.calculationType) {
    case "fixed_amount":
      assertAllowed(args.amount !== undefined && args.amount >= 0, "Fixed fees require a non-negative amount.");
      return;
    case "per_unit":
      assertAllowed(
        args.ratePerUnit !== undefined && args.ratePerUnit >= 0,
        "Per-unit fees require a non-negative ratePerUnit.",
      );
      return;
    case "per_unit_per_day":
      assertAllowed(
        args.ratePerUnitPerDay !== undefined && args.ratePerUnitPerDay >= 0,
        "Per-unit-per-day fees require a non-negative ratePerUnitPerDay.",
      );
      return;
    case "percentage_of_gross_sale":
    case "percentage_of_transport_cost":
      assertAllowed(
        args.percentage !== undefined && args.percentage >= 0 && args.percentage <= 100,
        "Percentage fees require a percentage between 0 and 100.",
      );
      return;
  }
}

async function requireFeeAdmin(ctx: QueryCtx | MutationCtx, actorUserId: Id<"users">): Promise<Actor> {
  const actor = await getActor(ctx, actorUserId);
  assertAllowed(actor.role === "admin", "Only admins can configure fee rules.");
  assertAllowed(actor.status === "active", "Admin user must be active.");
  return actor;
}

async function feeScopeTarget(ctx: QueryCtx | MutationCtx, scope: RuleScope) {
  if (scope.warehouseId !== undefined) {
    return await warehouseScopeTarget(ctx, scope.warehouseId as Id<"warehouses">);
  }
  if (scope.destinationMarket !== undefined) {
    return { destinationMarket: scope.destinationMarket };
  }
  return {};
}

async function nextVersionForFeeCode(ctx: QueryCtx | MutationCtx, code: string): Promise<number> {
  const existing = await ctx.db
    .query("feeRules")
    .withIndex("by_code_version", (q) => q.eq("code", code))
    .collect();

  return existing.reduce((version, rule) => Math.max(version, rule.version), 0) + 1;
}

function scopeMatches(scope: RuleScope, input: RuleMatchInput): boolean {
  return (
    (scope.warehouseId === undefined || scope.warehouseId === input.warehouseId) &&
    (scope.cropType === undefined || scope.cropType === input.cropType) &&
    (scope.unit === undefined || scope.unit === input.unit) &&
    (scope.grade === undefined || scope.grade === input.grade) &&
    (scope.destinationMarket === undefined || scope.destinationMarket === input.destinationMarket)
  );
}

function scoreScope(scope: RuleScope): number {
  return [
    scope.warehouseId,
    scope.cropType,
    scope.unit,
    scope.grade,
    scope.destinationMarket,
  ].filter((value) => value !== undefined).length;
}

function isEffective(rule: { status: string; effectiveFrom: number; effectiveTo?: number }, asOf: number): boolean {
  return rule.status === "active" && rule.effectiveFrom <= asOf && (rule.effectiveTo === undefined || rule.effectiveTo > asOf);
}

export async function selectApplicableFeeRule(
  ctx: QueryCtx | MutationCtx,
  input: RuleMatchInput,
): Promise<Doc<"feeRules"> | null> {
  const asOf = input.asOf ?? Date.now();
  const activeRules = await ctx.db
    .query("feeRules")
    .withIndex("by_status_effective", (q) => q.eq("status", "active"))
    .collect();

  return (
    activeRules
      .filter((rule) => isEffective(rule, asOf))
      .filter((rule) => scopeMatches(rule.scope, input))
      .sort((left, right) => {
        const scopeDifference = scoreScope(right.scope) - scoreScope(left.scope);
        return scopeDifference !== 0 ? scopeDifference : right.version - left.version;
      })[0] ?? null
  );
}

export async function listApplicableFeeRules(
  ctx: QueryCtx | MutationCtx,
  input: RuleMatchInput,
): Promise<Doc<"feeRules">[]> {
  const asOf = input.asOf ?? Date.now();
  const activeRules = await ctx.db
    .query("feeRules")
    .withIndex("by_status_effective", (q) => q.eq("status", "active"))
    .collect();

  return activeRules
    .filter((rule) => isEffective(rule, asOf))
    .filter((rule) => scopeMatches(rule.scope, input))
    .sort((left, right) => {
      const scopeDifference = scoreScope(right.scope) - scoreScope(left.scope);
      return scopeDifference !== 0 ? scopeDifference : right.version - left.version;
    });
}

export function snapshotFeeRule(rule: Doc<"feeRules">, snapshottedAt: number) {
  return {
    feeRuleId: rule._id,
    feeRuleVersion: rule.version,
    label: rule.label,
    calculationType: rule.calculationType,
    payer: rule.payer,
    amount: rule.amount,
    percentage: rule.percentage,
    ratePerUnit: rule.ratePerUnit,
    ratePerUnitPerDay: rule.ratePerUnitPerDay,
    currency: rule.currency,
    scope: rule.scope,
    snapshottedAt,
  };
}

export async function selectApplicableStorageRateRule(
  ctx: QueryCtx | MutationCtx,
  input: RuleMatchInput,
): Promise<Doc<"storageRateRules"> | null> {
  const asOf = input.asOf ?? Date.now();
  const rules = await ctx.db
    .query("storageRateRules")
    .withIndex("by_status_effective", (q) => q.eq("status", "active"))
    .collect();

  return (
    rules
      .filter((rule) => isEffective(rule, asOf))
      .filter((rule) =>
        scopeMatches(
          {
            warehouseId: rule.warehouseId,
            cropType: rule.cropType,
            unit: rule.unit,
            grade: rule.grade,
          },
          input,
        ),
      )
      .sort((left, right) => {
        const scopeDifference =
          scoreScope({
            warehouseId: right.warehouseId,
            cropType: right.cropType,
            unit: right.unit,
            grade: right.grade,
          }) -
          scoreScope({
            warehouseId: left.warehouseId,
            cropType: left.cropType,
            unit: left.unit,
            grade: left.grade,
          });
        return scopeDifference !== 0 ? scopeDifference : right.version - left.version;
      })[0] ?? null
  );
}

export function snapshotStorageRateRule(
  rule: Doc<"storageRateRules">,
  snapshottedAt: number,
) {
  return {
    feeRuleId: rule._id,
    feeRuleVersion: rule.version,
    label: "Storage fee",
    calculationType: "per_unit_per_day" as const,
    payer: "farmer" as const,
    ratePerUnitPerDay: rule.ratePerUnitPerDay,
    currency: rule.currency,
    scope: {
      warehouseId: rule.warehouseId,
      cropType: rule.cropType,
      unit: rule.unit,
      grade: rule.grade,
    },
    snapshottedAt,
  };
}

export const create = mutation({
  args: {
    actorUserId: v.id("users"),
    code: v.string(),
    label: v.string(),
    scope: feeRuleScope,
    calculationType: feeCalculationType,
    payer: feePayer,
    amount: v.optional(v.number()),
    percentage: v.optional(v.number()),
    ratePerUnit: v.optional(v.number()),
    ratePerUnitPerDay: v.optional(v.number()),
    currency: v.optional(v.string()),
    status: v.optional(feeRuleStatus),
    effectiveFrom: v.optional(v.number()),
    effectiveTo: v.optional(v.number()),
  },
  returns: v.id("feeRules"),
  handler: async (ctx, args) => {
    const actor = await requireFeeAdmin(ctx, args.actorUserId);
    assertValidFeeRuleAmount(args);
    await requireAdminPermission(ctx, args.actorUserId, "fees:manage", await feeScopeTarget(ctx, args.scope));

    const now = Date.now();
    const code = args.code.trim().toUpperCase();
    const feeRuleId = await ctx.db.insert("feeRules", {
      code,
      label: args.label.trim(),
      scope: args.scope,
      calculationType: args.calculationType,
      payer: args.payer,
      amount: args.amount,
      percentage: args.percentage,
      ratePerUnit: args.ratePerUnit,
      ratePerUnitPerDay: args.ratePerUnitPerDay,
      currency: args.currency ?? "GHS",
      status: args.status ?? "draft",
      effectiveFrom: args.effectiveFrom ?? now,
      effectiveTo: args.effectiveTo,
      version: await nextVersionForFeeCode(ctx, code),
      createdAt: now,
      updatedAt: now,
    });

    const after = await ctx.db.get(feeRuleId);
    await insertAuditLog(ctx, {
      actor,
      action: "fee_rule.created",
      entityType: "fee_rule",
      entityId: feeRuleId,
      after: after === null ? undefined : auditSnapshot(after),
    });

    return feeRuleId;
  },
});

export const replace = mutation({
  args: {
    actorUserId: v.id("users"),
    replacesFeeRuleId: v.id("feeRules"),
    label: v.optional(v.string()),
    scope: v.optional(feeRuleScope),
    calculationType: v.optional(feeCalculationType),
    payer: v.optional(feePayer),
    amount: v.optional(v.number()),
    percentage: v.optional(v.number()),
    ratePerUnit: v.optional(v.number()),
    ratePerUnitPerDay: v.optional(v.number()),
    currency: v.optional(v.string()),
    effectiveFrom: v.optional(v.number()),
  },
  returns: v.id("feeRules"),
  handler: async (ctx, args) => {
    const actor = await requireFeeAdmin(ctx, args.actorUserId);
    const previous = await ctx.db.get(args.replacesFeeRuleId);
    assertAllowed(previous !== null, "Fee rule was not found.");
    await requireAdminPermission(ctx, args.actorUserId, "fees:manage", await feeScopeTarget(ctx, previous.scope));
    if (args.scope !== undefined) {
      await requireAdminPermission(ctx, args.actorUserId, "fees:manage", await feeScopeTarget(ctx, args.scope));
    }

    const calculationType = args.calculationType ?? previous.calculationType;
    assertValidFeeRuleAmount({
      calculationType,
      amount: args.amount ?? previous.amount,
      percentage: args.percentage ?? previous.percentage,
      ratePerUnit: args.ratePerUnit ?? previous.ratePerUnit,
      ratePerUnitPerDay: args.ratePerUnitPerDay ?? previous.ratePerUnitPerDay,
    });

    const now = Date.now();
    await ctx.db.patch(args.replacesFeeRuleId, {
      status: "archived",
      effectiveTo: now,
      updatedAt: now,
    });

    const feeRuleId = await ctx.db.insert("feeRules", {
      code: previous.code,
      label: args.label?.trim() ?? previous.label,
      scope: args.scope ?? previous.scope,
      calculationType,
      payer: args.payer ?? previous.payer,
      amount: args.amount ?? previous.amount,
      percentage: args.percentage ?? previous.percentage,
      ratePerUnit: args.ratePerUnit ?? previous.ratePerUnit,
      ratePerUnitPerDay: args.ratePerUnitPerDay ?? previous.ratePerUnitPerDay,
      currency: args.currency ?? previous.currency,
      status: "active",
      effectiveFrom: args.effectiveFrom ?? now,
      version: previous.version + 1,
      createdAt: now,
      updatedAt: now,
    });

    const after = await ctx.db.get(feeRuleId);
    await insertAuditLog(ctx, {
      actor,
      action: "fee_rule.replaced",
      entityType: "fee_rule",
      entityId: feeRuleId,
      before: auditSnapshot(previous),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: { replacesFeeRuleId: args.replacesFeeRuleId },
    });

    return feeRuleId;
  },
});

export const updateStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    feeRuleId: v.id("feeRules"),
    status: feeRuleStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("feeRules"),
  handler: async (ctx, args) => {
    const actor = await requireFeeAdmin(ctx, args.actorUserId);
    const feeRule = await ctx.db.get(args.feeRuleId);
    assertAllowed(feeRule !== null, "Fee rule was not found.");
    await requireAdminPermission(ctx, args.actorUserId, "fees:manage", await feeScopeTarget(ctx, feeRule.scope));

    await ctx.db.patch(args.feeRuleId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    const after = await ctx.db.get(args.feeRuleId);
    await insertAuditLog(ctx, {
      actor,
      action: "fee_rule.status_updated",
      entityType: "fee_rule",
      entityId: args.feeRuleId,
      before: auditSnapshot(feeRule),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.feeRuleId;
  },
});

export const createStorageRateRule = mutation({
  args: {
    actorUserId: v.id("users"),
    warehouseId: v.optional(v.id("warehouses")),
    cropType: v.optional(v.string()),
    unit: v.string(),
    grade: v.optional(produceGrade),
    ratePerUnitPerDay: v.number(),
    currency: v.optional(v.string()),
    status: v.optional(feeRuleStatus),
    effectiveFrom: v.optional(v.number()),
    effectiveTo: v.optional(v.number()),
  },
  returns: v.id("storageRateRules"),
  handler: async (ctx, args) => {
    const actor = await requireFeeAdmin(ctx, args.actorUserId);
    assertAllowed(args.ratePerUnitPerDay >= 0, "Storage rate must be non-negative.");
    if (args.warehouseId !== undefined) {
      await requireAdminPermission(
        ctx,
        args.actorUserId,
        "fees:manage",
        await warehouseScopeTarget(ctx, args.warehouseId),
      );
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("storageRateRules")
      .withIndex("by_crop_unit_grade_status", (q) =>
        q.eq("cropType", args.cropType).eq("unit", args.unit).eq("grade", args.grade).eq("status", "active"),
      )
      .collect();
    const version = existing.reduce((current, rule) => Math.max(current, rule.version), 0) + 1;
    const storageRateRuleId = await ctx.db.insert("storageRateRules", {
      warehouseId: args.warehouseId,
      cropType: args.cropType,
      unit: args.unit,
      grade: args.grade,
      ratePerUnitPerDay: args.ratePerUnitPerDay,
      currency: args.currency ?? "GHS",
      status: args.status ?? "draft",
      effectiveFrom: args.effectiveFrom ?? now,
      effectiveTo: args.effectiveTo,
      version,
      createdAt: now,
      updatedAt: now,
    });

    const after = await ctx.db.get(storageRateRuleId);
    await insertAuditLog(ctx, {
      actor,
      action: "storage_rate_rule.created",
      entityType: "storage_rate_rule",
      entityId: storageRateRuleId,
      after: after === null ? undefined : auditSnapshot(after),
    });

    return storageRateRuleId;
  },
});

export const updateStorageRateRuleStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    storageRateRuleId: v.id("storageRateRules"),
    status: feeRuleStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("storageRateRules"),
  handler: async (ctx, args) => {
    const actor = await requireFeeAdmin(ctx, args.actorUserId);
    const storageRateRule = await ctx.db.get(args.storageRateRuleId);
    assertAllowed(storageRateRule !== null, "Storage rate rule was not found.");
    if (storageRateRule.warehouseId !== undefined) {
      await requireAdminPermission(
        ctx,
        args.actorUserId,
        "fees:manage",
        await warehouseScopeTarget(ctx, storageRateRule.warehouseId),
      );
    }

    await ctx.db.patch(args.storageRateRuleId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    const after = await ctx.db.get(args.storageRateRuleId);
    await insertAuditLog(ctx, {
      actor,
      action: "storage_rate_rule.status_updated",
      entityType: "storage_rate_rule",
      entityId: args.storageRateRuleId,
      before: auditSnapshot(storageRateRule),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.storageRateRuleId;
  },
});

export const list = query({
  args: {
    actorUserId: v.optional(v.id("users")),
    status: v.optional(feeRuleStatus),
    code: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.status === undefined
        ? await ctx.db.query("feeRules").take(limit * 3)
        : await ctx.db
            .query("feeRules")
            .withIndex("by_status_effective", (q) => q.eq("status", args.status!))
            .take(limit * 3);

    if (args.actorUserId === undefined) {
      return candidates
        .filter((rule) => args.code === undefined || rule.code === args.code.trim().toUpperCase())
        .slice(0, limit);
    }
    const access = await getEffectiveAdminAccess(ctx, args.actorUserId);
    const results = [];
    for (const rule of candidates) {
      if (args.code !== undefined && rule.code !== args.code.trim().toUpperCase()) {
        continue;
      }
      if (adminAccessHasPermissionForScope(access, "fees:read", await feeScopeTarget(ctx, rule.scope))) {
        results.push(rule);
      }
      if (results.length >= limit) {
        break;
      }
    }
    return results;
  },
});

export const listStorageRateRules = query({
  args: {
    actorUserId: v.optional(v.id("users")),
    status: v.optional(feeRuleStatus),
    warehouseId: v.optional(v.id("warehouses")),
    cropType: v.optional(v.string()),
    unit: v.optional(v.string()),
    grade: v.optional(produceGrade),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.status === undefined
        ? await ctx.db.query("storageRateRules").take(limit * 3)
        : await ctx.db
            .query("storageRateRules")
            .withIndex("by_status_effective", (q) => q.eq("status", args.status!))
            .take(limit * 3);

    const filtered = candidates
      .filter((rule) => args.warehouseId === undefined || rule.warehouseId === args.warehouseId)
      .filter((rule) => args.cropType === undefined || rule.cropType === args.cropType)
      .filter((rule) => args.unit === undefined || rule.unit === args.unit)
      .filter((rule) => args.grade === undefined || rule.grade === args.grade);
    if (args.actorUserId === undefined) {
      return filtered.slice(0, limit);
    }
    const access = await getEffectiveAdminAccess(ctx, args.actorUserId);
    const results = [];
    for (const rule of filtered) {
      const target =
        rule.warehouseId === undefined ? {} : await warehouseScopeTarget(ctx, rule.warehouseId);
      if (adminAccessHasPermissionForScope(access, "fees:read", target)) {
        results.push(rule);
      }
      if (results.length >= limit) {
        break;
      }
    }
    return results;
  },
});
