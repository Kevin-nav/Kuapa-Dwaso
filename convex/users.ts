import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { omitUndefinedValues, requireAdminPermission } from "./workflowHelpers";

const marketplaceRole = v.union(
  v.literal("farmer"),
  v.literal("warehouse_agent"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("admin")
);

const userStatus = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("suspended"),
  v.literal("rejected"),
  v.literal("deactivated")
);
const authMethod = v.union(v.literal("phone"), v.literal("email_password"));
const mfaRequirement = v.union(
  v.literal("not_required"),
  v.literal("sms_required"),
  v.literal("totp_required"),
  v.literal("required")
);
const mfaStatus = v.union(
  v.literal("not_required"),
  v.literal("pending"),
  v.literal("verified"),
  v.literal("failed"),
  v.literal("blocked"),
  v.literal("recovery")
);

const userProfile = v.object({
  userId: v.string(),
  authProviderId: v.string(),
  authProvider: v.optional(v.string()),
  phoneNumber: v.optional(v.string()),
  email: v.optional(v.string()),
  name: v.string(),
  role: marketplaceRole,
  status: userStatus,
  mfaRequirement: v.optional(v.string()),
  mfaStatus: v.optional(v.string()),
  onboardingState: v.optional(v.string())
});

export const upsertProfile = mutation({
  args: {
    authProviderId: v.optional(v.string()),
    authProvider: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.string(),
    role: marketplaceRole,
    status: v.optional(userStatus),
    authMethods: v.optional(v.array(authMethod)),
    phoneVerified: v.optional(v.boolean()),
    emailVerified: v.optional(v.boolean()),
    mfaRequirement: v.optional(mfaRequirement),
    mfaStatus: v.optional(mfaStatus)
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const status = args.status ?? "pending";

    const existing =
      args.authProviderId === undefined
        ? null
        : await ctx.db
            .query("users")
            .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.authProviderId))
            .unique();

    if (existing !== null) {
      await ctx.db.patch(existing._id, omitUndefinedValues({
        authProvider: args.authProvider,
        phoneNumber: args.phoneNumber,
        email: args.email,
        name: args.name,
        role: args.role,
        status,
        authMethods: args.authMethods,
        phoneVerified: args.phoneVerified,
        emailVerified: args.emailVerified,
        mfaRequirement: args.mfaRequirement,
        mfaStatus: args.mfaStatus,
        onboardingState: existing.onboardingState ?? "profile_required",
        updatedAt: now
      }));
      return existing._id;
    }

    return await ctx.db.insert("users", omitUndefinedValues({
      authProviderId: args.authProviderId,
      authProvider: args.authProvider,
      phoneNumber: args.phoneNumber,
      email: args.email,
      name: args.name,
      role: args.role,
      status,
      authMethods: args.authMethods,
      phoneVerified: args.phoneVerified,
      emailVerified: args.emailVerified,
      mfaRequirement: args.mfaRequirement,
      mfaStatus: args.mfaStatus,
      onboardingState: "profile_required",
      createdAt: now,
      updatedAt: now
    }));
  }
});

export const upsertProfileByAuthProviderId = mutation({
  args: {
    authProviderId: v.string(),
    authProvider: v.string(),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.string(),
    role: marketplaceRole,
    status: v.optional(userStatus),
    authMethods: v.optional(v.array(authMethod)),
    phoneVerified: v.optional(v.boolean()),
    emailVerified: v.optional(v.boolean()),
    mfaRequirement: v.optional(mfaRequirement),
    mfaStatus: v.optional(mfaStatus)
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const status = args.status ?? "pending";
    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.authProviderId))
      .unique();

    if (existing !== null) {
      await ctx.db.patch(existing._id, omitUndefinedValues({
        authProvider: args.authProvider,
        phoneNumber: args.phoneNumber,
        email: args.email,
        name: args.name,
        role: args.role,
        status,
        authMethods: args.authMethods,
        phoneVerified: args.phoneVerified,
        emailVerified: args.emailVerified,
        mfaRequirement: args.mfaRequirement,
        mfaStatus: args.mfaStatus,
        onboardingState: existing.onboardingState ?? "profile_required",
        updatedAt: now
      }));
      return existing._id;
    }

    return await ctx.db.insert("users", omitUndefinedValues({
      authProviderId: args.authProviderId,
      authProvider: args.authProvider,
      phoneNumber: args.phoneNumber,
      email: args.email,
      name: args.name,
      role: args.role,
      status,
      authMethods: args.authMethods,
      phoneVerified: args.phoneVerified,
      emailVerified: args.emailVerified,
      mfaRequirement: args.mfaRequirement,
      mfaStatus: args.mfaStatus,
      onboardingState: "profile_required",
      createdAt: now,
      updatedAt: now
    }));
  }
});

export const getByAuthProviderId = query({
  args: {
    authProviderId: v.string()
  },
  returns: v.union(v.null(), userProfile),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.authProviderId))
      .unique();

    return user === null ? null : toUserProfile(user);
  }
});

export const updateStatus = mutation({
  args: {
    userId: v.id("users"),
    status: userStatus
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      status: args.status,
      updatedAt: Date.now()
    });
    return null;
  }
});

export const getById = query({
  args: {
    userId: v.id("users")
  },
  returns: v.union(v.null(), userProfile),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user === null ? null : toUserProfile(user);
  }
});

export const listAdmins = query({
  args: {
    actorUserId: v.id("users"),
    status: v.optional(userStatus),
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, args.actorUserId, "adminAccess:manage", {});
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.status === undefined
        ? (
            await Promise.all(
              (["pending", "active", "suspended", "rejected", "deactivated"] as const).map((status) =>
                ctx.db
                  .query("users")
                  .withIndex("by_role_status", (q) => q.eq("role", "admin").eq("status", status))
                  .take(limit),
              ),
            )
          ).flat()
        : await ctx.db
            .query("users")
            .withIndex("by_role_status", (q) => q.eq("role", "admin").eq("status", args.status!))
            .take(limit * 2);

    return candidates.slice(0, limit).map((user) => ({
      userId: user._id,
      authProviderId: user.authProviderId,
      authProvider: user.authProvider,
      phoneNumber: user.phoneNumber,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      authMethods: user.authMethods ?? [],
      mfaRequirement: user.mfaRequirement ?? "not_required",
      mfaStatus: user.mfaStatus ?? "not_required",
      onboardingState: user.onboardingState ?? "not_started",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
  }
});

function toUserProfile(user: Doc<"users">) {
  if (user.authProviderId === undefined) {
    return null;
  }

  const profile: {
    userId: string;
    authProviderId: string;
    authProvider?: string;
    phoneNumber?: string;
    email?: string;
    name: string;
    role: "farmer" | "warehouse_agent" | "buyer" | "transporter" | "admin";
    status: "pending" | "active" | "suspended" | "rejected" | "deactivated";
    mfaRequirement?: string;
    mfaStatus?: string;
    onboardingState?: string;
  } = {
    userId: user._id.toString(),
    authProviderId: user.authProviderId,
    name: user.name,
    role: user.role,
    status: user.status
  };

  if (user.authProvider !== undefined) {
    profile.authProvider = user.authProvider;
  }
  if (user.phoneNumber !== undefined) {
    profile.phoneNumber = user.phoneNumber;
  }
  if (user.email !== undefined) {
    profile.email = user.email;
  }
  if (user.mfaRequirement !== undefined) {
    profile.mfaRequirement = user.mfaRequirement;
  }
  if (user.mfaStatus !== undefined) {
    profile.mfaStatus = user.mfaStatus;
  }
  if (user.onboardingState !== undefined) {
    profile.onboardingState = user.onboardingState;
  }

  return profile;
}
