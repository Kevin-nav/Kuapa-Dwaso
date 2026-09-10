import { defineTable } from "convex/server";
import { v } from "convex/values";

const datasetProvenance = v.union(v.literal("live"), v.literal("sample_only"));
const commercialMode = v.union(
  v.literal("coordination"),
  v.literal("kuapa_purchase"),
);
const cancellationState = v.union(
  v.literal("none"),
  v.literal("requested"),
  v.literal("resolving"),
  v.literal("resolved"),
);
const location = v.object({
  label: v.string(),
  region: v.optional(v.string()),
  district: v.optional(v.string()),
  address: v.optional(v.string()),
  latitudeE6: v.optional(v.number()),
  longitudeE6: v.optional(v.number()),
});
const rate = v.object({
  numerator: v.number(),
  scale: v.number(),
  unit: v.union(v.literal("per_kg"), v.literal("percent"), v.literal("fixed")),
});
const chargeTerm = v.object({
  code: v.string(),
  label: v.string(),
  payer: v.union(
    v.literal("buyer"),
    v.literal("farmer"),
    v.literal("kuapa_dwaso"),
  ),
  calculation: v.union(
    v.literal("fixed"),
    v.literal("per_kg"),
    v.literal("percent_of_produce"),
  ),
  rate,
});
const paymentTerm = v.object({
  trigger: v.union(
    v.literal("buyer_acceptance"),
    v.literal("cleared_buyer_funds"),
    v.literal("purchase_collection_acceptance"),
    v.literal("fixed_date"),
  ),
  offsetCalendarDays: v.number(),
  fixedDueAt: v.optional(v.number()),
  timezone: v.literal("Africa/Accra"),
});
const maizeSpecification = v.object({
  maizeType: v.string(),
  moistureMaximumPermille: v.optional(v.number()),
  contaminationCheckRequired: v.boolean(),
  additionalCriteria: v.array(
    v.object({ code: v.string(), label: v.string(), required: v.boolean() }),
  ),
  policyProvenance: datasetProvenance,
});
const termClause = v.object({
  code: v.string(),
  label: v.string(),
  detail: v.string(),
});
const partyKind = v.union(
  v.literal("buyer"),
  v.literal("farmer"),
  v.literal("kuapa_dwaso"),
  v.literal("transporter"),
  v.literal("facility"),
  v.literal("external_provider"),
);
const partyRef = v.object({
  kind: partyKind,
  id: v.optional(v.string()),
  displayNameSnapshot: v.string(),
});
const qualityStatus = v.union(
  v.literal("pending"),
  v.literal("passed"),
  v.literal("partial"),
  v.literal("failed"),
  v.literal("superseded"),
);
const pilotEntityType = v.union(
  v.literal("pilotProgrammes"),
  v.literal("pilotAssignments"),
  v.literal("pilotFacilities"),
  v.literal("pilotBuyerRequests"),
  v.literal("pilotBuyerAgreementRevisions"),
  v.literal("pilotSupplyDeclarations"),
  v.literal("pilotFarmerOffers"),
  v.literal("pilotFarmerOfferRevisions"),
  v.literal("pilotAllocations"),
  v.literal("pilotProcurementLots"),
  v.literal("pilotInspections"),
  v.literal("pilotFulfilmentPlans"),
  v.literal("pilotFulfilmentStops"),
  v.literal("pilotCustodyEvents"),
  v.literal("pilotBuyerAcceptances"),
  v.literal("pilotPurchasingBudgets"),
  v.literal("pilotFundingReservations"),
  v.literal("pilotBudgetEvents"),
  v.literal("pilotFinancialEntries"),
  v.literal("pilotPaymentTransactions"),
  v.literal("pilotActivityEvents"),
  v.literal("pilotIssues"),
  v.literal("pilotIdempotencyKeys"),
);

export const pilotTables = {
  pilotProgrammes: defineTable({
    code: v.string(),
    name: v.string(),
    countryCode: v.literal("GH"),
    currency: v.literal("GHS"),
    timezone: v.literal("Africa/Accra"),
    region: v.string(),
    district: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("closed"),
    ),
    datasetProvenance,
    datasetId: v.optional(v.string()),
    commercialConfigurationStatus: v.union(
      v.literal("missing"),
      v.literal("draft"),
      v.literal("approved"),
    ),
    currentCommercialConfiguration: v.optional(
      v.object({
        qualityPolicy: v.optional(maizeSpecification),
        chargeTerms: v.optional(v.array(chargeTerm)),
        paymentTerms: v.optional(v.array(paymentTerm)),
        purchaseLimitPesewas: v.optional(v.number()),
        taxTerms: v.optional(v.array(termClause)),
        approvalReferences: v.array(v.string()),
      }),
    ),
    version: v.number(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"])
    .index("by_dataset", ["datasetId"])
    .index("by_provenance_status", ["datasetProvenance", "status"]),

  pilotAssignments: defineTable({
    programmeId: v.id("pilotProgrammes"),
    userId: v.id("users"),
    identityKind: v.union(v.literal("warehouse_agent"), v.literal("admin")),
    warehouseAgentId: v.optional(v.id("warehouseAgents")),
    capabilities: v.array(
      v.union(
        v.literal("pilot:read"),
        v.literal("requests:review"),
        v.literal("supply:manage"),
        v.literal("offers:manage"),
        v.literal("quality:record"),
        v.literal("fulfilment:manage"),
        v.literal("custody:record"),
        v.literal("issues:manage"),
      ),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("revoked"),
      v.literal("expired"),
    ),
    invitationId: v.optional(v.id("platformInvitations")),
    grantedByUserId: v.id("users"),
    grantedAt: v.number(),
    expiresAt: v.optional(v.number()),
    revokedByUserId: v.optional(v.id("users")),
    revokedAt: v.optional(v.number()),
    revocationReason: v.optional(v.string()),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_programme_status", ["programmeId", "status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_programme_user", ["programmeId", "userId"])
    .index("by_expiry_status", ["expiresAt", "status"]),

  pilotFacilities: defineTable({
    programmeId: v.id("pilotProgrammes"),
    name: v.string(),
    facilityType: v.union(
      v.literal("collection_point"),
      v.literal("partner_facility"),
      v.literal("warehouse"),
    ),
    warehouseId: v.optional(v.id("warehouses")),
    location,
    storageAssessed: v.boolean(),
    assessedAt: v.optional(v.number()),
    assessedByUserId: v.optional(v.id("users")),
    assessmentEvidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("inactive"),
      v.literal("closed"),
    ),
    datasetProvenance,
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_programme_status", ["programmeId", "status"])
    .index("by_warehouse", ["warehouseId"])
    .index("by_programme_type_status", [
      "programmeId",
      "facilityType",
      "status",
    ]),

  pilotBuyerRequests: defineTable({
    programmeId: v.id("pilotProgrammes"),
    buyerId: v.id("buyers"),
    cropCode: v.literal("maize"),
    maizeType: v.string(),
    requestedGrams: v.number(),
    confirmedGrams: v.optional(v.number()),
    destination: location,
    deliveryWindowStartAt: v.number(),
    deliveryWindowEndAt: v.number(),
    requestedSpecification: maizeSpecification,
    paymentExpectation: paymentTerm,
    commercialMode,
    status: v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("under_review"),
      v.literal("quoted"),
      v.literal("confirmed"),
      v.literal("fulfilling"),
      v.literal("delivered"),
      v.literal("closed"),
      v.literal("cancelled"),
      v.literal("disputed"),
    ),
    cancellationState,
    currentAgreementRevisionId: v.optional(
      v.id("pilotBuyerAgreementRevisions"),
    ),
    version: v.number(),
    createdByUserId: v.id("users"),
    submittedAt: v.optional(v.number()),
    confirmedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_buyer_status", ["buyerId", "status"])
    .index("by_buyer_programme_status", ["buyerId", "programmeId", "status"])
    .index("by_programme_status", ["programmeId", "status"])
    .index("by_programme_delivery_window", [
      "programmeId",
      "deliveryWindowStartAt",
    ])
    .index("by_status_updated_at", ["status", "updatedAt"]),

  pilotBuyerAgreementRevisions: defineTable({
    requestId: v.id("pilotBuyerRequests"),
    programmeId: v.id("pilotProgrammes"),
    revision: v.number(),
    supersedesRevisionId: v.optional(v.id("pilotBuyerAgreementRevisions")),
    quantityGrams: v.number(),
    commercialMode,
    specification: maizeSpecification,
    producePriceRate: rate,
    chargeTerms: v.array(chargeTerm),
    acceptanceRules: v.array(termClause),
    deliveryWindowStartAt: v.number(),
    deliveryWindowEndAt: v.number(),
    paymentTerms: v.array(paymentTerm),
    cancellationTerms: v.array(termClause),
    expiresAt: v.number(),
    state: v.union(
      v.literal("proposed"),
      v.literal("acknowledged"),
      v.literal("superseded"),
      v.literal("expired"),
      v.literal("withdrawn"),
    ),
    buyerAcknowledgedByUserId: v.optional(v.id("users")),
    buyerAcknowledgedAt: v.optional(v.number()),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_request_revision", ["requestId", "revision"])
    .index("by_request_state", ["requestId", "state"])
    .index("by_expiry_state", ["expiresAt", "state"])
    .index("by_programme_created_at", ["programmeId", "createdAt"]),

  pilotSupplyDeclarations: defineTable({
    programmeId: v.id("pilotProgrammes"),
    farmerId: v.id("farmers"),
    cropCode: v.literal("maize"),
    maizeType: v.string(),
    availableGrams: v.number(),
    readinessWindowStartAt: v.number(),
    readinessWindowEndAt: v.number(),
    collectionLocation: location,
    verificationStatus: v.union(
      v.literal("self_reported"),
      v.literal("reviewed"),
      v.literal("rejected"),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("exhausted"),
      v.literal("withdrawn"),
      v.literal("expired"),
    ),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_farmer_status", ["farmerId", "status"])
    .index("by_farmer_programme_status", ["farmerId", "programmeId", "status"])
    .index("by_programme_status", ["programmeId", "status"])
    .index("by_programme_maize_type_status", [
      "programmeId",
      "maizeType",
      "status",
    ])
    .index("by_readiness_status", ["readinessWindowStartAt", "status"]),

  pilotFarmerOffers: defineTable({
    programmeId: v.id("pilotProgrammes"),
    requestId: v.id("pilotBuyerRequests"),
    declarationId: v.id("pilotSupplyDeclarations"),
    farmerId: v.id("farmers"),
    commercialMode,
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired"),
      v.literal("withdrawn"),
    ),
    currentRevisionId: v.optional(v.id("pilotFarmerOfferRevisions")),
    acceptedRevisionId: v.optional(v.id("pilotFarmerOfferRevisions")),
    decisionAt: v.optional(v.number()),
    expiresAt: v.number(),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_farmer_status", ["farmerId", "status"])
    .index("by_request_status", ["requestId", "status"])
    .index("by_declaration_status", ["declarationId", "status"])
    .index("by_expiry_status", ["expiresAt", "status"]),

  pilotFarmerOfferRevisions: defineTable({
    offerId: v.id("pilotFarmerOffers"),
    programmeId: v.id("pilotProgrammes"),
    requestId: v.id("pilotBuyerRequests"),
    declarationId: v.id("pilotSupplyDeclarations"),
    buyerAgreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
    revision: v.number(),
    supersedesRevisionId: v.optional(v.id("pilotFarmerOfferRevisions")),
    commercialMode,
    offeredGrams: v.number(),
    priceBasis: v.union(v.literal("per_kg"), v.literal("fixed_lot")),
    priceRate: rate,
    chargeTerms: v.array(chargeTerm),
    expectedGrossPesewas: v.number(),
    expectedChargesPesewas: v.number(),
    expectedNetPesewas: v.number(),
    inspectionTerms: v.array(termClause),
    paymentTerms: v.array(paymentTerm),
    titleTransferTerms: v.array(termClause),
    custodyTransferTerms: v.array(termClause),
    cancellationTerms: v.array(termClause),
    expiresAt: v.number(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_offer_revision", ["offerId", "revision"])
    .index("by_request_created_at", ["requestId", "createdAt"])
    .index("by_expiry", ["expiresAt"]),

  pilotAllocations: defineTable({
    programmeId: v.id("pilotProgrammes"),
    requestId: v.id("pilotBuyerRequests"),
    declarationId: v.id("pilotSupplyDeclarations"),
    offerId: v.id("pilotFarmerOffers"),
    offerRevisionId: v.id("pilotFarmerOfferRevisions"),
    farmerId: v.id("farmers"),
    commercialMode,
    allocatedGrams: v.number(),
    clearedGrams: v.number(),
    releasedGrams: v.number(),
    status: v.union(
      v.literal("provisional"),
      v.literal("committed"),
      v.literal("quality_cleared"),
      v.literal("released"),
      v.literal("expired"),
      v.literal("cancelled"),
    ),
    holdExpiresAt: v.optional(v.number()),
    releaseReason: v.optional(v.string()),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request_status", ["requestId", "status"])
    .index("by_declaration_status", ["declarationId", "status"])
    .index("by_offer", ["offerId"])
    .index("by_hold_expiry_status", ["holdExpiresAt", "status"])
    .index("by_farmer_status", ["farmerId", "status"]),

  pilotProcurementLots: defineTable({
    programmeId: v.id("pilotProgrammes"),
    requestId: v.id("pilotBuyerRequests"),
    allocationId: v.id("pilotAllocations"),
    offerRevisionId: v.id("pilotFarmerOfferRevisions"),
    farmerId: v.id("farmers"),
    commercialMode,
    lotCode: v.string(),
    parentLotId: v.optional(v.id("pilotProcurementLots")),
    sourceGrams: v.number(),
    qualityStatus,
    clearedGrams: v.number(),
    rejectedGrams: v.number(),
    titleOwnerKind: v.union(
      v.literal("farmer"),
      v.literal("buyer"),
      v.literal("kuapa_dwaso"),
    ),
    titleOwnerFarmerId: v.optional(v.id("farmers")),
    currentCustodianKind: v.union(
      v.literal("farmer"),
      v.literal("kuapa_dwaso"),
      v.literal("transporter"),
      v.literal("buyer"),
      v.literal("facility"),
    ),
    currentCustodianId: v.optional(v.string()),
    currentLocation: location,
    facilityId: v.optional(v.id("pilotFacilities")),
    dispositionStatus: v.union(
      v.literal("available_for_plan"),
      v.literal("allocated_to_plan"),
      v.literal("held"),
      v.literal("delivered"),
      v.literal("returned"),
      v.literal("disposed"),
      v.literal("closed"),
    ),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_lot_code", ["lotCode"])
    .index("by_request_disposition", ["requestId", "dispositionStatus"])
    .index("by_farmer", ["farmerId"])
    .index("by_allocation", ["allocationId"])
    .index("by_parent", ["parentLotId"])
    .index("by_owner_disposition", ["titleOwnerKind", "dispositionStatus"])
    .index("by_programme_quality", ["programmeId", "qualityStatus"]),

  pilotInspections: defineTable({
    programmeId: v.id("pilotProgrammes"),
    requestId: v.id("pilotBuyerRequests"),
    lotId: v.id("pilotProcurementLots"),
    allocationId: v.id("pilotAllocations"),
    buyerAgreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
    supersedesInspectionId: v.optional(v.id("pilotInspections")),
    samplingMethod: v.string(),
    testMethod: v.string(),
    sampleCount: v.number(),
    moisturePermille: v.optional(v.number()),
    contaminationResult: v.union(
      v.literal("passed"),
      v.literal("failed"),
      v.literal("not_recorded"),
    ),
    additionalReadings: v.array(
      v.object({
        code: v.string(),
        label: v.string(),
        value: v.string(),
        passed: v.optional(v.boolean()),
      }),
    ),
    grossWeightGrams: v.optional(v.number()),
    tareWeightGrams: v.optional(v.number()),
    measuredGrams: v.number(),
    acceptedGrams: v.number(),
    rejectedGrams: v.number(),
    qualityStatus,
    reasonCode: v.optional(v.string()),
    notes: v.optional(v.string()),
    evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    inspectedByUserId: v.id("users"),
    inspectedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_lot_created_at", ["lotId", "createdAt"])
    .index("by_lot_quality", ["lotId", "qualityStatus"])
    .index("by_request_quality", ["requestId", "qualityStatus"])
    .index("by_inspector_created_at", ["inspectedByUserId", "createdAt"]),

  pilotFulfilmentPlans: defineTable({
    programmeId: v.id("pilotProgrammes"),
    requestId: v.id("pilotBuyerRequests"),
    buyerAgreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
    status: v.union(
      v.literal("planning"),
      v.literal("ready"),
      v.literal("assigned"),
      v.literal("collecting"),
      v.literal("in_transit"),
      v.literal("delivered"),
      v.literal("cancelled"),
    ),
    plannedGrams: v.number(),
    transporterId: v.optional(v.id("transporterProfiles")),
    driverUserId: v.optional(v.id("users")),
    vehicleRegistration: v.optional(v.string()),
    vehicleCapacityGrams: v.optional(v.number()),
    collectionWindowStartAt: v.number(),
    collectionWindowEndAt: v.number(),
    deliveryWindowStartAt: v.number(),
    deliveryWindowEndAt: v.number(),
    destination: location,
    readinessBlockers: v.array(v.string()),
    cancellationState,
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request", ["requestId"])
    .index("by_programme_status", ["programmeId", "status"])
    .index("by_driver_status", ["driverUserId", "status"])
    .index("by_delivery_window_status", ["deliveryWindowStartAt", "status"]),

  pilotFulfilmentStops: defineTable({
    programmeId: v.id("pilotProgrammes"),
    planId: v.id("pilotFulfilmentPlans"),
    sequence: v.number(),
    stopType: v.union(
      v.literal("collection"),
      v.literal("facility"),
      v.literal("destination"),
    ),
    location,
    facilityId: v.optional(v.id("pilotFacilities")),
    lotIds: v.array(v.id("pilotProcurementLots")),
    plannedGrams: v.number(),
    collectedGrams: v.number(),
    windowStartAt: v.number(),
    windowEndAt: v.number(),
    status: v.union(
      v.literal("planned"),
      v.literal("arrived"),
      v.literal("completed"),
      v.literal("skipped"),
      v.literal("cancelled"),
    ),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_plan_sequence", ["planId", "sequence"])
    .index("by_plan_status", ["planId", "status"])
    .index("by_facility", ["facilityId"])
    .index("by_window_status", ["windowStartAt", "status"]),

  pilotCustodyEvents: defineTable({
    programmeId: v.id("pilotProgrammes"),
    requestId: v.id("pilotBuyerRequests"),
    lotId: v.id("pilotProcurementLots"),
    planId: v.optional(v.id("pilotFulfilmentPlans")),
    stopId: v.optional(v.id("pilotFulfilmentStops")),
    eventType: v.union(
      v.literal("collected"),
      v.literal("loaded"),
      v.literal("handed_over"),
      v.literal("delivered"),
      v.literal("held"),
      v.literal("returned"),
      v.literal("released"),
      v.literal("corrected"),
    ),
    grams: v.number(),
    fromCustodian: partyRef,
    toCustodian: partyRef,
    location,
    evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    supersedesEventId: v.optional(v.id("pilotCustodyEvents")),
    reasonCode: v.optional(v.string()),
    recordedByUserId: v.id("users"),
    occurredAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_lot_occurred_at", ["lotId", "occurredAt"])
    .index("by_plan_occurred_at", ["planId", "occurredAt"])
    .index("by_request_occurred_at", ["requestId", "occurredAt"])
    .index("by_recorder_created_at", ["recordedByUserId", "createdAt"]),

  pilotBuyerAcceptances: defineTable({
    programmeId: v.id("pilotProgrammes"),
    requestId: v.id("pilotBuyerRequests"),
    planId: v.id("pilotFulfilmentPlans"),
    buyerAgreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
    revision: v.number(),
    supersedesAcceptanceId: v.optional(v.id("pilotBuyerAcceptances")),
    lines: v.array(
      v.object({
        lotId: v.id("pilotProcurementLots"),
        sublotId: v.optional(v.id("pilotProcurementLots")),
        deliveredGrams: v.number(),
        acceptedGrams: v.number(),
        rejectedGrams: v.number(),
        reasonCode: v.optional(v.string()),
        evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
        issueId: v.optional(v.id("pilotIssues")),
        discrepancyState: v.union(
          v.literal("none"),
          v.literal("open"),
          v.literal("resolved"),
        ),
      }),
    ),
    acknowledgedByBuyerUserId: v.id("users"),
    acknowledgedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_request_revision", ["requestId", "revision"])
    .index("by_plan_revision", ["planId", "revision"])
    .index("by_programme_created_at", ["programmeId", "createdAt"]),

  pilotPurchasingBudgets: defineTable({
    programmeId: v.id("pilotProgrammes"),
    fundingSourceLabel: v.string(),
    fundingSourceReference: v.string(),
    fundingEvidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    datasetProvenance,
    currency: v.literal("GHS"),
    approvedCapacityPesewas: v.number(),
    reservedPesewas: v.number(),
    committedPesewas: v.number(),
    spentPesewas: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("closed"),
    ),
    approvedByUserId: v.id("users"),
    approvedAt: v.number(),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_programme_status", ["programmeId", "status"])
    .index("by_provenance_status", ["datasetProvenance", "status"])
    .index("by_funding_reference", ["fundingSourceReference"]),

  pilotFundingReservations: defineTable({
    programmeId: v.id("pilotProgrammes"),
    budgetId: v.id("pilotPurchasingBudgets"),
    requestId: v.id("pilotBuyerRequests"),
    buyerAgreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
    farmerOfferRevisionId: v.id("pilotFarmerOfferRevisions"),
    produceAmountPesewas: v.number(),
    knownCostAmountPesewas: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("partly_consumed"),
      v.literal("consumed"),
      v.literal("released"),
      v.literal("expired"),
      v.literal("reversed"),
    ),
    consumedPesewas: v.number(),
    releasedPesewas: v.number(),
    expiresAt: v.number(),
    approvedByUserId: v.id("users"),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_budget_status", ["budgetId", "status"])
    .index("by_request_status", ["requestId", "status"])
    .index("by_offer_revision", ["farmerOfferRevisionId"])
    .index("by_expiry_status", ["expiresAt", "status"]),

  pilotBudgetEvents: defineTable({
    programmeId: v.id("pilotProgrammes"),
    budgetId: v.id("pilotPurchasingBudgets"),
    reservationId: v.optional(v.id("pilotFundingReservations")),
    financialEntryId: v.optional(v.id("pilotFinancialEntries")),
    eventType: v.union(
      v.literal("capacity_added"),
      v.literal("reserved"),
      v.literal("released"),
      v.literal("committed"),
      v.literal("spent"),
      v.literal("reversed"),
    ),
    amountPesewas: v.number(),
    postingKey: v.string(),
    reasonCode: v.string(),
    recordedByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_budget_created_at", ["budgetId", "createdAt"])
    .index("by_reservation_created_at", ["reservationId", "createdAt"])
    .index("by_posting_key", ["postingKey"]),

  pilotFinancialEntries: defineTable({
    programmeId: v.id("pilotProgrammes"),
    requestId: v.optional(v.id("pilotBuyerRequests")),
    lotId: v.optional(v.id("pilotProcurementLots")),
    offerRevisionId: v.optional(v.id("pilotFarmerOfferRevisions")),
    acceptanceId: v.optional(v.id("pilotBuyerAcceptances")),
    fundingReservationId: v.optional(v.id("pilotFundingReservations")),
    postingKind: v.union(
      v.literal("obligation"),
      v.literal("receipt"),
      v.literal("payment"),
      v.literal("cost"),
      v.literal("revenue"),
      v.literal("reimbursement"),
      v.literal("refund"),
      v.literal("adjustment"),
      v.literal("reversal"),
    ),
    purpose: v.union(
      v.literal("buyer_produce"),
      v.literal("buyer_transport"),
      v.literal("farmer_proceeds"),
      v.literal("coordination_fee"),
      v.literal("purchase_inventory"),
      v.literal("transport_cost"),
      v.literal("handling_cost"),
      v.literal("other_agreed_cost"),
      v.literal("correction"),
    ),
    basis: v.union(v.literal("estimate"), v.literal("actual")),
    payer: partyRef,
    payee: partyRef,
    amountPesewas: v.number(),
    currency: v.literal("GHS"),
    dueAt: v.optional(v.number()),
    settlesEntryId: v.optional(v.id("pilotFinancialEntries")),
    reversesEntryId: v.optional(v.id("pilotFinancialEntries")),
    postingKey: v.string(),
    evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    provenance: datasetProvenance,
    reasonCode: v.string(),
    recordedByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_posting_key", ["postingKey"])
    .index("by_request_created_at", ["requestId", "createdAt"])
    .index("by_lot_created_at", ["lotId", "createdAt"])
    .index("by_payer_created_at", ["payer.kind", "createdAt"])
    .index("by_payee_created_at", ["payee.kind", "createdAt"])
    .index("by_due_at", ["dueAt"])
    .index("by_settles_entry", ["settlesEntryId"])
    .index("by_reverses_entry", ["reversesEntryId"]),

  pilotPaymentTransactions: defineTable({
    programmeId: v.id("pilotProgrammes"),
    requestId: v.id("pilotBuyerRequests"),
    buyerId: v.id("buyers"),
    purpose: v.union(v.literal("buyer_produce"), v.literal("buyer_transport")),
    provider: v.string(),
    providerReference: v.string(),
    providerAccessCode: v.optional(v.string()),
    authorizationUrl: v.optional(v.string()),
    amountPesewas: v.number(),
    currency: v.literal("GHS"),
    status: v.union(
      v.literal("pending"),
      v.literal("initialized"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("reversed"),
    ),
    idempotencyKey: v.string(),
    correlationId: v.optional(v.string()),
    initializedByUserId: v.id("users"),
    verifiedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    reversedAt: v.optional(v.number()),
    providerStatus: v.optional(v.string()),
    providerMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request_status", ["requestId", "status"])
    .index("by_provider_reference", ["providerReference"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_buyer_created_at", ["buyerId", "createdAt"]),

  pilotActivityEvents: defineTable({
    programmeId: v.id("pilotProgrammes"),
    requestId: v.optional(v.id("pilotBuyerRequests")),
    entityType: pilotEntityType,
    entityId: v.string(),
    entityRevision: v.optional(v.number()),
    eventName: v.string(),
    actorUserId: v.id("users"),
    reasonCode: v.optional(v.string()),
    recipientViews: v.array(
      v.object({
        audience: v.union(
          v.literal("buyer"),
          v.literal("farmer"),
          v.literal("transporter"),
          v.literal("pilot_ops"),
          v.literal("finance"),
          v.literal("admin"),
          v.literal("audit"),
        ),
        targetId: v.optional(v.string()),
        title: v.string(),
        detail: v.string(),
      }),
    ),
    createdAt: v.number(),
  })
    .index("by_request_created_at", ["requestId", "createdAt"])
    .index("by_entity_created_at", ["entityType", "entityId", "createdAt"])
    .index("by_programme_created_at", ["programmeId", "createdAt"])
    .index("by_actor_created_at", ["actorUserId", "createdAt"]),

  pilotIssues: defineTable({
    programmeId: v.id("pilotProgrammes"),
    requestId: v.id("pilotBuyerRequests"),
    lotId: v.optional(v.id("pilotProcurementLots")),
    planId: v.optional(v.id("pilotFulfilmentPlans")),
    acceptanceId: v.optional(v.id("pilotBuyerAcceptances")),
    issueType: v.union(
      v.literal("quality_shortfall"),
      v.literal("custody_discrepancy"),
      v.literal("buyer_rejection"),
      v.literal("cancellation_disposition"),
      v.literal("payment_dispute"),
      v.literal("correction"),
    ),
    status: v.union(
      v.literal("open"),
      v.literal("investigating"),
      v.literal("awaiting_party"),
      v.literal("resolved"),
      v.literal("closed"),
    ),
    assignedToUserId: v.id("users"),
    reasonCode: v.string(),
    summary: v.string(),
    nextStep: v.string(),
    responsibleCustodian: partyRef,
    deadlineAt: v.optional(v.number()),
    evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    resolution: v.optional(v.string()),
    resolvedByUserId: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number()),
    version: v.number(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request_status", ["requestId", "status"])
    .index("by_assignee_status", ["assignedToUserId", "status"])
    .index("by_lot_status", ["lotId", "status"])
    .index("by_programme_status", ["programmeId", "status"])
    .index("by_deadline_status", ["deadlineAt", "status"]),

  pilotIdempotencyKeys: defineTable({
    programmeId: v.id("pilotProgrammes"),
    actorUserId: v.id("users"),
    operationName: v.string(),
    idempotencyKey: v.string(),
    requestHash: v.string(),
    status: v.union(v.literal("started"), v.literal("completed")),
    resultRefs: v.array(
      v.object({ entityType: pilotEntityType, entityId: v.string() }),
    ),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_actor_operation_key", [
      "actorUserId",
      "operationName",
      "idempotencyKey",
    ])
    .index("by_programme_created_at", ["programmeId", "createdAt"]),
};
