import { normalizeEmailAddress, normalizePhoneNumber } from "@kuapa-dwaso/utils";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { insertNotificationRecord } from "./notifications";
import {
  assertAllowed,
  auditSnapshot,
  cleanOptionalText,
  getActor,
  insertAuditLog,
  normalizeCodeSegment,
  omitUndefinedValues,
  type Actor,
} from "./workflowHelpers";

export async function resolveActor(ctx: QueryCtx | MutationCtx, actorUserId: Id<"users">): Promise<Actor> {
  return await getActor(ctx, actorUserId);
}

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

const mfaRequirement = v.union(
  v.literal("not_required"),
  v.literal("sms_required"),
  v.literal("totp_required"),
  v.literal("required"),
);

function authMethodsForIdentity(identity: {
  email?: string | undefined;
  signInProvider?: string | undefined;
}): ("phone" | "email_password" | "google")[] {
  if (identity.signInProvider === "google.com") {
    return ["google"];
  }
  return identity.email !== undefined ? ["email_password"] : ["phone"];
}

function identityName(identity: {
  displayName?: string | undefined;
  email?: string | undefined;
  phoneNumber?: string | undefined;
}): string {
  return cleanOptionalText(identity.displayName) ?? identity.email ?? identity.phoneNumber ?? "Platform user";
}

function makeFarmerCode(community: string, phoneNumber: string, timestamp: number, attempt: number): string {
  const communitySegment = normalizeCodeSegment(community, 3).padEnd(3, "X");
  const phoneTail = phoneNumber.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const timeTail = String(timestamp).slice(-4);
  const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
  return `FM-${communitySegment}-${phoneTail}-${timeTail}${suffix}`;
}

async function makeUniqueFarmerCode(
  ctx: QueryCtx | MutationCtx,
  community: string,
  phoneNumber: string,
  timestamp: number,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const farmerCode = makeFarmerCode(community, phoneNumber, timestamp, attempt);
    const existing = await ctx.db
      .query("farmers")
      .withIndex("by_farmer_code", (q) => q.eq("farmerCode", farmerCode))
      .unique();
    if (existing === null) {
      return farmerCode;
    }
  }
  throw new Error("Could not generate a unique farmer code.");
}

async function upsertUserFromIdentity(
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
    status?: "pending" | "active" | "suspended" | "rejected" | "deactivated";
    mfaRequirement?: "not_required" | "sms_required" | "totp_required" | "required";
  },
): Promise<Id<"users">> {
  const now = Date.now();
  const email = args.identity.email === undefined ? undefined : normalizeEmailAddress(args.identity.email);
  const phoneNumber =
    args.identity.phoneNumber === undefined ? undefined : normalizePhoneNumber(args.identity.phoneNumber);
  const mfa = args.mfaRequirement ?? "not_required";
  const mfaStatus = mfa === "not_required" ? "not_required" : args.identity.mfaSatisfied === true ? "verified" : "pending";
  const existing = await ctx.db
    .query("users")
    .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.identity.authProviderId))
    .unique();
  const authMethods = authMethodsForIdentity({
    email,
    signInProvider: args.identity.signInProvider,
  });

  if (existing !== null) {
    await ctx.db.patch(existing._id, omitUndefinedValues({
      authProvider: "firebase",
      phoneNumber,
      email,
      name: identityName({ ...args.identity, email, phoneNumber }),
      role: args.role,
      status: args.status ?? (mfaStatus === "pending" && args.role === "admin" ? "pending" : "active"),
      authMethods,
      phoneVerified: args.identity.phoneVerified,
      emailVerified: args.identity.emailVerified,
      mfaRequirement: mfa,
      mfaStatus,
      mfaMethods: args.identity.mfaMethods,
      onboardingState: "profile_required",
      updatedAt: now,
    }));
    return existing._id;
  }

  return await ctx.db.insert("users", omitUndefinedValues({
    authProviderId: args.identity.authProviderId,
    authProvider: "firebase",
    phoneNumber,
    email,
    name: identityName({ ...args.identity, email, phoneNumber }),
    role: args.role,
    status: args.status ?? (mfaStatus === "pending" && args.role === "admin" ? "pending" : "active"),
    authMethods,
    phoneVerified: args.identity.phoneVerified,
    emailVerified: args.identity.emailVerified,
    mfaRequirement: mfa,
    mfaStatus,
    mfaMethods: args.identity.mfaMethods,
    onboardingState: "profile_required",
    createdAt: now,
    updatedAt: now,
  }));
}

async function linkProfile(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    profileType: "farmer" | "buyer" | "transporter" | "warehouse_agent" | "admin";
    profileId: string;
    source: "self_app" | "agent_assisted_claim" | "invite_acceptance" | "admin_link";
  },
): Promise<void> {
  const existing = await ctx.db
    .query("profileLinks")
    .withIndex("by_profile", (q) => q.eq("profileType", args.profileType).eq("profileId", args.profileId))
    .unique();
  assertAllowed(existing === null || existing.userId === args.userId, "Profile is already linked to another user.");
  const now = Date.now();
  if (existing !== null) {
    await ctx.db.patch(existing._id, {
      status: "linked",
      source: args.source,
      updatedAt: now,
    });
    return;
  }
  await ctx.db.insert("profileLinks", {
    userId: args.userId,
    profileType: args.profileType,
    profileId: args.profileId,
    status: "linked",
    source: args.source,
    createdAt: now,
    updatedAt: now,
  });
}

async function collectProfiles(ctx: QueryCtx, userId: Id<"users">) {
  const links = await ctx.db
    .query("profileLinks")
    .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "linked"))
    .collect();
  return links.map((link) => ({
    profileType: link.profileType,
    profileId: link.profileId,
    status: "linked",
    linkStatus: link.status,
  }));
}

export const resolveCurrentPrincipal = query({
  args: {
    authProviderId: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.authProviderId))
      .unique();
    if (user === null) {
      return null;
    }
    return {
      userId: user._id,
      authProvider: user.authProvider ?? "firebase",
      authProviderId: user.authProviderId,
      role: user.role,
      status: user.status,
      phoneNumber: user.phoneNumber,
      email: user.email,
      name: user.name,
      authMethods: user.authMethods ?? [],
      mfaRequirement: user.mfaRequirement ?? "not_required",
      mfaStatus: user.mfaStatus ?? "not_required",
      onboardingState: user.onboardingState ?? "not_started",
      profiles: await collectProfiles(ctx, user._id),
    };
  },
});

export const syncFirebaseIdentity = mutation({
  args: {
    identity: firebaseIdentity,
    role: v.union(
      v.literal("farmer"),
      v.literal("warehouse_agent"),
      v.literal("buyer"),
      v.literal("transporter"),
      v.literal("admin"),
    ),
    mfaRequirement: v.optional(mfaRequirement),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    return await upsertUserFromIdentity(ctx, omitUndefinedValues({
      identity: args.identity,
      role: args.role,
      mfaRequirement: args.mfaRequirement,
    }));
  },
});

export const createSelfAppFarmerProfile = mutation({
  args: {
    identity: firebaseIdentity,
    fullName: v.string(),
    community: v.string(),
    region: v.optional(v.string()),
    householdPhoneOwnerName: v.optional(v.string()),
    preferredWarehouseId: v.optional(v.id("warehouses")),
  },
  returns: v.object({ userId: v.string(), farmerId: v.string() }),
  handler: async (ctx, args) => {
    assertAllowed(args.identity.phoneVerified === true, "Farmer phone number must be verified by Firebase.");
    assertAllowed(args.identity.phoneNumber !== undefined, "Farmer phone number is required.");
    const phoneNumber = normalizePhoneNumber(args.identity.phoneNumber);
    const userId = await upsertUserFromIdentity(ctx, {
      identity: { ...args.identity, phoneNumber },
      role: "farmer",
      status: "active",
    });

    const existing = await ctx.db
      .query("farmers")
      .withIndex("by_phone_number", (q) => q.eq("phoneNumber", phoneNumber))
      .unique();
    const now = Date.now();
    let farmerId: Id<"farmers">;
    let farmerCode: string | undefined;
    if (existing !== null) {
      assertAllowed(existing.userId === undefined || existing.userId === userId, "Farmer phone is already linked.");
      farmerId = existing._id;
      await ctx.db.patch(farmerId, {
        userId,
        fullName: args.fullName.trim(),
        verificationStatus: existing.verificationStatus === "rejected" ? "pending" : existing.verificationStatus,
        updatedAt: now,
      });
    } else {
      farmerCode = await makeUniqueFarmerCode(ctx, args.community, phoneNumber, now);
      farmerId = await ctx.db.insert("farmers", omitUndefinedValues({
        userId,
        farmerCode,
        fullName: args.fullName.trim(),
        phoneNumber,
        community: args.community.trim(),
        region: cleanOptionalText(args.region),
        householdPhoneOwnerName: cleanOptionalText(args.householdPhoneOwnerName),
        preferredWarehouseId: args.preferredWarehouseId,
        registrationSource: "self_app",
        verificationStatus: "verified",
        status: "active",
        createdAt: now,
        updatedAt: now,
      }));
    }
    await linkProfile(ctx, { userId, profileType: "farmer", profileId: farmerId, source: "self_app" });
    await ctx.db.patch(userId, { onboardingState: "complete", updatedAt: now });
    const actor = await getActor(ctx, userId);
    const farmer = await ctx.db.get(farmerId);
    await insertAuditLog(ctx, {
      actor,
      action: "farmer.self_onboarded",
      entityType: "farmer",
      entityId: farmerId,
      after: farmer === null ? undefined : auditSnapshot(farmer),
    });
    if (farmerCode !== undefined) {
      await insertNotificationRecord(ctx, {
        recipientId: phoneNumber,
        recipientUserId: userId,
        recipientRole: "farmer",
        channel: "sms",
        title: "Welcome to Kuapa Dwaso",
        message: `Welcome to Kuapa Dwaso. Your farmer code is ${farmerCode}. Show this code when you bring produce to the warehouse.`,
        messageKind: "transactional",
        templateKey: "generic_notification",
        relatedEntityType: "farmer",
        relatedEntityId: farmerId,
      });
    }
    return { userId, farmerId };
  },
});

export const claimFarmerProfileByVerifiedPhone = mutation({
  args: {
    identity: firebaseIdentity,
  },
  returns: v.object({ userId: v.string(), farmerId: v.string() }),
  handler: async (ctx, args) => {
    assertAllowed(args.identity.phoneVerified === true, "Farmer phone number must be verified by Firebase.");
    assertAllowed(args.identity.phoneNumber !== undefined, "Farmer phone number is required.");
    const phoneNumber = normalizePhoneNumber(args.identity.phoneNumber);
    const farmer = await ctx.db
      .query("farmers")
      .withIndex("by_phone_number", (q) => q.eq("phoneNumber", phoneNumber))
      .unique();
    assertAllowed(farmer !== null, "No farmer profile exists for this verified phone number.");
    const userId = await upsertUserFromIdentity(ctx, {
      identity: { ...args.identity, phoneNumber },
      role: "farmer",
      status: "active",
    });
    assertAllowed(farmer.userId === undefined || farmer.userId === userId, "Farmer profile is already claimed.");
    const now = Date.now();
    await ctx.db.patch(farmer._id, {
      userId,
      verificationStatus: farmer.verificationStatus === "rejected" ? "pending" : farmer.verificationStatus,
      updatedAt: now,
    });
    await linkProfile(ctx, { userId, profileType: "farmer", profileId: farmer._id, source: "agent_assisted_claim" });
    await ctx.db.patch(userId, { onboardingState: "complete", updatedAt: now });
    const actor = await getActor(ctx, userId);
    await insertAuditLog(ctx, {
      actor,
      action: "farmer.profile_claimed",
      entityType: "farmer",
      entityId: farmer._id,
      before: auditSnapshot(farmer),
      after: auditSnapshot((await ctx.db.get(farmer._id)) as Doc<"farmers">),
    });
    return { userId, farmerId: farmer._id };
  },
});

export const createOrLinkBuyerProfileAfterPhoneAuth = mutation({
  args: {
    identity: firebaseIdentity,
    fullName: v.string(),
    displayName: v.optional(v.string()),
    buyerType,
    organizationName: v.optional(v.string()),
    email: v.optional(v.string()),
    organizationRegistrationNumber: v.optional(v.string()),
    contactRole: v.optional(v.string()),
    registeredAddress: v.optional(v.string()),
    destinationMarket: v.optional(v.string()),
  },
  returns: v.object({ userId: v.string(), buyerId: v.string() }),
  handler: async (ctx, args) => {
    assertAllowed(args.identity.phoneVerified === true, "Buyer phone number must be verified by Firebase.");
    assertAllowed(args.identity.phoneNumber !== undefined, "Buyer phone number is required.");
    const phoneNumber = normalizePhoneNumber(args.identity.phoneNumber);
    const isInstitution = args.buyerType === "institution";
    const email = cleanOptionalText(args.email)?.toLowerCase();
    if (isInstitution) {
      assertAllowed(email !== undefined && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), "A valid official email is required.");
      assertAllowed(cleanOptionalText(args.organizationName) !== undefined, "Organization name is required.");
      assertAllowed(cleanOptionalText(args.organizationRegistrationNumber) !== undefined, "Organization registration number is required.");
      assertAllowed(cleanOptionalText(args.contactRole) !== undefined, "Contact role is required.");
      assertAllowed(cleanOptionalText(args.registeredAddress) !== undefined, "Registered address is required.");
    }
    const userId = await upsertUserFromIdentity(ctx, {
      identity: { ...args.identity, phoneNumber },
      role: "buyer",
      status: "active",
    });
    const now = Date.now();
    const existing = await ctx.db
      .query("buyers")
      .withIndex("by_phone_number", (q) => q.eq("phoneNumber", phoneNumber))
      .unique();
    let buyerId: Id<"buyers">;
    if (existing !== null) {
      assertAllowed(existing.userId === undefined || existing.userId === userId, "Buyer phone is already linked.");
      buyerId = existing._id;
      await ctx.db.patch(buyerId, omitUndefinedValues({
        userId,
        fullName: args.fullName.trim(),
        displayName: cleanOptionalText(args.displayName),
        buyerType: args.buyerType,
        organizationName: cleanOptionalText(args.organizationName),
        email,
        organizationRegistrationNumber: cleanOptionalText(args.organizationRegistrationNumber),
        contactRole: cleanOptionalText(args.contactRole),
        registeredAddress: cleanOptionalText(args.registeredAddress),
        destinationMarket: cleanOptionalText(args.destinationMarket),
        enhancedVerificationStatus: isInstitution ? "required" : (existing.enhancedVerificationStatus ?? "not_required"),
        updatedAt: now,
      }));
    } else {
      buyerId = await ctx.db.insert("buyers", omitUndefinedValues({
        userId,
        fullName: args.fullName.trim(),
        displayName: cleanOptionalText(args.displayName),
        phoneNumber,
        buyerType: args.buyerType,
        organizationName: cleanOptionalText(args.organizationName),
        email,
        organizationRegistrationNumber: cleanOptionalText(args.organizationRegistrationNumber),
        contactRole: cleanOptionalText(args.contactRole),
        registeredAddress: cleanOptionalText(args.registeredAddress),
        destinationMarket: cleanOptionalText(args.destinationMarket),
        verificationStatus: "pending",
        enhancedVerificationStatus: isInstitution ? "required" : "not_required",
        status: "active",
        createdAt: now,
        updatedAt: now,
      }));
    }
    await linkProfile(ctx, { userId, profileType: "buyer", profileId: buyerId, source: "self_app" });
    await ctx.db.patch(userId, { onboardingState: "complete", updatedAt: now });
    return { userId, buyerId };
  },
});

export const createOrLinkTransporterProfileAfterPhoneAuth = mutation({
  args: {
    identity: firebaseIdentity,
    fullName: v.string(),
    vehicleType: v.string(),
    vehicleCapacity: v.optional(v.number()),
    vehicleCapacityUnit: v.optional(v.string()),
    baseLocation: v.string(),
    routesServed: v.array(v.string()),
    destinationsServed: v.array(v.string()),
  },
  returns: v.object({ userId: v.string(), transporterId: v.string() }),
  handler: async (ctx, args) => {
    assertAllowed(args.identity.phoneVerified === true, "Transporter phone number must be verified by Firebase.");
    assertAllowed(args.identity.phoneNumber !== undefined, "Transporter phone number is required.");
    const phoneNumber = normalizePhoneNumber(args.identity.phoneNumber);
    const userId = await upsertUserFromIdentity(ctx, {
      identity: { ...args.identity, phoneNumber },
      role: "transporter",
      status: "active",
    });
    const now = Date.now();
    const existing = await ctx.db
      .query("transporterProfiles")
      .withIndex("by_phone_number", (q) => q.eq("phoneNumber", phoneNumber))
      .unique();
    let transporterId: Id<"transporterProfiles">;
    if (existing !== null) {
      assertAllowed(existing.userId === undefined || existing.userId === userId, "Transporter phone is already linked.");
      transporterId = existing._id;
      await ctx.db.patch(transporterId, omitUndefinedValues({
        userId,
        fullName: args.fullName.trim(),
        vehicleType: args.vehicleType.trim(),
        vehicleCapacity: args.vehicleCapacity,
        vehicleCapacityUnit: cleanOptionalText(args.vehicleCapacityUnit),
        baseLocation: args.baseLocation.trim(),
        routesServed: args.routesServed.map((route) => route.trim()).filter(Boolean),
        destinationsServed: args.destinationsServed.map((destination) => destination.trim()).filter(Boolean),
        verificationStatus: "pending",
        updatedAt: now,
      }));
    } else {
      transporterId = await ctx.db.insert("transporterProfiles", omitUndefinedValues({
        userId,
        fullName: args.fullName.trim(),
        phoneNumber,
        vehicleType: args.vehicleType.trim(),
        vehicleCapacity: args.vehicleCapacity,
        vehicleCapacityUnit: cleanOptionalText(args.vehicleCapacityUnit),
        baseLocation: args.baseLocation.trim(),
        routesServed: args.routesServed.map((route) => route.trim()).filter(Boolean),
        destinationsServed: args.destinationsServed.map((destination) => destination.trim()).filter(Boolean),
        verificationStatus: "pending",
        status: "active",
        createdAt: now,
        updatedAt: now,
      }));
    }
    await linkProfile(ctx, { userId, profileType: "transporter", profileId: transporterId, source: "self_app" });
    await ctx.db.patch(userId, { onboardingState: "pending_approval", updatedAt: now });
    return { userId, transporterId };
  },
});

export const recordMfaState = mutation({
  args: {
    actorUserId: v.id("users"),
    mfaRequirement: mfaRequirement,
    mfaSatisfied: v.boolean(),
    mfaMethods: v.optional(v.array(v.string())),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    await ctx.db.patch(args.actorUserId, omitUndefinedValues({
      mfaRequirement: args.mfaRequirement,
      mfaStatus: args.mfaRequirement === "not_required" ? "not_required" : args.mfaSatisfied ? "verified" : "pending",
      mfaMethods: args.mfaMethods,
      status: args.mfaSatisfied || args.mfaRequirement === "not_required" ? "active" : actor.status,
      updatedAt: Date.now(),
    }));
    return args.actorUserId;
  },
});
