import {
  agentStatuses,
  approvalActionTypes,
  approvalStatuses,
  bulkLotStatuses,
  dealStatuses,
  farmerVerificationStatuses,
  listingStatuses,
  marketplaceRoles,
  paymentStatuses,
  produceGrades,
  registrationSources,
  transportPayers,
  transportRequestStatuses,
  userStatuses,
  type AgentStatus,
  type ApprovalActionType,
  type ApprovalStatus,
  type BulkLotStatus,
  type DealStatus,
  type FarmerVerificationStatus,
  type ListingStatus,
  type MarketplaceRole,
  type PaymentStatus,
  type ProduceGrade,
  type RegistrationSource,
  type TransportPayer,
  type TransportRequestStatus,
  type UserStatus
} from "@kuapa-dwaso/types";

function isOneOf<const Values extends readonly string[]>(
  values: Values,
  value: unknown
): value is Values[number] {
  return typeof value === "string" && values.includes(value);
}

export function isMarketplaceRole(value: unknown): value is MarketplaceRole {
  return isOneOf(marketplaceRoles, value);
}

export function isUserStatus(value: unknown): value is UserStatus {
  return isOneOf(userStatuses, value);
}

export function isAgentStatus(value: unknown): value is AgentStatus {
  return isOneOf(agentStatuses, value);
}

export function isFarmerVerificationStatus(value: unknown): value is FarmerVerificationStatus {
  return isOneOf(farmerVerificationStatuses, value);
}

export function isRegistrationSource(value: unknown): value is RegistrationSource {
  return isOneOf(registrationSources, value);
}

export function isProduceGrade(value: unknown): value is ProduceGrade {
  return isOneOf(produceGrades, value);
}

export function isListingStatus(value: unknown): value is ListingStatus {
  return isOneOf(listingStatuses, value);
}

export function isBulkLotStatus(value: unknown): value is BulkLotStatus {
  return isOneOf(bulkLotStatuses, value);
}

export function isDealStatus(value: unknown): value is DealStatus {
  return isOneOf(dealStatuses, value);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return isOneOf(paymentStatuses, value);
}

export function isApprovalActionType(value: unknown): value is ApprovalActionType {
  return isOneOf(approvalActionTypes, value);
}

export function isApprovalStatus(value: unknown): value is ApprovalStatus {
  return isOneOf(approvalStatuses, value);
}

export function isTransportRequestStatus(value: unknown): value is TransportRequestStatus {
  return isOneOf(transportRequestStatuses, value);
}

export function isTransportPayer(value: unknown): value is TransportPayer {
  return isOneOf(transportPayers, value);
}
