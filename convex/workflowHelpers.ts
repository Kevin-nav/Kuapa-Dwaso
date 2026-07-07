import {
  adminRoleHasPermission,
  type AdminPermissionKey,
} from "@kuapa-dwaso/permissions";
import type { AdminRoleKey, AdminScopeType, MarketplaceRole } from "@kuapa-dwaso/types";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type Actor = Doc<"users"> & { role: MarketplaceRole };

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

export function assertAllowed(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function cleanOptionalText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned === undefined || cleaned.length === 0 ? undefined : cleaned;
}

export function auditSnapshot(value: Record<string, unknown>): Record<string, unknown> {
  return value;
}

export function normalizeCodeSegment(value: string | number, maxLength: number): string {
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, maxLength);
}

export async function getActor(ctx: QueryCtx | MutationCtx, actorUserId: Id<"users">): Promise<Actor> {
  const actor = await ctx.db.get(actorUserId);
  assertAllowed(actor !== null, "Actor user was not found.");
  assertAllowed(
    actor.status !== "suspended" && actor.status !== "rejected" && actor.status !== "deactivated",
    "Actor user cannot perform marketplace actions."
  );

  return actor;
}

function isActiveGrant(grant: {
  status: "active" | "revoked" | "expired";
  expiresAt?: number;
}, now: number): boolean {
  return grant.status === "active" && (grant.expiresAt === undefined || grant.expiresAt > now);
}

function normalizeScopeValue(value: string | undefined): string | undefined {
  const cleaned = value?.trim().toLowerCase();
  return cleaned === undefined || cleaned.length === 0 ? undefined : cleaned;
}

function scopeGrantMatchesTarget(grant: AdminScopeGrant, target: AdminScopeTarget): boolean {
  if (grant.scopeType === "global") {
    return true;
  }
  if (grant.scopeType === "warehouse") {
    return target.warehouseId !== undefined && grant.scopeId === String(target.warehouseId);
  }
  if (grant.scopeType === "region") {
    return normalizeScopeValue(grant.scopeValue ?? grant.scopeId) === normalizeScopeValue(target.region);
  }
  if (grant.scopeType === "district") {
    return normalizeScopeValue(grant.scopeValue ?? grant.scopeId) === normalizeScopeValue(target.district);
  }
  if (grant.scopeType === "destination_market") {
    return normalizeScopeValue(grant.scopeValue ?? grant.scopeId) === normalizeScopeValue(target.destinationMarket);
  }
  return false;
}

function rolePermissions(roleKey: AdminRoleKey): readonly AdminPermissionKey[] {
  return [
    "adminAccess:manage",
    "warehouses:read",
    "warehouses:manage",
    "warehouseAgents:read",
    "warehouseAgents:manage",
    "farmers:read",
    "farmers:manage",
    "farmers:verify",
    "inventory:read",
    "inventory:manage",
    "inventory:adjust",
    "fees:read",
    "fees:manage",
    "buyers:read",
    "buyers:manage",
    "orders:read",
    "orders:manage",
    "sales:read",
    "sales:managePaymentStatus",
    "dispatches:read",
    "dispatches:manage",
    "transporters:read",
    "transporters:manage",
    "disputes:read",
    "disputes:manage",
    "auditLogs:read",
    "reports:read",
    "notifications:read",
    "notifications:send",
  ].filter((permission) => adminRoleHasPermission(roleKey, permission)) as AdminPermissionKey[];
}

export async function requireActiveAdmin(
  ctx: QueryCtx | MutationCtx,
  actorUserId: Id<"users">,
): Promise<Actor> {
  const actor = await getActor(ctx, actorUserId);
  assertAllowed(actor.role === "admin", "Actor must be an admin user.");
  assertAllowed(actor.status === "active", "Admin user must be active.");
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
    .withIndex("by_admin_user_status", (q) => q.eq("adminUserId", adminUserId).eq("status", "active"))
    .collect();

  for (const assignment of directAssignments) {
    if (!isActiveGrant(assignment, now)) {
      continue;
    }
    grants.push({
      roleKey: assignment.roleKey,
      permissions: rolePermissions(assignment.roleKey),
      scopeType: assignment.scopeType,
      scopeId: assignment.scopeId,
      scopeValue: assignment.scopeValue,
      source: "direct",
      assignmentId: assignment._id,
      expiresAt: assignment.expiresAt,
    });
  }

  const activeMemberships = await ctx.db
    .query("adminAccessGroupMembers")
    .withIndex("by_admin_user_status", (q) => q.eq("adminUserId", adminUserId).eq("status", "active"))
    .collect();

  for (const membership of activeMemberships) {
    const group = await ctx.db.get(membership.groupId);
    if (group === null || group.status !== "active") {
      continue;
    }
    const groupAssignments = await ctx.db
      .query("adminAccessGroupRoleAssignments")
      .withIndex("by_group_status", (q) => q.eq("groupId", membership.groupId).eq("status", "active"))
      .collect();

    for (const assignment of groupAssignments) {
      if (!isActiveGrant(assignment, now)) {
        continue;
      }
      grants.push({
        roleKey: assignment.roleKey,
        permissions: rolePermissions(assignment.roleKey),
        scopeType: assignment.scopeType,
        scopeId: assignment.scopeId,
        scopeValue: assignment.scopeValue,
        source: "group",
        assignmentId: assignment._id,
        groupId: membership.groupId,
        expiresAt: assignment.expiresAt,
      });
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
    isPlatformOwner: grants.some((grant) => grant.roleKey === "platform_owner" && grant.scopeType === "global"),
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
  return {
    warehouseId,
    region: warehouse.region,
    district: warehouse.district,
  };
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
  return {
    region: farmer.region,
    district: farmer.community,
  };
}

export async function buyerOrderScopeTarget(
  ctx: QueryCtx | MutationCtx,
  order: Pick<Doc<"buyerOrders">, "destinationMarket" | "matchedInventoryBatchIds">,
): Promise<AdminScopeTarget> {
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

  assertAllowed(warehouseAgent !== null, "Actor does not have a warehouse agent profile.");
  assertAllowed(warehouseAgent.status === "approved", "Warehouse agent profile must be approved.");
  assertAllowed(
    warehouseAgent.assignedWarehouseIds.some((assignedWarehouseId) => assignedWarehouseId === warehouseId),
    "Warehouse agents can only operate assigned warehouses.",
  );

  return warehouseAgent;
}

export async function insertAuditLog(
  ctx: MutationCtx,
  args: {
    actor: Actor;
    action: string;
    entityType: string;
    entityId: string;
    before?: Record<string, unknown> | undefined;
    after?: Record<string, unknown> | undefined;
    metadata?: Record<string, unknown> | undefined;
  }
): Promise<void> {
  const auditLog: {
    actorId: string;
    actorRole: MarketplaceRole;
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
    createdAt: Date.now()
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
