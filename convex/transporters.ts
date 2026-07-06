import { canManageTransporters } from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  assertAllowed,
  auditSnapshot,
  cleanOptionalText,
  getActor,
  insertAuditLog,
} from "./workflowHelpers";

const verificationStatus = v.union(
  v.literal("pending"),
  v.literal("verified"),
  v.literal("rejected"),
);

const profileStatus = v.union(
  v.literal("active"),
  v.literal("suspended"),
  v.literal("deactivated"),
);

function cleanText(value: string, label: string): string {
  const cleaned = value.trim();
  assertAllowed(cleaned.length > 0, `${label} is required.`);
  return cleaned;
}

function cleanTextArray(values: string[], label: string): string[] {
  const cleaned = values.map((value) => value.trim()).filter((value) => value.length > 0);
  assertAllowed(cleaned.length > 0, `${label} must include at least one value.`);
  return [...new Set(cleaned)];
}

function assertOptionalPositiveNumber(value: number | undefined, label: string): void {
  if (value !== undefined) {
    assertAllowed(Number.isFinite(value) && value > 0, `${label} must be a positive number.`);
  }
}

function assertOptionalRating(value: number | undefined): void {
  if (value !== undefined) {
    assertAllowed(Number.isFinite(value) && value >= 0 && value <= 5, "Rating must be between 0 and 5.");
  }
}

async function assertCanManageProfile(
  actor: Doc<"users">,
  profile: Doc<"transporterProfiles">,
): Promise<void> {
  if (actor.role === "transporter") {
    assertAllowed(profile.userId === actor._id, "Transporters can only manage their own profile.");
    return;
  }
  assertAllowed(canManageTransporters(actor.role), "Only admins can manage transporter profiles.");
}

export const create = mutation({
  args: {
    actorUserId: v.id("users"),
    userId: v.optional(v.id("users")),
    fullName: v.string(),
    phoneNumber: v.string(),
    vehicleType: v.string(),
    vehicleCapacity: v.optional(v.number()),
    vehicleCapacityUnit: v.optional(v.string()),
    baseLocation: v.string(),
    routesServed: v.array(v.string()),
    destinationsServed: v.array(v.string()),
    rating: v.optional(v.number()),
  },
  returns: v.id("transporterProfiles"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(
      actor.role === "transporter" || canManageTransporters(actor.role),
      "Only transporters and admins can create transporter profiles.",
    );
    const userId = args.userId ?? (actor.role === "transporter" ? actor._id : undefined);
    if (actor.role === "transporter") {
      assertAllowed(userId === actor._id, "Transporters can only create their own profile.");
    }
    if (userId !== undefined) {
      const linkedUser = await ctx.db.get(userId);
      assertAllowed(linkedUser !== null, "Linked user was not found.");
      assertAllowed(linkedUser.role === "transporter", "Linked user must have transporter role.");
      const existing = await ctx.db
        .query("transporterProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      assertAllowed(existing === null, "This user already has a transporter profile.");
    }

    assertOptionalPositiveNumber(args.vehicleCapacity, "Vehicle capacity");
    assertOptionalRating(args.rating);
    const now = Date.now();
    const transporterId = await ctx.db.insert("transporterProfiles", {
      userId,
      fullName: cleanText(args.fullName, "Full name"),
      phoneNumber: cleanText(args.phoneNumber, "Phone number"),
      vehicleType: cleanText(args.vehicleType, "Vehicle type"),
      vehicleCapacity: args.vehicleCapacity,
      vehicleCapacityUnit: cleanOptionalText(args.vehicleCapacityUnit),
      baseLocation: cleanText(args.baseLocation, "Base location"),
      routesServed: cleanTextArray(args.routesServed, "Routes served"),
      destinationsServed: cleanTextArray(args.destinationsServed, "Destinations served"),
      verificationStatus: "pending",
      status: "active",
      rating: args.rating,
      createdAt: now,
      updatedAt: now,
    });
    const after = await ctx.db.get(transporterId);
    await insertAuditLog(ctx, {
      actor,
      action: "transporter_profile.created",
      entityType: "transporter_profile",
      entityId: transporterId,
      after: after === null ? undefined : auditSnapshot(after),
    });

    return transporterId;
  },
});

export const update = mutation({
  args: {
    actorUserId: v.id("users"),
    transporterId: v.id("transporterProfiles"),
    fullName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    vehicleType: v.optional(v.string()),
    vehicleCapacity: v.optional(v.number()),
    vehicleCapacityUnit: v.optional(v.string()),
    baseLocation: v.optional(v.string()),
    routesServed: v.optional(v.array(v.string())),
    destinationsServed: v.optional(v.array(v.string())),
    rating: v.optional(v.number()),
  },
  returns: v.id("transporterProfiles"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const profile = await ctx.db.get(args.transporterId);
    assertAllowed(profile !== null, "Transporter profile was not found.");
    await assertCanManageProfile(actor, profile);
    assertOptionalPositiveNumber(args.vehicleCapacity, "Vehicle capacity");
    assertOptionalRating(args.rating);
    if (args.rating !== undefined) {
      assertAllowed(canManageTransporters(actor.role), "Only admins can update transporter ratings.");
    }

    await ctx.db.patch(args.transporterId, {
      fullName: args.fullName === undefined ? undefined : cleanText(args.fullName, "Full name"),
      phoneNumber: args.phoneNumber === undefined ? undefined : cleanText(args.phoneNumber, "Phone number"),
      vehicleType: args.vehicleType === undefined ? undefined : cleanText(args.vehicleType, "Vehicle type"),
      vehicleCapacity: args.vehicleCapacity,
      vehicleCapacityUnit: cleanOptionalText(args.vehicleCapacityUnit),
      baseLocation: args.baseLocation === undefined ? undefined : cleanText(args.baseLocation, "Base location"),
      routesServed: args.routesServed === undefined ? undefined : cleanTextArray(args.routesServed, "Routes served"),
      destinationsServed:
        args.destinationsServed === undefined
          ? undefined
          : cleanTextArray(args.destinationsServed, "Destinations served"),
      rating: args.rating,
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.transporterId);
    await insertAuditLog(ctx, {
      actor,
      action: "transporter_profile.updated",
      entityType: "transporter_profile",
      entityId: args.transporterId,
      before: auditSnapshot(profile),
      after: after === null ? undefined : auditSnapshot(after),
    });

    return args.transporterId;
  },
});

export const updateVerificationStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    transporterId: v.id("transporterProfiles"),
    verificationStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("transporterProfiles"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canManageTransporters(actor.role), "Only admins can verify transporter profiles.");
    const profile = await ctx.db.get(args.transporterId);
    assertAllowed(profile !== null, "Transporter profile was not found.");

    await ctx.db.patch(args.transporterId, {
      verificationStatus: args.verificationStatus,
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.transporterId);
    await insertAuditLog(ctx, {
      actor,
      action: "transporter_profile.verification_status_updated",
      entityType: "transporter_profile",
      entityId: args.transporterId,
      before: auditSnapshot(profile),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.transporterId;
  },
});

export const updateStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    transporterId: v.id("transporterProfiles"),
    status: profileStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("transporterProfiles"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canManageTransporters(actor.role), "Only admins can update transporter status.");
    const profile = await ctx.db.get(args.transporterId);
    assertAllowed(profile !== null, "Transporter profile was not found.");

    await ctx.db.patch(args.transporterId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.transporterId);
    await insertAuditLog(ctx, {
      actor,
      action: "transporter_profile.status_updated",
      entityType: "transporter_profile",
      entityId: args.transporterId,
      before: auditSnapshot(profile),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.transporterId;
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transporterProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const getById = query({
  args: {
    actorUserId: v.id("users"),
    transporterId: v.id("transporterProfiles"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const profile = await ctx.db.get(args.transporterId);
    if (profile === null) {
      return null;
    }
    if (actor.role === "transporter") {
      assertAllowed(profile.userId === actor._id, "Transporters can only view their own profile.");
    } else {
      assertAllowed(
        actor.role === "admin" || actor.role === "warehouse_agent",
        "Actor cannot view transporter profile details.",
      );
    }

    return profile;
  },
});

export const list = query({
  args: {
    status: v.optional(profileStatus),
    verificationStatus: v.optional(verificationStatus),
    baseLocation: v.optional(v.string()),
    routeServed: v.optional(v.string()),
    destinationServed: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.status !== undefined && args.verificationStatus !== undefined
        ? await ctx.db
            .query("transporterProfiles")
            .withIndex("by_status_verification_status", (q) =>
              q.eq("status", args.status!).eq("verificationStatus", args.verificationStatus!),
            )
            .take(limit * 4)
        : args.status !== undefined
          ? await ctx.db
              .query("transporterProfiles")
              .withIndex("by_status", (q) => q.eq("status", args.status!))
              .take(limit * 4)
          : args.verificationStatus !== undefined
            ? await ctx.db
                .query("transporterProfiles")
                .withIndex("by_verification_status", (q) =>
                  q.eq("verificationStatus", args.verificationStatus!),
                )
                .take(limit * 4)
            : args.baseLocation !== undefined
              ? await ctx.db
                  .query("transporterProfiles")
                  .withIndex("by_base_location", (q) => q.eq("baseLocation", args.baseLocation!.trim()))
                  .take(limit * 4)
              : await ctx.db.query("transporterProfiles").take(limit * 4);
    const routeServed = args.routeServed?.trim().toLowerCase();
    const destinationServed = args.destinationServed?.trim().toLowerCase();

    return candidates
      .filter((profile) => args.status === undefined || profile.status === args.status)
      .filter(
        (profile) =>
          args.verificationStatus === undefined ||
          profile.verificationStatus === args.verificationStatus,
      )
      .filter(
        (profile) =>
          args.baseLocation === undefined || profile.baseLocation === args.baseLocation.trim(),
      )
      .filter(
        (profile) =>
          routeServed === undefined ||
          profile.routesServed.some((route) => route.toLowerCase() === routeServed),
      )
      .filter(
        (profile) =>
          destinationServed === undefined ||
          profile.destinationsServed.some(
            (destination) => destination.toLowerCase() === destinationServed,
          ),
      )
      .slice(0, limit);
  },
});
