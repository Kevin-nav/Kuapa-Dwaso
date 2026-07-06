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
  "sent",
  "read",
  "failed",
  "archived",
] as const;
export type NotificationStatus = (typeof notificationStatuses)[number];

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
  "sale_record",
  "dispatch",
  "storage_fee_ledger",
  "buyer",
  "notification",
  "app_setting",
] as const;
export type DisputeEntityType = (typeof disputeEntityTypes)[number];

export const auditEntityTypes = [
  "user",
  "farmer",
  "warehouse_agent",
  "transporter_profile",
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
  "dispute",
  "notification",
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
  destinationMarket?: string;
  verificationStatus: BuyerVerificationStatus;
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

export type Notification = {
  id: string;
  recipientId?: string;
  recipientUserId?: string;
  recipientRole: MarketplaceRole;
  channel: "sms" | "in_app" | "email";
  title: string;
  message: string;
  relatedEntityType?: AuditEntityType;
  relatedEntityId?: string;
  status: NotificationStatus;
  createdAt: number;
  updatedAt?: number;
  sentAt?: number;
  readAt?: number;
};

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
