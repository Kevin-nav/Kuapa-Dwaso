import type { ApprovalActionType, MarketplaceRole } from "@kuapa-dwaso/types";

export const permissionKeys = [
  "agentApplications:manage",
  "farmerProfiles:create",
  "listings:create",
  "bulkLots:create",
  "offers:submit",
  "transport:manage",
  "auditLogs:view",
  "users:updateStatus"
] as const;
export type PermissionKey = (typeof permissionKeys)[number];

const permissionsByRole: Record<MarketplaceRole, ReadonlySet<PermissionKey>> = {
  farmer: new Set(),
  buyer: new Set(["offers:submit"]),
  transporter: new Set(["transport:manage"]),
  agent: new Set(["farmerProfiles:create", "listings:create", "bulkLots:create", "transport:manage"]),
  admin: new Set(permissionKeys)
};

export function principalHasAnyRole(roles: readonly MarketplaceRole[], requiredRoles: readonly MarketplaceRole[]): boolean {
  return requiredRoles.some((requiredRole) => roles.includes(requiredRole));
}

export function roleHasPermission(role: MarketplaceRole, permission: PermissionKey): boolean {
  return permissionsByRole[role].has(permission);
}

export function principalHasAnyPermission(
  roles: readonly MarketplaceRole[],
  requiredPermissions: readonly PermissionKey[]
): boolean {
  return roles.some((role) => requiredPermissions.some((permission) => roleHasPermission(role, permission)));
}

export function canManageAgentApplications(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "agentApplications:manage");
}

export function canCreateFarmerProfile(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "farmerProfiles:create");
}

export function canCompleteFarmerProfile(role: MarketplaceRole): boolean {
  return marketplaceOperatorRoles.has(role);
}

export function canAssignFarmerToAgent(role: MarketplaceRole): boolean {
  return role === "admin";
}

export function canVerifyFarmer(role: MarketplaceRole): boolean {
  return role === "admin";
}

export function canRejectFarmer(role: MarketplaceRole): boolean {
  return role === "admin";
}

export function canCreateListing(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "listings:create");
}

export function canCreateBulkLot(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "bulkLots:create");
}

export function canSubmitOffer(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "offers:submit");
}

export function canManageTransport(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "transport:manage");
}

export function canViewAuditLogs(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "auditLogs:view");
}

export function canViewAdminObservability(role: MarketplaceRole): boolean {
  return role === "admin";
}

export function canCreateDispute(role: MarketplaceRole): boolean {
  return (
    role === "farmer" ||
    role === "agent" ||
    role === "buyer" ||
    role === "transporter" ||
    role === "admin"
  );
}

export function canManageDisputes(role: MarketplaceRole): boolean {
  return role === "admin";
}

export function requiresFarmerApproval(
  actionType: ApprovalActionType,
): boolean {
  return (
    actionType === "ACCEPT_DEAL" ||
    actionType === "MARK_PICKED_UP" ||
    actionType === "CONFIRM_PAYMENT" ||
    actionType === "CHANGE_PRICE" ||
    actionType === "CHANGE_PHONE" ||
    actionType === "REMOVE_FROM_BULK_LOT"
  );
}
