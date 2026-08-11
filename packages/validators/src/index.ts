import {
  buyerOrderPaymentStatuses,
  buyerOrderStatuses,
  buyerStatuses,
  buyerTypes,
  blogCategories,
  blogStatuses,
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
  paymentEventStatuses,
  paymentProviders,
  paymentTransactionStatuses,
  payoutLedgerStatuses,
  smsDeliveryStatuses,
  smsMessageKinds,
  smsProviderErrorClasses,
  smsProviders,
  smsTemplateKeys,
  mfaRequirements,
  mfaStatuses,
  onboardingStates,
  platformInvitationStatuses,
  platformInvitationTypes,
  invitationChannels,
  marketDeliveryRunStatuses,
  marketServiceScheduleStatuses,
  notificationPriorities,
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
  type BlogCategory,
  type BlogStatus,
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
  type PaymentEventStatus,
  type PaymentProvider,
  type PaymentTransactionStatus,
  type PayoutLedgerStatus,
  type SmsDeliveryStatus,
  type SmsMessageKind,
  type SmsProvider,
  type SmsProviderErrorClass,
  type SmsTemplateKey,
  type MfaRequirement,
  type MfaStatus,
  type OnboardingState,
  type PlatformInvitationStatus,
  type PlatformInvitationType,
  type InvitationChannel,
  type MarketDeliveryRunStatus,
  type MarketServiceScheduleStatus,
  type NotificationPriority,
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
import type { PushSubscriptionInput } from "@kuapa-dwaso/types";

function isOneOf<const Values extends readonly string[]>(
  values: Values,
  value: unknown,
): value is Values[number] {
  return typeof value === "string" && values.includes(value);
}

export function isMarketplaceRole(value: unknown): value is MarketplaceRole {
  return isOneOf(marketplaceRoles, value);
}

export function isBlogCategory(value: unknown): value is BlogCategory {
  return isOneOf(blogCategories, value);
}

export function isBlogStatus(value: unknown): value is BlogStatus {
  return isOneOf(blogStatuses, value);
}

export function normalizeBlogSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");
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

export function isTransporterStatus(
  value: unknown,
): value is TransporterStatus {
  return isOneOf(transporterStatuses, value);
}

export function isBuyerOrderStatus(value: unknown): value is BuyerOrderStatus {
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

export function isPaymentProvider(value: unknown): value is PaymentProvider {
  return isOneOf(paymentProviders, value);
}

export function isPaymentTransactionStatus(
  value: unknown,
): value is PaymentTransactionStatus {
  return isOneOf(paymentTransactionStatuses, value);
}

export function isPaymentEventStatus(
  value: unknown,
): value is PaymentEventStatus {
  return isOneOf(paymentEventStatuses, value);
}

export function isPayoutLedgerStatus(
  value: unknown,
): value is PayoutLedgerStatus {
  return isOneOf(payoutLedgerStatuses, value);
}

export function isSmsProvider(value: unknown): value is SmsProvider {
  return isOneOf(smsProviders, value);
}

export function isSmsMessageKind(value: unknown): value is SmsMessageKind {
  return isOneOf(smsMessageKinds, value);
}

export function isSmsDeliveryStatus(
  value: unknown,
): value is SmsDeliveryStatus {
  return isOneOf(smsDeliveryStatuses, value);
}

export function isSmsTemplateKey(value: unknown): value is SmsTemplateKey {
  return isOneOf(smsTemplateKeys, value);
}

export function isSmsProviderErrorClass(
  value: unknown,
): value is SmsProviderErrorClass {
  return isOneOf(smsProviderErrorClasses, value);
}

export function isE164PhoneNumber(value: unknown): value is string {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value.trim());
}

export function isGhanaE164PhoneNumber(value: unknown): value is string {
  return typeof value === "string" && /^\+233\d{9}$/.test(value.trim());
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

export function isInvitationChannel(
  value: unknown,
): value is InvitationChannel {
  return isOneOf(invitationChannels, value);
}

export function isMarketServiceScheduleStatus(
  value: unknown,
): value is MarketServiceScheduleStatus {
  return isOneOf(marketServiceScheduleStatuses, value);
}

export function isMarketDeliveryRunStatus(
  value: unknown,
): value is MarketDeliveryRunStatus {
  return isOneOf(marketDeliveryRunStatuses, value);
}

export function isNotificationPriority(
  value: unknown,
): value is NotificationPriority {
  return isOneOf(notificationPriorities, value);
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

export function isUploadAccessLevel(
  value: unknown,
): value is UploadAccessLevel {
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
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
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
    return (
      typeof input.targetEmail === "string" &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.targetEmail.trim())
    );
  }
  return (
    typeof input.targetPhoneNumber === "string" &&
    input.targetPhoneNumber.trim().length >= 8
  );
}

export function isValidFirebaseIdentityForPhoneLink(input: {
  phoneNumber?: unknown;
  phoneVerified?: unknown;
}): boolean {
  return (
    typeof input.phoneNumber === "string" &&
    input.phoneNumber.trim().length >= 8 &&
    input.phoneVerified === true
  );
}

export function isValidFirebaseIdentityForEmailLink(input: {
  email?: unknown;
  emailVerified?: unknown;
}): boolean {
  return (
    typeof input.email === "string" &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim()) &&
    input.emailVerified === true
  );
}

export const imageUploadContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function isAllowedUploadContentType(
  contentType: unknown,
): contentType is string {
  return (
    typeof contentType === "string" &&
    imageUploadContentTypes.includes(
      contentType as (typeof imageUploadContentTypes)[number],
    )
  );
}

export function isAllowedUploadSize(
  sizeBytes: unknown,
  maxSizeBytes = 8 * 1024 * 1024,
): sizeBytes is number {
  return (
    typeof sizeBytes === "number" &&
    Number.isInteger(sizeBytes) &&
    sizeBytes > 0 &&
    sizeBytes <= maxSizeBytes
  );
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
    (input.accessLevel === undefined ||
      isUploadAccessLevel(input.accessLevel)) &&
    (input.relatedEntityType === undefined ||
      isUploadRelatedEntityType(input.relatedEntityType))
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

const webPushHostPatterns = [
  (host: string) => host === "fcm.googleapis.com",
  (host: string) => host === "updates.push.services.mozilla.com" || host.endsWith(".push.services.mozilla.com"),
  (host: string) => host === "web.push.apple.com" || host.endsWith(".web.push.apple.com"),
  (host: string) => host.endsWith(".notify.windows.com"),
];

export function isApprovedWebPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "" && (url.port === "" || url.port === "443") && webPushHostPatterns.some((matches) => matches(url.hostname.toLowerCase()));
  } catch {
    return false;
  }
}

function isWebPushKey(value: unknown, minimumLength: number): value is string {
  return typeof value === "string" && value.length >= minimumLength && value.length <= 512 && /^[A-Za-z0-9_-]+$/.test(value);
}

export function isValidPushSubscriptionInput(value: unknown): value is PushSubscriptionInput {
  if (typeof value !== "object" || value === null) return false;
  const input = value as Partial<PushSubscriptionInput>;
  return (
    (input.surface === "app" || input.surface === "ops" || input.surface === "admin") &&
    isApprovedWebPushEndpoint(input.endpoint) &&
    (input.expirationTime === null || input.expirationTime === undefined || (typeof input.expirationTime === "number" && Number.isFinite(input.expirationTime))) &&
    typeof input.keys === "object" && input.keys !== null &&
    isWebPushKey(input.keys.p256dh, 40) && isWebPushKey(input.keys.auth, 8)
  );
}
