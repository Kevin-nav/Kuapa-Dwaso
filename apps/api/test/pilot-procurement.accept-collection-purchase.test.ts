import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptCollectionPurchaseHandler,
  type purchaseCollectionArgs,
} from "../../../convex/pilotProcurement";
import type { Infer } from "convex/values";
import {
  InMemoryConvex,
  type FailurePoint,
} from "./helpers/in-memory-convex";

const NOW = Date.UTC(2026, 6, 8, 10, 30);
const FUTURE = NOW + 86_400_000;
const LOCATION = { label: "Techiman collection point", region: "Bono East" };

type PurchaseArgs = Infer<typeof purchaseCollectionArgs>;

const ids = {
  operator: "users:operator",
  driver: "users:driver",
  farmer: "farmers:one",
  buyer: "buyers:one",
  warehouseAgent: "warehouseAgents:operator",
  assignment: "pilotAssignments:operator",
  programme: "pilotProgrammes:maize",
  request: "pilotBuyerRequests:one",
  otherRequest: "pilotBuyerRequests:other",
  agreement: "pilotBuyerAgreementRevisions:one",
  offer: "pilotFarmerOffers:one",
  revision: "pilotFarmerOfferRevisions:one",
  allocation: "pilotAllocations:one",
  lot: "pilotProcurementLots:one",
  secondLot: "pilotProcurementLots:two",
  inspection: "pilotInspections:one",
  secondInspection: "pilotInspections:two",
  plan: "pilotFulfilmentPlans:one",
  stop: "pilotFulfilmentStops:one",
  transporter: "transporterProfiles:one",
  collectionEvidence: "uploadAssets:collection",
  inspectionEvidence: "uploadAssets:inspection",
  budget: "pilotPurchasingBudgets:one",
  reservation: "pilotFundingReservations:one",
  buyerPayment: "pilotPaymentTransactions:one",
} as const;

function fixture(options: {
  twoLots?: boolean;
  reservedPesewas?: number;
  produceAmountPesewas?: number;
} = {}) {
  const twoLots = options.twoLots ?? false;
  const reservedPesewas = options.reservedPesewas ?? 2_000;
  const produceAmountPesewas = options.produceAmountPesewas ?? 2_000;
  const tables: Record<
    string,
    Array<Record<string, unknown> & { _id: string }>
  > = {
    users: [
      {
        _id: ids.operator,
        authProviderId: "operator-subject",
        name: "Collection operator",
        role: "warehouse_agent",
        status: "active",
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        _id: ids.driver,
        authProviderId: "driver-subject",
        name: "Assigned driver",
        role: "transporter",
        status: "active",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    warehouseAgents: [
      {
        _id: ids.warehouseAgent,
        userId: ids.operator,
        agentCode: "OPS-1",
        fullName: "Collection operator",
        phoneNumber: "+233200000001",
        assignedWarehouseIds: [],
        status: "approved",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    pilotAssignments: [
      {
        _id: ids.assignment,
        programmeId: ids.programme,
        userId: ids.operator,
        identityKind: "warehouse_agent",
        warehouseAgentId: ids.warehouseAgent,
        capabilities: ["custody:record"],
        status: "active",
        grantedByUserId: ids.operator,
        grantedAt: NOW,
        version: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    pilotProgrammes: [
      {
        _id: ids.programme,
        code: "MAIZE-2026",
        name: "Maize pilot",
        countryCode: "GH",
        currency: "GHS",
        timezone: "Africa/Accra",
        region: "Bono East",
        status: "active",
        datasetProvenance: "sample_only",
        commercialConfigurationStatus: "approved",
        version: 1,
        createdByUserId: ids.operator,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    pilotBuyerRequests: [
      {
        _id: ids.request,
        programmeId: ids.programme,
        buyerId: ids.buyer,
        cropCode: "maize",
        maizeType: "yellow",
        requestedGrams: 2_000,
        confirmedGrams: 2_000,
        destination: LOCATION,
        deliveryWindowStartAt: NOW,
        deliveryWindowEndAt: FUTURE,
        commercialMode: "kuapa_purchase",
        status: "confirmed",
        cancellationState: "none",
        currentAgreementRevisionId: ids.agreement,
        version: 1,
        createdByUserId: ids.operator,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        _id: ids.otherRequest,
        programmeId: ids.programme,
        buyerId: ids.buyer,
        cropCode: "maize",
        maizeType: "yellow",
        requestedGrams: 2_000,
        destination: LOCATION,
        deliveryWindowStartAt: NOW,
        deliveryWindowEndAt: FUTURE,
        commercialMode: "kuapa_purchase",
        status: "confirmed",
        cancellationState: "none",
        currentAgreementRevisionId: ids.agreement,
        version: 1,
        createdByUserId: ids.operator,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    pilotBuyerAgreementRevisions: [
      {
        _id: ids.agreement,
        requestId: ids.request,
        programmeId: ids.programme,
        revision: 1,
        quantityGrams: 2_000,
        commercialMode: "kuapa_purchase",
        producePriceRate: { numerator: 1_000, scale: 1, unit: "per_kg" },
        chargeTerms: [],
        acceptanceRules: [],
        deliveryWindowStartAt: NOW,
        deliveryWindowEndAt: FUTURE,
        paymentTerms: [],
        cancellationTerms: [],
        expiresAt: FUTURE,
        state: "acknowledged",
        createdByUserId: ids.operator,
        createdAt: NOW,
      },
    ],
    pilotFarmerOffers: [
      {
        _id: ids.offer,
        programmeId: ids.programme,
        requestId: ids.request,
        declarationId: "pilotSupplyDeclarations:one",
        farmerId: ids.farmer,
        commercialMode: "kuapa_purchase",
        status: "accepted",
        currentRevisionId: ids.revision,
        acceptedRevisionId: ids.revision,
        expiresAt: FUTURE,
        version: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    pilotFarmerOfferRevisions: [
      {
        _id: ids.revision,
        offerId: ids.offer,
        programmeId: ids.programme,
        requestId: ids.request,
        declarationId: "pilotSupplyDeclarations:one",
        buyerAgreementRevisionId: ids.agreement,
        revision: 1,
        commercialMode: "kuapa_purchase",
        offeredGrams: 2_000,
        priceBasis: "per_kg",
        priceRate: { numerator: 1_000, scale: 1, unit: "per_kg" },
        chargeTerms: [
          {
            code: "WEIGHING",
            label: "One-time weighing charge",
            payer: "farmer",
            calculation: "fixed",
            rate: { numerator: 100, scale: 1, unit: "fixed" },
          },
        ],
        expectedGrossPesewas: 2_000,
        expectedChargesPesewas: 100,
        expectedNetPesewas: 1_900,
        inspectionTerms: [],
        paymentTerms: [
          {
            trigger: "purchase_collection_acceptance",
            offsetCalendarDays: 0,
            timezone: "Africa/Accra",
          },
        ],
        titleTransferTerms: [],
        custodyTransferTerms: [],
        cancellationTerms: [],
        expiresAt: FUTURE,
        createdByUserId: ids.operator,
        createdAt: NOW,
      },
    ],
    pilotAllocations: [
      {
        _id: ids.allocation,
        programmeId: ids.programme,
        requestId: ids.request,
        declarationId: "pilotSupplyDeclarations:one",
        offerId: ids.offer,
        offerRevisionId: ids.revision,
        farmerId: ids.farmer,
        commercialMode: "kuapa_purchase",
        allocatedGrams: 2_000,
        clearedGrams: 2_000,
        releasedGrams: 0,
        status: "quality_cleared",
        version: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    pilotProcurementLots: [
      lot(ids.lot, "LOT-ONE"),
      ...(twoLots ? [lot(ids.secondLot, "LOT-TWO")] : []),
    ],
    pilotInspections: [
      inspection(ids.inspection, ids.lot),
      ...(twoLots ? [inspection(ids.secondInspection, ids.secondLot)] : []),
    ],
    pilotFulfilmentPlans: [
      {
        _id: ids.plan,
        programmeId: ids.programme,
        requestId: ids.request,
        buyerAgreementRevisionId: ids.agreement,
        status: "ready",
        plannedGrams: twoLots ? 2_000 : 1_000,
        transporterId: ids.transporter,
        driverUserId: ids.driver,
        vehicleRegistration: "GT-100-26",
        vehicleCapacityGrams: 2_000,
        collectionWindowStartAt: NOW,
        collectionWindowEndAt: FUTURE,
        deliveryWindowStartAt: NOW,
        deliveryWindowEndAt: FUTURE,
        destination: LOCATION,
        readinessBlockers: [],
        cancellationState: "none",
        version: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    pilotFulfilmentStops: [
      {
        _id: ids.stop,
        programmeId: ids.programme,
        planId: ids.plan,
        sequence: 1,
        stopType: "collection",
        location: LOCATION,
        lotIds: twoLots ? [ids.lot, ids.secondLot] : [ids.lot],
        plannedGrams: twoLots ? 2_000 : 1_000,
        collectedGrams: 0,
        windowStartAt: NOW,
        windowEndAt: FUTURE,
        status: "planned",
        version: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    transporterProfiles: [
      {
        _id: ids.transporter,
        userId: ids.driver,
        fullName: "Assigned driver",
        phoneNumber: "+233200000002",
        vehicleType: "truck",
        baseLocation: "Techiman",
        routesServed: [],
        destinationsServed: [],
        verificationStatus: "verified",
        status: "active",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    uploadAssets: [
      {
        _id: ids.collectionEvidence,
        ownerUserId: ids.operator,
        pilotProgrammeId: ids.programme,
        purpose: "pilot_collection_evidence",
        status: "verified",
        accessLevel: "private",
        bucket: "private",
        objectKey: "collection.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1_024,
        relatedEntityType: "pilotProcurementLots",
        relatedEntityId: ids.lot,
        createdByUserId: ids.operator,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        _id: ids.inspectionEvidence,
        ownerUserId: ids.operator,
        pilotProgrammeId: ids.programme,
        purpose: "pilot_inspection_evidence",
        status: "attached",
        accessLevel: "private",
        bucket: "private",
        objectKey: "inspection.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1_024,
        relatedEntityType: "pilotInspections",
        relatedEntityId: ids.inspection,
        createdByUserId: ids.operator,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    pilotPurchasingBudgets: [
      {
        _id: ids.budget,
        programmeId: ids.programme,
        fundingSourceLabel: "Sample purchase fund",
        fundingSourceReference: "SAMPLE-1",
        fundingEvidenceUploadAssetIds: [],
        datasetProvenance: "sample_only",
        currency: "GHS",
        approvedCapacityPesewas: 5_000,
        reservedPesewas,
        committedPesewas: 0,
        spentPesewas: 0,
        status: "active",
        approvedByUserId: ids.operator,
        approvedAt: NOW,
        version: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    pilotFundingReservations: [
      {
        _id: ids.reservation,
        programmeId: ids.programme,
        budgetId: ids.budget,
        requestId: ids.request,
        buyerAgreementRevisionId: ids.agreement,
        farmerOfferRevisionId: ids.revision,
        produceAmountPesewas,
        knownCostAmountPesewas: 0,
        status: "active",
        consumedPesewas: 0,
        releasedPesewas: 0,
        expiresAt: FUTURE,
        approvedByUserId: ids.operator,
        version: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    pilotIssues: [],
    pilotCustodyEvents: [],
    pilotFinancialEntries: [],
    pilotBudgetEvents: [],
    pilotActivityEvents: [],
    pilotIdempotencyKeys: [],
    pilotPaymentTransactions: [
      {
        _id: ids.buyerPayment,
        programmeId: ids.programme,
        requestId: ids.request,
        buyerId: ids.buyer,
        provider: "mock",
        providerReference: "buyer-payment-1",
        amountPesewas: 2_000,
        currency: "GHS",
        status: "failed",
        idempotencyKey: "buyer-payment-key",
        initializedByUserId: ids.operator,
        failedAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  };

  return {
    db: new InMemoryConvex(tables),
    args: argsFor(ids.lot, ids.inspection, ids.collectionEvidence),
  };
}

function lot(id: string, lotCode: string) {
  return {
    _id: id,
    programmeId: ids.programme,
    requestId: ids.request,
    allocationId: ids.allocation,
    offerRevisionId: ids.revision,
    farmerId: ids.farmer,
    commercialMode: "kuapa_purchase",
    lotCode,
    sourceGrams: 1_000,
    qualityStatus: "passed",
    clearedGrams: 1_000,
    rejectedGrams: 0,
    titleOwnerKind: "farmer",
    titleOwnerFarmerId: ids.farmer,
    currentCustodianKind: "farmer",
    currentCustodianId: ids.farmer,
    currentLocation: LOCATION,
    dispositionStatus: "allocated_to_plan",
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function inspection(id: string, lotId: string) {
  return {
    _id: id,
    programmeId: ids.programme,
    requestId: ids.request,
    lotId,
    allocationId: ids.allocation,
    buyerAgreementRevisionId: ids.agreement,
    samplingMethod: "composite",
    testMethod: "meter",
    sampleCount: 3,
    contaminationResult: "passed",
    additionalReadings: [],
    measuredGrams: 1_000,
    acceptedGrams: 1_000,
    rejectedGrams: 0,
    qualityStatus: "passed",
    evidenceUploadAssetIds: [ids.inspectionEvidence],
    inspectedByUserId: ids.operator,
    inspectedAt: NOW,
    createdAt: NOW,
  };
}

function argsFor(lotId: string, inspectionId: string, evidenceId: string) {
  return {
    requestId: ids.request,
    lotId,
    planId: ids.plan,
    stopId: ids.stop,
    farmerOfferRevisionId: ids.revision,
    inspectionId,
    buyerAgreementRevisionId: ids.agreement,
    acceptedGrams: 1_000,
    evidenceUploadAssetIds: [evidenceId],
    fundingReservationId: ids.reservation,
    expectedFundingReservationVersion: 1,
    expectedBudgetVersion: 1,
    expectedLotVersion: 1,
    expectedPlanVersion: 1,
    idempotencyKey: `purchase-${lotId}`,
  } as PurchaseArgs;
}

function invoke(
  db: InMemoryConvex,
  args: PurchaseArgs,
  identity: { subject: string } | null = { subject: "operator-subject" },
  failure?: FailurePoint,
) {
  return db.transaction(
    identity,
    (ctx) =>
      acceptCollectionPurchaseHandler(
        ctx as Parameters<typeof acceptCollectionPurchaseHandler>[0],
        args,
      ),
    failure,
  );
}

function purchaseEntries(db: InMemoryConvex) {
  return db.all("pilotFinancialEntries").filter(
    (entry) => entry.lotId === ids.lot,
  );
}

function expectNoPurchaseWrites(db: InMemoryConvex) {
  expect(db.all("pilotFinancialEntries")).toHaveLength(0);
  expect(db.all("pilotBudgetEvents")).toHaveLength(0);
  expect(db.all("pilotCustodyEvents")).toHaveLength(0);
  expect(db.all("pilotActivityEvents")).toHaveLength(0);
  expect(db.all("pilotIdempotencyKeys")).toHaveLength(0);
  expect(db.get(ids.lot)).toMatchObject({
    titleOwnerKind: "farmer",
    version: 1,
  });
  expect(db.get(ids.budget)).toMatchObject({
    reservedPesewas: expect.any(Number),
    committedPesewas: 0,
    version: 1,
  });
}

describe("acceptCollectionPurchaseHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("commits title, custody, funding, farmer payable and activity once", async () => {
    const { db, args } = fixture();

    const first = await invoke(db, args);
    const replay = await invoke(db, args);

    expect(replay).toEqual(first);
    expect(db.get(ids.lot)).toMatchObject({
      titleOwnerKind: "kuapa_dwaso",
      titleOwnerFarmerId: undefined,
      currentCustodianKind: "transporter",
      currentCustodianId: ids.transporter,
      version: 2,
    });
    expect(db.get(ids.budget)).toMatchObject({
      reservedPesewas: 1_100,
      committedPesewas: 900,
      version: 2,
    });
    expect(db.get(ids.reservation)).toMatchObject({
      consumedPesewas: 900,
      status: "partly_consumed",
      version: 2,
    });
    expect(db.all("pilotCustodyEvents")).toHaveLength(1);
    expect(db.all("pilotBudgetEvents")).toHaveLength(1);
    expect(db.all("pilotActivityEvents")).toHaveLength(1);
    expect(db.all("pilotIdempotencyKeys")).toHaveLength(1);
    expect(purchaseEntries(db)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          postingKind: "obligation",
          purpose: "farmer_proceeds",
          amountPesewas: 900,
          dueAt: Date.UTC(2026, 6, 8, 23, 59, 59, 999),
        }),
        expect.objectContaining({
          postingKind: "cost",
          purpose: "purchase_inventory",
          amountPesewas: 900,
        }),
      ]),
    );
  });

  it("allows the assigned driver to use the same atomic purchase boundary", async () => {
    const { db, args } = fixture();
    await db.transaction({ subject: "operator-subject" }, async (ctx) =>
      void (await (
        ctx as {
          db: { patch: (id: string, value: object) => Promise<void> };
        }
      ).db.patch(ids.collectionEvidence, { ownerUserId: ids.driver })),
    );

    await invoke(db, args, { subject: "driver-subject" });

    expect(db.get(ids.lot)).toMatchObject({
      titleOwnerKind: "kuapa_dwaso",
      currentCustodianKind: "transporter",
    });
  });

  it("rolls back the idempotency receipt and every write on an unauthenticated call", async () => {
    const { db, args } = fixture();

    await expect(invoke(db, args, null)).rejects.toThrow(
      "Authentication is required for pilot access.",
    );
    expectNoPurchaseWrites(db);
  });

  it.each([
    ["stale budget version", { expectedBudgetVersion: 2 }, /stale|expired|inactive/i],
    ["expired reservation", {}, /stale|expired|inactive/i],
  ])("rejects %s without leaving partial state", async (label, override, error) => {
    const { db, args } = fixture();
    if (label === "expired reservation")
      await db.transaction({ subject: "operator-subject" }, async (ctx) =>
        void (await (
          ctx as {
            db: { patch: (id: string, value: object) => Promise<void> };
          }
        ).db.patch(ids.reservation, { expiresAt: NOW })),
      );

    await expect(invoke(db, { ...args, ...override })).rejects.toThrow(error);
    expectNoPurchaseWrites(db);
  });

  it("rejects produce that exceeds the reservation even when known-cost funds exist", async () => {
    const { db, args } = fixture({
      reservedPesewas: 1_000,
      produceAmountPesewas: 800,
    });
    await db.transaction({ subject: "operator-subject" }, async (ctx) =>
      (ctx as { db: { patch: (id: string, value: object) => Promise<void> } }).db.patch(
        ids.reservation,
        { knownCostAmountPesewas: 200 },
      ),
    );

    await expect(invoke(db, args)).rejects.toThrow(
      "Reserved purchase capacity is insufficient; known-cost capacity cannot fund produce.",
    );
    expectNoPurchaseWrites(db);
  });

  it("rejects an idempotency key reused with a different payload", async () => {
    const { db, args } = fixture();
    await invoke(db, args);

    await expect(
      invoke(db, { ...args, acceptedGrams: 999 }),
    ).rejects.toThrow("Idempotency key was already used with a different payload.");
    expect(db.all("pilotFinancialEntries")).toHaveLength(2);
    expect(db.all("pilotCustodyEvents")).toHaveLength(1);
  });

  it("rejects collection evidence owned by another actor", async () => {
    const { db, args } = fixture();
    await db.transaction({ subject: "operator-subject" }, async (ctx) =>
      (ctx as { db: { patch: (id: string, value: object) => Promise<void> } }).db.patch(
        ids.collectionEvidence,
        { ownerUserId: ids.driver },
      ),
    );

    await expect(invoke(db, args)).rejects.toThrow(
      "Collection evidence must be completed, private, actor-owned and staged against this lot.",
    );
    expectNoPurchaseWrites(db);
  });

  it("rejects a lot linked to another request and rolls back the started receipt", async () => {
    const { db, args } = fixture();

    await expect(
      invoke(db, { ...args, requestId: ids.otherRequest }),
    ).rejects.toThrow(
      "Purchase requires current confirmed buyer terms without cancellation.",
    );
    expectNoPurchaseWrites(db);
  });

  it("rolls back an already inserted payable when the inventory insert fails", async () => {
    const { db, args } = fixture();

    await expect(
      invoke(db, args, { subject: "operator-subject" }, {
        operation: "insert",
        table: "pilotFinancialEntries",
        occurrence: 2,
      }),
    ).rejects.toThrow("Injected insert failure for pilotFinancialEntries.");
    expectNoPurchaseWrites(db);
  });

  it("serializes two lots competing for one insufficient reservation so only one commits", async () => {
    const { db, args } = fixture({
      twoLots: true,
      reservedPesewas: 1_500,
      produceAmountPesewas: 1_500,
    });
    const secondArgs = argsFor(
      ids.secondLot,
      ids.secondInspection,
      ids.collectionEvidence,
    );
    await db.transaction({ subject: "operator-subject" }, async (ctx) =>
      (ctx as { db: { patch: (id: string, value: object) => Promise<void> } }).db.patch(
        ids.collectionEvidence,
        { relatedEntityId: ids.secondLot },
      ),
    );

    const outcomes = await Promise.allSettled([
      invoke(db, args),
      invoke(db, secondArgs),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(db.all("pilotCustodyEvents")).toHaveLength(1);
    expect(db.all("pilotFinancialEntries")).toHaveLength(2);
    expect(db.get(ids.budget)).toMatchObject({
      reservedPesewas: 600,
      committedPesewas: 900,
      version: 2,
    });
  });

  it("charges a fixed farmer fee once when an accepted offer is split into two lots", async () => {
    const { db, args } = fixture({ twoLots: true });
    await db.transaction({ subject: "operator-subject" }, async (ctx) => {
      const mutationCtx = ctx as {
        db: {
          insert: (table: string, value: Record<string, unknown>) => Promise<string>;
        };
      };
      await mutationCtx.db.insert("uploadAssets", {
        ownerUserId: ids.operator,
        pilotProgrammeId: ids.programme,
        purpose: "pilot_collection_evidence",
        status: "verified",
        accessLevel: "private",
        bucket: "private",
        objectKey: "collection-two.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1_024,
        relatedEntityType: "pilotProcurementLots",
        relatedEntityId: ids.secondLot,
        createdByUserId: ids.operator,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });
    // The generated ID is deterministic for this fixture's first inserted row.
    const insertedEvidenceId = db
      .all("uploadAssets")
      .find((asset) => asset.objectKey === "collection-two.jpg")!._id as string;

    await invoke(db, args);
    await invoke(db, {
      ...argsFor(ids.secondLot, ids.secondInspection, insertedEvidenceId),
      expectedFundingReservationVersion: 2,
      expectedBudgetVersion: 2,
      expectedPlanVersion: 2,
    });

    const payables = db
      .all("pilotFinancialEntries")
      .filter((entry) => entry.purpose === "farmer_proceeds");
    expect(payables.map((entry) => entry.amountPesewas)).toEqual([900, 1_000]);
    expect(db.get(ids.budget)).toMatchObject({
      reservedPesewas: 100,
      committedPesewas: 1_900,
      version: 3,
    });
  });

  it("keeps the farmer payable when buyer payment remains failed", async () => {
    const { db, args } = fixture();
    await invoke(db, args);

    expect(db.get(ids.buyerPayment)).toMatchObject({ status: "failed" });
    expect(
      db
        .all("pilotFinancialEntries")
        .filter((entry) => entry.purpose === "farmer_proceeds"),
    ).toEqual([
      expect.objectContaining({
        postingKind: "obligation",
        payee: expect.objectContaining({ kind: "farmer", id: ids.farmer }),
        amountPesewas: 900,
      }),
    ]);
  });
});
