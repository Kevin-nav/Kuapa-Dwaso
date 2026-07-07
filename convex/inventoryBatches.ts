import {
  canTransitionInventoryBatchStatus,
  canUpdateInventoryBatch,
  canUpdateInventoryBatchStatus,
} from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  selectApplicableStorageRateRule,
  snapshotStorageRateRule,
} from "./feeRules";
import { insertNotificationRecord } from "./notifications";
import {
  assertAllowed,
  adminScopeTarget,
  auditSnapshot,
  cleanOptionalText,
  getActor,
  insertAuditLog,
  inventoryScopeTarget,
  normalizeCodeSegment,
  omitUndefinedValues,
  requireAdminPermission,
  requireWarehouseAgentAssignedToWarehouse,
  warehouseScopeTarget,
} from "./workflowHelpers";

const produceGrade = v.union(
  v.literal("A"),
  v.literal("B"),
  v.literal("C"),
  v.literal("mixed"),
  v.literal("ungraded"),
);

const inventoryBatchStatus = v.union(
  v.literal("received"),
  v.literal("verified"),
  v.literal("available"),
  v.literal("partially_reserved"),
  v.literal("reserved"),
  v.literal("partially_sold"),
  v.literal("sold"),
  v.literal("prepared_for_dispatch"),
  v.literal("dispatched"),
  v.literal("withdrawn"),
  v.literal("expired"),
  v.literal("spoiled"),
  v.literal("disputed"),
);

type InventoryBatchStatus =
  | "received"
  | "verified"
  | "available"
  | "partially_reserved"
  | "reserved"
  | "partially_sold"
  | "sold"
  | "prepared_for_dispatch"
  | "dispatched"
  | "withdrawn"
  | "expired"
  | "spoiled"
  | "disputed";

async function makeUniqueReceiptCode(
  ctx: QueryCtx | MutationCtx,
  warehouseCode: string,
  timestamp: number,
): Promise<string> {
  const warehouseSegment = normalizeCodeSegment(warehouseCode, 8).padEnd(3, "X");
  const timeTail = String(timestamp).slice(-6).padStart(6, "0");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const receiptCode = `WH-${warehouseSegment}-${timeTail}${suffix}`;
    const existing = await ctx.db
      .query("inventoryBatches")
      .withIndex("by_receipt_code", (q) => q.eq("receiptCode", receiptCode))
      .unique();

    if (existing === null) {
      return receiptCode;
    }
  }

  throw new Error("Could not generate a unique receipt code.");
}

function assertPositiveQuantity(value: number, label: string): void {
  assertAllowed(Number.isFinite(value) && value > 0, `${label} must be a positive number.`);
}

function manualStorageRateSnapshot(args: {
  ratePerUnitPerDay: number;
  unit: string;
  currency?: string;
  warehouseId: Id<"warehouses">;
  cropType: string;
  grade: "A" | "B" | "C" | "mixed" | "ungraded";
  snapshottedAt: number;
}) {
  return {
    label: "Manual storage fee",
    calculationType: "per_unit_per_day" as const,
    payer: "farmer" as const,
    ratePerUnitPerDay: args.ratePerUnitPerDay,
    currency: args.currency ?? "GHS",
    scope: {
      warehouseId: args.warehouseId,
      cropType: args.cropType,
      unit: args.unit,
      grade: args.grade,
    },
    snapshottedAt: args.snapshottedAt,
  };
}

async function ensureActorCanViewBatch(
  ctx: QueryCtx,
  actorUserId: Id<"users">,
  batch: {
    farmerId: Id<"farmers">;
    warehouseId: Id<"warehouses">;
  },
): Promise<void> {
  const actor = await getActor(ctx, actorUserId);
  if (actor.role === "admin") {
    await requireAdminPermission(ctx, actorUserId, "inventory:read", await inventoryScopeTarget(ctx, batch));
    return;
  }

  if (actor.role === "warehouse_agent") {
    await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, batch.warehouseId);
    return;
  }

  if (actor.role === "farmer") {
    const farmer = await ctx.db.get(batch.farmerId);
    assertAllowed(farmer !== null && farmer.userId === actor._id, "Actor cannot view this receipt.");
    return;
  }

  throw new Error("Actor cannot view this inventory batch.");
}

export const createIntake = mutation({
  args: {
    actorUserId: v.id("users"),
    farmerId: v.id("farmers"),
    warehouseId: v.id("warehouses"),
    cropType: v.string(),
    variety: v.optional(v.string()),
    quantityReceived: v.number(),
    unit: v.string(),
    grade: produceGrade,
    photos: v.optional(v.array(v.string())),
    conditionNotes: v.optional(v.string()),
    receivedAt: v.optional(v.number()),
    expectedShelfLifeDays: v.optional(v.number()),
    sellByDate: v.optional(v.number()),
    storageRateRuleId: v.optional(v.id("storageRateRules")),
    manualStorageRatePerUnitPerDay: v.optional(v.number()),
    storageRateCurrency: v.optional(v.string()),
    askingPricePerUnit: v.optional(v.number()),
    minimumPricePerUnit: v.optional(v.number()),
    status: v.optional(inventoryBatchStatus),
  },
  returns: v.id("inventoryBatches"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "warehouse_agent", "Only warehouse agents can receive produce.");
    const warehouseAgent = await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, args.warehouseId);
    const warehouse = await ctx.db.get(args.warehouseId);
    assertAllowed(warehouse !== null, "Warehouse was not found.");
    assertAllowed(warehouse.status === "active", "Produce can only be received at active warehouses.");
    const farmer = await ctx.db.get(args.farmerId);
    assertAllowed(farmer !== null, "Farmer was not found.");
    assertAllowed(farmer.status === "active", "Farmer must be active.");
    assertPositiveQuantity(args.quantityReceived, "Quantity received");
    if (args.askingPricePerUnit !== undefined) {
      assertAllowed(args.askingPricePerUnit >= 0, "Asking price must be non-negative.");
    }
    if (args.minimumPricePerUnit !== undefined) {
      assertAllowed(args.minimumPricePerUnit >= 0, "Minimum price must be non-negative.");
    }

    const now = Date.now();
    const receivedAt = args.receivedAt ?? now;
    const explicitRule =
      args.storageRateRuleId === undefined ? null : await ctx.db.get(args.storageRateRuleId);
    assertAllowed(
      args.storageRateRuleId === undefined || explicitRule !== null,
      "Storage rate rule was not found.",
    );
    const selectedRule =
      explicitRule ??
      (await selectApplicableStorageRateRule(ctx, {
        warehouseId: args.warehouseId,
        cropType: args.cropType,
        unit: args.unit,
        grade: args.grade,
        asOf: receivedAt,
      }));
    const storageRateSnapshot =
      selectedRule === null
        ? manualStorageRateSnapshot(omitUndefinedValues({
            ratePerUnitPerDay: args.manualStorageRatePerUnitPerDay ?? 0,
            unit: args.unit,
            currency: args.storageRateCurrency,
            warehouseId: args.warehouseId,
            cropType: args.cropType,
            grade: args.grade,
            snapshottedAt: now,
          }))
        : snapshotStorageRateRule(selectedRule, now);

    const receiptCode = await makeUniqueReceiptCode(ctx, warehouse.code, now);
    const inventoryBatchId = await ctx.db.insert("inventoryBatches", omitUndefinedValues({
      receiptCode,
      farmerId: args.farmerId,
      warehouseId: args.warehouseId,
      receivedByWarehouseAgentId: warehouseAgent._id,
      cropType: args.cropType.trim(),
      variety: cleanOptionalText(args.variety),
      quantityReceived: args.quantityReceived,
      quantityAvailable: args.quantityReceived,
      unit: args.unit.trim(),
      grade: args.grade,
      photos: args.photos ?? [],
      conditionNotes: cleanOptionalText(args.conditionNotes),
      receivedAt,
      expectedShelfLifeDays: args.expectedShelfLifeDays,
      sellByDate: args.sellByDate,
      storageRateSnapshot,
      storageFeeAccrued: 0,
      lastFeeCalculatedAt: receivedAt,
      askingPricePerUnit: args.askingPricePerUnit,
      minimumPricePerUnit: args.minimumPricePerUnit,
      status: args.status ?? "received",
      createdAt: now,
      updatedAt: now,
    }));

    await insertNotificationRecord(ctx, {
      recipientId: args.farmerId,
      recipientUserId: farmer.userId,
      recipientRole: "farmer",
      channel: "sms",
      title: "Produce received",
      message: `Your ${args.quantityReceived} ${args.unit} of ${args.cropType} has been received at ${warehouse.name}.`,
      relatedEntityType: "inventory_batch",
      relatedEntityId: inventoryBatchId,
    });
    await insertNotificationRecord(ctx, {
      recipientId: args.farmerId,
      recipientUserId: farmer.userId,
      recipientRole: "farmer",
      channel: "sms",
      title: "Receipt generated",
      message: `Receipt ${receiptCode} was generated for your ${args.cropType} at ${warehouse.name}.`,
      relatedEntityType: "inventory_batch",
      relatedEntityId: inventoryBatchId,
    });

    const after = await ctx.db.get(inventoryBatchId);
    await insertAuditLog(ctx, {
      actor,
      action: "inventory_batch.intake_created",
      entityType: "inventory_batch",
      entityId: inventoryBatchId,
      after: after === null ? undefined : auditSnapshot(after),
    });

    return inventoryBatchId;
  },
});

export const updateStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    inventoryBatchId: v.id("inventoryBatches"),
    status: inventoryBatchStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("inventoryBatches"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canUpdateInventoryBatchStatus(actor.role), "Actor cannot update inventory status.");
    const batch = await ctx.db.get(args.inventoryBatchId);
    assertAllowed(batch !== null, "Inventory batch was not found.");
    if (actor.role === "warehouse_agent") {
      await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, batch.warehouseId);
    } else {
      await requireAdminPermission(ctx, actor._id, "inventory:manage", await inventoryScopeTarget(ctx, batch));
    }
    assertAllowed(
      canTransitionInventoryBatchStatus(batch.status, args.status as InventoryBatchStatus),
      "Inventory status transition is not allowed.",
    );

    await ctx.db.patch(args.inventoryBatchId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    const after = await ctx.db.get(args.inventoryBatchId);
    await insertAuditLog(ctx, {
      actor,
      action: `inventory_batch.status_${args.status}`,
      entityType: "inventory_batch",
      entityId: args.inventoryBatchId,
      before: auditSnapshot(batch),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.inventoryBatchId;
  },
});

export const updateDetails = mutation({
  args: {
    actorUserId: v.id("users"),
    inventoryBatchId: v.id("inventoryBatches"),
    quantityAvailable: v.optional(v.number()),
    grade: v.optional(produceGrade),
    askingPricePerUnit: v.optional(v.number()),
    minimumPricePerUnit: v.optional(v.number()),
    conditionNotes: v.optional(v.string()),
    photos: v.optional(v.array(v.string())),
    reason: v.optional(v.string()),
  },
  returns: v.id("inventoryBatches"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canUpdateInventoryBatch(actor.role), "Actor cannot update inventory.");
    const batch = await ctx.db.get(args.inventoryBatchId);
    assertAllowed(batch !== null, "Inventory batch was not found.");
    if (actor.role === "warehouse_agent") {
      await requireWarehouseAgentAssignedToWarehouse(ctx, actor._id, batch.warehouseId);
    } else {
      await requireAdminPermission(ctx, actor._id, "inventory:manage", await inventoryScopeTarget(ctx, batch));
      if (args.quantityAvailable !== undefined) {
        await requireAdminPermission(ctx, actor._id, "inventory:adjust", await inventoryScopeTarget(ctx, batch));
      }
    }
    if (args.quantityAvailable !== undefined) {
      assertAllowed(args.quantityAvailable >= 0, "Available quantity must be non-negative.");
      assertAllowed(
        args.quantityAvailable <= batch.quantityReceived,
        "Available quantity cannot exceed received quantity.",
      );
    }
    if (args.askingPricePerUnit !== undefined) {
      assertAllowed(args.askingPricePerUnit >= 0, "Asking price must be non-negative.");
    }
    if (args.minimumPricePerUnit !== undefined) {
      assertAllowed(args.minimumPricePerUnit >= 0, "Minimum price must be non-negative.");
    }

    await ctx.db.patch(args.inventoryBatchId, omitUndefinedValues({
      quantityAvailable: args.quantityAvailable,
      grade: args.grade,
      askingPricePerUnit: args.askingPricePerUnit,
      minimumPricePerUnit: args.minimumPricePerUnit,
      conditionNotes: cleanOptionalText(args.conditionNotes),
      photos: args.photos,
      updatedAt: Date.now(),
    }));

    const after = await ctx.db.get(args.inventoryBatchId);
    await insertAuditLog(ctx, {
      actor,
      action: "inventory_batch.details_updated",
      entityType: "inventory_batch",
      entityId: args.inventoryBatchId,
      before: auditSnapshot(batch),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.inventoryBatchId;
  },
});

export const getByReceiptCode = query({
  args: {
    actorUserId: v.id("users"),
    receiptCode: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("inventoryBatches")
      .withIndex("by_receipt_code", (q) => q.eq("receiptCode", args.receiptCode.trim().toUpperCase()))
      .unique();
    if (batch === null) {
      return null;
    }

    await ensureActorCanViewBatch(ctx, args.actorUserId, batch);
    return batch;
  },
});

export const getById = query({
  args: {
    actorUserId: v.id("users"),
    inventoryBatchId: v.id("inventoryBatches"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.inventoryBatchId);
    if (batch === null) {
      return null;
    }

    await ensureActorCanViewBatch(ctx, args.actorUserId, batch);
    return batch;
  },
});

export const listFarmerReceipts = query({
  args: {
    actorUserId: v.id("users"),
    farmerId: v.id("farmers"),
    status: v.optional(inventoryBatchStatus),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const farmer = await ctx.db.get(args.farmerId);
    assertAllowed(farmer !== null, "Farmer was not found.");
    assertAllowed(
      actor.role === "admin" || farmer.userId === actor._id,
      "Actor cannot list this farmer's receipts.",
    );
    if (actor.role === "admin") {
      await requireAdminPermission(ctx, args.actorUserId, "inventory:read", adminScopeTarget({
        warehouseId: farmer.preferredWarehouseId,
        region: farmer.region,
        district: farmer.community,
      }));
    }
    const limit = Math.min(args.limit ?? 50, 100);
    const batches = await ctx.db
      .query("inventoryBatches")
      .withIndex("by_farmer", (q) => q.eq("farmerId", args.farmerId))
      .take(limit * 3);

    return batches
      .filter((batch) => args.status === undefined || batch.status === args.status)
      .slice(0, limit);
  },
});

export const listWarehouseInventory = query({
  args: {
    actorUserId: v.id("users"),
    warehouseId: v.id("warehouses"),
    status: v.optional(inventoryBatchStatus),
    cropType: v.optional(v.string()),
    grade: v.optional(produceGrade),
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
        "inventory:read",
        await warehouseScopeTarget(ctx, args.warehouseId),
      );
    }

    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.status === undefined
        ? await ctx.db
            .query("inventoryBatches")
            .withIndex("by_warehouse_status", (q) => q.eq("warehouseId", args.warehouseId))
            .take(limit * 3)
        : args.cropType !== undefined && args.grade !== undefined
          ? await ctx.db
              .query("inventoryBatches")
              .withIndex("by_warehouse_crop_grade_status", (q) =>
                q
                  .eq("warehouseId", args.warehouseId)
                  .eq("cropType", args.cropType!)
                  .eq("grade", args.grade!)
                  .eq("status", args.status!),
              )
              .take(limit * 3)
          : await ctx.db
              .query("inventoryBatches")
              .withIndex("by_warehouse_status", (q) =>
                q.eq("warehouseId", args.warehouseId).eq("status", args.status!),
              )
              .take(limit * 3);

    return candidates
      .filter((batch) => args.cropType === undefined || batch.cropType === args.cropType)
      .filter((batch) => args.grade === undefined || batch.grade === args.grade)
      .filter((batch) => args.status === undefined || batch.status === args.status)
      .slice(0, limit);
  },
});
