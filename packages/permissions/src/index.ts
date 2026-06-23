import type { ApprovalActionType, DealStatus, MarketplaceRole } from "@kuapa-dwaso/types";

const agentLikeRoles = new Set<MarketplaceRole>(["agent", "admin"]);
const marketplaceOperatorRoles = new Set<MarketplaceRole>(["agent", "admin"]);

export function canManageAgentApplications(role: MarketplaceRole): boolean {
  return role === "admin";
}

export function canCreateFarmerProfile(role: MarketplaceRole): boolean {
  return marketplaceOperatorRoles.has(role);
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

export function canManageBuyerProfile(role: MarketplaceRole): boolean {
  return role === "buyer" || role === "admin";
}

export function canReviewBuyerOffer(role: MarketplaceRole): boolean {
  return role === "agent" || role === "admin";
}

export function canNegotiateDeal(role: MarketplaceRole): boolean {
  return role === "buyer" || role === "agent" || role === "admin";
}

export function canUpdateDealStatus(role: MarketplaceRole): boolean {
  return role === "agent" || role === "admin";
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
