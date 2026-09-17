import { isActivePreviewProgramme } from "@kuapa-dwaso/permissions/pilot";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { requirePilotPrincipal } from "./pilotAccess";
import { assertAllowed } from "./workflowHelpers";

const confirmationToken = "PROVISION_PREVIEW_ACTORS";
const programmeCode = "MAIZE-PREVIEW-2026";
const datasetId = "temporary-public-preview-2026-09";
const hour = 60 * 60 * 1_000;

const location = {
  label: "Tarkwa collection point",
  region: "Western",
  district: "Tarkwa-Nsuaem Municipal",
};
const destination = {
  label: "Takoradi buyer receiving point",
  region: "Western",
  district: "Sekondi-Takoradi Metropolitan",
};
const qualityPolicy = {
  maizeType: "Yellow maize",
  moistureMaximumPermille: 135,
  contaminationCheckRequired: true,
  additionalCriteria: [
    { code: "clean_bags", label: "Clean, sealed bags", required: true },
  ],
  policyProvenance: "live" as const,
};
const sellerCoordinationCharge = {
  code: "preview_seller_coordination_fee",
  label: "Coordination fee",
  payer: "farmer" as const,
  calculation: "percent_of_produce" as const,
  rate: { numerator: 3, scale: 100, unit: "percent" as const },
};
const buyerCharges = [
  {
    code: "preview_transport_charge",
    label: "Collection and delivery",
    payer: "buyer" as const,
    calculation: "per_kg" as const,
    rate: { numerator: 30, scale: 1, unit: "per_kg" as const },
  },
  {
    code: "preview_handling_charge",
    label: "Handling",
    payer: "buyer" as const,
    calculation: "per_kg" as const,
    rate: { numerator: 10, scale: 1, unit: "per_kg" as const },
  },
] as const;

export const run = mutation({
  args: {
    farmerUserId: v.id("users"),
    farmerId: v.id("farmers"),
    buyerUserId: v.id("users"),
    buyerId: v.id("buyers"),
    transporterUserId: v.id("users"),
    transporterId: v.id("transporterProfiles"),
    operationsUserId: v.id("users"),
    startAt: v.number(),
    endAt: v.number(),
    cutoffAt: v.number(),
    confirm: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    assertAllowed(
      principal.role === "admin",
      "Preview setup requires an authenticated administrator.",
    );
    assertAllowed(
      args.confirm === confirmationToken,
      `Preview setup requires the exact confirmation token ${confirmationToken}.`,
    );
    const now = Date.now();
    assertAllowed(
      Number.isSafeInteger(args.startAt) &&
        Number.isSafeInteger(args.endAt) &&
        Number.isSafeInteger(args.cutoffAt) &&
        args.startAt <= now &&
        now < args.cutoffAt &&
        args.cutoffAt <= args.endAt &&
        args.endAt - args.startAt <= 14 * 24 * hour &&
        args.cutoffAt - now > 10 * hour,
      "Preview setup needs a current window and at least ten hours before cutoff.",
    );

    const [
      farmerUser,
      farmer,
      buyerUser,
      buyer,
      transporterUser,
      transporter,
      operationsUser,
    ] = await Promise.all([
      ctx.db.get(args.farmerUserId),
      ctx.db.get(args.farmerId),
      ctx.db.get(args.buyerUserId),
      ctx.db.get(args.buyerId),
      ctx.db.get(args.transporterUserId),
      ctx.db.get(args.transporterId),
      ctx.db.get(args.operationsUserId),
    ]);
    assertAllowed(
      farmerUser?.role === "farmer" && farmer?.userId === farmerUser._id,
      "Farmer user and profile do not match.",
    );
    assertAllowed(
      buyerUser?.role === "buyer" && buyer?.userId === buyerUser._id,
      "Buyer user and profile do not match.",
    );
    assertAllowed(
      transporterUser?.role === "transporter" &&
        transporter?.userId === transporterUser._id,
      "Transporter user and profile do not match.",
    );
    assertAllowed(
      operationsUser?.role === "warehouse_agent",
      "Operations user does not have the operations role.",
    );
    assertAllowed(
      new Set([
        args.farmerUserId,
        args.buyerUserId,
        args.transporterUserId,
        args.operationsUserId,
      ]).size === 4,
      "Preview setup requires four distinct users.",
    );

    const programme = await ensureProgramme(ctx, principal._id, args.cutoffAt);
    const operationsProfileId = await ensureOperationsProfile(ctx, {
      operationsUser,
      adminUserId: principal._id,
    });
    await Promise.all([
      ctx.db.patch(farmer._id, {
        community: "Tarkwa",
        region: "Western",
        verificationStatus: "verified",
        status: "active",
        updatedAt: now,
      }),
      ctx.db.patch(buyer._id, {
        destinationMarket: destination.label,
        verificationStatus: "verified",
        status: "active",
        updatedAt: now,
      }),
      ctx.db.patch(transporter._id, {
        baseLocation: "Tarkwa",
        routesServed: ["Tarkwa to Takoradi"],
        destinationsServed: [destination.label],
        verificationStatus: "verified",
        status: "active",
        vehicleCapacity: 200,
        vehicleCapacityUnit: "50kg bags",
        updatedAt: now,
      }),
    ]);
    const assignmentId = await ensureOperationsAssignment(ctx, {
      programmeId: programme._id,
      operationsUserId: operationsUser._id,
      operationsProfileId,
      adminUserId: principal._id,
      cutoffAt: args.cutoffAt,
    });
    const backgroundFarmers = await Promise.all([
      ensureBackgroundFarmer(ctx, {
        farmerCode: "PREVIEW-FARMER-KOFI-2026",
        fullName: "Kofi Antwi",
        community: "Nsuta",
        phoneNumber: farmer.phoneNumber,
      }),
      ensureBackgroundFarmer(ctx, {
        farmerCode: "PREVIEW-FARMER-ABENA-2026",
        fullName: "Abena Serwaa",
        community: "Aboso",
        phoneNumber: farmer.phoneNumber,
      }),
    ]);

    const jobs = [];
    for (const [index, bags] of [100, 150, 200].entries()) {
      jobs.push(
        await ensureReadyJob(ctx, {
          programme,
          buyerId: buyer._id,
          buyerUserId: buyerUser._id,
          farmerSources:
            index === 0
              ? [
                  {
                    farmerId: farmer._id,
                    fullName: farmer.fullName,
                    collectionLabel: "Ama Mensah farm gate, Tarkwa",
                    bags: 40,
                  },
                  {
                    farmerId: backgroundFarmers[0].farmerId,
                    fullName: backgroundFarmers[0].fullName,
                    collectionLabel: "Kofi Antwi farm gate, Nsuta",
                    bags: 30,
                  },
                  {
                    farmerId: backgroundFarmers[1].farmerId,
                    fullName: backgroundFarmers[1].fullName,
                    collectionLabel: "Abena Serwaa farm gate, Aboso",
                    bags: 30,
                  },
                ]
              : [
                  {
                    farmerId: farmer._id,
                    fullName: farmer.fullName,
                    collectionLabel: "Ama Mensah farm gate, Tarkwa",
                    bags,
                  },
                ],
          transporterId: transporter._id,
          transporterUserId: transporterUser._id,
          operationsUserId: operationsUser._id,
          cutoffAt: args.cutoffAt,
          index,
          bags,
        }),
      );
    }

    return {
      programmeId: programme._id,
      programmeCode,
      assignmentId,
      operationsProfileId,
      backgroundFarmers,
      previewCoordinationUntil: args.cutoffAt,
      jobs,
    };
  },
});

async function ensureProgramme(
  ctx: MutationCtx,
  adminUserId: Id<"users">,
  cutoffAt: number,
): Promise<Doc<"pilotProgrammes">> {
  const now = Date.now();
  const existing = await ctx.db
    .query("pilotProgrammes")
    .withIndex("by_code", (query) => query.eq("code", programmeCode))
    .unique();
  if (existing !== null) {
    assertAllowed(
      existing.datasetId === datasetId &&
        existing.datasetProvenance === "live" &&
        existing.createdByUserId === adminUserId,
      "The preview programme code belongs to unrelated data.",
    );
    await ctx.db.patch(existing._id, {
      name: "Tarkwa maize connections",
      region: "Western",
      district: "Tarkwa-Nsuaem Municipal",
      status: "active",
      previewCoordinationUntil: cutoffAt,
      commercialConfigurationStatus: "approved",
      currentCommercialConfiguration: programmeConfiguration(),
      version: existing.version + 1,
      updatedAt: now,
    });
    return (await ctx.db.get(existing._id))!;
  }
  const id = await ctx.db.insert("pilotProgrammes", {
    code: programmeCode,
    name: "Tarkwa maize connections",
    countryCode: "GH",
    currency: "GHS",
    timezone: "Africa/Accra",
    region: "Western",
    district: "Tarkwa-Nsuaem Municipal",
    status: "active",
    datasetProvenance: "live",
    datasetId,
    previewCoordinationUntil: cutoffAt,
    commercialConfigurationStatus: "approved",
    currentCommercialConfiguration: programmeConfiguration(),
    version: 0,
    createdByUserId: adminUserId,
    createdAt: now,
    updatedAt: now,
  });
  return (await ctx.db.get(id))!;
}

function programmeConfiguration() {
  return {
    qualityPolicy,
    chargeTerms: [sellerCoordinationCharge, ...buyerCharges],
    paymentTerms: [
      {
        trigger: "buyer_acceptance" as const,
        offsetCalendarDays: 1,
        timezone: "Africa/Accra" as const,
      },
    ],
    taxTerms: [],
    approvalReferences: ["temporary-preview-coordination"],
  };
}

async function ensureOperationsAssignment(
  ctx: MutationCtx,
  input: {
    programmeId: Id<"pilotProgrammes">;
    operationsUserId: Id<"users">;
    operationsProfileId: Id<"warehouseAgents">;
    adminUserId: Id<"users">;
    cutoffAt: number;
  },
) {
  const assignments = await ctx.db
    .query("pilotAssignments")
    .withIndex("by_programme_user", (query) =>
      query
        .eq("programmeId", input.programmeId)
        .eq("userId", input.operationsUserId),
    )
    .collect();
  assertAllowed(
    assignments.length <= 1,
    "Preview operations user has conflicting programme assignments.",
  );
  const capabilities = [
    "pilot:read",
    "requests:review",
    "supply:manage",
    "offers:manage",
    "quality:record",
    "fulfilment:manage",
    "custody:record",
    "issues:manage",
  ] as const;
  const now = Date.now();
  const existing = assignments[0];
  if (existing !== undefined) {
    assertAllowed(
      existing.identityKind === "warehouse_agent" &&
        (existing.warehouseAgentId === undefined ||
          existing.warehouseAgentId === input.operationsProfileId),
      "Preview operations assignment is linked to another profile.",
    );
    await ctx.db.patch(existing._id, {
      capabilities: [...capabilities],
      status: "active",
      warehouseAgentId: input.operationsProfileId,
      expiresAt: input.cutoffAt,
      revokedByUserId: undefined,
      revokedAt: undefined,
      revocationReason: undefined,
      version: existing.version + 1,
      updatedAt: now,
    });
    return existing._id;
  }
  return await ctx.db.insert("pilotAssignments", {
    programmeId: input.programmeId,
    userId: input.operationsUserId,
    identityKind: "warehouse_agent",
    warehouseAgentId: input.operationsProfileId,
    capabilities: [...capabilities],
    status: "active",
    grantedByUserId: input.adminUserId,
    grantedAt: now,
    expiresAt: input.cutoffAt,
    version: 0,
    createdAt: now,
    updatedAt: now,
  });
}

async function ensureOperationsProfile(
  ctx: MutationCtx,
  input: {
    operationsUser: Doc<"users">;
    adminUserId: Id<"users">;
  },
) {
  assertAllowed(
    input.operationsUser.phoneNumber !== undefined,
    "Operations user needs the configured team phone number.",
  );
  const profiles = await ctx.db
    .query("warehouseAgents")
    .withIndex("by_user", (query) =>
      query.eq("userId", input.operationsUser._id),
    )
    .collect();
  assertAllowed(
    profiles.length <= 1,
    "Operations user has conflicting profiles.",
  );
  const now = Date.now();
  const existing = profiles[0];
  if (existing !== undefined) {
    assertAllowed(
      existing.assignedWarehouseIds.length === 0,
      "Operations preview profile is already assigned to warehouse work.",
    );
    await ctx.db.patch(existing._id, {
      fullName: "Akosua Boateng",
      phoneNumber: input.operationsUser.phoneNumber,
      status: "approved",
      approvedBy: input.adminUserId,
      approvedAt: now,
      updatedAt: now,
    });
    return existing._id;
  }
  return await ctx.db.insert("warehouseAgents", {
    userId: input.operationsUser._id,
    agentCode: "PREVIEW-OPS-2026",
    fullName: "Akosua Boateng",
    phoneNumber: input.operationsUser.phoneNumber,
    assignedWarehouseIds: [],
    status: "approved",
    approvedBy: input.adminUserId,
    approvedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

async function ensureBackgroundFarmer(
  ctx: MutationCtx,
  input: {
    farmerCode: string;
    fullName: string;
    community: string;
    phoneNumber: string;
  },
) {
  const existing = await ctx.db
    .query("farmers")
    .withIndex("by_farmer_code", (query) =>
      query.eq("farmerCode", input.farmerCode),
    )
    .unique();
  const now = Date.now();
  if (existing !== null) {
    assertAllowed(
      existing.userId !== undefined &&
        existing.registrationSource === "admin" &&
        existing.preferredWarehouseId === undefined,
      `${input.farmerCode} belongs to unrelated farmer data.`,
    );
    const user = await ctx.db.get(existing.userId);
    assertAllowed(
      user !== null &&
        user.role === "farmer" &&
        user.authProviderId === undefined &&
        user.name === input.fullName,
      `${input.farmerCode} is not a background-only preview farmer.`,
    );
    await ctx.db.patch(existing._id, {
      fullName: input.fullName,
      phoneNumber: input.phoneNumber,
      community: input.community,
      region: "Western",
      verificationStatus: "verified",
      status: "active",
      updatedAt: now,
    });
    return {
      userId: user._id,
      farmerId: existing._id,
      fullName: input.fullName,
    };
  }
  const userId = await ctx.db.insert("users", {
    name: input.fullName,
    role: "farmer",
    status: "active",
    phoneVerified: false,
    mfaRequirement: "not_required",
    mfaStatus: "not_required",
    onboardingState: "complete",
    createdAt: now,
    updatedAt: now,
  });
  const farmerId = await ctx.db.insert("farmers", {
    userId,
    farmerCode: input.farmerCode,
    fullName: input.fullName,
    phoneNumber: input.phoneNumber,
    community: input.community,
    region: "Western",
    registrationSource: "admin",
    verificationStatus: "verified",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  return { userId, farmerId, fullName: input.fullName };
}

async function ensureReadyJob(
  ctx: MutationCtx,
  input: {
    programme: Doc<"pilotProgrammes">;
    buyerId: Id<"buyers">;
    buyerUserId: Id<"users">;
    farmerSources: Array<{
      farmerId: Id<"farmers">;
      fullName: string;
      collectionLabel: string;
      bags: number;
    }>;
    transporterId: Id<"transporterProfiles">;
    transporterUserId: Id<"users">;
    operationsUserId: Id<"users">;
    cutoffAt: number;
    index: number;
    bags: number;
  },
) {
  assertAllowed(
    isActivePreviewProgramme(input.programme, Date.now()),
    "Preview programme is not active.",
  );
  const previewSeedKey = `public-preview-${input.bags}-bags-v2`;
  const existing = await ctx.db
    .query("pilotBuyerRequests")
    .withIndex("by_preview_seed_key", (query) =>
      query.eq("previewSeedKey", previewSeedKey),
    )
    .unique();
  if (existing !== null) {
    assertAllowed(
      existing.programmeId === input.programme._id &&
        existing.buyerId === input.buyerId &&
        existing.commercialMode === "coordination",
      "A preview seed key belongs to another transaction.",
    );
    const plans = await ctx.db
      .query("pilotFulfilmentPlans")
      .withIndex("by_request", (query) => query.eq("requestId", existing._id))
      .collect();
    const [lots, entries] = await Promise.all([
      ctx.db
        .query("pilotProcurementLots")
        .withIndex("by_request_disposition", (query) =>
          query.eq("requestId", existing._id),
        )
        .collect(),
      ctx.db
        .query("pilotFinancialEntries")
        .withIndex("by_request_created_at", (query) =>
          query.eq("requestId", existing._id),
        )
        .collect(),
    ]);
    assertAllowed(
      plans.length === 1 &&
        plans[0]!.status === "ready" &&
        plans[0]!.driverUserId === input.transporterUserId &&
        lots.length === input.farmerSources.length,
      "Existing preview transaction is no longer in its prepared state.",
    );
    if (input.index === 0) {
      assertAllowed(
        entries.filter((entry) => entry.purpose === "buyer_produce").length ===
          3 &&
          entries.filter((entry) => entry.purpose === "coordination_fee")
            .length === 3 &&
          entries.filter((entry) => entry.purpose === "buyer_transport")
            .length === 1 &&
          entries.filter((entry) => entry.purpose === "other_agreed_cost")
            .length === 1,
        "Existing preview transaction does not contain the expected marketplace ledger.",
      );
    } else {
      assertAllowed(
        entries.length === 0,
        "A non-finance preview route contains unexpected financial entries.",
      );
    }
    const now = Date.now();
    await ctx.db.patch(existing._id, { destination, updatedAt: now });
    const offers = await ctx.db
      .query("pilotFarmerOffers")
      .withIndex("by_request_status", (query) =>
        query.eq("requestId", existing._id),
      )
      .collect();
    for (const offer of offers) {
      const declaration = await ctx.db.get(offer.declarationId);
      const source = input.farmerSources.find(
        (candidate) => candidate.farmerId === offer.farmerId,
      );
      if (declaration !== null && source !== undefined) {
        await ctx.db.patch(declaration._id, {
          collectionLocation: { ...location, label: source.collectionLabel },
          updatedAt: now,
        });
      }
    }
    for (const lot of lots) {
      const source = input.farmerSources.find(
        (candidate) => candidate.farmerId === lot.farmerId,
      );
      if (source !== undefined) {
        await ctx.db.patch(lot._id, {
          currentLocation: { ...location, label: source.collectionLabel },
          updatedAt: now,
        });
      }
    }
    const stops = await ctx.db
      .query("pilotFulfilmentStops")
      .withIndex("by_plan_sequence", (query) =>
        query.eq("planId", plans[0]!._id),
      )
      .collect();
    for (const stop of stops) {
      if (stop.stopType === "destination") {
        await ctx.db.patch(stop._id, { location: destination });
        continue;
      }
      const stopLot = lots.find((lot) => stop.lotIds.includes(lot._id));
      const source = input.farmerSources.find(
        (candidate) => candidate.farmerId === stopLot?.farmerId,
      );
      if (source !== undefined) {
        await ctx.db.patch(stop._id, {
          location: { ...location, label: source.collectionLabel },
        });
      }
    }
    return {
      bags: input.bags,
      requestId: existing._id,
      sourceLots: lots.map((lot) => ({ lotId: lot._id })),
      planId: plans[0]!._id,
      status: "ready" as const,
    };
  }

  const now = Date.now();
  const grams = input.bags * 50 * 1_000;
  const collectionStartAt = now + (2 + input.index * 2) * hour;
  const collectionEndAt = collectionStartAt + hour;
  const deliveryStartAt = collectionEndAt + hour;
  const deliveryEndAt = deliveryStartAt + 2 * hour;
  assertAllowed(
    deliveryEndAt < input.cutoffAt,
    "Preview cutoff does not cover all prepared collection jobs.",
  );
  const requestId = await ctx.db.insert("pilotBuyerRequests", {
    programmeId: input.programme._id,
    buyerId: input.buyerId,
    cropCode: "maize",
    maizeType: qualityPolicy.maizeType,
    requestedGrams: grams,
    confirmedGrams: grams,
    destination,
    deliveryWindowStartAt: deliveryStartAt,
    deliveryWindowEndAt: deliveryEndAt,
    requestedSpecification: qualityPolicy,
    paymentExpectation: {
      trigger: "buyer_acceptance",
      offsetCalendarDays: 1,
      timezone: "Africa/Accra",
    },
    commercialMode: "coordination",
    previewSeedKey,
    status: "fulfilling",
    cancellationState: "none",
    version: 0,
    createdByUserId: input.buyerUserId,
    submittedAt: now,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  const agreementId = await ctx.db.insert("pilotBuyerAgreementRevisions", {
    requestId,
    programmeId: input.programme._id,
    revision: 1,
    quantityGrams: grams,
    commercialMode: "coordination",
    specification: qualityPolicy,
    producePriceRate: { numerator: 500, scale: 1, unit: "per_kg" },
    chargeTerms: [...buyerCharges],
    acceptanceRules: [
      {
        code: "quality_cleared_quantity",
        label: "Quality-cleared quantity",
        detail: "The buyer accepts the quantity cleared before collection.",
      },
    ],
    deliveryWindowStartAt: deliveryStartAt,
    deliveryWindowEndAt: deliveryEndAt,
    paymentTerms: [
      {
        trigger: "buyer_acceptance",
        offsetCalendarDays: 1,
        timezone: "Africa/Accra",
      },
    ],
    cancellationTerms: [
      {
        code: "before_collection",
        label: "Before collection",
        detail: "The parties record a reason if they cancel before collection.",
      },
    ],
    expiresAt: input.cutoffAt,
    state: "acknowledged",
    buyerAcknowledgedByUserId: input.buyerUserId,
    buyerAcknowledgedAt: now,
    createdByUserId: input.operationsUserId,
    createdAt: now,
  });
  await ctx.db.patch(requestId, { currentAgreementRevisionId: agreementId });

  assertAllowed(
    input.farmerSources.reduce((sum, source) => sum + source.bags, 0) ===
      input.bags,
    "Preview farmer lots must equal the buyer request quantity.",
  );
  const sources = [];
  for (const [sourceIndex, source] of input.farmerSources.entries()) {
    const sourceGrams = source.bags * 50 * 1_000;
    const sourceLocation = {
      ...location,
      label: source.collectionLabel,
    };
    const declarationId = await ctx.db.insert("pilotSupplyDeclarations", {
      programmeId: input.programme._id,
      farmerId: source.farmerId,
      cropCode: "maize",
      maizeType: qualityPolicy.maizeType,
      availableGrams: sourceGrams,
      readinessWindowStartAt: collectionStartAt - hour,
      readinessWindowEndAt: collectionEndAt,
      collectionLocation: sourceLocation,
      verificationStatus: "reviewed",
      status: "exhausted",
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    const offerId = await ctx.db.insert("pilotFarmerOffers", {
      programmeId: input.programme._id,
      requestId,
      declarationId,
      farmerId: source.farmerId,
      commercialMode: "coordination",
      status: "accepted",
      decisionAt: now,
      expiresAt: input.cutoffAt,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    const expectedGrossPesewas = source.bags * 50 * 500;
    const expectedChargesPesewas = Math.round((expectedGrossPesewas * 3) / 100);
    const offerRevisionId = await ctx.db.insert("pilotFarmerOfferRevisions", {
      offerId,
      programmeId: input.programme._id,
      requestId,
      declarationId,
      buyerAgreementRevisionId: agreementId,
      revision: 1,
      commercialMode: "coordination",
      offeredGrams: sourceGrams,
      priceBasis: "per_kg",
      priceRate: { numerator: 500, scale: 1, unit: "per_kg" },
      chargeTerms: [sellerCoordinationCharge],
      expectedGrossPesewas,
      expectedChargesPesewas,
      expectedNetPesewas: expectedGrossPesewas - expectedChargesPesewas,
      inspectionTerms: [
        {
          code: "field_sampling",
          label: "Inspection before collection",
          detail: "Operations checks weight, moisture, and contamination.",
        },
      ],
      paymentTerms: [
        {
          trigger: "buyer_acceptance",
          offsetCalendarDays: 1,
          timezone: "Africa/Accra",
        },
      ],
      titleTransferTerms: [
        {
          code: "farmer_to_buyer",
          label: "Farmer to buyer",
          detail:
            "The farmer keeps title until the buyer accepts the delivered maize. Kuapa Dwaso never takes title.",
        },
      ],
      custodyTransferTerms: [
        {
          code: "recorded_handover",
          label: "Recorded handover",
          detail: "The parties record collection and delivery handovers.",
        },
      ],
      cancellationTerms: [
        {
          code: "before_collection",
          label: "Before collection",
          detail:
            "The parties record a reason if they cancel before collection.",
        },
      ],
      expiresAt: input.cutoffAt,
      createdByUserId: input.operationsUserId,
      createdAt: now,
    });
    await ctx.db.patch(offerId, {
      currentRevisionId: offerRevisionId,
      acceptedRevisionId: offerRevisionId,
    });
    const allocationId = await ctx.db.insert("pilotAllocations", {
      programmeId: input.programme._id,
      requestId,
      declarationId,
      offerId,
      offerRevisionId,
      farmerId: source.farmerId,
      commercialMode: "coordination",
      allocatedGrams: sourceGrams,
      clearedGrams: sourceGrams,
      releasedGrams: 0,
      status: "quality_cleared",
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    const lotId = await ctx.db.insert("pilotProcurementLots", {
      programmeId: input.programme._id,
      requestId,
      allocationId,
      offerRevisionId,
      farmerId: source.farmerId,
      commercialMode: "coordination",
      lotCode: `PREVIEW-${input.bags}-${sourceIndex + 1}`,
      sourceGrams,
      qualityStatus: "passed",
      clearedGrams: sourceGrams,
      rejectedGrams: 0,
      titleOwnerKind: "farmer",
      titleOwnerFarmerId: source.farmerId,
      currentCustodianKind: "farmer",
      currentCustodianId: String(source.farmerId),
      currentLocation: sourceLocation,
      dispositionStatus: "allocated_to_plan",
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    const inspectionId = await ctx.db.insert("pilotInspections", {
      programmeId: input.programme._id,
      requestId,
      lotId,
      allocationId,
      buyerAgreementRevisionId: agreementId,
      samplingMethod: "Representative bag sample",
      testMethod: "Moisture meter and visual check",
      sampleCount: 3,
      moisturePermille: 130,
      contaminationResult: "passed",
      additionalReadings: [
        {
          code: "clean_bags",
          label: "Clean, sealed bags",
          value: "passed",
          passed: true,
        },
      ],
      grossWeightGrams: sourceGrams,
      tareWeightGrams: 0,
      measuredGrams: sourceGrams,
      acceptedGrams: sourceGrams,
      rejectedGrams: 0,
      qualityStatus: "passed",
      notes: "Prepared coordination preview inspection.",
      evidenceUploadAssetIds: [],
      inspectedByUserId: input.operationsUserId,
      inspectedAt: now,
      createdAt: now,
    });
    sources.push({
      ...source,
      sourceGrams,
      sourceLocation,
      declarationId,
      offerId,
      offerRevisionId,
      allocationId,
      lotId,
      inspectionId,
      expectedGrossPesewas,
      expectedChargesPesewas,
    });
  }
  const planId = await ctx.db.insert("pilotFulfilmentPlans", {
    programmeId: input.programme._id,
    requestId,
    buyerAgreementRevisionId: agreementId,
    status: "ready",
    plannedGrams: grams,
    transporterId: input.transporterId,
    driverUserId: input.transporterUserId,
    vehicleRegistration: "AS-4026-26",
    vehicleCapacityGrams: 10_000_000,
    collectionWindowStartAt: collectionStartAt,
    collectionWindowEndAt: collectionEndAt,
    deliveryWindowStartAt: deliveryStartAt,
    deliveryWindowEndAt: deliveryEndAt,
    destination,
    readinessBlockers: [],
    cancellationState: "none",
    version: 0,
    createdAt: now,
    updatedAt: now,
  });
  for (const [sourceIndex, source] of sources.entries()) {
    await ctx.db.insert("pilotFulfilmentStops", {
      programmeId: input.programme._id,
      planId,
      sequence: sourceIndex + 1,
      stopType: "collection",
      location: source.sourceLocation,
      packagingNotes: `${source.fullName}, ${source.bags} sealed 50 kg maize bags. Confirm contact and bag count before loading.`,
      lotIds: [source.lotId],
      plannedGrams: source.sourceGrams,
      collectedGrams: 0,
      windowStartAt: collectionStartAt,
      windowEndAt: collectionEndAt,
      status: "planned",
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
  await ctx.db.insert("pilotFulfilmentStops", {
    programmeId: input.programme._id,
    planId,
    sequence: sources.length + 1,
    stopType: "destination",
    location: destination,
    packagingNotes: "Keep the inspected lot identifiable at handover.",
    lotIds: [],
    plannedGrams: grams,
    collectedGrams: 0,
    windowStartAt: deliveryStartAt,
    windowEndAt: deliveryEndAt,
    status: "planned",
    version: 0,
    createdAt: now,
    updatedAt: now,
  });
  if (input.index === 0)
    await seedMarketplaceLedger(ctx, {
      programmeId: input.programme._id,
      requestId,
      buyerId: input.buyerId,
      buyerUserId: input.buyerUserId,
      sources,
      dueAt: deliveryEndAt + 24 * hour,
      totalGrams: grams,
      createdAt: now,
    });
  return {
    bags: input.bags,
    requestId,
    sourceLots: sources.map((source) => ({
      declarationId: source.declarationId,
      offerId: source.offerId,
      inspectionId: source.inspectionId,
      lotId: source.lotId,
      bags: source.bags,
    })),
    planId,
    status: "ready" as const,
  };
}

async function seedMarketplaceLedger(
  ctx: MutationCtx,
  input: {
    programmeId: Id<"pilotProgrammes">;
    requestId: Id<"pilotBuyerRequests">;
    buyerId: Id<"buyers">;
    buyerUserId: Id<"users">;
    sources: Array<{
      farmerId: Id<"farmers">;
      offerRevisionId: Id<"pilotFarmerOfferRevisions">;
      lotId: Id<"pilotProcurementLots">;
      expectedGrossPesewas: number;
      expectedChargesPesewas: number;
    }>;
    dueAt: number;
    totalGrams: number;
    createdAt: number;
  },
) {
  for (const source of input.sources) {
    await ctx.db.insert("pilotFinancialEntries", {
      programmeId: input.programmeId,
      requestId: input.requestId,
      lotId: source.lotId,
      offerRevisionId: source.offerRevisionId,
      postingKind: "obligation",
      purpose: "buyer_produce",
      basis: "estimate",
      payer: {
        kind: "buyer",
        id: String(input.buyerId),
        displayNameSnapshot: "Buyer",
      },
      payee: {
        kind: "farmer",
        id: String(source.farmerId),
        displayNameSnapshot: "Farmer",
      },
      amountPesewas: source.expectedGrossPesewas,
      currency: "GHS",
      dueAt: input.dueAt,
      postingKey: `preview:${input.requestId}:lot:${source.lotId}:buyer-produce`,
      evidenceUploadAssetIds: [],
      provenance: "live",
      reasonCode: "preview_marketplace_terms",
      recordedByUserId: input.buyerUserId,
      createdAt: input.createdAt,
    });
    await ctx.db.insert("pilotFinancialEntries", {
      programmeId: input.programmeId,
      requestId: input.requestId,
      lotId: source.lotId,
      offerRevisionId: source.offerRevisionId,
      postingKind: "revenue",
      purpose: "coordination_fee",
      basis: "estimate",
      payer: {
        kind: "farmer",
        id: String(source.farmerId),
        displayNameSnapshot: "Farmer",
      },
      payee: {
        kind: "kuapa_dwaso",
        displayNameSnapshot: "Kuapa Dwaso",
      },
      amountPesewas: source.expectedChargesPesewas,
      currency: "GHS",
      postingKey: `preview:${input.requestId}:lot:${source.lotId}:coordination-fee`,
      evidenceUploadAssetIds: [],
      provenance: "live",
      reasonCode: "preview_seller_coordination_fee",
      recordedByUserId: input.buyerUserId,
      createdAt: input.createdAt,
    });
  }
  for (const charge of buyerCharges) {
    const amountPesewas = Math.round(
      (input.totalGrams * charge.rate.numerator) / charge.rate.scale / 1_000,
    );
    await ctx.db.insert("pilotFinancialEntries", {
      programmeId: input.programmeId,
      requestId: input.requestId,
      postingKind: "obligation",
      purpose:
        charge.code === "preview_transport_charge"
          ? "buyer_transport"
          : "other_agreed_cost",
      basis: "estimate",
      payer: {
        kind: "buyer",
        id: String(input.buyerId),
        displayNameSnapshot: "Buyer",
      },
      payee: {
        kind: "kuapa_dwaso",
        displayNameSnapshot: "Kuapa Dwaso coordination",
      },
      amountPesewas,
      currency: "GHS",
      dueAt: input.dueAt,
      postingKey: `preview:${input.requestId}:buyer-charge:${charge.code}`,
      evidenceUploadAssetIds: [],
      provenance: "live",
      reasonCode: charge.code,
      recordedByUserId: input.buyerUserId,
      createdAt: input.createdAt,
    });
  }
}
