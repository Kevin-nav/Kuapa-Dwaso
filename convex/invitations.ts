import {
  assertInviteIdentityVerification,
  assertInvitationCanBeAccepted,
  assertInvitationDeliveryAllowed,
  assertInviteTargetMatchesIdentity,
  normalizeEmailAddress,
  normalizePhoneNumber,
  phoneNumbersMatch,
} from "@kuapa-dwaso/utils";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { insertNotificationRecord } from "./notifications";
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
const invitationChannel = v.union(v.literal("email"), v.literal("manual_link"));
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

function authMethodsForIdentity(identity: {
  email?: string | undefined;
  signInProvider?: string | undefined;
}): ("phone" | "email_password" | "google")[] {
  if (identity.signInProvider === "google.com") {
    return ["google"];
  }
  return identity.email !== undefined ? ["email_password"] : ["phone"];
}

function mfaMethodsSatisfyRequirement(
  requirement: "not_required" | "sms_required" | "totp_required" | "required",
  methods: string[] | undefined,
): boolean {
  if (requirement === "not_required") {
    return true;
  }
  if (methods === undefined || methods.length === 0) {
    return false;
  }
  if (requirement === "sms_required") {
    return methods.includes("phone");
  }
  if (requirement === "totp_required") {
    return methods.includes("totp");
  }
  return true;
}

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
      signInProvider?: string;
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

  const existingByPhone =
    phoneNumber === undefined
      ? null
      : await ctx.db.query("users").withIndex("by_phone_number", (q) => q.eq("phoneNumber", phoneNumber)).first();
  const existingByEmail =
    email === undefined
      ? null
      : await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).first();
  const identityOwner = existingByPhone ?? existingByEmail;
  assertAllowed(
    existing === null || identityOwner === null || existing._id === identityOwner._id,
    "This verified identity is already linked to another account. Sign in to that account or contact support.",
  );
  const linkedExisting = existing ?? identityOwner;

  if (linkedExisting !== null) {
    await ctx.db.patch(linkedExisting._id, omitUndefinedValues({
      authProviderId: args.identity.authProviderId,
      authProvider: "firebase",
      phoneNumber,
      email,
      name: cleanOptionalText(args.identity.displayName) ?? linkedExisting.name,
      role: args.role,
      status: mfaStatus === "pending" && args.role === "admin" ? "pending" : "active",
      authMethods: authMethodsForIdentity({
        email,
        signInProvider: args.identity.signInProvider,
      }),
      phoneVerified: args.identity.phoneVerified,
      emailVerified: args.identity.emailVerified,
      mfaRequirement: args.mfaRequirement,
      mfaStatus,
      mfaMethods: args.identity.mfaMethods,
      onboardingState: "complete",
      updatedAt: now,
    }));
    return linkedExisting._id;
  }

  return await ctx.db.insert("users", omitUndefinedValues({
    authProviderId: args.identity.authProviderId,
    authProvider: "firebase",
    phoneNumber,
    email,
    name: cleanOptionalText(args.identity.displayName) ?? email ?? phoneNumber ?? "Invited user",
    role: args.role,
    status: mfaStatus === "pending" && args.role === "admin" ? "pending" : "active",
    authMethods: authMethodsForIdentity({
      email,
      signInProvider: args.identity.signInProvider,
    }),
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
    assertInvitationDeliveryAllowed(args.type, args.channel);
    const phonePrimary = args.type === "warehouse_agent_invite" || args.type === "transporter_invite";
    assertAllowed(args.channel !== "email" || targetEmail !== undefined, "Email invitation requires a target email address.");
    assertAllowed(!phonePrimary || targetPhoneNumber !== undefined, "Warehouse-agent and transporter invitations require the phone number that will be verified at acceptance.");
    assertAllowed(args.channel !== "manual_link" || targetPhoneNumber !== undefined, "Manual-link invitations require a target phone number.");
    if (args.type === "warehouse_manager_invite") {
      assertAllowed(
        args.pendingAdminRoleAssignment?.roleKey === "warehouse_manager" &&
          args.pendingAdminRoleAssignment.scopeType === "warehouse" &&
          args.pendingAdminRoleAssignment.scopeId !== undefined,
        "Warehouse-manager invitations require a warehouse-scoped warehouse_manager assignment.",
      );
    }
    if (args.type === "admin_invite") {
      assertAllowed(args.pendingAdminRoleAssignment !== undefined, "Admin invitations require an initial role assignment.");
      assertAllowed(args.pendingAdminRoleAssignment.roleKey !== "warehouse_manager", "Use a warehouse-manager invitation for that role.");
    }
    if (args.type === "admin_invite" || args.type === "warehouse_manager_invite") {
      assertAllowed(
        args.mfaRequirement === undefined || args.mfaRequirement === "totp_required" || args.mfaRequirement === "required",
        "Privileged invitations require MFA.",
      );
    }

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
          : "totp_required"),
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
    await insertNotificationRecord(ctx, {
      recipientUserId: args.actorUserId,
      recipientRole: "admin",
      channel: "in_app",
      title: "Invitation created",
      message: `${args.type.replaceAll("_", " ")} is ready for ${args.channel === "email" ? "email delivery" : "secure in-person sharing"}.`,
      relatedEntityType: "platform_invitation",
      relatedEntityId: invitationId,
      actionUrl: "/access",
      priority: "normal",
      deduplicationKey: `invitation-created:${invitationId}`,
      expiresAt: args.expiresAt,
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

    if (invitation.type === "admin_invite" || invitation.type === "warehouse_manager_invite") {
      assertInviteTargetMatchesIdentity(omitUndefinedValues({
        targetEmail: invitation.targetEmail,
        identityEmail: args.identity.email,
      }));
      assertAllowed(invitation.targetEmail !== undefined, "Privileged invitations must target an email address.");
      assertAllowed(args.identity.email !== undefined, "Privileged invite acceptance requires a Firebase email identity.");
      assertAllowed(
        args.identity.signInProvider === undefined ||
          args.identity.signInProvider === "password" ||
          args.identity.signInProvider === "google.com",
        "Privileged invite acceptance requires Firebase email/password or Google sign-in.",
      );
    }
    // Phone-primary invite types (warehouse_agent_invite, transporter_invite) use phone auth
    // even when the invite was delivered via email. Skip email verification when a verified
    // phone identity is present for these types.
    const isPhonePrimaryInvite =
      invitation.type === "warehouse_agent_invite" || invitation.type === "transporter_invite";
    if (isPhonePrimaryInvite) {
      assertInviteTargetMatchesIdentity(omitUndefinedValues({
        targetPhoneNumber: invitation.targetPhoneNumber,
        identityPhoneNumber: args.identity.phoneNumber,
      }));
    }
    assertInviteIdentityVerification(omitUndefinedValues({
      invitationType: invitation.type,
      targetEmail: invitation.targetEmail,
      targetPhoneNumber: invitation.targetPhoneNumber,
      identityPhoneNumber: args.identity.phoneNumber,
      emailVerified: args.identity.emailVerified,
      phoneVerified: args.identity.phoneVerified,
    }));
    const mfaRequired = invitation.mfaRequirement !== "not_required";
    assertAllowed(!mfaRequired || args.identity.mfaSatisfied === true, "Required MFA has not been satisfied.");
    assertAllowed(
      mfaMethodsSatisfyRequirement(invitation.mfaRequirement, args.identity.mfaMethods),
      invitation.mfaRequirement === "totp_required"
        ? "Authenticator-app MFA has not been satisfied."
        : invitation.mfaRequirement === "sms_required"
          ? "SMS MFA has not been satisfied."
          : "Required MFA method evidence is missing.",
    );

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
        phoneNumbersMatch(warehouseAgent.phoneNumber, args.identity.phoneNumber ?? ""),
        "Warehouse agent invite phone does not match the linked profile.",
      );
      await ctx.db.patch(warehouseAgentId, {
        userId,
        updatedAt: now,
      });
    } else if (invitation.type === "transporter_invite" && invitation.linkedProfileId !== undefined) {
      const transporterId = invitation.linkedProfileId as Id<"transporterProfiles">;
      const transporter = await ctx.db.get(transporterId);
      assertAllowed(transporter !== null, "Linked transporter profile was not found.");
      assertAllowed(
        phoneNumbersMatch(transporter.phoneNumber, args.identity.phoneNumber ?? ""),
        "Transporter invite phone does not match the linked profile.",
      );
      await ctx.db.patch(transporterId, { userId, updatedAt: now });
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
      const existingProfileLink = await ctx.db
        .query("profileLinks")
        .withIndex("by_profile", (q) => q.eq("profileType", invitation.intendedProfileType).eq("profileId", profileId!))
        .first();
      if (existingProfileLink === null) {
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
      } else {
        assertAllowed(existingProfileLink.userId === userId, "This profile is already linked to another user.");
      }
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
    await insertNotificationRecord(ctx, {
      recipientUserId: userId,
      recipientRole: invitation.intendedRole,
      channel: "in_app",
      title: "Invitation accepted",
      message: "Your verified identity is linked. Continue to your assigned workspace.",
      relatedEntityType: "platform_invitation",
      relatedEntityId: invitation._id,
      actionUrl: "/",
      priority: "normal",
      deduplicationKey: `invitation-accepted:${invitation._id}:${userId}`,
    });
    await insertNotificationRecord(ctx, {
      recipientUserId: invitation.invitedByUserId,
      recipientRole: "admin",
      channel: "in_app",
      title: "Invitation accepted",
      message: "The invited person verified their identity and joined the assigned workspace.",
      relatedEntityType: "platform_invitation",
      relatedEntityId: invitation._id,
      actionUrl: "/access",
      priority: "normal",
      deduplicationKey: `invitation-accepted-admin:${invitation._id}`,
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

export const getPendingByTokenHash = query({
  args: {
    tokenHash: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      type: invitationType,
      channel: invitationChannel,
      targetEmail: v.optional(v.string()),
      targetPhoneNumber: v.optional(v.string()),
      status: invitationStatus,
      expiresAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("platformInvitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (invitation === null || invitation.status !== "pending") {
      return null;
    }
    return omitUndefinedValues({
      type: invitation.type,
      channel: invitation.channel,
      targetEmail: invitation.targetEmail,
      targetPhoneNumber: invitation.targetPhoneNumber,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    }) as any;
  },
});
