import type { ApprovalActionType, DealStatus, MarketplaceRole } from "@kuapa-dwaso/types";

const marketplaceOperatorRoles = new Set<MarketplaceRole>(["agent", "admin"]);

export const permissionKeys = [
  "agentApplications:manage",
  "farmerProfiles:create",
  "listings:create",
  "listings:update",
  "listings:updateStatus",
  "bulkLots:create",
  "bulkLots:update",
  "bulkLots:updateStatus",
  "buyerProfiles:manage",
  "offers:submit",
  "offers:review",
  "deals:negotiate",
  "deals:updateStatus",
  "transport:manage",
  "auditLogs:view",
  "users:updateStatus"
] as const;
export type PermissionKey = (typeof permissionKeys)[number];

const permissionsByRole: Record<MarketplaceRole, ReadonlySet<PermissionKey>> = {
  farmer: new Set(),
  buyer: new Set(["buyerProfiles:manage", "offers:submit", "deals:negotiate"]),
  transporter: new Set(["transport:manage"]),
  agent: new Set([
    "farmerProfiles:create",
    "listings:create",
    "listings:update",
    "listings:updateStatus",
    "bulkLots:create",
    "bulkLots:update",
    "bulkLots:updateStatus",
    "offers:review",
    "deals:negotiate",
    "deals:updateStatus",
    "transport:manage"
  ]),
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

export function canUpdateProduceListing(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "listings:update");
}

export function canUpdateProduceListingStatus(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "listings:updateStatus");
}

export function canCreateBulkLot(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "bulkLots:create");
}

export function canUpdateBulkLot(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "bulkLots:update");
}

export function canUpdateBulkLotStatus(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "bulkLots:updateStatus");
}

export function canManageBuyerProfile(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "buyerProfiles:manage");
}

export function canSubmitOffer(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "offers:submit");
}

export function canReviewBuyerOffer(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "offers:review");
}

export function canNegotiateDeal(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "deals:negotiate");
}

export function canUpdateDealStatus(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "deals:updateStatus");
}

export const allowedDealStatusTransitions: Readonly<Record<DealStatus, readonly DealStatus[]>> = {
  offer_received: ["countered", "accepted_pending_farmer_approval", "rejected", "cancelled", "disputed"],
  countered: ["countered", "accepted_pending_farmer_approval", "rejected", "cancelled", "disputed"],
  accepted_pending_farmer_approval: ["rejected", "cancelled", "disputed"],
  accepted: ["transport_pending", "cancelled", "disputed"],
  transport_pending: ["in_transit", "cancelled", "disputed"],
  in_transit: ["delivered", "disputed"],
  delivered: ["completed", "disputed"],
  completed: ["disputed"],
  rejected: [],
  cancelled: [],
  disputed: []
};

export const quantityHoldingDealStatuses: readonly DealStatus[] = [
  "offer_received",
  "countered",
  "accepted_pending_farmer_approval",
  "accepted",
  "transport_pending",
  "in_transit",
  "delivered",
  "completed",
  "disputed"
] as const;

export function canTransitionDealStatus(currentStatus: DealStatus, nextStatus: DealStatus): boolean {
  return allowedDealStatusTransitions[currentStatus].includes(nextStatus);
}

export function isQuantityHoldingDealStatus(status: DealStatus): boolean {
  return quantityHoldingDealStatuses.includes(status);
}

export function calculateBulkLotAvailableQuantity(
  totalQuantity: number,
  quantityHoldingDeals: readonly { quantity: number }[]
): number {
  const reservedQuantity = quantityHoldingDeals.reduce((total, deal) => total + deal.quantity, 0);
  return Math.max(0, totalQuantity - reservedQuantity);
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

export function requiresFarmerApproval(actionType: ApprovalActionType): boolean {
  return (
    actionType === "ACCEPT_DEAL" ||
    actionType === "MARK_PICKED_UP" ||
    actionType === "CONFIRM_PAYMENT" ||
    actionType === "CHANGE_PRICE" ||
    actionType === "CHANGE_PHONE" ||
    actionType === "REMOVE_FROM_BULK_LOT"
  );
}
