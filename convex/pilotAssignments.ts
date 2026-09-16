import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireActiveAdmin } from "./workflowHelpers";
import {
  requirePilotAdminPermission,
  requirePilotPrincipal,
} from "./pilotAccess";
import {
  beginPilotIdempotency,
  completePilotIdempotency,
  replayEntityId,
} from "./pilotIdempotency";
import { insertPilotActivityEvent } from "./pilotActivity";

const capability = v.union(
  v.literal("pilot:read"),
  v.literal("requests:review"),
  v.literal("supply:manage"),
  v.literal("offers:manage"),
  v.literal("quality:record"),
  v.literal("fulfilment:manage"),
  v.literal("custody:record"),
  v.literal("issues:manage"),
);

function assignmentSummary(assignment: {
  _id: Id<"pilotAssignments">;
  programmeId: Id<"pilotProgrammes">;
  userId: Id<"users">;
  capabilities: string[];
  status: "active" | "revoked" | "expired";
  expiresAt?: number;
  version: number;
}) {
  return {
    assignmentId: assignment._id,
    programmeId: assignment.programmeId,
    userId: assignment.userId,
    capabilities: assignment.capabilities,
    status: assignment.status,
    expiresAt: assignment.expiresAt,
    version: assignment.version,
  };
}

export const grant = mutation({
  args: {
    programmeId: v.id("pilotProgrammes"),
    targetUserId: v.id("users"),
    capabilities: v.array(capability),
    expiresAt: v.optional(v.number()),
    invitationId: v.optional(v.id("platformInvitations")),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    await requirePilotAdminPermission(
      ctx,
      principal,
      args.programmeId,
      "pilotAssignments:manage",
    );
    const uniqueCapabilities = [...new Set(args.capabilities)].sort();
    if (uniqueCapabilities.length === 0)
      throw new Error("At least one pilot capability is required.");
    if (args.expiresAt !== undefined && args.expiresAt <= Date.now())
      throw new Error("Assignment expiry must be in the future.");
    const target = await ctx.db.get(args.targetUserId);
    if (target === null || target.status !== "active")
      throw new Error("Assignment target must be an active user.");
    const warehouseAgent =
      target.role === "warehouse_agent"
        ? await ctx.db
            .query("warehouseAgents")
            .withIndex("by_user", (q) => q.eq("userId", target._id))
            .unique()
        : null;
    if (
      target.role === "warehouse_agent" &&
      (warehouseAgent === null || warehouseAgent.status !== "approved")
    )
      throw new Error(
        "Pilot operations assignments require an approved operations profile.",
      );
    if (target.role === "admin") await requireActiveAdmin(ctx, target._id);
    if (target.role !== "admin" && target.role !== "warehouse_agent")
      throw new Error(
        "Pilot assignments can target only approved operations or admin identities.",
      );
    if (args.invitationId !== undefined) {
      const invitation = await ctx.db.get(args.invitationId);
      if (
        invitation === null ||
        invitation.type !== "pilot_operations_invite" ||
        invitation.pilotProgrammeId !== args.programmeId ||
        invitation.status !== "accepted" ||
        invitation.acceptedByUserId !== target._id
      )
        throw new Error(
          "Pilot invitation is not accepted for this programme by the assignment target.",
        );
    }
    const requestHash = JSON.stringify({
      programmeId: args.programmeId,
      targetUserId: args.targetUserId,
      capabilities: uniqueCapabilities,
      expiresAt: args.expiresAt ?? null,
      invitationId: args.invitationId ?? null,
    });
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: args.programmeId,
      actorUserId: principal._id,
      operationName: "pilotAssignments.grant",
      idempotencyKey: args.idempotencyKey,
      requestHash,
    });
    if (receipt.kind === "replay") {
      const assignment = await ctx.db.get(
        replayEntityId<"pilotAssignments">(receipt.receipt, "pilotAssignments"),
      );
      if (assignment === null)
        throw new Error("Idempotent assignment result was not found.");
      return assignmentSummary(assignment);
    }
    const existing = await ctx.db
      .query("pilotAssignments")
      .withIndex("by_programme_user", (q) =>
        q.eq("programmeId", args.programmeId).eq("userId", args.targetUserId),
      )
      .collect();
    if (
      existing.some(
        (assignment) =>
          assignment.status === "active" &&
          (assignment.expiresAt === undefined ||
            assignment.expiresAt > Date.now()),
      )
    )
      throw new Error(
        "User already has an active assignment for this programme.",
      );
    const now = Date.now();
    const assignmentId = await ctx.db.insert("pilotAssignments", {
      programmeId: args.programmeId,
      userId: args.targetUserId,
      identityKind: target.role === "admin" ? "admin" : "warehouse_agent",
      ...(warehouseAgent === null
        ? {}
        : { warehouseAgentId: warehouseAgent._id }),
      capabilities: uniqueCapabilities,
      status: "active",
      ...(args.invitationId === undefined
        ? {}
        : { invitationId: args.invitationId }),
      grantedByUserId: principal._id,
      grantedAt: now,
      ...(args.expiresAt === undefined ? {} : { expiresAt: args.expiresAt }),
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    await insertPilotActivityEvent(ctx, {
      programmeId: args.programmeId,
      entityType: "pilotAssignments",
      entityId: assignmentId,
      entityRevision: 0,
      eventName: "pilot.assignment.granted",
      actorUserId: principal._id,
      recipientViews: [
        {
          audience: "admin",
          targetId: args.targetUserId,
          title: "Pilot assignment granted",
          detail: "Programme access and named capabilities were granted.",
        },
      ],
      createdAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotAssignments", entityId: assignmentId },
    ]);
    return assignmentSummary((await ctx.db.get(assignmentId))!);
  },
});

export const revoke = mutation({
  args: {
    assignmentId: v.id("pilotAssignments"),
    expectedVersion: v.number(),
    reason: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const assignment = await ctx.db.get(args.assignmentId);
    if (assignment === null) throw new Error("Pilot assignment was not found.");
    await requirePilotAdminPermission(
      ctx,
      principal,
      assignment.programmeId,
      "pilotAssignments:manage",
    );
    const requestHash = JSON.stringify({
      assignmentId: args.assignmentId,
      expectedVersion: args.expectedVersion,
      reason: args.reason.trim(),
    });
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: assignment.programmeId,
      actorUserId: principal._id,
      operationName: "pilotAssignments.revoke",
      idempotencyKey: args.idempotencyKey,
      requestHash,
    });
    if (receipt.kind === "replay") {
      const replayed = await ctx.db.get(
        replayEntityId<"pilotAssignments">(receipt.receipt, "pilotAssignments"),
      );
      if (replayed === null)
        throw new Error("Idempotent assignment result was not found.");
      return assignmentSummary(replayed);
    }
    if (assignment.status !== "active")
      throw new Error("Only an active assignment can be revoked.");
    if (assignment.version !== args.expectedVersion)
      throw new Error(
        "Pilot assignment changed. Refresh and retry with its current version.",
      );
    if (args.reason.trim().length === 0)
      throw new Error("Revocation reason is required.");
    const now = Date.now();
    await ctx.db.patch(assignment._id, {
      status: "revoked",
      revokedByUserId: principal._id,
      revokedAt: now,
      revocationReason: args.reason.trim(),
      version: assignment.version + 1,
      updatedAt: now,
    });
    await insertPilotActivityEvent(ctx, {
      programmeId: assignment.programmeId,
      entityType: "pilotAssignments",
      entityId: assignment._id,
      entityRevision: assignment.version + 1,
      eventName: "pilot.assignment.revoked",
      actorUserId: principal._id,
      reasonCode: "access_revoked",
      recipientViews: [
        {
          audience: "admin",
          targetId: assignment.userId,
          title: "Pilot assignment revoked",
          detail: args.reason.trim(),
        },
      ],
      createdAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotAssignments", entityId: assignment._id },
    ]);
    return assignmentSummary((await ctx.db.get(assignment._id))!);
  },
});

export const list = query({
  args: {
    programmeId: v.id("pilotProgrammes"),
    status: v.optional(
      v.union(v.literal("active"), v.literal("revoked"), v.literal("expired")),
    ),
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    await requirePilotAdminPermission(
      ctx,
      principal,
      args.programmeId,
      "pilotAssignments:read",
    );
    if (!Number.isSafeInteger(args.limit) || args.limit < 1 || args.limit > 50)
      throw new Error("Page limit must be an integer from 1 to 50.");
    const results = await ctx.db
      .query("pilotAssignments")
      .withIndex("by_programme_status", (q) =>
        q
          .eq("programmeId", args.programmeId)
          .eq("status", args.status ?? "active"),
      )
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit });
    return {
      page: results.page.map(assignmentSummary),
      nextCursor: results.continueCursor,
      isDone: results.isDone,
    };
  },
});

export const listCandidates = query({
  args: { programmeId: v.id("pilotProgrammes") },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    await requirePilotAdminPermission(ctx, principal, args.programmeId, "pilotAssignments:read");
    const users = await ctx.db.query("users").collect();
    const candidates = [];
    for (const user of users) {
      if (user.status !== "active" || (user.role !== "admin" && user.role !== "warehouse_agent")) continue;
      if (user.role === "warehouse_agent") {
        const profile = await ctx.db.query("warehouseAgents").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
        if (profile === null || profile.status !== "approved") continue;
        candidates.push({ userId: user._id, name: profile.fullName, identityKind: "warehouse_agent" as const, warehouseCount: profile.assignedWarehouseIds.length });
      } else {
        candidates.push({ userId: user._id, name: user.email ?? user.phoneNumber ?? `Admin ${String(user._id).slice(-8)}`, identityKind: "admin" as const, warehouseCount: 0 });
      }
    }
    return candidates.sort((a, b) => a.name.localeCompare(b.name));
  },
});
