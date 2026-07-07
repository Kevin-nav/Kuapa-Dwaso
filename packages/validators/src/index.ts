import {
  buyerOrderPaymentStatuses,
  buyerOrderStatuses,
  buyerStatuses,
  buyerTypes,
  buyerVerificationStatuses,
  dispatchStatuses,
  disputeStatuses,
  farmerStatuses,
  farmerVerificationStatuses,
  feeCalculationTypes,
  feePayers,
  feeRuleStatuses,
  inventoryBatchStatuses,
  inventoryReservationStatuses,
  marketplaceRoles,
  notificationStatuses,
  mfaRequirements,
  mfaStatuses,
  onboardingStates,
  platformInvitationStatuses,
  platformInvitationTypes,
  invitationChannels,
  profileLinkStatuses,
  profileTypes,
  uploadAccessLevels,
  uploadAssetPurposes,
  uploadAssetStatuses,
  uploadRelatedEntityTypes,
  produceGrades,
  registrationSources,
  salePaymentStatuses,
  storageFeeLedgerStatuses,
  transporterStatuses,
  transporterVerificationStatuses,
  userStatuses,
  warehouseAgentStatuses,
  warehouseStatuses,
  type BuyerOrderPaymentStatus,
  type BuyerOrderStatus,
  type BuyerStatus,
  type BuyerType,
  type BuyerVerificationStatus,
  type DispatchStatus,
  type DisputeStatus,
  type FarmerStatus,
  type FarmerVerificationStatus,
  type FeeCalculationType,
  type FeePayer,
  type FeeRuleStatus,
  type InventoryBatchStatus,
  type InventoryReservationStatus,
  type MarketplaceRole,
  type NotificationStatus,
  type MfaRequirement,
  type MfaStatus,
  type OnboardingState,
  type PlatformInvitationStatus,
  type PlatformInvitationType,
  type InvitationChannel,
  type ProfileLinkStatus,
  type ProfileType,
  type UploadAccessLevel,
  type UploadAssetPurpose,
  type UploadAssetStatus,
  type UploadRelatedEntityType,
  type ProduceGrade,
  type RegistrationSource,
  type SalePaymentStatus,
  type StorageFeeLedgerStatus,
  type TransporterStatus,
  type TransporterVerificationStatus,
  type UserStatus,
  type WarehouseAgentStatus,
  type WarehouseStatus,
} from "@kuapa-dwaso/types";

function isOneOf<const Values extends readonly string[]>(
  values: Values,
  value: unknown,
): value is Values[number] {
  return typeof value === "string" && values.includes(value);
}

export function isMarketplaceRole(value: unknown): value is MarketplaceRole {
  return isOneOf(marketplaceRoles, value);
}

export function isUserStatus(value: unknown): value is UserStatus {
  return isOneOf(userStatuses, value);
}

export function isWarehouseStatus(value: unknown): value is WarehouseStatus {
  return isOneOf(warehouseStatuses, value);
}

export function isWarehouseAgentStatus(
  value: unknown,
): value is WarehouseAgentStatus {
  return isOneOf(warehouseAgentStatuses, value);
}

export function isFarmerVerificationStatus(
  value: unknown,
): value is FarmerVerificationStatus {
  return isOneOf(farmerVerificationStatuses, value);
}

export function isFarmerStatus(value: unknown): value is FarmerStatus {
  return isOneOf(farmerStatuses, value);
}

export function isRegistrationSource(
  value: unknown,
): value is RegistrationSource {
  return isOneOf(registrationSources, value);
}

export function isProduceGrade(value: unknown): value is ProduceGrade {
  return isOneOf(produceGrades, value);
}

export function isInventoryBatchStatus(
  value: unknown,
): value is InventoryBatchStatus {
  return isOneOf(inventoryBatchStatuses, value);
}

export function isInventoryReservationStatus(
  value: unknown,
): value is InventoryReservationStatus {
  return isOneOf(inventoryReservationStatuses, value);
}

export function isStorageFeeLedgerStatus(
  value: unknown,
): value is StorageFeeLedgerStatus {
  return isOneOf(storageFeeLedgerStatuses, value);
}

export function isBuyerType(value: unknown): value is BuyerType {
  return isOneOf(buyerTypes, value);
}

export function isBuyerVerificationStatus(
  value: unknown,
): value is BuyerVerificationStatus {
  return isOneOf(buyerVerificationStatuses, value);
}

export function isBuyerStatus(value: unknown): value is BuyerStatus {
  return isOneOf(buyerStatuses, value);
}

export function isTransporterVerificationStatus(
  value: unknown,
): value is TransporterVerificationStatus {
  return isOneOf(transporterVerificationStatuses, value);
}

export function isTransporterStatus(value: unknown): value is TransporterStatus {
  return isOneOf(transporterStatuses, value);
}

export function isBuyerOrderStatus(
  value: unknown,
): value is BuyerOrderStatus {
  return isOneOf(buyerOrderStatuses, value);
}

export function isBuyerOrderPaymentStatus(
  value: unknown,
): value is BuyerOrderPaymentStatus {
  return isOneOf(buyerOrderPaymentStatuses, value);
}

export function isSalePaymentStatus(
  value: unknown,
): value is SalePaymentStatus {
  return isOneOf(salePaymentStatuses, value);
}

export function isDispatchStatus(value: unknown): value is DispatchStatus {
  return isOneOf(dispatchStatuses, value);
}

export function isFeeRuleStatus(value: unknown): value is FeeRuleStatus {
  return isOneOf(feeRuleStatuses, value);
}

export function isFeeCalculationType(
  value: unknown,
): value is FeeCalculationType {
  return isOneOf(feeCalculationTypes, value);
}

export function isFeePayer(value: unknown): value is FeePayer {
  return isOneOf(feePayers, value);
}

export function isNotificationStatus(
  value: unknown,
): value is NotificationStatus {
  return isOneOf(notificationStatuses, value);
}

export function isDisputeStatus(value: unknown): value is DisputeStatus {
  return isOneOf(disputeStatuses, value);
}

export function isMfaRequirement(value: unknown): value is MfaRequirement {
  return isOneOf(mfaRequirements, value);
}

export function isMfaStatus(value: unknown): value is MfaStatus {
  return isOneOf(mfaStatuses, value);
}

export function isOnboardingState(value: unknown): value is OnboardingState {
  return isOneOf(onboardingStates, value);
}

export function isPlatformInvitationType(
  value: unknown,
): value is PlatformInvitationType {
  return isOneOf(platformInvitationTypes, value);
}

export function isInvitationChannel(value: unknown): value is InvitationChannel {
  return isOneOf(invitationChannels, value);
}

export function isPlatformInvitationStatus(
  value: unknown,
): value is PlatformInvitationStatus {
  return isOneOf(platformInvitationStatuses, value);
}

export function isProfileType(value: unknown): value is ProfileType {
  return isOneOf(profileTypes, value);
}

export function isProfileLinkStatus(
  value: unknown,
): value is ProfileLinkStatus {
  return isOneOf(profileLinkStatuses, value);
}

export function isUploadAssetPurpose(
  value: unknown,
): value is UploadAssetPurpose {
  return isOneOf(uploadAssetPurposes, value);
}

export function isUploadAssetStatus(
  value: unknown,
): value is UploadAssetStatus {
  return isOneOf(uploadAssetStatuses, value);
}

export function isUploadAccessLevel(value: unknown): value is UploadAccessLevel {
  return isOneOf(uploadAccessLevels, value);
}

export function isUploadRelatedEntityType(
  value: unknown,
): value is UploadRelatedEntityType {
  return isOneOf(uploadRelatedEntityTypes, value);
}

export function isPositiveQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isNonNegativeQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isPositiveMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isNonNegativeMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isPercentage(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function hasNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => hasNonEmptyText(item))
  );
}

export function isValidInviteTarget(input: {
  channel: InvitationChannel;
  targetEmail?: unknown;
  targetPhoneNumber?: unknown;
}): boolean {
  if (input.channel === "email") {
    return typeof input.targetEmail === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.targetEmail.trim());
  }
  return typeof input.targetPhoneNumber === "string" && input.targetPhoneNumber.trim().length >= 8;
}

export function isValidFirebaseIdentityForPhoneLink(input: {
  phoneNumber?: unknown;
  phoneVerified?: unknown;
}): boolean {
  return typeof input.phoneNumber === "string" && input.phoneNumber.trim().length >= 8 && input.phoneVerified === true;
}

export function isValidFirebaseIdentityForEmailLink(input: {
  email?: unknown;
  emailVerified?: unknown;
}): boolean {
  return typeof input.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim()) && input.emailVerified === true;
}

export const imageUploadContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function isAllowedUploadContentType(contentType: unknown): contentType is string {
  return typeof contentType === "string" && imageUploadContentTypes.includes(contentType as (typeof imageUploadContentTypes)[number]);
}

export function isAllowedUploadSize(sizeBytes: unknown, maxSizeBytes = 8 * 1024 * 1024): sizeBytes is number {
  return typeof sizeBytes === "number" && Number.isInteger(sizeBytes) && sizeBytes > 0 && sizeBytes <= maxSizeBytes;
}

export function isValidUploadPresignRequest(input: {
  purpose?: unknown;
  contentType?: unknown;
  sizeBytes?: unknown;
  accessLevel?: unknown;
  relatedEntityType?: unknown;
}): boolean {
  return (
    isUploadAssetPurpose(input.purpose) &&
    isAllowedUploadContentType(input.contentType) &&
    isAllowedUploadSize(input.sizeBytes) &&
    (input.accessLevel === undefined || isUploadAccessLevel(input.accessLevel)) &&
    (input.relatedEntityType === undefined || isUploadRelatedEntityType(input.relatedEntityType))
  );
}

export function isValidFeeRuleAmount(
  calculationType: FeeCalculationType,
  input: {
    amount?: unknown;
    percentage?: unknown;
    ratePerUnit?: unknown;
    ratePerUnitPerDay?: unknown;
  },
): boolean {
  switch (calculationType) {
    case "fixed_amount":
      return isNonNegativeMoney(input.amount);
    case "per_unit":
      return isNonNegativeMoney(input.ratePerUnit);
    case "per_unit_per_day":
      return isNonNegativeMoney(input.ratePerUnitPerDay);
    case "percentage_of_gross_sale":
    case "percentage_of_transport_cost":
      return isPercentage(input.percentage);
  }
}

export function isValidFeeRulePayer(
  calculationType: FeeCalculationType,
  payer: FeePayer,
): boolean {
  if (calculationType === "percentage_of_transport_cost") {
    return payer === "buyer" || payer === "farmer" || payer === "shared";
  }

  if (calculationType === "per_unit_per_day") {
    return payer === "farmer" || payer === "platform";
  }

  return true;
}
