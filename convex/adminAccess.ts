import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  adminAccessHasPermissionForScope,
  adminScopeTarget,
  assertAllowed,
  auditSnapshot,
  cleanOptionalText,
  getEffectiveAdminAccess,
  getActor,
  insertAuditLog,
  omitUndefinedValues,
  requireActiveAdmin,
  requireAdminPermission,
  type AdminScopeTarget,
} from "./workflowHelpers";
import type { AdminPermissionKey } from "@kuapa-dwaso/permissions";

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

const adminAccessGroupStatus = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("deactivated"),
);
const privilegedMfaRequirement = v.union(v.literal("totp_required"), v.literal("required"));

const adminPermissionKey = v.union(
  v.literal("adminAccess:manage"),
  v.literal("warehouses:read"),
  v.literal("warehouses:manage"),
  v.literal("warehouseAgents:read"),
  v.literal("warehouseAgents:manage"),
  v.literal("farmers:read"),
  v.literal("farmers:manage"),
  v.literal("farmers:verify"),
  v.literal("inventory:read"),
  v.literal("inventory:manage"),
  v.literal("inventory:adjust"),
  v.literal("fees:read"),
  v.literal("fees:manage"),
  v.literal("buyers:read"),
  v.literal("buyers:manage"),
  v.literal("orders:read"),
  v.literal("orders:manage"),
  v.literal("sales:read"),
  v.literal("sales:managePaymentStatus"),
  v.literal("payments:read"),
  v.literal("payments:manage"),
  v.literal("payouts:read"),
  v.literal("payouts:manage"),
  v.literal("dispatches:read"),
  v.literal("dispatches:manage"),
  v.literal("marketSchedules:read"),
  v.literal("marketSchedules:manage"),
  v.literal("marketRuns:read"),
  v.literal("marketRuns:manage"),
  v.literal("transporters:read"),
  v.literal("transporters:manage"),
  v.literal("disputes:read"),
  v.literal("disputes:manage"),
  v.literal("auditLogs:read"),
  v.literal("reports:read"),
  v.literal("notifications:read"),
  v.literal("notifications:send"),
  v.literal("invitations:read"),
  v.literal("invitations:manage"),
  v.literal("profileLinks:read"),
  v.literal("profileLinks:manage"),
  v.literal("uploads:read"),
  v.literal("uploads:manage"),
  v.literal("blog:read"),
  v.literal("blog:write"),
  v.literal("blog:publish"),
);

function normalizeScope(args: {
  scopeType:
    | "global"
    | "region"
    | "district"
    | "warehouse"
    | "destination_market";
  scopeId?: string;
  scopeValue?: string;
}): { scopeId?: string; scopeValue?: string } {
  if (args.scopeType === "global") {
    return {};
  }
  const scopeId = cleanOptionalText(args.scopeId);
  const scopeValue = cleanOptionalText(args.scopeValue);
  assertAllowed(scopeId !== undefined || scopeValue !== undefined, "Scoped admin grants require a scope id or value.");
  
  const res: { scopeId?: string; scopeValue?: string } = {};
  if (scopeId !== undefined) {
    res.scopeId = scopeId;
  }
  if (scopeValue !== undefined) {
    res.scopeValue = scopeValue;
  }
  return res;
}

async function requireAccessManager(ctx: Parameters<typeof requireAdminPermission>[0], actorUserId: Id<"users">) {
  const access = await requireAdminPermission(ctx, actorUserId, "adminAccess:manage", { scopeType: "global" } as AdminScopeTarget);
  return access.actor;
}

async function requireAdminTarget(ctx: Parameters<typeof getActor>[0], adminUserId: Id<"users">): Promise<Doc<"users">> {
  const user = await ctx.db.get(adminUserId);
  assertAllowed(user !== null, "Admin user was not found.");
  assertAllowed(user.role === "admin", "Role assignments can only target admin users.");
  assertAllowed(user.status === "active", "Admin user must be active.");
  return user;
}

function summarizeAccess(access: Awaited<ReturnType<typeof getEffectiveAdminAccess>>) {
  return {
    adminUserId: access.actor._id,
    generatedAt: access.generatedAt,
    isPlatformOwner: access.isPlatformOwner,
    permissions: [...access.permissions].sort(),
    roles: access.grants.map(({ permissions: _permissions, ...grant }) => grant),
  };
}

export const bootstrapFirstPlatformOwner = mutation({
  args: {
    adminUserId: v.id("users"),
    reason: v.string(),
  },
  returns: v.id("adminRoleAssignments"),
  handler: async (ctx, args) => {
    assertAllowed(args.reason.trim().length > 0, "Bootstrap reason is required.");
    const adminUser = await requireAdminTarget(ctx, args.adminUserId);
    const existing = await ctx.db
      .query("adminRoleAssignments")
      .withIndex("by_role_status", (q) => q.eq("roleKey", "platform_owner").eq("status", "active"))
      .collect();
    const activeGlobalOwner = existing.find(
      (assignment) =>
        assignment.scopeType === "global" &&
        (assignment.expiresAt === undefined || assignment.expiresAt > Date.now()),
    );
    assertAllowed(
      activeGlobalOwner === undefined,
      "A platform owner already exists; use admin access management instead.",
    );

    const now = Date.now();
    const assignmentId = await ctx.db.insert("adminRoleAssignments", {
      adminUserId: args.adminUserId,
      roleKey: "platform_owner",
      scopeType: "global",
      status: "active",
      assignedBy: args.adminUserId,
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const after = await ctx.db.get(assignmentId);
    await insertAuditLog(ctx, {
      actor: adminUser,
      action: "admin_access.bootstrap_platform_owner",
      entityType: "admin_role_assignment",
      entityId: assignmentId,
      after: after === null ? undefined : auditSnapshot(after),
      metadata: { reason: args.reason, bootstrap: true },
    });
    return assignmentId;
  },
});

/** A verified platform owner can re-enrol a legacy admin that predates MFA fields. */
export const recoverLegacyAdminMfa = mutation({
  args: {
    actorUserId: v.id("users"),
    adminUserId: v.id("users"),
    mfaRequirement: privilegedMfaRequirement,
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const actor = await requireAccessManager(ctx, args.actorUserId);
    const target = await requireAdminTarget(ctx, args.adminUserId);
    assertAllowed(
      target.mfaRequirement === undefined || target.mfaStatus === undefined,
      "MFA recovery is only available for legacy admin accounts.",
    );
    const now = Date.now();
    await ctx.db.patch(target._id, {
      mfaRequirement: args.mfaRequirement,
      mfaStatus: "pending",
      updatedAt: now,
    });
    await insertAuditLog(ctx, {
      actor,
      action: "admin_access.legacy_mfa_recovery_started",
      entityType: "user",
      entityId: target._id,
      before: auditSnapshot(target),
      after: auditSnapshot((await ctx.db.get(target._id))!),
    });
    return target._id;
  },
});

export const assignDirectRole = mutation({
  args: {
    actorUserId: v.id("users"),
    adminUserId: v.id("users"),
    roleKey: adminRoleKey,
    scopeType: adminScopeType,
    scopeId: v.optional(v.string()),
    scopeValue: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.id("adminRoleAssignments"),
  handler: async (ctx, args) => {
    const actor = await requireAccessManager(ctx, args.actorUserId);
    await requireAdminTarget(ctx, args.adminUserId);
    const scope = normalizeScope(args);
    const now = Date.now();
    const assignmentPayload: any = {
      adminUserId: args.adminUserId,
      roleKey: args.roleKey,
      scopeType: args.scopeType,
      ...scope,
      status: "active",
      assignedBy: args.actorUserId,
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    if (args.expiresAt !== undefined) {
      assignmentPayload.expiresAt = args.expiresAt;
    }
    const assignmentId = await ctx.db.insert("adminRoleAssignments", assignmentPayload);
    const after = await ctx.db.get(assignmentId);
    await insertAuditLog(ctx, {
      actor,
      action: "admin_role_assignment.created",
      entityType: "admin_role_assignment",
      entityId: assignmentId,
      after: after === null ? undefined : auditSnapshot(after),
    });
    return assignmentId;
  },
});

export const deactivateDirectRole = mutation({
  args: {
    actorUserId: v.id("users"),
    assignmentId: v.id("adminRoleAssignments"),
    reason: v.optional(v.string()),
  },
  returns: v.id("adminRoleAssignments"),
  handler: async (ctx, args) => {
    const actor = await requireAccessManager(ctx, args.actorUserId);
    const assignment = await ctx.db.get(args.assignmentId);
    assertAllowed(assignment !== null, "Admin role assignment was not found.");
    await ctx.db.patch(args.assignmentId, {
      status: "revoked",
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.assignmentId);
    await insertAuditLog(ctx, {
      actor,
      action: "admin_role_assignment.revoked",
      entityType: "admin_role_assignment",
      entityId: args.assignmentId,
      before: auditSnapshot(assignment),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });
    return args.assignmentId;
  },
});

export const listDirectAssignmentsByUser = query({
  args: {
    actorUserId: v.id("users"),
    adminUserId: v.id("users"),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    if (args.actorUserId !== args.adminUserId) {
      await requireAdminPermission(ctx, args.actorUserId, "adminAccess:manage", { scopeType: "global" } as AdminScopeTarget);
    } else {
      await requireActiveAdmin(ctx, args.actorUserId);
    }
    return await ctx.db
      .query("adminRoleAssignments")
      .withIndex("by_admin_user_status", (q) => q.eq("adminUserId", args.adminUserId))
      .collect();
  },
});

export const listGroupMembershipsByUser = query({
  args: {
    actorUserId: v.id("users"),
    adminUserId: v.id("users"),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    if (args.actorUserId !== args.adminUserId) {
      await requireAdminPermission(ctx, args.actorUserId, "adminAccess:manage", { scopeType: "global" } as AdminScopeTarget);
    } else {
      await requireActiveAdmin(ctx, args.actorUserId);
    }
    const memberships = await ctx.db
      .query("adminAccessGroupMembers")
      .withIndex("by_admin_user_status", (q) => q.eq("adminUserId", args.adminUserId))
      .collect();
    return await Promise.all(
      memberships.map(async (membership) => ({
        ...membership,
        group: await ctx.db.get(membership.groupId),
      })),
    );
  },
});

export const listGroups = query({
  args: {
    actorUserId: v.id("users"),
    status: v.optional(adminAccessGroupStatus),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, args.actorUserId, "adminAccess:manage", { scopeType: "global" } as AdminScopeTarget);
    const limit = Math.min(args.limit ?? 50, 100);
    const groups =
      args.status === undefined
        ? await ctx.db.query("adminAccessGroups").take(limit * 2)
        : await ctx.db
            .query("adminAccessGroups")
            .withIndex("by_status", (q) => q.eq("status", args.status!))
            .take(limit * 2);
    return await Promise.all(
      groups.slice(0, limit).map(async (group) => {
        const activeMembers = await ctx.db
          .query("adminAccessGroupMembers")
          .withIndex("by_group_status", (q) => q.eq("groupId", group._id).eq("status", "active"))
          .collect();
        const activeRoleAssignments = await ctx.db
          .query("adminAccessGroupRoleAssignments")
          .withIndex("by_group_status", (q) => q.eq("groupId", group._id).eq("status", "active"))
          .collect();
        return {
          ...group,
          activeMemberCount: activeMembers.length,
          activeRoleAssignmentCount: activeRoleAssignments.length,
        };
      }),
    );
  },
});

export const getGroupDetails = query({
  args: {
    actorUserId: v.id("users"),
    groupId: v.id("adminAccessGroups"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, args.actorUserId, "adminAccess:manage", { scopeType: "global" } as AdminScopeTarget);
    const group = await ctx.db.get(args.groupId);
    if (group === null) {
      return null;
    }
    const members = await ctx.db
      .query("adminAccessGroupMembers")
      .withIndex("by_group_status", (q) => q.eq("groupId", args.groupId))
      .collect();
    const roleAssignments = await ctx.db
      .query("adminAccessGroupRoleAssignments")
      .withIndex("by_group_status", (q) => q.eq("groupId", args.groupId))
      .collect();
    return {
      group,
      members: await Promise.all(
        members.map(async (member) => ({
          ...member,
          adminUser: await ctx.db.get(member.adminUserId),
        })),
      ),
      roleAssignments,
    };
  },
});

export const createGroup = mutation({
  args: {
    actorUserId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("adminAccessGroups"),
  handler: async (ctx, args) => {
    const actor = await requireAccessManager(ctx, args.actorUserId);
    const name = args.name.trim();
    assertAllowed(name.length > 0, "Group name is required.");
    const now = Date.now();
    const groupId = await ctx.db.insert("adminAccessGroups", omitUndefinedValues({
      name,
      description: cleanOptionalText(args.description),
      status: "active",
      createdBy: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    }));
    const after = await ctx.db.get(groupId);
    await insertAuditLog(ctx, {
      actor,
      action: "admin_access_group.created",
      entityType: "admin_access_group",
      entityId: groupId,
      after: after === null ? undefined : auditSnapshot(after),
    });
    return groupId;
  },
});

export const updateGroup = mutation({
  args: {
    actorUserId: v.id("users"),
    groupId: v.id("adminAccessGroups"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(adminAccessGroupStatus),
  },
  returns: v.id("adminAccessGroups"),
  handler: async (ctx, args) => {
    const actor = await requireAccessManager(ctx, args.actorUserId);
    const group = await ctx.db.get(args.groupId);
    assertAllowed(group !== null, "Admin access group was not found.");
    await ctx.db.patch(args.groupId, omitUndefinedValues({
      name: args.name?.trim(),
      description: cleanOptionalText(args.description),
      status: args.status,
      updatedAt: Date.now(),
    }));
    const after = await ctx.db.get(args.groupId);
    await insertAuditLog(ctx, {
      actor,
      action: "admin_access_group.updated",
      entityType: "admin_access_group",
      entityId: args.groupId,
      before: auditSnapshot(group),
      after: after === null ? undefined : auditSnapshot(after),
    });
    return args.groupId;
  },
});

export const addGroupMember = mutation({
  args: {
    actorUserId: v.id("users"),
    groupId: v.id("adminAccessGroups"),
    adminUserId: v.id("users"),
  },
  returns: v.id("adminAccessGroupMembers"),
  handler: async (ctx, args) => {
    const actor = await requireAccessManager(ctx, args.actorUserId);
    const group = await ctx.db.get(args.groupId);
    assertAllowed(group !== null && group.status === "active", "Admin access group must be active.");
    await requireAdminTarget(ctx, args.adminUserId);
    const now = Date.now();
    const existing = await ctx.db
      .query("adminAccessGroupMembers")
      .withIndex("by_group_admin_user", (q) => q.eq("groupId", args.groupId).eq("adminUserId", args.adminUserId))
      .unique();
    let memberId: Id<"adminAccessGroupMembers">;
    if (existing === null) {
      memberId = await ctx.db.insert("adminAccessGroupMembers", {
        groupId: args.groupId,
        adminUserId: args.adminUserId,
        status: "active",
        addedBy: args.actorUserId,
        addedAt: now,
        updatedAt: now,
      });
    } else {
      memberId = existing._id;
      await ctx.db.patch(memberId, {
        status: "active",
        updatedAt: now,
      });
    }
    const after = await ctx.db.get(memberId);
    await insertAuditLog(ctx, {
      actor,
      action: "admin_access_group_member.added",
      entityType: "admin_access_group_member",
      entityId: memberId,
      before: existing === null ? undefined : auditSnapshot(existing),
      after: after === null ? undefined : auditSnapshot(after),
    });
    return memberId;
  },
});

export const deactivateGroupMember = mutation({
  args: {
    actorUserId: v.id("users"),
    memberId: v.id("adminAccessGroupMembers"),
    reason: v.optional(v.string()),
  },
  returns: v.id("adminAccessGroupMembers"),
  handler: async (ctx, args) => {
    const actor = await requireAccessManager(ctx, args.actorUserId);
    const member = await ctx.db.get(args.memberId);
    assertAllowed(member !== null, "Admin access group member was not found.");
    await ctx.db.patch(args.memberId, {
      status: "removed",
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.memberId);
    await insertAuditLog(ctx, {
      actor,
      action: "admin_access_group_member.removed",
      entityType: "admin_access_group_member",
      entityId: args.memberId,
      before: auditSnapshot(member),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });
    return args.memberId;
  },
});

export const assignGroupRole = mutation({
  args: {
    actorUserId: v.id("users"),
    groupId: v.id("adminAccessGroups"),
    roleKey: adminRoleKey,
    scopeType: adminScopeType,
    scopeId: v.optional(v.string()),
    scopeValue: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.id("adminAccessGroupRoleAssignments"),
  handler: async (ctx, args) => {
    const actor = await requireAccessManager(ctx, args.actorUserId);
    const group = await ctx.db.get(args.groupId);
    assertAllowed(group !== null && group.status === "active", "Admin access group must be active.");
    const scope = normalizeScope(args);
    const now = Date.now();
    const assignmentId = await ctx.db.insert("adminAccessGroupRoleAssignments", omitUndefinedValues({
      groupId: args.groupId,
      roleKey: args.roleKey,
      scopeType: args.scopeType,
      ...scope,
      status: "active",
      assignedBy: args.actorUserId,
      assignedAt: now,
      expiresAt: args.expiresAt,
      createdAt: now,
      updatedAt: now,
    }));
    const after = await ctx.db.get(assignmentId);
    await insertAuditLog(ctx, {
      actor,
      action: "admin_access_group_role_assignment.created",
      entityType: "admin_access_group_role_assignment",
      entityId: assignmentId,
      after: after === null ? undefined : auditSnapshot(after),
    });
    return assignmentId;
  },
});

export const deactivateGroupRole = mutation({
  args: {
    actorUserId: v.id("users"),
    assignmentId: v.id("adminAccessGroupRoleAssignments"),
    reason: v.optional(v.string()),
  },
  returns: v.id("adminAccessGroupRoleAssignments"),
  handler: async (ctx, args) => {
    const actor = await requireAccessManager(ctx, args.actorUserId);
    const assignment = await ctx.db.get(args.assignmentId);
    assertAllowed(assignment !== null, "Admin access group role assignment was not found.");
    await ctx.db.patch(args.assignmentId, {
      status: "revoked",
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.assignmentId);
    await insertAuditLog(ctx, {
      actor,
      action: "admin_access_group_role_assignment.revoked",
      entityType: "admin_access_group_role_assignment",
      entityId: args.assignmentId,
      before: auditSnapshot(assignment),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });
    return args.assignmentId;
  },
});

export const getEffectiveAccess = query({
  args: {
    actorUserId: v.id("users"),
    adminUserId: v.id("users"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (args.actorUserId !== args.adminUserId) {
      await requireAdminPermission(ctx, args.actorUserId, "adminAccess:manage", { scopeType: "global" } as AdminScopeTarget);
    } else {
      await requireActiveAdmin(ctx, args.actorUserId);
    }
    return summarizeAccess(await getEffectiveAdminAccess(ctx, args.adminUserId));
  },
});

export const previewPermission = query({
  args: {
    actorUserId: v.id("users"),
    adminUserId: v.id("users"),
    permission: adminPermissionKey,
    scopeType: adminScopeType,
    scopeId: v.optional(v.string()),
    scopeValue: v.optional(v.string()),
  },
  returns: v.object({
    allowed: v.boolean(),
    matchedGrantCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, args.actorUserId, "adminAccess:manage", { scopeType: "global" } as AdminScopeTarget);
    const scope = normalizeScope(args);
    const target: AdminScopeTarget =
      args.scopeType === "warehouse"
        ? adminScopeTarget({ warehouseId: scope.scopeId ?? scope.scopeValue })
        : args.scopeType === "region"
          ? adminScopeTarget({ region: scope.scopeValue ?? scope.scopeId })
          : args.scopeType === "district"
            ? adminScopeTarget({ district: scope.scopeValue ?? scope.scopeId })
            : args.scopeType === "destination_market"
              ? adminScopeTarget({ destinationMarket: scope.scopeValue ?? scope.scopeId })
              : {};
    const access = await getEffectiveAdminAccess(ctx, args.adminUserId);
    const allowed = adminAccessHasPermissionForScope(access, args.permission as AdminPermissionKey, target);
    return {
      allowed,
      matchedGrantCount: access.grants.filter((grant) =>
        grant.permissions.includes(args.permission as AdminPermissionKey),
      ).length,
    };
  },
});
