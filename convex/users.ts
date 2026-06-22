import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const marketplaceRole = v.union(
  v.literal("farmer"),
  v.literal("agent"),
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

export const getByAuthProviderId = query({
  args: {
    authProviderId: v.string()
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.authProviderId))
      .unique();
  }
});

export const getById = query({
  args: {
    userId: v.id("users")
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  }
});
