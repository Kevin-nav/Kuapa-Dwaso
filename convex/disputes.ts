import { canCreateDispute, canManageDisputes } from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { insertNotificationRecord } from "./notifications";
import {
  assertActorRoleMatchesUser,
  resolveRequestingRole,
} from "./observabilityAccess";
import {
  adminAccessHasPermissionForScope,
  disputeScopeTarget,
  getEffectiveAdminAccess,
  omitUndefinedValues,
  requireAdminPermission,
  warehouseScopeTarget,
} from "./workflowHelpers";
import { previousClientActionResult, recordClientAction } from "./clientActions";

const marketplaceRole = v.union(
  v.literal("farmer"),
  v.literal("warehouse_agent"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("admin"),
);

const disputeStatus = v.union(
  v.literal("open"),
  v.literal("under_review"),
  v.literal("resolved"),
  v.literal("cancelled"),
);
const disputeEntityType = v.union(
  v.literal("farmer"),
  v.literal("warehouse"),
  v.literal("warehouse_agent"),
  v.literal("inventory_batch"),
  v.literal("storage_receipt"),
  v.literal("buyer_order"),
  v.literal("sale_record"),
  v.literal("dispatch"),
  v.literal("storage_fee_ledger"),
  v.literal("buyer"),
  v.literal("notification"),
  v.literal("app_setting"),
);
const genericRecord = v.record(v.string(), v.any());
const maxDisputeLimit = 200;

function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 50, 1), maxDisputeLimit);
}

function requireNonBlank(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} cannot be blank.`);
  }
}

function assertCanCreateDispute(
  role: "farmer" | "warehouse_agent" | "buyer" | "transporter" | "admin",
): void {
  if (!canCreateDispute(role)) {
    throw new Error("This role cannot create disputes.");
  }
}

function assertCanManageDisputes(
  role: "farmer" | "warehouse_agent" | "buyer" | "transporter" | "admin",
): void {
  if (!canManageDisputes(role)) {
    throw new Error("Only admins can manage disputes.");
  }
}

export const create = mutation({
  args: {
    actorId: v.string(),
    actorUserId: v.optional(v.id("users")),
    actorRole: marketplaceRole,
    entityType: disputeEntityType,
    entityId: v.string(),
    openedByUserId: v.optional(v.id("users")),
    warehouseId: v.optional(v.id("warehouses")),
    summary: v.string(),
    metadata: v.optional(genericRecord),
    clientActionId: v.optional(v.string()),
  },
  returns: v.id("disputes"),
  handler: async (ctx, args) => {
    await assertActorRoleMatchesUser(ctx.db, args);
    assertCanCreateDispute(args.actorRole);
    if (args.actorUserId !== undefined) {
      const actionKind = args.actorRole === "warehouse_agent" ? "ops_dispute_create" : "farmer_dispute_create";
      const previous = await previousClientActionResult(ctx, args.actorUserId, actionKind, args.clientActionId);
      if (previous?.resultEntityId !== undefined) return previous.resultEntityId as Id<"disputes">;
    }
    if (args.actorRole === "admin") {
      if (args.actorUserId === undefined) {
        throw new Error("Admin dispute creation requires actorUserId.");
      }
      await requireAdminPermission(
        ctx,
        args.actorUserId,
        "disputes:manage",
        args.warehouseId === undefined ? {} : await warehouseScopeTarget(ctx, args.warehouseId),
      );
    }
    requireNonBlank(args.actorId, "Actor ID");
    requireNonBlank(args.entityId, "Entity ID");
    requireNonBlank(args.summary, "Dispute summary");

    const now = Date.now();
    const disputeId = await ctx.db.insert("disputes", omitUndefinedValues({
      entityType: args.entityType,
      entityId: args.entityId,
      status: "open",
      openedByUserId: args.openedByUserId,
      openedByRole: args.actorRole,
      warehouseId: args.warehouseId,
      summary: args.summary,
      createdAt: now,
      updatedAt: now,
    }));

    await ctx.db.insert("auditLogs", omitUndefinedValues({
      actorId: args.actorId,
      actorRole: args.actorRole,
      action: "dispute.created",
      entityType: "dispute",
      entityId: disputeId,
      after: {
        entityType: args.entityType,
        entityId: args.entityId,
        status: "open",
        summary: args.summary,
      },
      metadata: args.metadata,
      createdAt: now,
    }));
    const recipientUserId = args.openedByUserId ?? args.actorUserId;
    if (recipientUserId !== undefined) {
      await insertNotificationRecord(ctx, {
        recipientUserId,
        recipientRole: args.actorRole,
        channel: "sms",
        title: "Issue received",
        message: "We received your issue. We will look into it.",
        messageKind: "dispute_update",
        templateKey: "generic_notification",
        relatedEntityType: "dispute",
        relatedEntityId: disputeId,
      });
    }

    if (args.actorUserId !== undefined) {
      await recordClientAction(ctx, { actorUserId: args.actorUserId, clientActionId: args.clientActionId, actionKind: args.actorRole === "warehouse_agent" ? "ops_dispute_create" : "farmer_dispute_create", resultEntityId: disputeId });
    }

    return disputeId;
  },
});

export const updateStatus = mutation({
  args: {
    actorId: v.string(),
    actorUserId: v.optional(v.id("users")),
    actorRole: marketplaceRole,
    disputeId: v.id("disputes"),
    status: disputeStatus,
    resolution: v.optional(v.string()),
    metadata: v.optional(genericRecord),
  },
  returns: v.id("disputes"),
  handler: async (ctx, args) => {
    await assertActorRoleMatchesUser(ctx.db, args);
    assertCanManageDisputes(args.actorRole);
    if (args.actorRole === "admin") {
      if (args.actorUserId === undefined) {
        throw new Error("Admin dispute management requires actorUserId.");
      }
    }

    const existing = await ctx.db.get(args.disputeId);
    if (existing === null) {
      throw new Error("Dispute not found.");
    }
    if (args.actorRole === "admin") {
      await requireAdminPermission(ctx, args.actorUserId!, "disputes:manage", await disputeScopeTarget(ctx, existing));
    }
    requireNonBlank(args.actorId, "Actor ID");
    const resolution = args.resolution;
    if (args.status === "resolved") {
      if (resolution === undefined) {
        throw new Error("Resolution is required for resolved disputes.");
      }
      requireNonBlank(resolution, "Resolution");
    }

    const now = Date.now();
    const patch =
      args.status === "resolved"
        ? { status: args.status, resolution, resolvedAt: now, updatedAt: now }
        : resolution === undefined
          ? { status: args.status, updatedAt: now }
          : { status: args.status, resolution, updatedAt: now };

    await ctx.db.patch(args.disputeId, patch);
    await ctx.db.insert("auditLogs", omitUndefinedValues({
      actorId: args.actorId,
      actorRole: args.actorRole,
      action: "dispute.status_updated",
      entityType: "dispute",
      entityId: args.disputeId,
      before: {
        status: existing.status,
        resolution: existing.resolution,
        resolvedAt: existing.resolvedAt,
      },
      after: patch,
      metadata: args.metadata,
      createdAt: now,
    }));
    if (existing.openedByUserId !== undefined && existing.openedByRole !== undefined) {
      const message =
        args.status === "under_review"
          ? "We are looking at your issue."
          : args.status === "resolved"
            ? `Your issue has been resolved. ${resolution}`
            : args.status === "cancelled"
              ? "Your issue has been closed."
              : "Your issue has been updated.";
      await insertNotificationRecord(ctx, {
        recipientUserId: existing.openedByUserId,
        recipientRole: existing.openedByRole,
        channel: "sms",
        title: "Issue update",
        message,
        messageKind: "dispute_update",
        templateKey: "generic_notification",
        relatedEntityType: "dispute",
        relatedEntityId: args.disputeId,
      });
    }

    return args.disputeId;
  },
});

export const list = query({
  args: {
    requestingUserId: v.optional(v.id("users")),
    requestingActorRole: v.optional(marketplaceRole),
    status: v.optional(disputeStatus),
    entityType: v.optional(disputeEntityType),
    entityId: v.optional(v.string()),
    warehouseId: v.optional(v.id("warehouses")),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const role = await resolveRequestingRole(ctx.db, args);
    assertCanManageDisputes(role);
    if (role === "admin" && args.requestingUserId === undefined) {
      throw new Error("Admin dispute listing requires requestingUserId.");
    }

    const { entityType, entityId, status, warehouseId } = args;
    const candidates =
      entityType !== undefined && entityId !== undefined
        ? await ctx.db
            .query("disputes")
            .withIndex("by_entity", (q) =>
              q.eq("entityType", entityType).eq("entityId", entityId),
            )
            .order("desc")
            .take(maxDisputeLimit)
        : warehouseId !== undefined && status !== undefined
          ? await ctx.db
              .query("disputes")
              .withIndex("by_warehouse_status", (q) => q.eq("warehouseId", warehouseId).eq("status", status))
              .order("desc")
              .take(maxDisputeLimit)
          : status !== undefined
            ? await ctx.db
                .query("disputes")
                .withIndex("by_status", (q) => q.eq("status", status))
                .order("desc")
                .take(maxDisputeLimit)
            : await ctx.db.query("disputes").order("desc").take(maxDisputeLimit);

    const filtered = candidates
      .filter((dispute) => status === undefined || dispute.status === status)
      .filter((dispute) => warehouseId === undefined || dispute.warehouseId === warehouseId)
      .filter(
        (dispute) =>
          entityType === undefined || dispute.entityType === entityType,
      )
      .filter(
        (dispute) => entityId === undefined || dispute.entityId === entityId,
      );
    if (role !== "admin") {
      return filtered.slice(0, clampLimit(args.limit));
    }
    const access = await getEffectiveAdminAccess(ctx, args.requestingUserId!);
    const results = [];
    for (const dispute of filtered) {
      if (adminAccessHasPermissionForScope(access, "disputes:read", await disputeScopeTarget(ctx, dispute))) {
        results.push(dispute);
      }
      if (results.length >= clampLimit(args.limit)) {
        break;
      }
    }
    return results;
  },
});
