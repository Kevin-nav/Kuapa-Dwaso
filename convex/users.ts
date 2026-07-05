import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

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

const userProfile = v.object({
  userId: v.string(),
  authProviderId: v.string(),
  authProvider: v.optional(v.string()),
  phoneNumber: v.optional(v.string()),
  email: v.optional(v.string()),
  name: v.string(),
  role: marketplaceRole,
  status: userStatus
});

export const upsertProfile = mutation({
  args: {
    authProviderId: v.optional(v.string()),
    authProvider: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.string(),
    role: marketplaceRole,
    status: v.optional(userStatus)
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
      await ctx.db.patch(existing._id, {
        authProvider: args.authProvider,
        phoneNumber: args.phoneNumber,
        email: args.email,
        name: args.name,
        role: args.role,
        status,
        updatedAt: now
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      authProviderId: args.authProviderId,
      authProvider: args.authProvider,
      phoneNumber: args.phoneNumber,
      email: args.email,
      name: args.name,
      role: args.role,
      status,
      createdAt: now,
      updatedAt: now
    });
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
    status: v.optional(userStatus)
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
      await ctx.db.patch(existing._id, {
        authProvider: args.authProvider,
        phoneNumber: args.phoneNumber,
        email: args.email,
        name: args.name,
        role: args.role,
        status,
        updatedAt: now
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      authProviderId: args.authProviderId,
      authProvider: args.authProvider,
      phoneNumber: args.phoneNumber,
      email: args.email,
      name: args.name,
      role: args.role,
      status,
      createdAt: now,
      updatedAt: now
    });
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

  return profile;
}
