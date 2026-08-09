import {
  adminPermissionKeys,
  adminScopeMatchesTarget,
  adminRoleHasPermission,
  type AdminPermissionKey,
} from "@kuapa-dwaso/permissions";
import type {
  AdminRoleKey,
  AdminScopeType,
  MarketplaceRole,
} from "@kuapa-dwaso/types";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type Actor = Doc<"users"> & { role: MarketplaceRole };

export type AuditActor =
  | Pick<Actor, "_id" | "role">
  | {
      _id: "system";
      role: "system";
    };

export const systemAuditActor: AuditActor = {
  _id: "system",
  role: "system",
};

export type AdminScopeGrant = {
  roleKey: AdminRoleKey;
  permissions: readonly AdminPermissionKey[];
  scopeType: AdminScopeType;
  scopeId?: string;
  scopeValue?: string;
  source: "direct" | "group";
  assignmentId: string;
  groupId?: string;
  expiresAt?: number;
};

export type EffectiveAdminAccess = {
  actor: Actor;
  generatedAt: number;
  grants: AdminScopeGrant[];
  permissions: Set<AdminPermissionKey>;
  isPlatformOwner: boolean;
};

export type AdminScopeTarget = {
  warehouseId?: Id<"warehouses"> | string;
  region?: string;
  district?: string;
  destinationMarket?: string;
};

export function assertAllowed(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function cleanOptionalText(
  value: string | undefined,
): string | undefined {
  const cleaned = value?.trim();
  return cleaned === undefined || cleaned.length === 0 ? undefined : cleaned;
}

export function omitUndefinedValues<T extends Record<string, unknown>>(
  value: T,
): {
  [K in keyof T]: Exclude<T[K], undefined>;
} {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

export function adminScopeTarget(target: {
  warehouseId?: Id<"warehouses"> | string | undefined;
  region?: string | undefined;
  district?: string | undefined;
  destinationMarket?: string | undefined;
}): AdminScopeTarget {
  return omitUndefinedValues(target) as AdminScopeTarget;
}

export function auditSnapshot(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return value;
}

export function normalizeCodeSegment(
  value: string | number,
  maxLength: number,
): string {
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, maxLength);
}

export async function getActor(
  ctx: QueryCtx | MutationCtx,
  actorUserId: Id<"users">,
): Promise<Actor> {
  const actor = await ctx.db.get(actorUserId);
  assertAllowed(actor !== null, "Actor user was not found.");
  assertAllowed(
    actor.status !== "suspended" &&
      actor.status !== "rejected" &&
      actor.status !== "deactivated",
    "Actor user cannot perform marketplace actions.",
  );

  return actor;
}

function isActiveGrant(
  grant: {
    status: "active" | "revoked" | "expired";
    expiresAt?: number;
  },
  now: number,
): boolean {
  return (
    grant.status === "active" &&
    (grant.expiresAt === undefined || grant.expiresAt > now)
  );
}

function scopeGrantMatchesTarget(
  grant: AdminScopeGrant,
  target: AdminScopeTarget,
): boolean {
  return adminScopeMatchesTarget(grant, {
    ...(target.warehouseId === undefined
      ? {}
      : { warehouseId: String(target.warehouseId) }),
    ...(target.region === undefined ? {} : { region: target.region }),
    ...(target.district === undefined ? {} : { district: target.district }),
    ...(target.destinationMarket === undefined
      ? {}
      : { destinationMarket: target.destinationMarket }),
  });
}

function rolePermissions(roleKey: AdminRoleKey): readonly AdminPermissionKey[] {
  return adminPermissionKeys.filter((permission) =>
    adminRoleHasPermission(roleKey, permission),
  );
}

export async function requireActiveAdmin(
  ctx: QueryCtx | MutationCtx,
  actorUserId: Id<"users">,
): Promise<Actor> {
  const actor = await getActor(ctx, actorUserId);
  assertAllowed(actor.role === "admin", "Actor must be an admin user.");
  assertAllowed(actor.status === "active", "Admin user must be active.");
  assertAllowed(actor.emailVerified === true, "Admin email must be verified.");
  assertAllowed(
    actor.authMethods?.some(
      (method) => method === "email_password" || method === "google",
    ) === true,
    "Admin must use Firebase email/password or Google authentication.",
  );
  assertAllowed(
    actor.mfaRequirement !== undefined &&
      actor.mfaRequirement !== "not_required" &&
      actor.mfaStatus === "verified",
    "Privileged admin access requires verified MFA.",
  );
  return actor;
}

export async function getEffectiveAdminAccess(
  ctx: QueryCtx | MutationCtx,
  adminUserId: Id<"users">,
): Promise<EffectiveAdminAccess> {
  const actor = await requireActiveAdmin(ctx, adminUserId);
  const now = Date.now();
  const grants: AdminScopeGrant[] = [];
  const directAssignments = await ctx.db
    .query("adminRoleAssignments")
    .withIndex("by_admin_user_status", (q) =>
      q.eq("adminUserId", adminUserId).eq("status", "active"),
    )
    .collect();

  for (const assignment of directAssignments) {
    if (!isActiveGrant(assignment, now)) {
      continue;
    }
    grants.push(
      omitUndefinedValues({
        roleKey: assignment.roleKey,
        permissions: rolePermissions(assignment.roleKey),
        scopeType: assignment.scopeType,
        scopeId: assignment.scopeId,
        scopeValue: assignment.scopeValue,
        source: "direct",
        assignmentId: assignment._id,
        expiresAt: assignment.expiresAt,
      }),
    );
  }

  const activeMemberships = await ctx.db
    .query("adminAccessGroupMembers")
    .withIndex("by_admin_user_status", (q) =>
      q.eq("adminUserId", adminUserId).eq("status", "active"),
    )
    .collect();

  for (const membership of activeMemberships) {
    const group = await ctx.db.get(membership.groupId);
    if (group === null || group.status !== "active") {
      continue;
    }
    const groupAssignments = await ctx.db
      .query("adminAccessGroupRoleAssignments")
      .withIndex("by_group_status", (q) =>
        q.eq("groupId", membership.groupId).eq("status", "active"),
      )
      .collect();

    for (const assignment of groupAssignments) {
      if (!isActiveGrant(assignment, now)) {
        continue;
      }
      grants.push(
        omitUndefinedValues({
          roleKey: assignment.roleKey,
          permissions: rolePermissions(assignment.roleKey),
          scopeType: assignment.scopeType,
          scopeId: assignment.scopeId,
          scopeValue: assignment.scopeValue,
          source: "group",
          assignmentId: assignment._id,
          groupId: membership.groupId,
          expiresAt: assignment.expiresAt,
        }),
      );
    }
  }

  const permissions = new Set<AdminPermissionKey>();
  for (const grant of grants) {
    for (const permission of grant.permissions) {
      permissions.add(permission);
    }
  }

  return {
    actor,
    generatedAt: now,
    grants,
    permissions,
    isPlatformOwner: grants.some(
      (grant) =>
        grant.roleKey === "platform_owner" && grant.scopeType === "global",
    ),
  };
}

export function adminAccessHasPermissionForScope(
  access: EffectiveAdminAccess,
  permission: AdminPermissionKey,
  target: AdminScopeTarget,
): boolean {
  return access.grants.some(
    (grant) =>
      grant.permissions.includes(permission) &&
      scopeGrantMatchesTarget(grant, target),
  );
}

export async function requireAdminPermission(
  ctx: QueryCtx | MutationCtx,
  actorUserId: Id<"users">,
  permission: AdminPermissionKey,
  target: AdminScopeTarget,
): Promise<EffectiveAdminAccess> {
  const access = await getEffectiveAdminAccess(ctx, actorUserId);
  assertAllowed(
    adminAccessHasPermissionForScope(access, permission, target),
    "Admin access is not permitted for this scope.",
  );
  return access;
}

export async function warehouseScopeTarget(
  ctx: QueryCtx | MutationCtx,
  warehouseId: Id<"warehouses">,
): Promise<AdminScopeTarget> {
  const warehouse = await ctx.db.get(warehouseId);
  assertAllowed(warehouse !== null, "Warehouse was not found.");
  return adminScopeTarget({
    warehouseId,
    region: warehouse.region,
    district: warehouse.district,
  });
}

export async function inventoryScopeTarget(
  ctx: QueryCtx | MutationCtx,
  batch: Pick<Doc<"inventoryBatches">, "warehouseId">,
): Promise<AdminScopeTarget> {
  return await warehouseScopeTarget(ctx, batch.warehouseId);
}

export async function farmerScopeTarget(
  ctx: QueryCtx | MutationCtx,
  farmer: Pick<Doc<"farmers">, "preferredWarehouseId" | "region" | "community">,
): Promise<AdminScopeTarget> {
  if (farmer.preferredWarehouseId !== undefined) {
    return await warehouseScopeTarget(ctx, farmer.preferredWarehouseId);
  }
  return adminScopeTarget({
    region: farmer.region,
    district: farmer.community,
  });
}

export async function buyerOrderScopeTarget(
  ctx: QueryCtx | MutationCtx,
  order: Pick<
    Doc<"buyerOrders">,
    "destinationMarket" | "matchedInventoryBatchIds" | "marketDeliveryRunId"
  >,
): Promise<AdminScopeTarget> {
  if (order.marketDeliveryRunId !== undefined) {
    const run = await ctx.db.get(order.marketDeliveryRunId);
    if (run !== null) {
      return {
        ...(await warehouseScopeTarget(ctx, run.originWarehouseId)),
        destinationMarket: order.destinationMarket,
      };
    }
  }
  const firstBatchId = order.matchedInventoryBatchIds[0];
  if (firstBatchId !== undefined) {
    const batch = await ctx.db.get(firstBatchId);
    if (batch !== null) {
      return {
        ...(await warehouseScopeTarget(ctx, batch.warehouseId)),
        destinationMarket: order.destinationMarket,
      };
    }
  }
  return { destinationMarket: order.destinationMarket };
}

export async function saleScopeTarget(
  ctx: QueryCtx | MutationCtx,
  sale: Pick<Doc<"saleRecords">, "warehouseId">,
): Promise<AdminScopeTarget> {
  return await warehouseScopeTarget(ctx, sale.warehouseId);
}

export async function dispatchScopeTarget(
  ctx: QueryCtx | MutationCtx,
  dispatch: Pick<Doc<"dispatches">, "warehouseId" | "destination">,
): Promise<AdminScopeTarget> {
  return {
    ...(await warehouseScopeTarget(ctx, dispatch.warehouseId)),
    destinationMarket: dispatch.destination,
  };
}

export async function disputeScopeTarget(
  ctx: QueryCtx | MutationCtx,
  dispute: Pick<Doc<"disputes">, "warehouseId">,
): Promise<AdminScopeTarget> {
  if (dispute.warehouseId === undefined) {
    return {};
  }
  return await warehouseScopeTarget(ctx, dispute.warehouseId);
}

export async function requireWarehouseAgentAssignedToWarehouse(
  ctx: QueryCtx | MutationCtx,
  actorUserId: Id<"users">,
  warehouseId: Id<"warehouses">,
): Promise<Doc<"warehouseAgents">> {
  const warehouseAgent = await ctx.db
    .query("warehouseAgents")
    .withIndex("by_user", (q) => q.eq("userId", actorUserId))
    .unique();

  assertAllowed(
    warehouseAgent !== null,
    "Actor does not have a warehouse agent profile.",
  );
  assertAllowed(
    warehouseAgent.status === "approved",
    "Warehouse agent profile must be approved.",
  );
  assertAllowed(
    warehouseAgent.assignedWarehouseIds.some(
      (assignedWarehouseId) => assignedWarehouseId === warehouseId,
    ),
    "Warehouse agents can only operate assigned warehouses.",
  );

  return warehouseAgent;
}

export async function insertAuditLog(
  ctx: MutationCtx,
  args: {
    actor: AuditActor;
    action: string;
    entityType: string;
    entityId: string;
    before?: Record<string, unknown> | undefined;
    after?: Record<string, unknown> | undefined;
    metadata?: Record<string, unknown> | undefined;
  },
): Promise<void> {
  const auditLog: {
    actorId: string;
    actorRole: MarketplaceRole | "system";
    action: string;
    entityType: string;
    entityId: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdAt: number;
  } = {
    actorId: args.actor._id,
    actorRole: args.actor.role,
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId,
    createdAt: Date.now(),
  };

  if (args.before !== undefined) {
    auditLog.before = args.before;
  }
  if (args.after !== undefined) {
    auditLog.after = args.after;
  }
  if (args.metadata !== undefined) {
    auditLog.metadata = args.metadata;
  }

  await ctx.db.insert("auditLogs", auditLog);
}
