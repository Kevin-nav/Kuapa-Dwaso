export const marketplaceRoles = [
  "farmer",
  "agent",
  "buyer",
  "transporter",
  "admin",
] as const;
export type MarketplaceRole = (typeof marketplaceRoles)[number];

export type MarketplaceAudience = "public" | MarketplaceRole;

export type HealthStatus = "ok";

export type HealthCheckResponse = {
  service: "api";
  status: HealthStatus;
};

export const userStatuses = [
  "pending",
  "active",
  "suspended",
  "rejected",
  "deactivated",
] as const;
export type UserStatus = (typeof userStatuses)[number];

export const agentStatuses = [
  "pending",
  "approved",
  "rejected",
  "suspended",
] as const;
export type AgentStatus = (typeof agentStatuses)[number];

export const farmerVerificationStatuses = [
  "pending",
  "verified",
  "rejected",
] as const;
export type FarmerVerificationStatus =
  (typeof farmerVerificationStatuses)[number];

export const registrationSources = ["sms", "agent", "web"] as const;
export type RegistrationSource = (typeof registrationSources)[number];

export const produceGrades = ["A", "B", "C", "mixed"] as const;
export type ProduceGrade = (typeof produceGrades)[number];

export const listingStatuses = [
  "draft",
  "pending_verification",
  "active",
  "in_bulk_lot",
  "reserved",
  "sold",
  "expired",
  "disputed",
  "cancelled",
] as const;
export type ListingStatus = (typeof listingStatuses)[number];

export const bulkLotStatuses = [
  "forming",
  "active",
  "buyer_interest",
  "negotiation",
  "reserved",
  "transport_pending",
  "in_transit",
  "completed",
  "cancelled",
  "disputed",
] as const;
export type BulkLotStatus = (typeof bulkLotStatuses)[number];

export const dealStatuses = [
  "offer_received",
  "countered",
  "accepted_pending_farmer_approval",
  "accepted",
  "transport_pending",
  "in_transit",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
] as const;
export type DealStatus = (typeof dealStatuses)[number];

export const paymentStatuses = [
  "not_required",
  "pending",
  "deposit_paid",
  "fully_paid",
  "payment_on_delivery",
  "released",
  "failed",
  "refunded",
  "disputed",
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const approvalActionTypes = [
  "ACCEPT_DEAL",
  "MARK_PICKED_UP",
  "CONFIRM_PAYMENT",
  "CHANGE_PRICE",
  "CHANGE_PHONE",
  "REMOVE_FROM_BULK_LOT",
] as const;
export type ApprovalActionType = (typeof approvalActionTypes)[number];

export const approvalStatuses = [
  "pending",
  "approved",
  "rejected",
  "expired",
] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

export const transportRequestStatuses = [
  "requested",
  "matched",
  "accepted",
  "at_pickup",
  "picked_up",
  "in_transit",
  "delivered",
  "cancelled",
  "issue_reported",
] as const;
export type TransportRequestStatus = (typeof transportRequestStatuses)[number];

export const transportPayers = [
  "buyer_pays",
  "seller_pays",
  "shared",
  "included_in_price",
] as const;
export type TransportPayer = (typeof transportPayers)[number];

export const auditEntityTypes = [
  "user",
  "farmer",
  "agent",
  "buyer",
  "produce_listing",
  "bulk_lot",
  "deal",
  "transport_provider",
  "transport_request",
  "approval_request",
  "dispute",
  "notification",
  "app_setting",
] as const;
export type AuditEntityType = (typeof auditEntityTypes)[number];

export type AuditActor = {
  actorId: string;
  actorRole: MarketplaceRole | "system";
};

export type AuditEntity = {
  entityType: AuditEntityType;
  entityId: string;
};

export type AuditLogInput = AuditActor &
  AuditEntity & {
    action: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };

export type RequestingActorInput = {
  requestingUserId?: string;
  requestingActorRole?: MarketplaceRole;
};

export type VerifiedActorInput = {
  actorId: string;
  actorUserId?: string;
  actorRole: MarketplaceRole;
};

export const disputeStatuses = [
  "open",
  "under_review",
  "resolved",
  "cancelled",
] as const;
export type DisputeStatus = (typeof disputeStatuses)[number];

export type PlatformSummaryCounts = {
  farmers: number;
  agents: number;
  buyers: number;
  listings: number;
  bulkLots: number;
  deals: number;
  transportRequests: number;
  disputes: number;
  openDisputes: number;
};

export type HotspotRecord = {
  cropType: string;
  area: string;
  unit: string;
  supplyScore: number;
  demandScore: number;
  opportunityScore: number;
  activeListings: number;
  activeBulkLots: number;
  activeDeals: number;
  activeTransportRequests: number;
  explanation: string[];
};
