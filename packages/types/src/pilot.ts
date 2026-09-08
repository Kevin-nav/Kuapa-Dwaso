export const datasetProvenances = ["live", "sample_only"] as const;
export type DatasetProvenance = (typeof datasetProvenances)[number];

export const pilotProgrammeStatuses = [
  "draft",
  "active",
  "suspended",
  "closed",
] as const;
export type PilotProgrammeStatus = (typeof pilotProgrammeStatuses)[number];

export const pilotCommercialModes = ["coordination", "kuapa_purchase"] as const;
export type PilotCommercialMode = (typeof pilotCommercialModes)[number];

export const pilotAssignmentStatuses = [
  "active",
  "revoked",
  "expired",
] as const;
export type PilotAssignmentStatus = (typeof pilotAssignmentStatuses)[number];

export const pilotCapabilities = [
  "pilot:read",
  "requests:review",
  "supply:manage",
  "offers:manage",
  "quality:record",
  "fulfilment:manage",
  "custody:record",
  "issues:manage",
] as const;
export type PilotCapability = (typeof pilotCapabilities)[number];

export const pilotRequestStatuses = [
  "draft",
  "submitted",
  "under_review",
  "quoted",
  "confirmed",
  "fulfilling",
  "delivered",
  "closed",
  "cancelled",
  "disputed",
] as const;
export type PilotRequestStatus = (typeof pilotRequestStatuses)[number];

export const pilotCancellationStates = [
  "none",
  "requested",
  "resolving",
  "resolved",
] as const;
export type PilotCancellationState = (typeof pilotCancellationStates)[number];
export type CancellationState = PilotCancellationState;

export const pilotOfferStatuses = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "withdrawn",
] as const;
export type PilotOfferStatus = (typeof pilotOfferStatuses)[number];
export type OfferStatus = PilotOfferStatus;

export const pilotAllocationStatuses = [
  "provisional",
  "committed",
  "quality_cleared",
  "released",
  "expired",
  "cancelled",
] as const;
export type PilotAllocationStatus = (typeof pilotAllocationStatuses)[number];
export type AllocationStatus = PilotAllocationStatus;

export const pilotQualityStatuses = [
  "pending",
  "passed",
  "partial",
  "failed",
  "superseded",
] as const;
export type PilotQualityStatus = (typeof pilotQualityStatuses)[number];
export type QualityStatus = PilotQualityStatus;

export const pilotFulfilmentStatuses = [
  "planning",
  "ready",
  "assigned",
  "collecting",
  "in_transit",
  "delivered",
  "cancelled",
] as const;
export type PilotFulfilmentStatus = (typeof pilotFulfilmentStatuses)[number];
export type FulfilmentStatus = PilotFulfilmentStatus;

export const pilotObligationStatuses = [
  "due",
  "partly_paid",
  "paid",
  "overdue",
  "disputed",
] as const;
export type PilotObligationStatus = (typeof pilotObligationStatuses)[number];
export type ObligationStatus = PilotObligationStatus;

export type PilotFinancialBasis = "estimate" | "actual";
export type FinancialBasis = PilotFinancialBasis;
export type PilotPartyKind =
  | "buyer"
  | "farmer"
  | "kuapa_dwaso"
  | "transporter"
  | "facility"
  | "external_provider";
export type PartyKind = PilotPartyKind;
export type PilotTitleOwnerKind = "farmer" | "buyer" | "kuapa_dwaso";
export type TitleOwnerKind = PilotTitleOwnerKind;
export type PilotCustodianKind =
  | "farmer"
  | "kuapa_dwaso"
  | "transporter"
  | "buyer"
  | "facility";
export type CustodianKind = PilotCustodianKind;

export type PilotOrderRef =
  | { source: "warehouse_run"; buyerOrderId: string }
  | { source: "pilot_request"; pilotRequestId: string };
export type OrderRef = PilotOrderRef;

export type PilotFacilityRef =
  | { kind: "none" }
  | { kind: "pilot_facility"; pilotFacilityId: string };
export type FacilityRef = PilotFacilityRef;

export type BoundedPageInput = {
  programmeId: string;
  cursor?: string;
  limit: number;
};

export type BoundedPageResult<T> = {
  page: T[];
  nextCursor?: string;
  isDone: boolean;
};

export type PilotBagMeasurement = {
  bagCount: number;
  declaredGramsPerBag: number;
  declaredTotalGrams: number;
  measuredTotalGrams?: number;
};

export type PilotLocation = {
  label: string;
  region?: string;
  district?: string;
  address?: string;
  latitudeE6?: number;
  longitudeE6?: number;
};

export type PilotRate = {
  numerator: number;
  scale: number;
  unit: "per_kg" | "percent" | "fixed";
};
export type Rate = PilotRate;

export type PilotChargeTerm = {
  code: string;
  label: string;
  payer: "buyer" | "farmer" | "kuapa_dwaso";
  calculation: "fixed" | "per_kg" | "percent_of_produce";
  rate: PilotRate;
};
export type ChargeTerm = PilotChargeTerm;

export type PilotPaymentTerm = {
  trigger:
    | "buyer_acceptance"
    | "cleared_buyer_funds"
    | "purchase_collection_acceptance"
    | "fixed_date";
  offsetCalendarDays: number;
  fixedDueAt?: number;
  timezone: "Africa/Accra";
};
export type PaymentTerm = PilotPaymentTerm;

export type PilotMaizeSpecification = {
  maizeType: string;
  moistureMaximumPermille?: number;
  contaminationCheckRequired: boolean;
  additionalCriteria: Array<{ code: string; label: string; required: boolean }>;
  policyProvenance: DatasetProvenance;
};
export type MaizeSpecification = PilotMaizeSpecification;

export type PilotPartyRef = {
  kind: PilotPartyKind;
  id?: string;
  displayNameSnapshot: string;
};
export type PartyRef = PilotPartyRef;

export type PilotTermClause = { code: string; label: string; detail: string };
export type PilotAdditionalReading = {
  code: string;
  label: string;
  value: string;
  passed?: boolean;
};

export type PilotCommercialConfiguration = {
  qualityPolicy?: PilotMaizeSpecification;
  chargeTerms?: PilotChargeTerm[];
  paymentTerms?: PilotPaymentTerm[];
  purchaseLimitPesewas?: number;
  taxTerms?: PilotTermClause[];
  approvalReferences: string[];
};

export type PilotTimestampFields = { createdAt: number; updatedAt: number };
export type PilotVersionedFields = PilotTimestampFields & { version: number };

export type PilotProgramme = PilotVersionedFields & {
  id: string;
  code: string;
  name: string;
  countryCode: "GH";
  currency: "GHS";
  timezone: "Africa/Accra";
  region: string;
  district?: string;
  status: PilotProgrammeStatus;
  datasetProvenance: DatasetProvenance;
  datasetId?: string;
  commercialConfigurationStatus: "missing" | "draft" | "approved";
  currentCommercialConfiguration?: PilotCommercialConfiguration;
  createdByUserId: string;
};

export type PilotAssignment = PilotVersionedFields & {
  id: string;
  programmeId: string;
  userId: string;
  identityKind: "warehouse_agent" | "admin";
  warehouseAgentId?: string;
  capabilities: PilotCapability[];
  status: PilotAssignmentStatus;
  invitationId?: string;
  grantedByUserId: string;
  grantedAt: number;
  expiresAt?: number;
  revokedByUserId?: string;
  revokedAt?: number;
  revocationReason?: string;
};

export type PilotFacility = PilotVersionedFields & {
  id: string;
  programmeId: string;
  name: string;
  facilityType: "collection_point" | "partner_facility" | "warehouse";
  warehouseId?: string;
  location: PilotLocation;
  storageAssessed: boolean;
  assessedAt?: number;
  assessedByUserId?: string;
  assessmentEvidenceUploadAssetIds: string[];
  status: "draft" | "active" | "inactive" | "closed";
  datasetProvenance: DatasetProvenance;
};

export type PilotBuyerRequest = PilotVersionedFields & {
  id: string;
  programmeId: string;
  buyerId: string;
  cropCode: "maize";
  maizeType: string;
  requestedGrams: number;
  confirmedGrams?: number;
  destination: PilotLocation;
  deliveryWindowStartAt: number;
  deliveryWindowEndAt: number;
  requestedSpecification: PilotMaizeSpecification;
  paymentExpectation: PilotPaymentTerm;
  commercialMode: PilotCommercialMode;
  status: PilotRequestStatus;
  cancellationState: PilotCancellationState;
  currentAgreementRevisionId?: string;
  createdByUserId: string;
  submittedAt?: number;
  confirmedAt?: number;
  deliveredAt?: number;
  closedAt?: number;
  cancelledAt?: number;
};

export type PilotBuyerAgreementRevision = {
  id: string;
  requestId: string;
  programmeId: string;
  revision: number;
  supersedesRevisionId?: string;
  quantityGrams: number;
  commercialMode: PilotCommercialMode;
  specification: PilotMaizeSpecification;
  producePriceRate: PilotRate;
  chargeTerms: PilotChargeTerm[];
  acceptanceRules: PilotTermClause[];
  deliveryWindowStartAt: number;
  deliveryWindowEndAt: number;
  paymentTerms: PilotPaymentTerm[];
  cancellationTerms: PilotTermClause[];
  expiresAt: number;
  state: "proposed" | "acknowledged" | "superseded" | "expired" | "withdrawn";
  buyerAcknowledgedByUserId?: string;
  buyerAcknowledgedAt?: number;
  createdByUserId: string;
  createdAt: number;
};

export type PilotSupplyDeclaration = PilotVersionedFields & {
  id: string;
  programmeId: string;
  farmerId: string;
  cropCode: "maize";
  maizeType: string;
  availableGrams: number;
  readinessWindowStartAt: number;
  readinessWindowEndAt: number;
  collectionLocation: PilotLocation;
  verificationStatus: "self_reported" | "reviewed" | "rejected";
  status: "active" | "exhausted" | "withdrawn" | "expired";
};

export type PilotFarmerOffer = PilotVersionedFields & {
  id: string;
  programmeId: string;
  requestId: string;
  declarationId: string;
  farmerId: string;
  commercialMode: PilotCommercialMode;
  status: PilotOfferStatus;
  currentRevisionId: string;
  acceptedRevisionId?: string;
  decisionAt?: number;
  expiresAt: number;
};

export type PilotFarmerOfferRevision = {
  id: string;
  offerId: string;
  programmeId: string;
  requestId: string;
  declarationId: string;
  revision: number;
  supersedesRevisionId?: string;
  commercialMode: PilotCommercialMode;
  offeredGrams: number;
  priceBasis: "per_kg" | "fixed_lot";
  priceRate: PilotRate;
  chargeTerms: PilotChargeTerm[];
  expectedGrossPesewas: number;
  expectedChargesPesewas: number;
  expectedNetPesewas: number;
  inspectionTerms: PilotTermClause[];
  paymentTerms: PilotPaymentTerm[];
  titleTransferTerms: PilotTermClause[];
  custodyTransferTerms: PilotTermClause[];
  cancellationTerms: PilotTermClause[];
  expiresAt: number;
  createdByUserId: string;
  createdAt: number;
};

export type PilotAllocation = PilotVersionedFields & {
  id: string;
  programmeId: string;
  requestId: string;
  declarationId: string;
  offerId: string;
  offerRevisionId: string;
  farmerId: string;
  commercialMode: PilotCommercialMode;
  allocatedGrams: number;
  clearedGrams: number;
  releasedGrams: number;
  status: PilotAllocationStatus;
  holdExpiresAt?: number;
  releaseReason?: string;
};

export type PilotProcurementLot = PilotVersionedFields & {
  id: string;
  programmeId: string;
  requestId: string;
  allocationId: string;
  offerRevisionId: string;
  farmerId: string;
  commercialMode: PilotCommercialMode;
  lotCode: string;
  parentLotId?: string;
  sourceGrams: number;
  qualityStatus: PilotQualityStatus;
  clearedGrams: number;
  rejectedGrams: number;
  titleOwnerKind: PilotTitleOwnerKind;
  titleOwnerFarmerId?: string;
  currentCustodianKind: PilotCustodianKind;
  currentCustodianId?: string;
  currentLocation: PilotLocation;
  facilityId?: string;
  dispositionStatus:
    | "available_for_plan"
    | "allocated_to_plan"
    | "held"
    | "delivered"
    | "returned"
    | "disposed"
    | "closed";
};

export type PilotInspection = {
  id: string;
  programmeId: string;
  requestId: string;
  lotId: string;
  allocationId: string;
  buyerAgreementRevisionId: string;
  supersedesInspectionId?: string;
  samplingMethod: string;
  testMethod: string;
  sampleCount: number;
  moisturePermille?: number;
  contaminationResult: "passed" | "failed" | "not_recorded";
  additionalReadings: PilotAdditionalReading[];
  measuredGrams: number;
  acceptedGrams: number;
  rejectedGrams: number;
  qualityStatus: PilotQualityStatus;
  reasonCode?: string;
  notes?: string;
  evidenceUploadAssetIds: string[];
  inspectedByUserId: string;
  inspectedAt: number;
  createdAt: number;
};

export type PilotFulfilmentPlan = PilotVersionedFields & {
  id: string;
  programmeId: string;
  requestId: string;
  buyerAgreementRevisionId: string;
  status: PilotFulfilmentStatus;
  plannedGrams: number;
  transporterId?: string;
  driverUserId?: string;
  vehicleRegistration?: string;
  vehicleCapacityGrams?: number;
  collectionWindowStartAt: number;
  collectionWindowEndAt: number;
  deliveryWindowStartAt: number;
  deliveryWindowEndAt: number;
  destination: PilotLocation;
  readinessBlockers: string[];
  cancellationState: PilotCancellationState;
};

export type PilotFulfilmentStop = PilotVersionedFields & {
  id: string;
  programmeId: string;
  planId: string;
  sequence: number;
  stopType: "collection" | "facility" | "destination";
  location: PilotLocation;
  facilityId?: string;
  lotIds: string[];
  plannedGrams: number;
  collectedGrams: number;
  windowStartAt: number;
  windowEndAt: number;
  status: "planned" | "arrived" | "completed" | "skipped" | "cancelled";
};

export type PilotCustodyEvent = {
  id: string;
  programmeId: string;
  requestId: string;
  lotId: string;
  planId?: string;
  stopId?: string;
  eventType:
    | "collected"
    | "loaded"
    | "handed_over"
    | "delivered"
    | "held"
    | "returned"
    | "released"
    | "corrected";
  grams: number;
  fromCustodian: PilotPartyRef;
  toCustodian: PilotPartyRef;
  location: PilotLocation;
  evidenceUploadAssetIds: string[];
  supersedesEventId?: string;
  reasonCode?: string;
  recordedByUserId: string;
  occurredAt: number;
  createdAt: number;
};

export type PilotBuyerAcceptanceLine = {
  lotId: string;
  sublotId?: string;
  deliveredGrams: number;
  acceptedGrams: number;
  rejectedGrams: number;
  reasonCode?: string;
  evidenceUploadAssetIds: string[];
  issueId?: string;
  discrepancyState: "none" | "open" | "resolved";
};

export type PilotBuyerAcceptance = {
  id: string;
  programmeId: string;
  requestId: string;
  planId: string;
  buyerAgreementRevisionId: string;
  revision: number;
  supersedesAcceptanceId?: string;
  lines: PilotBuyerAcceptanceLine[];
  acknowledgedByBuyerUserId: string;
  acknowledgedAt: number;
  createdAt: number;
};

export type PilotPurchasingBudget = PilotVersionedFields & {
  id: string;
  programmeId: string;
  fundingSourceLabel: string;
  fundingSourceReference: string;
  fundingEvidenceUploadAssetIds: string[];
  datasetProvenance: DatasetProvenance;
  currency: "GHS";
  approvedCapacityPesewas: number;
  reservedPesewas: number;
  committedPesewas: number;
  spentPesewas: number;
  status: "draft" | "active" | "suspended" | "closed";
  approvedByUserId: string;
  approvedAt: number;
};

export type PilotFundingReservation = PilotVersionedFields & {
  id: string;
  programmeId: string;
  budgetId: string;
  requestId: string;
  buyerAgreementRevisionId: string;
  farmerOfferRevisionId: string;
  produceAmountPesewas: number;
  knownCostAmountPesewas: number;
  status:
    | "active"
    | "partly_consumed"
    | "consumed"
    | "released"
    | "expired"
    | "reversed";
  consumedPesewas: number;
  releasedPesewas: number;
  expiresAt: number;
  approvedByUserId: string;
};

export type PilotBudgetEvent = {
  id: string;
  programmeId: string;
  budgetId: string;
  reservationId?: string;
  financialEntryId?: string;
  eventType:
    | "capacity_added"
    | "reserved"
    | "released"
    | "committed"
    | "spent"
    | "reversed";
  amountPesewas: number;
  postingKey: string;
  reasonCode: string;
  recordedByUserId: string;
  createdAt: number;
};

export type PilotFinancialEntry = {
  id: string;
  programmeId: string;
  requestId?: string;
  lotId?: string;
  offerRevisionId?: string;
  acceptanceId?: string;
  fundingReservationId?: string;
  postingKind:
    | "obligation"
    | "receipt"
    | "payment"
    | "cost"
    | "revenue"
    | "reimbursement"
    | "refund"
    | "adjustment"
    | "reversal";
  purpose:
    | "buyer_produce"
    | "buyer_transport"
    | "farmer_proceeds"
    | "coordination_fee"
    | "purchase_inventory"
    | "transport_cost"
    | "handling_cost"
    | "other_agreed_cost"
    | "correction";
  basis: PilotFinancialBasis;
  payer: PilotPartyRef;
  payee: PilotPartyRef;
  amountPesewas: number;
  currency: "GHS";
  dueAt?: number;
  settlesEntryId?: string;
  reversesEntryId?: string;
  postingKey: string;
  evidenceUploadAssetIds: string[];
  provenance: DatasetProvenance;
  reasonCode: string;
  recordedByUserId: string;
  createdAt: number;
};

export type PilotPaymentTransaction = PilotTimestampFields & {
  id: string;
  programmeId: string;
  requestId: string;
  buyerId: string;
  provider: string;
  providerReference: string;
  providerAccessCode?: string;
  authorizationUrl?: string;
  amountPesewas: number;
  currency: "GHS";
  status: "pending" | "initialized" | "succeeded" | "failed" | "reversed";
  idempotencyKey: string;
  correlationId?: string;
  initializedByUserId: string;
  verifiedAt?: number;
  paidAt?: number;
  failedAt?: number;
  reversedAt?: number;
  providerStatus?: string;
  providerMessage?: string;
};

export type PilotActivityRecipientView = {
  audience:
    | "buyer"
    | "farmer"
    | "transporter"
    | "pilot_ops"
    | "finance"
    | "admin"
    | "audit";
  targetId?: string;
  title: string;
  detail: string;
};

export type PilotActivityEvent = {
  id: string;
  programmeId: string;
  requestId?: string;
  entityType: string;
  entityId: string;
  entityRevision?: number;
  eventName: string;
  actorUserId: string;
  reasonCode?: string;
  recipientViews: PilotActivityRecipientView[];
  createdAt: number;
};

export type PilotIssue = PilotVersionedFields & {
  id: string;
  programmeId: string;
  requestId: string;
  lotId?: string;
  planId?: string;
  acceptanceId?: string;
  issueType:
    | "quality_shortfall"
    | "custody_discrepancy"
    | "buyer_rejection"
    | "cancellation_disposition"
    | "payment_dispute"
    | "correction";
  status: "open" | "investigating" | "awaiting_party" | "resolved" | "closed";
  summary: string;
  responsibleCustodian: PilotPartyRef;
  deadlineAt?: number;
  evidenceUploadAssetIds: string[];
  resolution?: string;
  resolvedByUserId?: string;
  resolvedAt?: number;
  createdByUserId: string;
};

export type PilotIdempotencyResultRef = {
  entityType: string;
  entityId: string;
};
export type PilotIdempotencyKey = {
  id: string;
  programmeId: string;
  actorUserId: string;
  operationName: string;
  idempotencyKey: string;
  requestHash: string;
  status: "started" | "completed";
  resultRefs: PilotIdempotencyResultRef[];
  createdAt: number;
  completedAt?: number;
};
