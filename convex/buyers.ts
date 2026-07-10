import { canCreateBuyerOrder, canUpdateUsers } from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { resolveActor } from "./auth";
import { insertNotificationRecord } from "./notifications";
import {
  adminAccessHasPermissionForScope,
  adminScopeTarget,
  auditSnapshot,
  getEffectiveAdminAccess,
  insertAuditLog,
  omitUndefinedValues,
  requireAdminPermission,
  type Actor,
} from "./workflowHelpers";

const buyerType = v.union(
  v.literal("market_trader"),
  v.literal("retailer"),
  v.literal("restaurant"),
  v.literal("hotel"),
  v.literal("school"),
  v.literal("processor"),
  v.literal("exporter"),
  v.literal("institution"),
  v.literal("other"),
);
const verificationStatus = v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"));
const enhancedVerificationStatus = v.union(
  v.literal("not_required"),
  v.literal("required"),
  v.literal("pending_review"),
  v.literal("verified"),
  v.literal("changes_requested"),
  v.literal("rejected"),
);
const buyerStatus = v.union(v.literal("active"), v.literal("suspended"), v.literal("deactivated"));

function cleanRequiredText(value: string | undefined, label: string): string {
  const cleaned = value?.trim();
  if (!cleaned) {
    throw new Error(`${label} is required.`);
  }
  return cleaned;
}

function cleanEmail(value: string | undefined, required: boolean): string | undefined {
  const cleaned = value?.trim().toLowerCase();
  if (!cleaned) {
    if (required) throw new Error("Official email is required.");
    return undefined;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleaned)) {
    throw new Error("Enter a valid official email address.");
  }
  return cleaned;
}

async function auditBuyerChange(
  ctx: MutationCtx,
  actor: Actor,
  action: string,
  buyerId: Id<"buyers">,
  before: Doc<"buyers"> | null,
  after: Doc<"buyers">,
): Promise<void> {
  await insertAuditLog(ctx, {
    actor,
    action,
    entityType: "buyer",
    entityId: buyerId,
    before: before === null ? undefined : auditSnapshot(before),
    after: auditSnapshot(after),
  });
}

export const createOrUpdateProfile = mutation({
  args: {
    actorUserId: v.id("users"),
    userId: v.optional(v.id("users")),
    fullName: v.string(),
    displayName: v.optional(v.string()),
    phoneNumber: v.string(),
    buyerType,
    organizationName: v.optional(v.string()),
    email: v.optional(v.string()),
    organizationRegistrationNumber: v.optional(v.string()),
    contactRole: v.optional(v.string()),
    registeredAddress: v.optional(v.string()),
    destinationMarket: v.optional(v.string()),
    verificationStatus: v.optional(verificationStatus),
    status: v.optional(buyerStatus),
  },
  returns: v.id("buyers"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);
    const isInstitution = args.buyerType === "institution";
    const email = cleanEmail(args.email, isInstitution);
    const organizationName = isInstitution
      ? cleanRequiredText(args.organizationName, "Organization name")
      : args.organizationName?.trim();
    const organizationRegistrationNumber = isInstitution
      ? cleanRequiredText(args.organizationRegistrationNumber, "Organization registration number")
      : args.organizationRegistrationNumber?.trim();
    const contactRole = isInstitution
      ? cleanRequiredText(args.contactRole, "Contact role")
      : args.contactRole?.trim();
    const registeredAddress = isInstitution
      ? cleanRequiredText(args.registeredAddress, "Registered address")
      : args.registeredAddress?.trim();

    if (!canCreateBuyerOrder(actor.role) && actor.role !== "admin") {
      throw new Error("Actor is not allowed to manage buyer profiles.");
    }

    if (actor.role !== "admin" && args.userId !== undefined && actor._id !== args.userId) {
      throw new Error("Buyers can only manage their own buyer profile.");
    }
    if (actor.role === "admin") {
      await requireAdminPermission(ctx, args.actorUserId, "buyers:manage", adminScopeTarget({
        destinationMarket: args.destinationMarket,
      }));
    }

    const userId = args.userId ?? (actor.role === "buyer" ? actor._id : undefined);
    if (userId !== undefined) {
      const user = await ctx.db.get(userId);
      if (user === null) {
        throw new Error("Buyer user was not found.");
      }
      if (user.role !== "buyer" && actor.role !== "admin") {
        throw new Error("Buyer profiles must be linked to a buyer user.");
      }
    }

    const now = Date.now();
    const existing =
      userId === undefined
        ? await ctx.db
            .query("buyers")
            .withIndex("by_phone_number", (q) => q.eq("phoneNumber", args.phoneNumber))
            .unique()
        : await ctx.db
            .query("buyers")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .unique();

    if (existing !== null) {
      await ctx.db.patch(existing._id, omitUndefinedValues({
        userId,
        fullName: args.fullName.trim(),
        displayName: args.displayName?.trim(),
        phoneNumber: args.phoneNumber.trim(),
        buyerType: args.buyerType,
        organizationName,
        email,
        organizationRegistrationNumber,
        contactRole,
        registeredAddress,
        destinationMarket: args.destinationMarket?.trim(),
        enhancedVerificationStatus:
          isInstitution && (existing.enhancedVerificationStatus === undefined || existing.enhancedVerificationStatus === "not_required")
            ? "required"
            : existing.enhancedVerificationStatus,
        verificationStatus: args.verificationStatus ?? existing.verificationStatus,
        status: args.status ?? existing.status,
        updatedAt: now,
      }));

      const after = await ctx.db.get(existing._id);
      if (after === null) {
        throw new Error("Updated buyer profile could not be loaded.");
      }

      await auditBuyerChange(ctx, actor, "buyer.profile_updated", existing._id, existing, after);
      return existing._id;
    }

    const buyerId = await ctx.db.insert("buyers", omitUndefinedValues({
      userId,
      fullName: args.fullName.trim(),
      displayName: args.displayName?.trim(),
      phoneNumber: args.phoneNumber.trim(),
      buyerType: args.buyerType,
      organizationName,
      email,
      organizationRegistrationNumber,
      contactRole,
      registeredAddress,
      destinationMarket: args.destinationMarket?.trim(),
      verificationStatus: args.verificationStatus ?? "pending",
      enhancedVerificationStatus: isInstitution ? "required" : "not_required",
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
    }));

    const after = await ctx.db.get(buyerId);
    if (after === null) {
      throw new Error("Created buyer profile could not be loaded.");
    }

    await auditBuyerChange(ctx, actor, "buyer.profile_created", buyerId, null, after);
    await insertNotificationRecord(ctx, {
      recipientId: after.phoneNumber,
      recipientUserId: after.userId,
      recipientRole: "buyer",
      channel: "sms",
      title: "Welcome to Kuapa Dwaso",
      message: after.verificationStatus === "verified"
        ? "Welcome to Kuapa Dwaso. Your buyer account is ready. You can place orders."
        : "Welcome to Kuapa Dwaso. We have received your details. We will send you a message when your account is ready.",
      messageKind: "transactional",
      templateKey: "generic_notification",
      relatedEntityType: "buyer",
      relatedEntityId: buyerId,
    });
    return buyerId;
  },
});

export const updateVerificationStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerId: v.id("buyers"),
    verificationStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("buyers"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);
    if (!canUpdateUsers(actor.role)) {
      throw new Error("Only admins can update buyer verification status.");
    }

    const buyer = await ctx.db.get(args.buyerId);
    if (buyer === null) {
      throw new Error("Buyer profile was not found.");
    }
    await requireAdminPermission(ctx, args.actorUserId, "buyers:manage", adminScopeTarget({
      destinationMarket: buyer.destinationMarket,
    }));

    const reason = args.reason?.trim();
    if (args.verificationStatus === "rejected" && !reason) {
      throw new Error("A rejection reason is required.");
    }

    await ctx.db.patch(args.buyerId, {
      verificationStatus: args.verificationStatus,
      updatedAt: Date.now(),
    });

    const after = await ctx.db.get(args.buyerId);
    if (after === null) {
      throw new Error("Updated buyer profile could not be loaded.");
    }

    await insertAuditLog(ctx, {
      actor,
      action: "buyer.verification_status_updated",
      entityType: "buyer",
      entityId: args.buyerId,
      before: auditSnapshot(buyer),
      after: auditSnapshot(after),
      metadata: reason === undefined ? undefined : { reason },
    });

    if (buyer.verificationStatus !== args.verificationStatus) {
      const title =
        args.verificationStatus === "verified"
          ? "Buyer profile approved"
          : args.verificationStatus === "rejected"
            ? "Buyer profile needs changes"
            : "Buyer profile under review";
      const message =
        args.verificationStatus === "verified"
          ? "Your buyer account is ready. You can place orders."
          : args.verificationStatus === "rejected"
            ? `We could not confirm your buyer account. Reason: ${reason}. Please update your details.`
            : "We are checking your buyer account. We will send you an update.";

      await insertNotificationRecord(ctx, {
        recipientId: buyer.phoneNumber,
        recipientUserId: buyer.userId,
        recipientRole: "buyer",
        channel: "sms",
        title,
        message,
        messageKind: "transactional",
        templateKey: "generic_notification",
        relatedEntityType: "buyer",
        relatedEntityId: args.buyerId,
      });
    }

    return args.buyerId;
  },
});

export const submitEnhancedVerification = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerId: v.id("buyers"),
  },
  returns: v.id("buyers"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);
    const buyer = await ctx.db.get(args.buyerId);
    if (buyer === null) throw new Error("Buyer profile was not found.");
    if (actor.role === "buyer") {
      if (buyer.userId !== actor._id) throw new Error("Buyers can only submit their own verification.");
    } else {
      if (actor.role !== "admin") throw new Error("Actor cannot submit buyer verification.");
      await requireAdminPermission(ctx, actor._id, "buyers:manage", adminScopeTarget({ destinationMarket: buyer.destinationMarket }));
    }

    cleanEmail(buyer.email, true);
    cleanRequiredText(buyer.organizationName, "Organization name");
    cleanRequiredText(buyer.organizationRegistrationNumber, "Organization registration number");
    cleanRequiredText(buyer.contactRole, "Contact role");
    cleanRequiredText(buyer.registeredAddress, "Registered address");

    const evidence = await ctx.db
      .query("uploadAssets")
      .withIndex("by_owner_purpose_status", (q) =>
        q.eq("ownerUserId", buyer.userId ?? actor._id).eq("purpose", "profile_evidence"),
      )
      .collect();
    if (!evidence.some((asset) => asset.relatedEntityType === "buyer" && asset.relatedEntityId === args.buyerId && ["attached", "verified"].includes(asset.status))) {
      throw new Error("Upload at least one organization registration document before submitting.");
    }

    const now = Date.now();
    await ctx.db.patch(args.buyerId, {
      enhancedVerificationStatus: "pending_review",
      enhancedVerificationSubmittedAt: now,
      enhancedVerificationReason: undefined,
      updatedAt: now,
    });
    const after = await ctx.db.get(args.buyerId);
    await insertAuditLog(ctx, {
      actor,
      action: "buyer.enhanced_verification_submitted",
      entityType: "buyer",
      entityId: args.buyerId,
      before: auditSnapshot(buyer),
      after: after === null ? undefined : auditSnapshot(after),
    });
    return args.buyerId;
  },
});

export const updateEnhancedVerificationStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerId: v.id("buyers"),
    status: enhancedVerificationStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("buyers"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);
    if (!canUpdateUsers(actor.role)) throw new Error("Only admins can review enhanced verification.");
    const buyer = await ctx.db.get(args.buyerId);
    if (buyer === null) throw new Error("Buyer profile was not found.");
    await requireAdminPermission(ctx, actor._id, "buyers:manage", adminScopeTarget({ destinationMarket: buyer.destinationMarket }));
    const reason = args.reason?.trim();
    if (["changes_requested", "rejected"].includes(args.status) && !reason) {
      throw new Error("An actionable review reason is required.");
    }
    if (args.status === "verified") {
      const evidence = await ctx.db
        .query("uploadAssets")
        .withIndex("by_related_entity", (q) =>
          q.eq("relatedEntityType", "buyer").eq("relatedEntityId", args.buyerId),
        )
        .collect();
      if (!evidence.some((asset) => asset.purpose === "profile_evidence" && asset.status === "verified")) {
        throw new Error("Verify at least one organization evidence file before approving enhanced verification.");
      }
    }

    const now = Date.now();
    await ctx.db.patch(args.buyerId, {
      enhancedVerificationStatus: args.status,
      enhancedVerificationReviewedAt: now,
      enhancedVerificationReviewedByUserId: actor._id,
      enhancedVerificationReason: reason,
      ...(args.status === "verified" ? { verificationStatus: "verified" as const } : {}),
      updatedAt: now,
    });
    const after = await ctx.db.get(args.buyerId);
    await insertAuditLog(ctx, {
      actor,
      action: "buyer.enhanced_verification_status_updated",
      entityType: "buyer",
      entityId: args.buyerId,
      before: auditSnapshot(buyer),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: reason === undefined ? { status: args.status } : { status: args.status, reason },
    });

    const title = "Account update";
    const message = args.status === "verified"
      ? "Your buyer account is ready. You can place orders and pay for deliveries."
      : args.status === "changes_requested"
        ? `Please update your buyer details.${reason ? ` Reason: ${reason}` : ""}`
        : args.status === "rejected"
          ? `We could not confirm your buyer account.${reason ? ` Reason: ${reason}` : ""}`
          : "We are checking your buyer account. We will send you an update.";
    await insertNotificationRecord(ctx, {
      recipientId: buyer.phoneNumber,
      recipientUserId: buyer.userId,
      recipientRole: "buyer",
      channel: "sms",
      title,
      message,
      messageKind: "transactional",
      templateKey: "generic_notification",
      relatedEntityType: "buyer",
      relatedEntityId: args.buyerId,
    });
    return args.buyerId;
  },
});

export const getInstitutionWelcomeEmailContext = query({
  args: { actorUserId: v.id("users"), buyerId: v.id("buyers") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);
    const buyer = await ctx.db.get(args.buyerId);
    if (buyer === null) return null;
    if (actor.role === "buyer") {
      if (buyer.userId !== actor._id) throw new Error("Buyers can only access their own welcome email.");
    } else {
      if (actor.role !== "admin") throw new Error("Actor cannot access this buyer.");
      await requireAdminPermission(ctx, actor._id, "buyers:manage", adminScopeTarget({ destinationMarket: buyer.destinationMarket }));
    }
    if (buyer.buyerType !== "institution" || buyer.email === undefined) return null;
    return buyer;
  },
});

export const recordInstitutionWelcomeEmail = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerId: v.id("buyers"),
    provider: v.string(),
    messageId: v.optional(v.string()),
  },
  returns: v.id("buyers"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);
    const buyer = await ctx.db.get(args.buyerId);
    if (buyer === null || buyer.buyerType !== "institution" || buyer.email === undefined) throw new Error("Institution buyer was not found.");
    if (actor.role === "buyer" && buyer.userId !== actor._id) throw new Error("Buyers can only record their own welcome email.");
    const now = Date.now();
    await ctx.db.patch(args.buyerId, { institutionWelcomeEmailSentAt: now, updatedAt: now });
    const notificationId = await insertNotificationRecord(ctx, {
      recipientId: buyer.email,
      recipientUserId: buyer.userId,
      recipientRole: "buyer",
      channel: "email",
      title: "Welcome to Kuapa Dwaso institutional sourcing",
      message: "Your institutional buyer account has been created.",
      relatedEntityType: "buyer",
      relatedEntityId: args.buyerId,
    });
    await ctx.db.patch(notificationId, { status: "sent", sentAt: now, updatedAt: now });
    await insertAuditLog(ctx, {
      actor,
      action: "buyer.institution_welcome_email_sent",
      entityType: "buyer",
      entityId: args.buyerId,
      before: auditSnapshot(buyer),
      after: auditSnapshot((await ctx.db.get(args.buyerId))!),
      metadata: { provider: args.provider, messageId: args.messageId },
    });
    return args.buyerId;
  },
});

export const updateStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    buyerId: v.id("buyers"),
    status: buyerStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("buyers"),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.actorUserId);
    if (!canUpdateUsers(actor.role)) {
      throw new Error("Only admins can update buyer status.");
    }

    const buyer = await ctx.db.get(args.buyerId);
    if (buyer === null) {
      throw new Error("Buyer profile was not found.");
    }
    await requireAdminPermission(ctx, args.actorUserId, "buyers:manage", adminScopeTarget({
      destinationMarket: buyer.destinationMarket,
    }));

    await ctx.db.patch(args.buyerId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    const after = await ctx.db.get(args.buyerId);
    if (after === null) {
      throw new Error("Updated buyer profile could not be loaded.");
    }

    await insertAuditLog(ctx, {
      actor,
      action: "buyer.status_updated",
      entityType: "buyer",
      entityId: args.buyerId,
      before: auditSnapshot(buyer),
      after: auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.buyerId;
  },
});

export const getByUserId = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("buyers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const getById = query({
  args: {
    actorUserId: v.optional(v.id("users")),
    buyerId: v.id("buyers"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const buyer = await ctx.db.get(args.buyerId);
    if (buyer !== null && args.actorUserId !== undefined) {
      const actor = await resolveActor(ctx, args.actorUserId);
      if (actor.role === "buyer") {
        if (buyer.userId !== actor._id) {
          throw new Error("Buyers can only read their own buyer profile.");
        }
      } else if (actor.role === "admin") {
        await requireAdminPermission(ctx, args.actorUserId, "buyers:read", adminScopeTarget({
          destinationMarket: buyer.destinationMarket,
        }));
      } else {
        throw new Error("Actor cannot read buyer profiles.");
      }
    }
    return buyer;
  },
});

export const getByPhoneNumber = query({
  args: {
    actorUserId: v.optional(v.id("users")),
    phoneNumber: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const buyer = await ctx.db
      .query("buyers")
      .withIndex("by_phone_number", (q) => q.eq("phoneNumber", args.phoneNumber.trim()))
      .unique();
    if (buyer !== null && args.actorUserId !== undefined) {
      await requireAdminPermission(ctx, args.actorUserId, "buyers:read", adminScopeTarget({
        destinationMarket: buyer.destinationMarket,
      }));
    }
    return buyer;
  },
});

export const list = query({
  args: {
    actorUserId: v.optional(v.id("users")),
    status: v.optional(buyerStatus),
    verificationStatus: v.optional(verificationStatus),
    destinationMarket: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.phoneNumber !== undefined
        ? await ctx.db
            .query("buyers")
            .withIndex("by_phone_number", (q) => q.eq("phoneNumber", args.phoneNumber!.trim()))
            .take(limit)
        : args.destinationMarket !== undefined
          ? await ctx.db
              .query("buyers")
              .withIndex("by_destination_market", (q) =>
                q.eq("destinationMarket", args.destinationMarket!.trim()),
              )
              .take(limit * 3)
          : args.verificationStatus !== undefined
            ? await ctx.db
                .query("buyers")
                .withIndex("by_verification_status", (q) =>
                  q.eq("verificationStatus", args.verificationStatus!),
                )
                .take(limit * 3)
            : args.status !== undefined
              ? await ctx.db
                  .query("buyers")
                  .withIndex("by_status", (q) => q.eq("status", args.status!))
                  .take(limit * 3)
              : await ctx.db.query("buyers").take(limit * 3);

    const filtered = candidates
      .filter((buyer) => args.status === undefined || buyer.status === args.status)
      .filter(
        (buyer) =>
          args.verificationStatus === undefined ||
          buyer.verificationStatus === args.verificationStatus,
      )
      .filter(
        (buyer) =>
          args.destinationMarket === undefined ||
          buyer.destinationMarket === args.destinationMarket.trim(),
      );
    if (args.actorUserId === undefined) {
      return filtered.slice(0, limit);
    }
    const access = await getEffectiveAdminAccess(ctx, args.actorUserId);
    return filtered
      .filter((buyer) =>
        adminAccessHasPermissionForScope(access, "buyers:read", adminScopeTarget({
          destinationMarket: buyer.destinationMarket,
        })),
      )
      .slice(0, limit);
  },
});
