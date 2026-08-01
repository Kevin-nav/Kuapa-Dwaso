import { calculateMarketRunOccurrence } from "@kuapa-dwaso/utils";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  adminAccessHasPermissionForScope,
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

const scheduleStatus = v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("retired"));

const scheduleFields = {
  originWarehouseId: v.id("warehouses"),
  destinationName: v.string(),
  destinationInstructions: v.string(),
  timezone: v.string(),
  deliveryWeekday: v.number(),
  cutoffDaysBefore: v.number(),
  cutoffLocalTime: v.string(),
  arrivalStartLocalTime: v.string(),
  arrivalEndLocalTime: v.string(),
  minimumLoadQuantity: v.optional(v.number()),
  minimumLoadUnit: v.optional(v.string()),
  capacityQuantity: v.optional(v.number()),
  capacityUnit: v.optional(v.string()),
  effectiveDate: v.string(),
  endDate: v.optional(v.string()),
};

function firstMatchingDeliveryDate(effectiveDate: string, deliveryWeekday: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(effectiveDate);
  assertAllowed(match !== null, "Effective date must use YYYY-MM-DD.");
  const cursor = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = new Date(cursor.getTime() + offset * 86_400_000);
    if (candidate.getUTCDay() === deliveryWeekday) return candidate.toISOString().slice(0, 10);
  }
  throw new Error("Could not resolve the first delivery date.");
}

function cleanScheduleInput(args: {
  destinationName: string;
  destinationInstructions: string;
  timezone: string;
  deliveryWeekday: number;
  cutoffDaysBefore: number;
  cutoffLocalTime: string;
  arrivalStartLocalTime: string;
  arrivalEndLocalTime: string;
  minimumLoadQuantity?: number;
  minimumLoadUnit?: string;
  capacityQuantity?: number;
  capacityUnit?: string;
  effectiveDate: string;
  endDate?: string;
}) {
  const destinationName = args.destinationName.trim();
  const destinationInstructions = args.destinationInstructions.trim();
  const timezone = args.timezone.trim();
  assertAllowed(destinationName.length > 0, "Destination name is required.");
  assertAllowed(destinationInstructions.length > 0, "Collection or location instructions are required.");
  assertAllowed(Number.isInteger(args.deliveryWeekday) && args.deliveryWeekday >= 0 && args.deliveryWeekday <= 6, "Delivery weekday must be between 0 and 6.");
  assertAllowed(Number.isInteger(args.cutoffDaysBefore) && args.cutoffDaysBefore >= 0 && args.cutoffDaysBefore <= 14, "Cutoff days before delivery must be between 0 and 14.");
  assertAllowed(args.endDate === undefined || args.endDate >= args.effectiveDate, "Schedule end date cannot be before its effective date.");
  for (const [quantity, unit, label] of [
    [args.minimumLoadQuantity, args.minimumLoadUnit, "Minimum load"],
    [args.capacityQuantity, args.capacityUnit, "Capacity"],
  ] as const) {
    assertAllowed(quantity === undefined || (Number.isFinite(quantity) && quantity > 0), `${label} must be a positive number.`);
    assertAllowed((quantity === undefined) === (cleanOptionalText(unit) === undefined), `${label} quantity and unit must be configured together.`);
  }
  if (
    args.minimumLoadQuantity !== undefined &&
    args.capacityQuantity !== undefined &&
    cleanOptionalText(args.minimumLoadUnit)?.toLowerCase() === cleanOptionalText(args.capacityUnit)?.toLowerCase()
  ) {
    assertAllowed(args.minimumLoadQuantity <= args.capacityQuantity, "Minimum load cannot exceed capacity when they share a unit.");
  }
  calculateMarketRunOccurrence(
    {
      timezone,
      deliveryWeekday: args.deliveryWeekday,
      cutoffDaysBefore: args.cutoffDaysBefore,
      cutoffLocalTime: args.cutoffLocalTime,
      arrivalStartLocalTime: args.arrivalStartLocalTime,
      arrivalEndLocalTime: args.arrivalEndLocalTime,
      effectiveDate: args.effectiveDate,
      ...(args.endDate === undefined ? {} : { endDate: args.endDate }),
    },
    firstMatchingDeliveryDate(args.effectiveDate, args.deliveryWeekday),
  );
  return omitUndefinedValues({
    destinationName,
    destinationInstructions,
    timezone,
    deliveryWeekday: args.deliveryWeekday,
    cutoffDaysBefore: args.cutoffDaysBefore,
    cutoffLocalTime: args.cutoffLocalTime,
    arrivalStartLocalTime: args.arrivalStartLocalTime,
    arrivalEndLocalTime: args.arrivalEndLocalTime,
    minimumLoadQuantity: args.minimumLoadQuantity,
    minimumLoadUnit: cleanOptionalText(args.minimumLoadUnit),
    capacityQuantity: args.capacityQuantity,
    capacityUnit: cleanOptionalText(args.capacityUnit),
    effectiveDate: args.effectiveDate,
    endDate: args.endDate,
  });
}

export const create = mutation({
  args: { actorUserId: v.id("users"), ...scheduleFields },
  returns: v.id("marketServiceSchedules"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin", "Only administrators can configure market services.");
    const warehouse = await ctx.db.get(args.originWarehouseId);
    assertAllowed(warehouse !== null, "Origin warehouse was not found.");
    assertAllowed(warehouse.status === "active", "Origin warehouse must be active.");
    await requireAdminPermission(ctx, args.actorUserId, "marketSchedules:manage", await warehouseScopeTarget(ctx, args.originWarehouseId));
    const cleaned = cleanScheduleInput(args);
    const now = Date.now();
    const scheduleId = await ctx.db.insert("marketServiceSchedules", {
      originWarehouseId: args.originWarehouseId,
      ...cleaned,
      status: "draft",
      createdByUserId: args.actorUserId,
      updatedByUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    });
    const schedule = await ctx.db.get(scheduleId);
    await insertAuditLog(ctx, { actor, action: "market_service_schedule.created", entityType: "market_service_schedule", entityId: scheduleId, after: schedule === null ? undefined : auditSnapshot(schedule) });
    return scheduleId;
  },
});

export const update = mutation({
  args: { actorUserId: v.id("users"), scheduleId: v.id("marketServiceSchedules"), ...scheduleFields },
  returns: v.id("marketServiceSchedules"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const schedule = await ctx.db.get(args.scheduleId);
    assertAllowed(schedule !== null, "Market service schedule was not found.");
    assertAllowed(schedule.status !== "retired", "Retired schedules cannot be edited.");
    await requireAdminPermission(ctx, args.actorUserId, "marketSchedules:manage", await warehouseScopeTarget(ctx, schedule.originWarehouseId));
    if (args.originWarehouseId !== schedule.originWarehouseId) {
      await requireAdminPermission(ctx, args.actorUserId, "marketSchedules:manage", await warehouseScopeTarget(ctx, args.originWarehouseId));
    }
    const cleaned = cleanScheduleInput(args);
    await ctx.db.patch(args.scheduleId, { originWarehouseId: args.originWarehouseId, ...cleaned, updatedByUserId: args.actorUserId, updatedAt: Date.now() });
    const after = await ctx.db.get(args.scheduleId);
    await insertAuditLog(ctx, { actor, action: "market_service_schedule.updated", entityType: "market_service_schedule", entityId: args.scheduleId, before: auditSnapshot(schedule), after: after === null ? undefined : auditSnapshot(after) });
    return args.scheduleId;
  },
});

const scheduleTransitions: Record<Doc<"marketServiceSchedules">["status"], readonly Doc<"marketServiceSchedules">["status"][]> = {
  draft: ["active", "retired"],
  active: ["paused", "retired"],
  paused: ["active", "retired"],
  retired: [],
};

export const updateStatus = mutation({
  args: { actorUserId: v.id("users"), scheduleId: v.id("marketServiceSchedules"), status: scheduleStatus, reason: v.optional(v.string()) },
  returns: v.id("marketServiceSchedules"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const schedule = await ctx.db.get(args.scheduleId);
    assertAllowed(schedule !== null, "Market service schedule was not found.");
    await requireAdminPermission(ctx, args.actorUserId, "marketSchedules:manage", await warehouseScopeTarget(ctx, schedule.originWarehouseId));
    assertAllowed(scheduleTransitions[schedule.status].includes(args.status), "Market service schedule status transition is not allowed.");
    await ctx.db.patch(args.scheduleId, { status: args.status, updatedByUserId: args.actorUserId, updatedAt: Date.now() });
    const after = await ctx.db.get(args.scheduleId);
    await insertAuditLog(ctx, { actor, action: "market_service_schedule.status_updated", entityType: "market_service_schedule", entityId: args.scheduleId, before: auditSnapshot(schedule), after: after === null ? undefined : auditSnapshot(after), metadata: args.reason === undefined ? undefined : { reason: args.reason } });
    return args.scheduleId;
  },
});

export const list = query({
  args: { actorUserId: v.id("users"), warehouseId: v.optional(v.id("warehouses")), status: v.optional(scheduleStatus), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const access = await getEffectiveAdminAccess(ctx, args.actorUserId);
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates = args.warehouseId === undefined
      ? await ctx.db.query("marketServiceSchedules").take(limit * 4)
      : await ctx.db.query("marketServiceSchedules").withIndex("by_warehouse_status", (q) => args.status === undefined ? q.eq("originWarehouseId", args.warehouseId!) : q.eq("originWarehouseId", args.warehouseId!).eq("status", args.status!)).take(limit * 4);
    const visible: Array<Doc<"marketServiceSchedules"> & { warehouseName: string }> = [];
    for (const schedule of candidates) {
      if (args.status !== undefined && schedule.status !== args.status) continue;
      const target = await warehouseScopeTarget(ctx, schedule.originWarehouseId);
      if (!adminAccessHasPermissionForScope(access, "marketSchedules:read", target)) continue;
      const warehouse = await ctx.db.get(schedule.originWarehouseId);
      visible.push({ ...schedule, warehouseName: warehouse?.name ?? "Unknown warehouse" });
      if (visible.length >= limit) break;
    }
    return visible;
  },
});

export const getById = query({
  args: { actorUserId: v.id("users"), scheduleId: v.id("marketServiceSchedules") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.scheduleId);
    if (schedule === null) return null;
    await requireAdminPermission(ctx, args.actorUserId, "marketSchedules:read", await warehouseScopeTarget(ctx, schedule.originWarehouseId));
    return schedule;
  },
});
