import {
  assertInvitationCanBeAccepted,
  assertInviteTargetMatchesIdentity,
  normalizeEmailAddress,
  normalizePhoneNumber,
} from "@kuapa-dwaso/utils";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  adminScopeTarget,
  assertAllowed,
  auditSnapshot,
  cleanOptionalText,
  getActor,
  insertAuditLog,
  omitUndefinedValues,
  requireAdminPermission,
} from "./workflowHelpers";

const invitationType = v.union(
  v.literal("admin_invite"),
  v.literal("warehouse_manager_invite"),
  v.literal("warehouse_agent_invite"),
  v.literal("transporter_invite"),
);
const invitationChannel = v.union(v.literal("email"), v.literal("sms"));
const invitationStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("revoked"),
  v.literal("expired"),
  v.literal("cancelled"),
);
const adminRoleKey = v.union(
  v.literal("platform_owner"),
  v.literal("operations_manager"),
  v.literal("warehouse_manager"),
  v.literal("finance_manager"),
  v.literal("support_officer"),
  v.literal("auditor"),
  v.literal("analyst"),
  v.literal("admin_viewer"),
);
const adminScopeType = v.union(
  v.literal("global"),
  v.literal("region"),
  v.literal("district"),
  v.literal("warehouse"),
  v.literal("destination_market"),
);
const mfaRequirement = v.union(
  v.literal("not_required"),
  v.literal("sms_required"),
  v.literal("totp_required"),
  v.literal("required"),
);

const firebaseIdentity = v.object({
  authProviderId: v.string(),
  phoneNumber: v.optional(v.string()),
  email: v.optional(v.string()),
  displayName: v.optional(v.string()),
  phoneVerified: v.optional(v.boolean()),
  emailVerified: v.optional(v.boolean()),
  signInProvider: v.optional(v.string()),
  mfaSatisfied: v.optional(v.boolean()),
  mfaMethods: v.optional(v.array(v.string())),
});

const pendingAdminRoleAssignment = v.object({
  roleKey: adminRoleKey,
  scopeType: adminScopeType,
  scopeId: v.optional(v.string()),
  scopeValue: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
});

function intendedRoleForType(type: "admin_invite" | "warehouse_manager_invite" | "warehouse_agent_invite" | "transporter_invite") {
  if (type === "warehouse_agent_invite") {
    return "warehouse_agent" as const;
  }
  if (type === "transporter_invite") {
    return "transporter" as const;
  }
  return "admin" as const;
}

function intendedProfileTypeForType(type: "admin_invite" | "warehouse_manager_invite" | "warehouse_agent_invite" | "transporter_invite") {
  if (type === "warehouse_agent_invite") {
    return "warehouse_agent" as const;
  }
  if (type === "transporter_invite") {
    return "transporter" as const;
  }
  return "admin" as const;
}

async function upsertFirebaseUser(
  ctx: MutationCtx,
  args: {
    identity: {
      authProviderId: string;
      phoneNumber?: string;
      email?: string;
      displayName?: string;
      phoneVerified?: boolean;
      emailVerified?: boolean;
      mfaSatisfied?: boolean;
      mfaMethods?: string[];
    };
    role: "farmer" | "warehouse_agent" | "buyer" | "transporter" | "admin";
    mfaRequirement: "not_required" | "sms_required" | "totp_required" | "required";
  },
): Promise<Id<"users">> {
  const now = Date.now();
  const existing = await ctx.db
    .query("users")
    .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.identity.authProviderId))
    .unique();
  const email = args.identity.email === undefined ? undefined : normalizeEmailAddress(args.identity.email);
  const phoneNumber =
    args.identity.phoneNumber === undefined ? undefined : normalizePhoneNumber(args.identity.phoneNumber);
  const mfaStatus =
    args.mfaRequirement === "not_required"
      ? "not_required"
      : args.identity.mfaSatisfied === true
        ? "verified"
        : "pending";

  if (existing !== null) {
    await ctx.db.patch(existing._id, omitUndefinedValues({
      authProvider: "firebase",
      phoneNumber,
      email,
      name: cleanOptionalText(args.identity.displayName) ?? existing.name,
      role: args.role,
      status: mfaStatus === "pending" && args.role === "admin" ? "pending" : "active",
      authMethods: email !== undefined ? ["email_password"] : ["phone"],
      phoneVerified: args.identity.phoneVerified,
      emailVerified: args.identity.emailVerified,
      mfaRequirement: args.mfaRequirement,
      mfaStatus,
      mfaMethods: args.identity.mfaMethods,
      onboardingState: "complete",
      updatedAt: now,
    }));
    return existing._id;
  }

  return await ctx.db.insert("users", omitUndefinedValues({
    authProviderId: args.identity.authProviderId,
    authProvider: "firebase",
    phoneNumber,
    email,
    name: cleanOptionalText(args.identity.displayName) ?? email ?? phoneNumber ?? "Invited user",
    role: args.role,
    status: mfaStatus === "pending" && args.role === "admin" ? "pending" : "active",
    authMethods: email !== undefined ? ["email_password"] : ["phone"],
    phoneVerified: args.identity.phoneVerified,
    emailVerified: args.identity.emailVerified,
    mfaRequirement: args.mfaRequirement,
    mfaStatus,
    mfaMethods: args.identity.mfaMethods,
    onboardingState: "complete",
    createdAt: now,
    updatedAt: now,
  }));
}

export const create = mutation({
  args: {
    actorUserId: v.id("users"),
    type: invitationType,
    channel: invitationChannel,
    tokenHash: v.string(),
    targetEmail: v.optional(v.string()),
    targetPhoneNumber: v.optional(v.string()),
    linkedProfileId: v.optional(v.string()),
    pendingAdminRoleAssignment: v.optional(pendingAdminRoleAssignment),
    expiresAt: v.number(),
    mfaRequirement: v.optional(mfaRequirement),
    messageId: v.optional(v.string()),
  },
  returns: v.id("platformInvitations"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin", "Only admins can create platform invitations.");
    assertAllowed(args.expiresAt > Date.now(), "Invitation expiry must be in the future.");
    assertAllowed(args.tokenHash.length >= 32, "Invitation token hash is required.");

    const targetEmail =
      args.targetEmail === undefined ? undefined : normalizeEmailAddress(args.targetEmail);
    const targetPhoneNumber =
      args.targetPhoneNumber === undefined ? undefined : normalizePhoneNumber(args.targetPhoneNumber);
    assertAllowed(
      args.channel === "email" ? targetEmail !== undefined : targetPhoneNumber !== undefined,
      "Invitation target must match its delivery channel.",
    );

    await requireAdminPermission(ctx, args.actorUserId, "invitations:manage", adminScopeTarget({
      warehouseId:
        args.pendingAdminRoleAssignment?.scopeType === "warehouse"
          ? args.pendingAdminRoleAssignment.scopeId
          : undefined,
      region:
        args.pendingAdminRoleAssignment?.scopeType === "region"
          ? args.pendingAdminRoleAssignment.scopeValue ?? args.pendingAdminRoleAssignment.scopeId
          : undefined,
      district:
        args.pendingAdminRoleAssignment?.scopeType === "district"
          ? args.pendingAdminRoleAssignment.scopeValue ?? args.pendingAdminRoleAssignment.scopeId
          : undefined,
      destinationMarket:
        args.pendingAdminRoleAssignment?.scopeType === "destination_market"
          ? args.pendingAdminRoleAssignment.scopeValue ?? args.pendingAdminRoleAssignment.scopeId
          : undefined,
    }));

    const now = Date.now();
    const pendingAssignment =
      args.pendingAdminRoleAssignment === undefined
        ? undefined
        : omitUndefinedValues(args.pendingAdminRoleAssignment);
    const invitationId = await ctx.db.insert("platformInvitations", omitUndefinedValues({
      type: args.type,
      channel: args.channel,
      status: "pending",
      tokenHash: args.tokenHash,
      targetEmail,
      targetPhoneNumber,
      intendedRole: intendedRoleForType(args.type),
      intendedProfileType: intendedProfileTypeForType(args.type),
      linkedProfileId: cleanOptionalText(args.linkedProfileId),
      pendingAdminRoleAssignment: pendingAssignment,
      mfaRequirement:
        args.mfaRequirement ??
        (args.type === "warehouse_agent_invite" || args.type === "transporter_invite"
          ? "not_required"
          : "sms_required"),
      invitedByUserId: args.actorUserId,
      expiresAt: args.expiresAt,
      messageId: cleanOptionalText(args.messageId),
      createdAt: now,
      updatedAt: now,
    }));

    const after = await ctx.db.get(invitationId);
    await insertAuditLog(ctx, {
      actor,
      action: "platform_invitation.created",
      entityType: "platform_invitation",
      entityId: invitationId,
      after: after === null ? undefined : auditSnapshot(after),
    });
    return invitationId;
  },
});

export const accept = mutation({
  args: {
    tokenHash: v.string(),
    identity: firebaseIdentity,
  },
  returns: v.object({
    invitationId: v.string(),
    userId: v.string(),
    profileType: v.string(),
    profileId: v.optional(v.string()),
    status: v.literal("accepted"),
    mfaRequired: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("platformInvitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    assertAllowed(invitation !== null, "Invitation was not found.");
    assertInvitationCanBeAccepted({
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    });

    assertInviteTargetMatchesIdentity(omitUndefinedValues({
      targetEmail: invitation.targetEmail,
      targetPhoneNumber: invitation.targetPhoneNumber,
      identityEmail: args.identity.email,
      identityPhoneNumber: args.identity.phoneNumber,
    }));
    if (invitation.targetEmail !== undefined) {
      assertAllowed(args.identity.emailVerified === true, "Invitation email must be verified.");
    }
    if (invitation.targetPhoneNumber !== undefined) {
      assertAllowed(args.identity.phoneVerified === true, "Invitation phone number must be verified.");
    }
    const mfaRequired = invitation.mfaRequirement !== "not_required";
    assertAllowed(!mfaRequired || args.identity.mfaSatisfied === true, "Required MFA has not been satisfied.");

    const userId = await upsertFirebaseUser(ctx, {
      identity: args.identity,
      role: invitation.intendedRole,
      mfaRequirement: invitation.mfaRequirement,
    });
    const now = Date.now();

    let profileId = invitation.linkedProfileId;
    if (invitation.type === "warehouse_agent_invite" && invitation.linkedProfileId !== undefined) {
      const warehouseAgentId = invitation.linkedProfileId as Id<"warehouseAgents">;
      const warehouseAgent = await ctx.db.get(warehouseAgentId);
      assertAllowed(warehouseAgent !== null, "Linked warehouse agent profile was not found.");
      assertAllowed(
        normalizePhoneNumber(warehouseAgent.phoneNumber) === normalizePhoneNumber(args.identity.phoneNumber ?? ""),
        "Warehouse agent invite phone does not match the linked profile.",
      );
      await ctx.db.patch(warehouseAgentId, {
        userId,
        updatedAt: now,
      });
    }

    if (invitation.pendingAdminRoleAssignment !== undefined) {
      await ctx.db.insert("adminRoleAssignments", omitUndefinedValues({
        adminUserId: userId,
        roleKey: invitation.pendingAdminRoleAssignment.roleKey,
        scopeType: invitation.pendingAdminRoleAssignment.scopeType,
        scopeId: invitation.pendingAdminRoleAssignment.scopeId,
        scopeValue: invitation.pendingAdminRoleAssignment.scopeValue,
        status: "active",
        assignedBy: invitation.invitedByUserId,
        assignedAt: now,
        expiresAt: invitation.pendingAdminRoleAssignment.expiresAt,
        createdAt: now,
        updatedAt: now,
      }));
    }

    if (profileId !== undefined) {
      await ctx.db.insert("profileLinks", {
        userId,
        profileType: invitation.intendedProfileType,
        profileId,
        status: "linked",
        source: "invite_acceptance",
        linkedByUserId: invitation.invitedByUserId,
        invitationId: invitation._id,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(invitation._id, {
      status: "accepted",
      acceptedByUserId: userId,
      acceptedAt: now,
      updatedAt: now,
    });
    const actor = await getActor(ctx, userId);
    const after = await ctx.db.get(invitation._id);
    await insertAuditLog(ctx, {
      actor,
      action: "platform_invitation.accepted",
      entityType: "platform_invitation",
      entityId: invitation._id,
      before: auditSnapshot(invitation),
      after: after === null ? undefined : auditSnapshot(after),
    });

    const result: {
      invitationId: string;
      userId: string;
      profileType: string;
      profileId?: string;
      status: "accepted";
      mfaRequired: boolean;
    } = {
      invitationId: invitation._id,
      userId,
      profileType: invitation.intendedProfileType,
      status: "accepted",
      mfaRequired,
    };
    if (profileId !== undefined) {
      result.profileId = profileId;
    }
    return result;
  },
});

export const revoke = mutation({
  args: {
    actorUserId: v.id("users"),
    invitationId: v.id("platformInvitations"),
    reason: v.optional(v.string()),
  },
  returns: v.id("platformInvitations"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const invitation = await ctx.db.get(args.invitationId);
    assertAllowed(invitation !== null, "Invitation was not found.");
    await requireAdminPermission(ctx, args.actorUserId, "invitations:manage", {});
    assertAllowed(invitation.status === "pending", "Only pending invitations can be revoked.");
    const now = Date.now();
    await ctx.db.patch(args.invitationId, {
      status: "revoked",
      revokedAt: now,
      revokedByUserId: args.actorUserId,
      updatedAt: now,
    });
    const after = await ctx.db.get(args.invitationId);
    await insertAuditLog(ctx, {
      actor,
      action: "platform_invitation.revoked",
      entityType: "platform_invitation",
      entityId: args.invitationId,
      before: auditSnapshot(invitation),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });
    return args.invitationId;
  },
});

export const expirePending = mutation({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const invitations = await ctx.db
      .query("platformInvitations")
      .withIndex("by_status_expires_at", (q) => q.eq("status", "pending").lte("expiresAt", now))
      .take(Math.min(args.limit ?? 50, 100));
    for (const invitation of invitations) {
      await ctx.db.patch(invitation._id, {
        status: "expired",
        updatedAt: now,
      });
    }
    return invitations.length;
  },
});

export const list = query({
  args: {
    actorUserId: v.id("users"),
    status: v.optional(invitationStatus),
    type: v.optional(invitationType),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, args.actorUserId, "invitations:read", {});
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.type === undefined
        ? await ctx.db.query("platformInvitations").take(limit * 3)
        : await ctx.db
            .query("platformInvitations")
            .withIndex("by_type_status", (q) =>
              args.status === undefined
                ? q.eq("type", args.type!)
                : q.eq("type", args.type!).eq("status", args.status!),
            )
            .take(limit * 3);
    return candidates
      .filter((invitation) => args.status === undefined || invitation.status === args.status)
      .slice(0, limit);
  },
});
