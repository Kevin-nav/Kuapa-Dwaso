import { v } from "convex/values";
import {
  pilotIssueNeedsReminder,
  pilotIssueReminderKey,
} from "@kuapa-dwaso/utils/pilot-notifications";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  requirePilotCapability,
  requirePilotPrincipal,
} from "./pilotAccess";
import { insertPilotActivityEvent } from "./pilotActivity";
import { insertNotificationRecord } from "./notifications";
import { assertAllowed } from "./workflowHelpers";

const issueType = v.union(
  v.literal("quality_shortfall"),
  v.literal("custody_discrepancy"),
  v.literal("buyer_rejection"),
  v.literal("cancellation_disposition"),
  v.literal("payment_dispute"),
  v.literal("correction"),
);

export async function findPilotIssueOwner(
  ctx: MutationCtx,
  programmeId: Id<"pilotProgrammes">,
): Promise<Id<"users">> {
  const assignments = await ctx.db
    .query("pilotAssignments")
    .withIndex("by_programme_status", (q) =>
      q.eq("programmeId", programmeId).eq("status", "active"),
    )
    .collect();
  const now = Date.now();
  const assignment = assignments.find(
    (candidate) =>
      candidate.capabilities.includes("issues:manage") &&
      (candidate.expiresAt === undefined || candidate.expiresAt > now),
  );
  assertAllowed(
    assignment !== undefined,
    "An active pilot issue owner with issues:manage is required.",
  );
  return assignment.userId;
}

async function validateOwner(
  ctx: MutationCtx,
  programmeId: Id<"pilotProgrammes">,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  assertAllowed(user?.status === "active", "Issue owner must be an active user.");
  const assignments = await ctx.db
    .query("pilotAssignments")
    .withIndex("by_programme_user", (q) =>
      q.eq("programmeId", programmeId).eq("userId", userId),
    )
    .collect();
  assertAllowed(
    assignments.some(
      (assignment) =>
        assignment.status === "active" &&
        assignment.capabilities.includes("issues:manage") &&
        (assignment.expiresAt === undefined || assignment.expiresAt > Date.now()),
    ),
    "Issue owner must have an active issues:manage assignment.",
  );
}

async function validateEvidence(
  ctx: MutationCtx,
  actorUserId: Id<"users">,
  programmeId: Id<"pilotProgrammes">,
  requestId: Id<"pilotBuyerRequests">,
  assetIds: Id<"uploadAssets">[],
) {
  assertAllowed(new Set(assetIds).size === assetIds.length, "Issue evidence cannot contain duplicates.");
  for (const assetId of assetIds) {
    const asset = await ctx.db.get(assetId);
    assertAllowed(
      asset !== null &&
        asset.ownerUserId === actorUserId &&
        asset.purpose === "pilot_issue_evidence" &&
        asset.accessLevel === "private" &&
        ["uploaded", "verified"].includes(asset.status) &&
        (asset.pilotProgrammeId === undefined || asset.pilotProgrammeId === programmeId) &&
        (asset.relatedEntityId === undefined ||
          (asset.relatedEntityType === "pilotBuyerRequests" && asset.relatedEntityId === requestId)),
      "Issue evidence must be private, completed, actor-owned, and scoped to this request.",
    );
  }
}

async function attachEvidence(
  ctx: MutationCtx,
  issueId: Id<"pilotIssues">,
  programmeId: Id<"pilotProgrammes">,
  assetIds: Id<"uploadAssets">[],
) {
  const now = Date.now();
  for (const assetId of assetIds)
    await ctx.db.patch(assetId, {
      pilotProgrammeId: programmeId,
      relatedEntityType: "pilotIssues",
      relatedEntityId: issueId,
      status: "attached",
      updatedAt: now,
    });
}

export const open = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    lotId: v.optional(v.id("pilotProcurementLots")),
    planId: v.optional(v.id("pilotFulfilmentPlans")),
    acceptanceId: v.optional(v.id("pilotBuyerAcceptances")),
    issueType,
    assignedToUserId: v.id("users"),
    reasonCode: v.string(),
    summary: v.string(),
    nextStep: v.string(),
    deadlineAt: v.optional(v.number()),
    responsibleCustodian: v.object({
      kind: v.union(
        v.literal("farmer"),
        v.literal("buyer"),
        v.literal("kuapa_dwaso"),
        v.literal("transporter"),
        v.literal("facility"),
      ),
      id: v.optional(v.string()),
      displayNameSnapshot: v.string(),
    }),
    evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const request = await ctx.db.get(args.requestId);
    assertAllowed(request !== null, "Pilot request was not found.");
    await requirePilotCapability(ctx, principal, request.programmeId, "issues:manage");
    await validateOwner(ctx, request.programmeId, args.assignedToUserId);
    await validateEvidence(ctx, principal._id, request.programmeId, request._id, args.evidenceUploadAssetIds);
    const reasonCode = args.reasonCode.trim();
    const summary = args.summary.trim();
    const nextStep = args.nextStep.trim();
    assertAllowed(reasonCode.length > 0 && summary.length > 0 && nextStep.length > 0, "Issue reason, summary, and next step are required.");
    const now = Date.now();
    const issueId = await ctx.db.insert("pilotIssues", {
      programmeId: request.programmeId,
      requestId: request._id,
      ...(args.lotId === undefined ? {} : { lotId: args.lotId }),
      ...(args.planId === undefined ? {} : { planId: args.planId }),
      ...(args.acceptanceId === undefined ? {} : { acceptanceId: args.acceptanceId }),
      issueType: args.issueType,
      status: "open",
      assignedToUserId: args.assignedToUserId,
      reasonCode,
      summary,
      nextStep,
      responsibleCustodian: args.responsibleCustodian,
      ...(args.deadlineAt === undefined ? {} : { deadlineAt: args.deadlineAt }),
      evidenceUploadAssetIds: args.evidenceUploadAssetIds,
      version: 0,
      createdByUserId: principal._id,
      createdAt: now,
      updatedAt: now,
    });
    await attachEvidence(ctx, issueId, request.programmeId, args.evidenceUploadAssetIds);
    await insertPilotActivityEvent(ctx, {
      programmeId: request.programmeId,
      requestId: request._id,
      entityType: "pilotIssues",
      entityId: issueId,
      entityRevision: 0,
      eventName: "pilot.issue.opened",
      actorUserId: principal._id,
      reasonCode,
      recipientViews: [
        { audience: "pilot_ops", targetId: args.assignedToUserId, title: "Pilot issue assigned", detail: `${summary} Next: ${nextStep}` },
      ],
      createdAt: now,
    });
    return await ctx.db.get(issueId);
  },
});

async function archiveIssueReminders(ctx: MutationCtx, issueId: Id<"pilotIssues">) {
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_related_entity", (q) =>
      q.eq("relatedEntityType", "pilotIssues").eq("relatedEntityId", String(issueId)),
    )
    .collect();
  for (const notification of notifications)
    if (["pending", "queued", "sent"].includes(notification.status))
      await ctx.db.patch(notification._id, { status: "archived", updatedAt: Date.now() });
}

export const resolve = mutation({
  args: {
    issueId: v.id("pilotIssues"),
    expectedVersion: v.number(),
    resolution: v.string(),
    evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const issue = await ctx.db.get(args.issueId);
    assertAllowed(issue !== null, "Pilot issue was not found.");
    await requirePilotCapability(ctx, principal, issue.programmeId, "issues:manage");
    assertAllowed(issue.version === args.expectedVersion, "Pilot issue changed; refresh and retry.");
    assertAllowed(!["resolved", "closed"].includes(issue.status), "Pilot issue is already resolved.");
    const resolution = args.resolution.trim();
    assertAllowed(resolution.length > 0, "Issue resolution is required.");
    await validateEvidence(ctx, principal._id, issue.programmeId, issue.requestId, args.evidenceUploadAssetIds);
    const now = Date.now();
    const evidenceUploadAssetIds = [...new Set([...issue.evidenceUploadAssetIds, ...args.evidenceUploadAssetIds])];
    await ctx.db.patch(issue._id, {
      status: "resolved",
      resolution,
      evidenceUploadAssetIds,
      resolvedByUserId: principal._id,
      resolvedAt: now,
      version: issue.version + 1,
      updatedAt: now,
    });
    await attachEvidence(ctx, issue._id, issue.programmeId, args.evidenceUploadAssetIds);
    await archiveIssueReminders(ctx, issue._id);
    await insertPilotActivityEvent(ctx, {
      programmeId: issue.programmeId,
      requestId: issue.requestId,
      entityType: "pilotIssues",
      entityId: issue._id,
      entityRevision: issue.version + 1,
      eventName: "pilot.issue.resolved",
      actorUserId: principal._id,
      reasonCode: issue.reasonCode,
      recipientViews: [
        { audience: "pilot_ops", targetId: issue.assignedToUserId, title: "Pilot issue resolved", detail: resolution },
        { audience: "buyer", title: "Request issue resolved", detail: resolution },
      ],
      createdAt: now,
    });
    return await ctx.db.get(issue._id);
  },
});

export const listAssigned = query({
  args: { status: v.optional(v.union(v.literal("open"), v.literal("investigating"), v.literal("awaiting_party"), v.literal("resolved"), v.literal("closed"))) },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const rows = args.status === undefined
      ? await ctx.db.query("pilotIssues").withIndex("by_assignee_status", (q) => q.eq("assignedToUserId", principal._id)).collect()
      : await ctx.db.query("pilotIssues").withIndex("by_assignee_status", (q) => q.eq("assignedToUserId", principal._id).eq("status", args.status!)).collect();
    return rows.sort((a, b) => (a.deadlineAt ?? Number.MAX_SAFE_INTEGER) - (b.deadlineAt ?? Number.MAX_SAFE_INTEGER));
  },
});

export const enqueueCurrentReminders = internalMutation({
  args: { now: v.optional(v.number()), dueWithinMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const cutoff = now + (args.dueWithinMs ?? 24 * 60 * 60 * 1000);
    const candidates = await ctx.db.query("pilotIssues").withIndex("by_deadline_status").collect();
    const active = candidates.filter((issue) =>
      pilotIssueNeedsReminder({
        status: issue.status,
        ...(issue.deadlineAt === undefined
          ? {}
          : { deadlineAt: issue.deadlineAt }),
        cutoff,
      }),
    );
    const ids = [];
    for (const issue of active) {
      const user = await ctx.db.get(issue.assignedToUserId);
      if (user === null || user.status !== "active") continue;
      ids.push(await insertNotificationRecord(ctx, {
        recipientUserId: user._id,
        recipientRole: user.role === "admin" ? "admin" : "warehouse_agent",
        channel: "in_app",
        title: issue.deadlineAt! < now ? "Pilot issue overdue" : "Pilot issue due soon",
        message: `${issue.summary} Next: ${issue.nextStep}`,
        messageKind: "transactional",
        templateKey: "generic_notification",
        relatedEntityType: "pilotIssues",
        relatedEntityId: String(issue._id),
        actionUrl: `/operational/pilot/issues/${issue._id}`,
        actionRequired: true,
        priority: issue.deadlineAt! < now ? "urgent" : "high",
        dueAt: issue.deadlineAt,
        deduplicationKey: pilotIssueReminderKey({
          issueId: String(issue._id),
          version: issue.version,
          deadlineAt: issue.deadlineAt!,
        }),
      }));
    }
    return ids;
  },
});
