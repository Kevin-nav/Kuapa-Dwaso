import { canCreateDispute, canManageDisputes } from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  assertActorRoleMatchesUser,
  resolveRequestingRole,
} from "./observabilityAccess";

const marketplaceRole = v.union(
  v.literal("farmer"),
  v.literal("agent"),
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
  v.literal("user"),
  v.literal("farmer"),
  v.literal("agent"),
  v.literal("buyer"),
  v.literal("produce_listing"),
  v.literal("bulk_lot"),
  v.literal("deal"),
  v.literal("transport_provider"),
  v.literal("transport_request"),
  v.literal("approval_request"),
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
  role: "farmer" | "agent" | "buyer" | "transporter" | "admin",
): void {
  if (!canCreateDispute(role)) {
    throw new Error("This role cannot create disputes.");
  }
}

function assertCanManageDisputes(
  role: "farmer" | "agent" | "buyer" | "transporter" | "admin",
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
    summary: v.string(),
    metadata: v.optional(genericRecord),
  },
  returns: v.id("disputes"),
  handler: async (ctx, args) => {
    await assertActorRoleMatchesUser(ctx.db, args);
    assertCanCreateDispute(args.actorRole);
    requireNonBlank(args.actorId, "Actor ID");
    requireNonBlank(args.entityId, "Entity ID");
    requireNonBlank(args.summary, "Dispute summary");

    const now = Date.now();
    const dispute = {
      entityType: args.entityType,
      entityId: args.entityId,
      status: "open" as const,
      summary: args.summary,
      createdAt: now,
      updatedAt: now,
    };
    const disputeId = await ctx.db.insert(
      "disputes",
      args.openedByUserId === undefined
        ? dispute
        : { ...dispute, openedByUserId: args.openedByUserId },
    );

    const auditLog = {
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
      createdAt: now,
    };
    await ctx.db.insert(
      "auditLogs",
      args.metadata === undefined
        ? auditLog
        : { ...auditLog, metadata: args.metadata },
    );

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

    const existing = await ctx.db.get(args.disputeId);
    if (existing === null) {
      throw new Error("Dispute not found.");
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
    const patch = {
      status: args.status,
      updatedAt: now,
    };
    const disputePatch =
      args.status === "resolved"
        ? { ...patch, resolution, resolvedAt: now }
        : resolution === undefined
          ? patch
          : { ...patch, resolution };

    await ctx.db.patch(args.disputeId, disputePatch);
    const auditLog = {
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
      after: disputePatch,
      createdAt: now,
    };
    await ctx.db.insert(
      "auditLogs",
      args.metadata === undefined
        ? auditLog
        : { ...auditLog, metadata: args.metadata },
    );

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
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    assertCanManageDisputes(await resolveRequestingRole(ctx.db, args));

    const { entityType, entityId, status } = args;
    const candidates =
      entityType !== undefined && entityId !== undefined
        ? await ctx.db
            .query("disputes")
            .withIndex("by_entity", (q) =>
              q.eq("entityType", entityType).eq("entityId", entityId),
            )
            .order("desc")
            .take(maxDisputeLimit)
        : status !== undefined
          ? await ctx.db
              .query("disputes")
              .withIndex("by_status", (q) => q.eq("status", status))
              .order("desc")
              .take(maxDisputeLimit)
          : await ctx.db.query("disputes").order("desc").take(maxDisputeLimit);

    return candidates
      .filter((dispute) => status === undefined || dispute.status === status)
      .filter(
        (dispute) =>
          entityType === undefined || dispute.entityType === entityType,
      )
      .filter(
        (dispute) => entityId === undefined || dispute.entityId === entityId,
      )
      .slice(0, clampLimit(args.limit));
  },
});
