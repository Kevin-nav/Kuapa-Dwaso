export const marketplaceRoles = [
  "farmer",
  "warehouse_agent",
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

export const adminRoleKeys = [
  "platform_owner",
  "operations_manager",
  "warehouse_manager",
  "finance_manager",
  "support_officer",
  "auditor",
  "analyst",
  "admin_viewer",
] as const;
export type AdminRoleKey = (typeof adminRoleKeys)[number];

export const adminScopeTypes = [
  "global",
  "region",
  "district",
  "warehouse",
  "destination_market",
] as const;
export type AdminScopeType = (typeof adminScopeTypes)[number];

export const adminRoleAssignmentStatuses = [
  "active",
  "revoked",
  "expired",
] as const;
export type AdminRoleAssignmentStatus =
  (typeof adminRoleAssignmentStatuses)[number];

export const adminAccessGroupStatuses = [
  "active",
  "inactive",
  "deactivated",
] as const;
export type AdminAccessGroupStatus =
  (typeof adminAccessGroupStatuses)[number];

export const adminAccessGroupMemberStatuses = [
  "active",
  "inactive",
  "removed",
] as const;
export type AdminAccessGroupMemberStatus =
  (typeof adminAccessGroupMemberStatuses)[number];

export type AdminScopeDescriptor = {
  scopeType: AdminScopeType;
  scopeId?: string;
  scopeValue?: string;
};

export type AdminRoleAssignment = TimestampFields &
  AdminScopeDescriptor & {
    id: string;
    adminUserId: string;
    roleKey: AdminRoleKey;
    status: AdminRoleAssignmentStatus;
    assignedBy: string;
    assignedAt: number;
    expiresAt?: number;
  };

export type AdminAccessGroup = TimestampFields & {
  id: string;
  name: string;
  description?: string;
  status: AdminAccessGroupStatus;
  createdBy: string;
};

export type AdminAccessGroupMember = AdminScopeDescriptor & {
  id: string;
  groupId: string;
  adminUserId: string;
  status: AdminAccessGroupMemberStatus;
  addedBy: string;
  addedAt: number;
  updatedAt: number;
};

export type AdminAccessGroupRoleAssignment = TimestampFields &
  AdminScopeDescriptor & {
    id: string;
    groupId: string;
    roleKey: AdminRoleKey;
    status: AdminRoleAssignmentStatus;
    assignedBy: string;
    assignedAt: number;
    expiresAt?: number;
  };

export type EffectiveAdminRoleGrant = AdminScopeDescriptor & {
  roleKey: AdminRoleKey;
  source: "direct" | "group";
  assignmentId: string;
  groupId?: string;
  expiresAt?: number;
};

export type EffectiveAdminAccessSummary = {
  adminUserId: string;
  generatedAt: number;
  isPlatformOwner: boolean;
  roles: EffectiveAdminRoleGrant[];
  permissions: string[];
};

export const warehouseStatuses = [
  "active",
  "inactive",
  "maintenance",
  "closed",
] as const;
export type WarehouseStatus = (typeof warehouseStatuses)[number];

export const warehouseAgentStatuses = [
  "pending",
  "approved",
  "rejected",
  "suspended",
  "deactivated",
] as const;
export type WarehouseAgentStatus = (typeof warehouseAgentStatuses)[number];

export const farmerVerificationStatuses = [
  "pending",
  "verified",
  "rejected",
] as const;
export type FarmerVerificationStatus =
  (typeof farmerVerificationStatuses)[number];

export const farmerStatuses = [
  "active",
  "suspended",
  "deactivated",
] as const;
export type FarmerStatus = (typeof farmerStatuses)[number];

export const registrationSources = [
  "self_app",
  "agent_assisted",
  "admin",
] as const;
export type RegistrationSource = (typeof registrationSources)[number];

export const produceGrades = ["A", "B", "C", "mixed", "ungraded"] as const;
export type ProduceGrade = (typeof produceGrades)[number];

export const inventoryBatchStatuses = [
  "received",
  "verified",
  "available",
  "partially_reserved",
  "reserved",
  "partially_sold",
  "sold",
  "prepared_for_dispatch",
  "dispatched",
  "withdrawn",
  "expired",
  "spoiled",
  "disputed",
] as const;
export type InventoryBatchStatus = (typeof inventoryBatchStatuses)[number];

export const inventoryReservationStatuses = [
  "active",
  "partially_released",
  "fulfilled",
  "released",
  "expired",
  "cancelled",
] as const;
export type InventoryReservationStatus =
  (typeof inventoryReservationStatuses)[number];

export const storageFeeLedgerStatuses = [
  "accrued",
  "partially_deducted_from_sale",
  "deducted_from_sale",
  "paid",
  "waived",
  "disputed",
] as const;
export type StorageFeeLedgerStatus =
  (typeof storageFeeLedgerStatuses)[number];

export const buyerTypes = [
  "market_trader",
  "retailer",
  "restaurant",
  "hotel",
  "school",
  "processor",
  "exporter",
  "institution",
  "other",
] as const;
export type BuyerType = (typeof buyerTypes)[number];

export const buyerVerificationStatuses = [
  "pending",
  "verified",
  "rejected",
] as const;
export type BuyerVerificationStatus =
  (typeof buyerVerificationStatuses)[number];

export const enhancedVerificationStatuses = [
  "not_required",
  "required",
  "pending_review",
  "verified",
  "changes_requested",
  "rejected",
] as const;
export type EnhancedVerificationStatus =
  (typeof enhancedVerificationStatuses)[number];

export const buyerStatuses = [
  "active",
  "suspended",
  "deactivated",
] as const;
export type BuyerStatus = (typeof buyerStatuses)[number];

export const transporterVerificationStatuses = [
  "pending",
  "verified",
  "rejected",
] as const;
export type TransporterVerificationStatus =
  (typeof transporterVerificationStatuses)[number];

export const transporterStatuses = [
  "active",
  "suspended",
  "deactivated",
] as const;
export type TransporterStatus = (typeof transporterStatuses)[number];

export const buyerOrderStatuses = [
  "draft",
  "submitted",
  "awaiting_payment",
  "confirmed",
  "matched_to_inventory",
  "reserved",
  "preparing",
  "ready_for_dispatch",
  "in_transit",
  "delivered",
  "completed",
  "cancelled",
  "unfulfilled",
  "disputed",
] as const;
export type BuyerOrderStatus = (typeof buyerOrderStatuses)[number];

export const buyerOrderPaymentStatuses = [
  "not_required",
  "awaiting_payment",
  "deposit_paid",
  "fully_paid",
  "payment_on_delivery",
  "failed",
  "refunded",
  "disputed",
] as const;
export type BuyerOrderPaymentStatus =
  (typeof buyerOrderPaymentStatuses)[number];

export const salePaymentStatuses = [
  "pending",
  "part_paid",
  "paid",
  "withheld",
  "disputed",
] as const;
export type SalePaymentStatus = (typeof salePaymentStatuses)[number];

export const dispatchStatuses = [
  "planned",
  "loading",
  "departed",
  "in_transit",
  "arrived",
  "delivered",
  "closed",
  "cancelled",
  "issue_reported",
] as const;
export type DispatchStatus = (typeof dispatchStatuses)[number];

export const marketServiceScheduleStatuses = ["draft", "active", "paused", "retired"] as const;
export type MarketServiceScheduleStatus = (typeof marketServiceScheduleStatuses)[number];

export const marketDeliveryRunStatuses = [
  "draft",
  "accepting_orders",
  "cutoff_reached",
  "ready",
  "confirmed",
  "cancelled",
  "dispatched",
  "completed",
] as const;
export type MarketDeliveryRunStatus = (typeof marketDeliveryRunStatuses)[number];

export const notificationPriorities = ["low", "normal", "high", "urgent"] as const;
export type NotificationPriority = (typeof notificationPriorities)[number];

export const feeRuleStatuses = ["draft", "active", "inactive", "archived"] as const;
export type FeeRuleStatus = (typeof feeRuleStatuses)[number];

export const feeCalculationTypes = [
  "fixed_amount",
  "per_unit",
  "per_unit_per_day",
  "percentage_of_gross_sale",
  "percentage_of_transport_cost",
] as const;
export type FeeCalculationType = (typeof feeCalculationTypes)[number];

export const feePayers = [
  "farmer",
  "buyer",
  "platform",
  "shared",
  "included_in_price",
] as const;
export type FeePayer = (typeof feePayers)[number];

export const notificationStatuses = [
  "pending",
  "queued",
  "sent",
  "read",
  "failed",
  "archived",
] as const;
export type NotificationStatus = (typeof notificationStatuses)[number];

export const smsProviders = ["mock", "arkesel"] as const;
export type SmsProvider = (typeof smsProviders)[number];

export const smsMessageKinds = [
  "notification",
  "otp",
  "transactional",
  "farmer_receipt",
  "storage_fee_reminder",
  "reservation_alert",
  "sale_payment_update",
  "payout_update",
  "buyer_order_update",
  "buyer_reservation_update",
  "buyer_cancellation_update",
  "dispatch_assignment",
  "dispatch_status_update",
  "market_run_update",
  "dispute_update",
  "promotional",
] as const;
export type SmsMessageKind = (typeof smsMessageKinds)[number];

export const smsDeliveryStatuses = [
  "pending",
  "queued",
  "sent",
  "delivered",
  "failed",
  "expired",
  "rejected",
] as const;
export type SmsDeliveryStatus = (typeof smsDeliveryStatuses)[number];

export const paymentProviders = ["mock", "paystack"] as const;
export type PaymentProvider = (typeof paymentProviders)[number];

export const paymentTransactionStatuses = [
  "initialized",
  "pending",
  "processing",
  "successful",
  "failed",
  "abandoned",
  "reversed",
  "refunded",
  "manual_review",
] as const;
export type PaymentTransactionStatus =
  (typeof paymentTransactionStatuses)[number];

export const paymentEventStatuses = [
  "received",
  "processed",
  "ignored",
  "failed",
] as const;
export type PaymentEventStatus = (typeof paymentEventStatuses)[number];

export const payoutLedgerStatuses = [
  "pending",
  "approved",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "manual_review",
] as const;
export type PayoutLedgerStatus = (typeof payoutLedgerStatuses)[number];

export const smsProviderErrorClasses = ["retryable", "nonretryable"] as const;
export type SmsProviderErrorClass = (typeof smsProviderErrorClasses)[number];

export const disputeStatuses = [
  "open",
  "under_review",
  "resolved",
  "cancelled",
] as const;
export type DisputeStatus = (typeof disputeStatuses)[number];

export const disputeEntityTypes = [
  "farmer",
  "warehouse",
  "warehouse_agent",
  "inventory_batch",
  "storage_receipt",
  "buyer_order",
  "market_service_schedule",
  "market_delivery_run",
  "sale_record",
  "dispatch",
  "storage_fee_ledger",
  "buyer",
  "notification",
  "app_setting",
  "admin_role_assignment",
  "admin_access_group",
  "admin_access_group_member",
  "admin_access_group_role_assignment",
] as const;
export type DisputeEntityType = (typeof disputeEntityTypes)[number];

export const auditEntityTypes = [
  "user",
  "farmer",
  "warehouse_agent",
  "transporter_profile",
  "platform_invitation",
  "profile_link",
  "upload_asset",
  "warehouse",
  "inventory_batch",
  "storage_receipt",
  "inventory_reservation",
  "storage_fee_ledger",
  "storage_rate_rule",
  "fee_rule",
  "buyer",
  "buyer_order",
  "buyer_order_charge",
  "sale_record",
  "sale_deduction",
  "dispatch",
  "market_service_schedule",
  "market_delivery_run",
  "dispute",
  "notification",
  "payment_transaction",
  "payment_webhook_event",
  "payout_ledger",
  "app_setting",
] as const;
export type AuditEntityType = (typeof auditEntityTypes)[number];

export type TimestampFields = {
  createdAt: number;
  updatedAt: number;
};

export type Warehouse = TimestampFields & {
  id: string;
  code: string;
  name: string;
  community: string;
  district?: string;
  region?: string;
  servedCommunities: string[];
  supportedCrops: string[];
  storageCapacity?: number;
  capacityUnit?: string;
  assignedWarehouseAgentIds: string[];
  destinationMarketsServed: string[];
  operatingDays: string[];
  dispatchDays?: string[];
  status: WarehouseStatus;
};

export type WarehouseAgent = TimestampFields & {
  id: string;
  userId: string;
  agentCode: string;
  fullName: string;
  phoneNumber: string;
  assignedWarehouseIds: string[];
  status: WarehouseAgentStatus;
  approvedBy?: string;
  approvedAt?: number;
};

export type Farmer = TimestampFields & {
  id: string;
  userId?: string;
  farmerCode: string;
  fullName: string;
  phoneNumber: string;
  community: string;
  region?: string;
  householdPhoneOwnerName?: string;
  preferredWarehouseId?: string;
  registrationSource: RegistrationSource;
  verificationStatus: FarmerVerificationStatus;
  status: FarmerStatus;
};

export type FeeRuleScope = {
  warehouseId?: string;
  cropType?: string;
  unit?: string;
  grade?: ProduceGrade;
  destinationMarket?: string;
};

export type FeeRuleSnapshot = {
  feeRuleId?: string;
  feeRuleVersion?: number;
  label: string;
  calculationType: FeeCalculationType;
  payer: FeePayer;
  amount?: number;
  percentage?: number;
  ratePerUnit?: number;
  ratePerUnitPerDay?: number;
  currency: string;
  scope?: FeeRuleScope;
  snapshottedAt: number;
};

export type StorageRateRule = TimestampFields & {
  id: string;
  warehouseId?: string;
  cropType?: string;
  unit: string;
  grade?: ProduceGrade;
  ratePerUnitPerDay: number;
  currency: string;
  status: FeeRuleStatus;
  effectiveFrom: number;
  effectiveTo?: number;
  version: number;
};

export type FeeRule = TimestampFields & {
  id: string;
  code: string;
  label: string;
  scope: FeeRuleScope;
  calculationType: FeeCalculationType;
  payer: FeePayer;
  amount?: number;
  percentage?: number;
  ratePerUnit?: number;
  ratePerUnitPerDay?: number;
  currency: string;
  status: FeeRuleStatus;
  effectiveFrom: number;
  effectiveTo?: number;
  version: number;
};

export type InventoryBatch = TimestampFields & {
  id: string;
  receiptCode: string;
  farmerId: string;
  warehouseId: string;
  receivedByWarehouseAgentId: string;
  cropType: string;
  variety?: string;
  quantityReceived: number;
  quantityAvailable: number;
  unit: string;
  grade: ProduceGrade;
  photos: string[];
  conditionNotes?: string;
  receivedAt: number;
  expectedShelfLifeDays?: number;
  sellByDate?: number;
  storageRateSnapshot: FeeRuleSnapshot;
  storageFeeAccrued: number;
  lastFeeCalculatedAt: number;
  askingPricePerUnit?: number;
  minimumPricePerUnit?: number;
  status: InventoryBatchStatus;
};

export type InventoryReservation = TimestampFields & {
  id: string;
  buyerOrderId: string;
  inventoryBatchId: string;
  warehouseId: string;
  farmerId: string;
  quantityReserved: number;
  quantityReleased: number;
  quantityFulfilled: number;
  unit: string;
  expiresAt?: number;
  status: InventoryReservationStatus;
};

export type StorageFeeLedger = {
  id: string;
  inventoryBatchId: string;
  farmerId: string;
  warehouseId: string;
  feeDate: number;
  quantityCharged: number;
  unit: string;
  appliedRuleSnapshot: FeeRuleSnapshot;
  amount: number;
  amountDeducted?: number;
  deductedSaleRecordIds?: string[];
  status: StorageFeeLedgerStatus;
  createdAt: number;
};

export type Buyer = TimestampFields & {
  id: string;
  userId?: string;
  fullName: string;
  displayName?: string;
  phoneNumber: string;
  buyerType: BuyerType;
  organizationName?: string;
  email?: string;
  organizationRegistrationNumber?: string;
  contactRole?: string;
  registeredAddress?: string;
  destinationMarket?: string;
  verificationStatus: BuyerVerificationStatus;
  enhancedVerificationStatus: EnhancedVerificationStatus;
  enhancedVerificationSubmittedAt?: number;
  enhancedVerificationReviewedAt?: number;
  enhancedVerificationReviewedByUserId?: string;
  enhancedVerificationReason?: string;
  institutionWelcomeEmailSentAt?: number;
  status: BuyerStatus;
};

export type TransporterProfile = TimestampFields & {
  id: string;
  userId?: string;
  fullName: string;
  phoneNumber: string;
  vehicleType: string;
  vehicleCapacity?: number;
  vehicleCapacityUnit?: string;
  baseLocation: string;
  routesServed: string[];
  destinationsServed: string[];
  verificationStatus: TransporterVerificationStatus;
  status: TransporterStatus;
  rating?: number;
};

export type BuyerOrder = TimestampFields & {
  id: string;
  buyerId: string;
  destinationMarket: string;
  cropType: string;
  requestedQuantity: number;
  unit: string;
  preferredGrade?: ProduceGrade;
  requestedDeliveryDate?: number;
  marketDeliveryRunId?: string;
  deliveryDateSnapshot?: number;
  orderCutoffSnapshot?: number;
  expectedArrivalStartSnapshot?: number;
  expectedArrivalEndSnapshot?: number;
  fulfilmentInstructionsSnapshot?: string;
  paymentDeadline?: number;
  authorizedAfterCutoffByUserId?: string;
  afterCutoffExceptionReason?: string;
  maxPricePerUnit?: number;
  matchedInventoryBatchIds: string[];
  subtotalAmount?: number;
  transportFee?: number;
  serviceFee?: number;
  totalAmount?: number;
  paymentStatus: BuyerOrderPaymentStatus;
  status: BuyerOrderStatus;
};

export type BuyerOrderCharge = {
  id: string;
  buyerOrderId: string;
  label: string;
  amount: number;
  appliedRuleSnapshot?: FeeRuleSnapshot;
  createdAt: number;
};

export type PaymentTransaction = TimestampFields & {
  id: string;
  buyerOrderId: string;
  buyerId: string;
  provider: PaymentProvider;
  providerReference: string;
  providerAccessCode?: string;
  authorizationUrl?: string;
  amount: number;
  currency: string;
  status: PaymentTransactionStatus;
  idempotencyKey: string;
  correlationId?: string;
  initializedByUserId: string;
  verifiedAt?: number;
  paidAt?: number;
  failedAt?: number;
  providerStatus?: string;
  providerMessage?: string;
  rawProviderData?: Record<string, unknown>;
};

export type SaleRecord = TimestampFields & {
  id: string;
  buyerOrderId: string;
  inventoryBatchId: string;
  farmerId: string;
  warehouseId: string;
  quantitySold: number;
  unit: string;
  pricePerUnit: number;
  grossAmount: number;
  storageFeeDeducted: number;
  handlingFeeDeducted?: number;
  commissionDeducted?: number;
  transportFeeDeducted?: number;
  adjustmentAmount?: number;
  netAmountDueToFarmer: number;
  paymentStatus: SalePaymentStatus;
};

export type PayoutLedgerEntry = TimestampFields & {
  id: string;
  saleRecordId: string;
  farmerId: string;
  buyerOrderId: string;
  amount: number;
  currency: string;
  status: PayoutLedgerStatus;
  sourcePaymentTransactionId?: string;
  approvedByUserId?: string;
  processedAt?: number;
  paidAt?: number;
  failedAt?: number;
  provider?: PaymentProvider;
  providerReference?: string;
  failureReason?: string;
};

export type SaleDeduction = {
  id: string;
  saleRecordId: string;
  farmerId: string;
  inventoryBatchId: string;
  storageFeeLedgerId?: string;
  label: string;
  amount: number;
  appliedRuleSnapshot?: FeeRuleSnapshot;
  createdAt: number;
};

export type Dispatch = TimestampFields & {
  marketDeliveryRunId?: string;
  id: string;
  warehouseId: string;
  destination: string;
  transporterId?: string;
  driverName?: string;
  driverPhoneNumber?: string;
  vehicleType?: string;
  vehicleCapacity?: number;
  vehicleCapacityUnit?: string;
  buyerOrderIds: string[];
  inventoryBatchIds: string[];
  saleRecordIds?: string[];
  reservationIds?: string[];
  totalQuantity: number;
  unit: string;
  plannedDepartureAt?: number;
  departedAt?: number;
  expectedArrivalAt?: number;
  arrivedAt?: number;
  transportCost?: number;
  transportPayer: FeePayer;
  status: DispatchStatus;
};

export type MarketServiceSchedule = TimestampFields & {
  id: string;
  originWarehouseId: string;
  destinationName: string;
  destinationInstructions: string;
  timezone: string;
  deliveryWeekday: number;
  cutoffDaysBefore: number;
  cutoffLocalTime: string;
  arrivalStartLocalTime: string;
  arrivalEndLocalTime: string;
  minimumLoadQuantity?: number;
  minimumLoadUnit?: string;
  capacityQuantity?: number;
  capacityUnit?: string;
  status: MarketServiceScheduleStatus;
  effectiveDate: string;
  endDate?: string;
  createdByUserId: string;
  updatedByUserId: string;
};

export type MarketDeliveryRun = TimestampFields & {
  id: string;
  scheduleId: string;
  originWarehouseId: string;
  destinationName: string;
  destinationInstructions: string;
  timezone: string;
  deliveryDate: string;
  deliveryDateAt: number;
  orderCutoffAt: number;
  expectedArrivalStartAt: number;
  expectedArrivalEndAt: number;
  status: MarketDeliveryRunStatus;
  minimumLoadQuantity?: number;
  minimumLoadUnit?: string;
  capacityQuantity?: number;
  capacityUnit?: string;
  buyerOrderIds: string[];
  dispatchIds: string[];
  cancellationReason?: string;
  postponementReason?: string;
  postponedFromRunId?: string;
  createdByUserId: string;
  updatedByUserId: string;
};

export type Notification = {
  id: string;
  recipientId?: string;
  recipientUserId?: string;
  recipientRole: MarketplaceRole;
  channel: "sms" | "in_app" | "email";
  title: string;
  message: string;
  messageKind?: SmsMessageKind;
  templateKey?: SmsTemplateKey;
  templateData?: Record<string, string | number | boolean | undefined>;
  relatedEntityType?: AuditEntityType;
  relatedEntityId?: string;
  marketDeliveryRunId?: string;
  actionUrl?: string;
  actionRequired?: boolean;
  priority?: NotificationPriority;
  dueAt?: number;
  acknowledgedAt?: number;
  acknowledgedByUserId?: string;
  deduplicationKey?: string;
  escalationLevel?: number;
  expiresAt?: number;
  status: NotificationStatus;
  createdAt: number;
  updatedAt?: number;
  sentAt?: number;
  readAt?: number;
};

export const smsTemplateKeys = [
  "farmer_receipt",
  "storage_fee_reminder",
  "reservation_alert",
  "sale_payment_update",
  "payout_update",
  "buyer_order_update",
  "buyer_reservation_update",
  "buyer_cancellation_update",
  "dispatch_assignment",
  "dispatch_status_update",
  "dispute_update",
  "generic_notification",
] as const;
export type SmsTemplateKey = (typeof smsTemplateKeys)[number];

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

export type PlatformSummaryCounts = {
  farmers: number;
  warehouseAgents: number;
  warehouses: number;
  buyers: number;
  transporterProfiles: number;
  inventoryBatches: number;
  availableInventoryBatches: number;
  buyerOrders: number;
  saleRecords: number;
  soldQuantity: number;
  grossSalesAmount: number;
  netFarmerAmountDue: number;
  salePaymentStatusCounts: Record<SalePaymentStatus, number>;
  dispatches: number;
  dispatchStatusCounts: Record<DispatchStatus, number>;
  inTransitDispatches: number;
  deliveredDispatches: number;
  issueDispatches: number;
  disputes: number;
  openDisputes: number;
};

export type WarehouseInventoryIntelligenceRecord = {
  warehouseId: string;
  warehouseName: string;
  cropType: string;
  unit: string;
  grade?: ProduceGrade;
  quantityAvailable: number;
  quantityReserved: number;
  quantitySold: number;
  quantitySpoiled: number;
  averageStorageDays: number;
  destinationMarketsServed: string[];
  explanation: string[];
};

export type BuyerProfileInput = {
  userId?: string;
  fullName: string;
  displayName?: string;
  phoneNumber: string;
  buyerType: BuyerType;
  organizationName?: string;
  email?: string;
  organizationRegistrationNumber?: string;
  contactRole?: string;
  registeredAddress?: string;
  destinationMarket?: string;
};

export type BuyerWarehouseInventorySearchFilters = {
  cropType?: string;
  warehouseId?: string;
  destinationMarket?: string;
  minimumQuantity?: number;
  grade?: ProduceGrade;
  maximumPricePerUnit?: number;
  sellByDateOnOrAfter?: number;
  sellByDateOnOrBefore?: number;
  limit?: number;
};

export type BuyerOrderInput = {
  buyerId: string;
  destinationMarket: string;
  cropType: string;
  requestedQuantity: number;
  unit: string;
  preferredGrade?: ProduceGrade;
  requestedDeliveryDate?: number;
  maxPricePerUnit?: number;
  clientRequestId?: string;
};

export const authProviders = ["firebase"] as const;
export type AuthProvider = (typeof authProviders)[number];

export const authMethods = ["phone", "email_password", "google"] as const;
export type AuthMethod = (typeof authMethods)[number];

export const mfaRequirements = ["not_required", "sms_required", "totp_required", "required"] as const;
export type MfaRequirement = (typeof mfaRequirements)[number];

export const mfaStatuses = ["not_required", "pending", "verified", "failed", "blocked", "recovery"] as const;
export type MfaStatus = (typeof mfaStatuses)[number];

export const onboardingStates = [
  "not_started",
  "profile_required",
  "pending_invite_acceptance",
  "pending_verification",
  "pending_approval",
  "complete",
] as const;
export type OnboardingState = (typeof onboardingStates)[number];

export const profileTypes = [
  "farmer",
  "buyer",
  "transporter",
  "warehouse_agent",
  "admin",
] as const;
export type ProfileType = (typeof profileTypes)[number];

export const profileLinkStatuses = [
  "pending",
  "linked",
  "rejected",
  "revoked",
] as const;
export type ProfileLinkStatus = (typeof profileLinkStatuses)[number];

export const profileLinkSources = [
  "self_app",
  "agent_assisted_claim",
  "invite_acceptance",
  "admin_link",
] as const;
export type ProfileLinkSource = (typeof profileLinkSources)[number];

export type FirebaseIdentityInput = {
  authProviderId: string;
  phoneNumber?: string;
  email?: string;
  displayName?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  signInProvider?: string;
  mfaSatisfied?: boolean;
  mfaMethods?: string[];
};

export type PlatformPrincipalProfile = {
  profileType: ProfileType;
  profileId: string;
  status: string;
  verificationStatus?: string;
  linkStatus?: ProfileLinkStatus;
};

export type CurrentPlatformPrincipal = {
  userId: string;
  authProvider: AuthProvider;
  authProviderId: string;
  role: MarketplaceRole;
  status: UserStatus;
  phoneNumber?: string;
  email?: string;
  name: string;
  authMethods: AuthMethod[];
  mfaRequirement: MfaRequirement;
  mfaStatus: MfaStatus;
  onboardingState: OnboardingState;
  profiles: PlatformPrincipalProfile[];
};

export const platformInvitationTypes = [
  "admin_invite",
  "warehouse_manager_invite",
  "warehouse_agent_invite",
  "transporter_invite",
] as const;
export type PlatformInvitationType = (typeof platformInvitationTypes)[number];

export const invitationChannels = ["email", "manual_link"] as const;
export type InvitationChannel = (typeof invitationChannels)[number];

export const platformInvitationStatuses = [
  "pending",
  "accepted",
  "revoked",
  "expired",
  "cancelled",
] as const;
export type PlatformInvitationStatus = (typeof platformInvitationStatuses)[number];

export type PendingAdminRoleAssignmentInput = AdminScopeDescriptor & {
  roleKey: AdminRoleKey;
  expiresAt?: number;
};

export type PlatformInvitation = TimestampFields & {
  id: string;
  type: PlatformInvitationType;
  channel: InvitationChannel;
  status: PlatformInvitationStatus;
  tokenHash: string;
  targetEmail?: string;
  targetPhoneNumber?: string;
  intendedRole: MarketplaceRole;
  intendedProfileType: ProfileType;
  linkedProfileId?: string;
  pendingAdminRoleAssignment?: PendingAdminRoleAssignmentInput;
  mfaRequirement: MfaRequirement;
  invitedByUserId: string;
  acceptedByUserId?: string;
  expiresAt: number;
  acceptedAt?: number;
  revokedAt?: number;
  revokedByUserId?: string;
  messageId?: string;
};

export type CreatePlatformInvitationInput = {
  actorUserId: string;
  type: PlatformInvitationType;
  channel: InvitationChannel;
  tokenHash: string;
  targetEmail?: string;
  targetPhoneNumber?: string;
  linkedProfileId?: string;
  pendingAdminRoleAssignment?: PendingAdminRoleAssignmentInput;
  expiresAt: number;
  mfaRequirement?: MfaRequirement;
};

export type AcceptPlatformInvitationInput = {
  tokenHash: string;
  identity: FirebaseIdentityInput;
};

export type InviteAcceptanceResult = {
  invitationId: string;
  userId: string;
  profileType: ProfileType;
  profileId?: string;
  status: "accepted";
  mfaRequired: boolean;
};

export const uploadAssetPurposes = [
  "transporter_truck_photo",
  "produce_intake_photo",
  "condition_evidence",
  "dispute_evidence",
  "dispatch_proof_photo",
  "profile_evidence",
] as const;
export type UploadAssetPurpose = (typeof uploadAssetPurposes)[number];

export const uploadAssetStatuses = [
  "pending_upload",
  "uploaded",
  "attached",
  "verified",
  "rejected",
  "expired",
  "deleted",
] as const;
export type UploadAssetStatus = (typeof uploadAssetStatuses)[number];

export const uploadAccessLevels = ["private", "public_read"] as const;
export type UploadAccessLevel = (typeof uploadAccessLevels)[number];

export const uploadRelatedEntityTypes = [
  "farmer",
  "buyer",
  "transporter_profile",
  "warehouse_agent",
  "inventory_batch",
  "dispatch",
  "dispute",
] as const;
export type UploadRelatedEntityType = (typeof uploadRelatedEntityTypes)[number];

export type UploadAsset = TimestampFields & {
  id: string;
  ownerUserId: string;
  ownerProfileType?: ProfileType;
  ownerProfileId?: string;
  purpose: UploadAssetPurpose;
  status: UploadAssetStatus;
  accessLevel: UploadAccessLevel;
  bucket: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256?: string;
  relatedEntityType?: UploadRelatedEntityType;
  relatedEntityId?: string;
  createdByUserId: string;
  completedAt?: number;
  verifiedByUserId?: string;
  verifiedAt?: number;
  rejectedByUserId?: string;
  rejectedAt?: number;
  rejectionReason?: string;
  deletedAt?: number;
  expiredAt?: number;
};

export type PresignedUploadRequest = {
  actorUserId: string;
  purpose: UploadAssetPurpose;
  contentType: string;
  sizeBytes: number;
  fileName?: string;
  ownerProfileType?: ProfileType;
  ownerProfileId?: string;
  relatedEntityType?: UploadRelatedEntityType;
  relatedEntityId?: string;
  accessLevel?: UploadAccessLevel;
};

export type PresignedUploadResponse = {
  uploadAssetId: string;
  method: "PUT";
  uploadUrl: string;
  objectKey: string;
  headers: Record<string, string>;
  expiresAt: number;
};

export type CompleteUploadAssetInput = {
  actorUserId: string;
  uploadAssetId: string;
  sizeBytes: number;
  checksumSha256?: string;
};

// ---------------------------------------------------------------------------
// Ghana geography constants
// ---------------------------------------------------------------------------

/** Ghana regions currently supported by the platform. */
export const GHANA_REGIONS = [
  "Ashanti",
  "Bono",
  "Northern",
  "Western",
  "Western North",
] as const;
export type GhanaRegion = (typeof GHANA_REGIONS)[number];

/** Communities/towns by region — drives cascading selects in registration and warehouse forms. */
export const COMMUNITIES_BY_REGION: Record<GhanaRegion, readonly string[]> = {
  Ashanti: [
    "Kumasi Central", "Bantama", "Adum", "Kejetia", "Bantama Farm Gate",
    "Obuasi", "Mampong", "Ejisu", "Konongo", "Agogo",
  ],
  Bono: [
    "Sunyani", "Fiapre", "Abesim", "Chiraa", "Sunyani South",
    "Berekum", "Dormaa Ahenkro", "Nsoatre",
  ],
  Northern: [
    "Tamale", "Tamale Industrial", "Savelugu", "Tolon", "Nyankpala",
    "Yendi", "Damongo", "Bimbilla",
  ],
  Western: [
    "Sekondi-Takoradi", "Tarkwa", "Prestea", "Axim", "Asankragua",
    "Bogoso", "Daboase", "Shama", "Aboadze", "Busua",
    "Elubo", "Half Assini", "Essiama", "Agona Nkwanta", "Dixcove",
  ],
  "Western North": [
    "Sefwi Wiawso", "Bibiani", "Enchi", "Adabokrom", "Essam",
    "Bodi", "Juaboso", "Akontombra", "Dadieso",
  ],
};

/** Districts by region — used for warehouse creation forms and admin filters. */
export const DISTRICTS_BY_REGION: Record<GhanaRegion, readonly string[]> = {
  Ashanti: [
    "Kumasi Metropolitan", "Asante Akim North", "Asante Akim South",
    "Asante Akim Central", "Obuasi Municipal", "Mampong Municipal",
    "Ejisu Municipal",
  ],
  Bono: [
    "Sunyani Municipal", "Dormaa Municipal", "Berekum Municipal",
    "Jaman South", "Tain",
  ],
  Northern: [
    "Tamale Metropolitan", "Savelugu Municipal", "Tolon",
    "Sagnarigu Municipal", "Yendi Municipal", "West Gonja",
  ],
  Western: [
    "Sekondi-Takoradi Metropolitan", "Tarkwa-Nsuaem Municipal",
    "Prestea-Huni Valley Municipal", "Nzema East Municipal",
    "Amenfi West", "Amenfi East", "Amenfi Central",
    "Wassa East", "Ahanta West", "Shama", "Jomoro", "Ellembelle",
    "Effia-Kwesimintsim",
  ],
  "Western North": [
    "Sefwi Wiawso Municipal", "Bibiani-Anhwiaso-Bekwai Municipal",
    "Aowin Municipal", "Bia East", "Bia West",
    "Bodi", "Juaboso", "Sefwi Akontombra", "Suaman",
  ],
};

/** Crops supported across the platform — drives checkbox grids and intake selects. */
export const SUPPORTED_CROPS = [
  "Maize", "Cocoa", "Cassava", "Yam", "Tomato",
  "Rice", "Sorghum", "Millet", "Soybeans", "Plantain",
  "Cocoyam", "Oil Palm", "Cashew", "Shea Nuts", "Pepper",
  "Okra", "Groundnut",
] as const;
export type SupportedCrop = (typeof SUPPORTED_CROPS)[number];

/** Standard capacity units for warehouse storage. */
export const CAPACITY_UNITS = ["tonnes", "bags", "crates"] as const;
export type CapacityUnit = (typeof CAPACITY_UNITS)[number];
