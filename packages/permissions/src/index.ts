import type { ApprovalActionType, MarketplaceRole } from "@kuapa-dwaso/types";

const agentLikeRoles = new Set<MarketplaceRole>(["agent", "admin"]);
const marketplaceOperatorRoles = new Set<MarketplaceRole>(["agent", "admin"]);

export function canManageAgentApplications(role: MarketplaceRole): boolean {
  return role === "admin";
}

export function canCreateFarmerProfile(role: MarketplaceRole): boolean {
  return marketplaceOperatorRoles.has(role);
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
  return marketplaceOperatorRoles.has(role);
}

export function canCreateBulkLot(role: MarketplaceRole): boolean {
  return agentLikeRoles.has(role);
}

export function canSubmitOffer(role: MarketplaceRole): boolean {
  return role === "buyer" || role === "admin";
}

export function canManageTransport(role: MarketplaceRole): boolean {
  return role === "transporter" || role === "agent" || role === "admin";
}

export function canViewAuditLogs(role: MarketplaceRole): boolean {
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
