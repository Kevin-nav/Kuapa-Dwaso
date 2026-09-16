import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import {
  buildPreviewStarterRecords,
  parsePreviewSetupOptions,
  previewActorDefinitions,
} from "./preview-setup-options.mjs";

const rootDir = resolve(import.meta.dirname, "../../..");
loadLocalEnvironment(resolve(rootDir, ".env.local"));

const options = parsePreviewSetupOptions(process.argv.slice(2));
const firebaseAuth = createFirebaseAuth();
const firebaseApiKey = requiredEnvironmentValue("NEXT_PUBLIC_FIREBASE_API_KEY");
const actorDefinitions = previewActorDefinitions.map((definition) => ({
  ...definition,
  ...options.actors[definition.key],
}));

await requireExistingFirebaseAdmin(firebaseAuth, options.adminFirebaseUid);
const firebasePlan = await inspectFirebaseActors(
  firebaseAuth,
  actorDefinitions,
);
const adminClient = await createAuthenticatedConvexClient(
  firebaseAuth,
  firebaseApiKey,
  options.convexUrl,
  options.adminFirebaseUid,
);
const adminPrincipal = await adminClient.query(
  api.pilotAuth.currentPrincipal,
  {},
);
if (adminPrincipal.role !== "admin") {
  throw new Error(
    "PREVIEW_SETUP_ADMIN_FIREBASE_UID is not linked to an admin user.",
  );
}
const adminAccess = await adminClient.query(
  api.adminAccess.getEffectiveAccess,
  {
    actorUserId: adminPrincipal.userId,
    adminUserId: adminPrincipal.userId,
  },
);
const requiredAdminPermissions = [
  "warehouseAgents:read",
  "warehouseAgents:manage",
  "farmers:read",
  "farmers:verify",
  "buyers:manage",
  "transporters:manage",
  "pilotAssignments:read",
  "pilotAssignments:manage",
  "pilotFinance:read",
  "pilotFinance:manage",
];
const missingAdminPermissions = requiredAdminPermissions.filter(
  (permission) => !adminAccess.permissions.includes(permission),
);
if (missingAdminPermissions.length > 0) {
  throw new Error(
    `The setup admin lacks required permissions: ${missingAdminPermissions.join(", ")}.`,
  );
}
const programme = await adminClient.query(api.pilotProgrammes.get, {
  programmeId: options.programmeId,
});
assertProgrammeReady(programme, options.programmeId);

const baseClient = new ConvexHttpClient(options.convexUrl);
const convexPlan = [];
for (const definition of actorDefinitions) {
  const existing = await baseClient.query(api.users.getByAuthProviderId, {
    authProviderId: definition.firebaseUid,
  });
  if (existing !== null && existing.role !== definition.role) {
    throw new Error(
      `${definition.key} Firebase UID is already linked to the ${existing.role} role.`,
    );
  }
  if (
    existing?.phoneNumber !== undefined &&
    existing.phoneNumber !== definition.phoneNumber
  ) {
    throw new Error(
      `${definition.key} Convex user has a different phone number.`,
    );
  }
  convexPlan.push({
    role: definition.key,
    user: existing === null ? "create" : "reuse",
    profile: existing === null ? "create" : "create-or-update",
  });
}

if (!options.execute) {
  printResult({
    mode: "dry-run",
    deployment: options.deployment,
    programme: {
      id: options.programmeId,
      name: programme.name,
      status: programme.status,
      datasetProvenance: programme.datasetProvenance,
    },
    firebasePlan,
    convexPlan,
    starterRecords: buildPreviewStarterRecords(options.startAt).map(
      toSafeStarterSummary,
    ),
    transporterJobs: options.profilesOnly
      ? "skipped for initial actor bootstrap"
      : buildPreviewStarterRecords(options.startAt).map((record, index) => ({
          bags: record.bags,
          inspectionEvidenceUploadAssetId:
            options.inspectionEvidenceUploadAssetIds[index],
          outcome: "ready collection job assigned to Kwame Asare",
        })),
    nextStep:
      "Run again with --execute and the exact confirmation token after reviewing this plan.",
  });
  process.exit(0);
}

for (const definition of actorDefinitions) {
  await provisionFirebaseActor(firebaseAuth, definition);
}

const clients = Object.fromEntries(
  await Promise.all(
    actorDefinitions.map(async (definition) => [
      definition.key,
      await createAuthenticatedConvexClient(
        firebaseAuth,
        firebaseApiKey,
        options.convexUrl,
        definition.firebaseUid,
      ),
    ]),
  ),
);

const identity = (key) => {
  const definition = actorDefinitions.find(
    (candidate) => candidate.key === key,
  );
  if (definition === undefined)
    throw new Error(`Unknown preview actor ${key}.`);
  return {
    authProviderId: definition.firebaseUid,
    phoneNumber: definition.phoneNumber,
    displayName: definition.name,
    phoneVerified: true,
    signInProvider: "custom",
  };
};

const farmerLocation = programme.district ?? programme.region;
const destinationMarket = "Kumasi Central Market";
const farmer = await clients.farmer.mutation(
  api.auth.createSelfAppFarmerProfile,
  {
    identity: identity("farmer"),
    fullName: actorDefinition("farmer").name,
    community: farmerLocation,
    region: programme.region,
  },
);
const buyer = await clients.buyer.mutation(
  api.auth.createOrLinkBuyerProfileAfterPhoneAuth,
  {
    identity: identity("buyer"),
    fullName: actorDefinition("buyer").name,
    displayName: "Adwoa's Maize Trading",
    buyerType: "market_trader",
    organizationName: "Adwoa's Maize Trading",
    destinationMarket,
  },
);
const transporter = await clients.transporter.mutation(
  api.auth.createOrLinkTransporterProfileAfterPhoneAuth,
  {
    identity: identity("transporter"),
    fullName: actorDefinition("transporter").name,
    vehicleType: "Cargo truck",
    vehicleCapacity: 100,
    vehicleCapacityUnit: "50kg bags",
    baseLocation: farmerLocation,
    routesServed: [`${farmerLocation} to ${destinationMarket}`],
    destinationsServed: [destinationMarket],
  },
);
const operationsUserId = await clients.operations.mutation(
  api.auth.syncFirebaseIdentity,
  {
    identity: identity("operations"),
    role: "warehouse_agent",
    mfaRequirement: "not_required",
  },
);

await ensureVerifiedProfiles(adminClient, adminPrincipal.userId, {
  farmer,
  buyer,
  transporter,
});
const warehouseAgentId = await ensureOperationsProfile(
  adminClient,
  adminPrincipal.userId,
  operationsUserId,
  actorDefinition("operations"),
);
const assignment = await ensurePilotAssignment(
  adminClient,
  operationsUserId,
  options.programmeId,
  options.cutoffAt,
);
const starterRecords = await seedStarterRecords({
  farmerClient: clients.farmer,
  buyerClient: clients.buyer,
  programme,
  programmeId: options.programmeId,
  startAt: options.startAt,
  farmerLocation,
  destinationMarket,
});
let transporterJobs = [];
if (!options.profilesOnly) {
  await validateInspectionEvidence({
    operationsClient: clients.operations,
    operationsUserId,
    programmeId: options.programmeId,
    starterRecords,
    assetIds: options.inspectionEvidenceUploadAssetIds,
  });
  transporterJobs = await prepareTransporterJobs({
    adminClient,
    operationsClient: clients.operations,
    buyerClient: clients.buyer,
    farmerClient: clients.farmer,
    programme,
    programmeId: options.programmeId,
    transporter,
    starterRecords,
    assetIds: options.inspectionEvidenceUploadAssetIds,
    cutoffAt: options.cutoffAt,
    destinationMarket,
  });
}

printResult({
  mode: "executed",
  deployment: options.deployment,
  programme: {
    id: options.programmeId,
    name: programme.name,
    status: programme.status,
    datasetProvenance: programme.datasetProvenance,
  },
  actors: {
    farmer: {
      name: actorDefinition("farmer").name,
      userId: farmer.userId,
      profileId: farmer.farmerId,
    },
    buyer: {
      name: actorDefinition("buyer").name,
      userId: buyer.userId,
      profileId: buyer.buyerId,
    },
    transporter: {
      name: actorDefinition("transporter").name,
      userId: transporter.userId,
      profileId: transporter.transporterId,
    },
    operations: {
      name: actorDefinition("operations").name,
      userId: operationsUserId,
      profileId: warehouseAgentId,
    },
  },
  assignment: {
    assignmentId: assignment.assignmentId,
    capabilities: assignment.capabilities,
    expiresAt: new Date(options.cutoffAt).toISOString(),
  },
  starterRecords: starterRecords.map(toExecutedStarterSummary),
  transporterJobs,
  cleanupEnvironment: {
    PREVIEW_CLEANUP_PROGRAMME_ID: options.programmeId,
    PREVIEW_FARMER_USER_ID: farmer.userId,
    PREVIEW_BUYER_USER_ID: buyer.userId,
    PREVIEW_TRANSPORTER_USER_ID: transporter.userId,
    PREVIEW_OPERATIONS_USER_ID: operationsUserId,
    PREVIEW_CLEANUP_START_AT: new Date(options.startAt).toISOString(),
    PREVIEW_CLEANUP_END_AT: new Date(options.endAt).toISOString(),
  },
  transporterNextStep: options.profilesOnly
    ? "Upload three private pilot_inspection_evidence assets as Akosua Boateng, then rerun full setup with their exact IDs."
    : "Open the transporter profile to review the three ready collection jobs assigned to Kwame Asare.",
});

function actorDefinition(key) {
  const definition = actorDefinitions.find(
    (candidate) => candidate.key === key,
  );
  if (definition === undefined)
    throw new Error(`Unknown preview actor ${key}.`);
  return definition;
}

function createFirebaseAuth() {
  const projectId = requiredEnvironmentValue("FIREBASE_PROJECT_ID");
  const serviceAccount = JSON.parse(
    Buffer.from(
      requiredEnvironmentValue("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64"),
      "base64",
    ).toString("utf8"),
  );
  if (typeof serviceAccount.private_key === "string") {
    serviceAccount.private_key = serviceAccount.private_key.replaceAll(
      "\\n",
      "\n",
    );
  }
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  return getAuth(app);
}

async function requireExistingFirebaseAdmin(auth, uid) {
  const user = await firebaseUserOrNull(auth, uid);
  if (user === null || user.disabled) {
    throw new Error(
      "The setup admin Firebase user must already exist and be enabled.",
    );
  }
}

async function inspectFirebaseActors(auth, definitions) {
  const plan = [];
  for (const definition of definitions) {
    const [byUid, byPhone] = await Promise.all([
      firebaseUserOrNull(auth, definition.firebaseUid),
      firebaseUserByPhoneOrNull(auth, definition.phoneNumber),
    ]);
    if (byPhone !== null && byPhone.uid !== definition.firebaseUid) {
      throw new Error(
        `${definition.key} phone number belongs to another Firebase user.`,
      );
    }
    if (
      byUid !== null &&
      byUid.phoneNumber !== undefined &&
      byUid.phoneNumber !== definition.phoneNumber
    ) {
      throw new Error(
        `${definition.key} Firebase user has a different phone number.`,
      );
    }
    const changes = [];
    if (byUid === null) {
      changes.push("create");
    } else {
      if (byUid.displayName !== definition.name)
        changes.push("set display name");
      if (byUid.phoneNumber === undefined) changes.push("set phone number");
      if (byUid.disabled) changes.push("enable");
    }
    plan.push({
      role: definition.key,
      actions: changes.length === 0 ? ["reuse"] : changes,
    });
  }
  return plan;
}

async function provisionFirebaseActor(auth, definition) {
  const existing = await firebaseUserOrNull(auth, definition.firebaseUid);
  if (existing === null) {
    await auth.createUser({
      uid: definition.firebaseUid,
      phoneNumber: definition.phoneNumber,
      displayName: definition.name,
      disabled: false,
    });
    return;
  }
  await auth.updateUser(definition.firebaseUid, {
    phoneNumber: definition.phoneNumber,
    displayName: definition.name,
    disabled: false,
  });
}

async function firebaseUserOrNull(auth, uid) {
  try {
    return await auth.getUser(uid);
  } catch (error) {
    if (firebaseErrorCode(error) === "auth/user-not-found") return null;
    throw error;
  }
}

async function firebaseUserByPhoneOrNull(auth, phoneNumber) {
  try {
    return await auth.getUserByPhoneNumber(phoneNumber);
  } catch (error) {
    if (firebaseErrorCode(error) === "auth/user-not-found") return null;
    throw error;
  }
}

function firebaseErrorCode(error) {
  return typeof error === "object" && error !== null && "code" in error
    ? error.code
    : undefined;
}

async function createAuthenticatedConvexClient(auth, apiKey, convexUrl, uid) {
  const customToken = await auth.createCustomToken(uid);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const body = await response.json();
  if (!response.ok || typeof body.idToken !== "string") {
    throw new Error(
      `Firebase token exchange failed with status ${response.status}.`,
    );
  }
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(body.idToken);
  return client;
}

function assertProgrammeReady(programme, programmeId) {
  if (programme === null || programme.id !== programmeId) {
    throw new Error(
      "The exact pilot programme is missing or unavailable to the setup admin.",
    );
  }
  if (programme.status !== "active") {
    throw new Error("Preview setup requires an active pilot programme.");
  }
  if (programme.datasetProvenance !== "live") {
    throw new Error(
      "Preview setup requires a live programme, not a sample-only dataset.",
    );
  }
  if (programme.commercialConfigurationStatus !== "approved") {
    throw new Error(
      "Preview setup requires an approved live commercial configuration.",
    );
  }
  const qualityPolicy = programme.currentCommercialConfiguration?.qualityPolicy;
  if (
    qualityPolicy === undefined ||
    qualityPolicy.policyProvenance !== "live"
  ) {
    throw new Error(
      "The live programme needs an approved live maize quality policy.",
    );
  }
}

async function ensureVerifiedProfiles(client, adminUserId, profiles) {
  const farmer = await client.query(api.farmers.getById, {
    actorUserId: adminUserId,
    farmerId: profiles.farmer.farmerId,
  });
  if (farmer?.verificationStatus !== "verified") {
    await client.mutation(api.farmers.updateVerificationStatus, {
      actorUserId: adminUserId,
      farmerId: profiles.farmer.farmerId,
      verificationStatus: "verified",
      reason: "Prepared shared preview profile",
    });
  }
  const buyer = await client.query(api.buyers.getByUserId, {
    userId: profiles.buyer.userId,
  });
  if (buyer?.verificationStatus !== "verified") {
    await client.mutation(api.buyers.updateVerificationStatus, {
      actorUserId: adminUserId,
      buyerId: profiles.buyer.buyerId,
      verificationStatus: "verified",
      reason: "Prepared shared preview profile",
    });
  }
  const transporter = await client.query(api.transporters.getByUser, {
    userId: profiles.transporter.userId,
  });
  if (transporter?.verificationStatus !== "verified") {
    await client.mutation(api.transporters.updateVerificationStatus, {
      actorUserId: adminUserId,
      transporterId: profiles.transporter.transporterId,
      verificationStatus: "verified",
      reason: "Prepared shared preview profile",
    });
  }
}

async function ensureOperationsProfile(
  client,
  adminUserId,
  userId,
  definition,
) {
  let profile = await client.query(api.warehouseAgents.getByUser, {
    actorUserId: adminUserId,
    userId,
  });
  if (profile === null) {
    const warehouseAgentId = await client.mutation(api.warehouseAgents.create, {
      actorUserId: adminUserId,
      userId,
      fullName: definition.name,
      phoneNumber: definition.phoneNumber,
      assignedWarehouseIds: [],
      status: "pending",
    });
    profile = await client.query(api.warehouseAgents.getByUser, {
      actorUserId: adminUserId,
      userId,
    });
    if (profile === null || profile._id !== warehouseAgentId) {
      throw new Error("Operations profile could not be loaded after creation.");
    }
  }
  if (
    profile.fullName !== definition.name ||
    profile.phoneNumber !== definition.phoneNumber
  ) {
    throw new Error(
      "Existing operations profile does not match the configured name and phone.",
    );
  }
  if (profile.status !== "approved") {
    await client.mutation(api.warehouseAgents.updateStatus, {
      actorUserId: adminUserId,
      warehouseAgentId: profile._id,
      status: "approved",
      reason: "Prepared shared preview operations profile",
    });
  }
  return profile._id;
}

const allPilotCapabilities = [
  "pilot:read",
  "requests:review",
  "supply:manage",
  "offers:manage",
  "quality:record",
  "fulfilment:manage",
  "custody:record",
  "issues:manage",
];

async function ensurePilotAssignment(
  client,
  operationsUserId,
  programmeId,
  cutoffAt,
) {
  const assignments = await client.query(api.pilotAssignments.list, {
    programmeId,
    status: "active",
    limit: 50,
  });
  const active = assignments.page.filter(
    (assignment) => assignment.userId === operationsUserId,
  );
  const exact = active.find(
    (assignment) =>
      assignment.expiresAt === cutoffAt &&
      sameStringSet(assignment.capabilities, allPilotCapabilities),
  );
  if (exact !== undefined && active.length === 1) return exact;

  for (const assignment of active) {
    await client.mutation(api.pilotAssignments.revoke, {
      assignmentId: assignment.assignmentId,
      expectedVersion: assignment.version,
      reason: "Replace with the bounded shared preview assignment",
      idempotencyKey: `preview-revoke-${assignment.assignmentId}-${assignment.version}`,
    });
  }
  return await client.mutation(api.pilotAssignments.grant, {
    programmeId,
    targetUserId: operationsUserId,
    capabilities: allPilotCapabilities,
    expiresAt: cutoffAt,
    idempotencyKey: `preview-ops-grant-${cutoffAt}`,
  });
}

async function seedStarterRecords(input) {
  const qualityPolicy =
    input.programme.currentCommercialConfiguration.qualityPolicy;
  const records = [];
  for (const fixture of buildPreviewStarterRecords(input.startAt)) {
    const draft = await input.buyerClient.mutation(
      api.pilotRequests.createDraft,
      {
        programmeId: input.programmeId,
        maizeType: qualityPolicy.maizeType,
        requestedGrams: fixture.grams,
        destination: {
          label: input.destinationMarket,
        },
        deliveryWindowStartAt: fixture.requestDeliveryStartAt,
        deliveryWindowEndAt: fixture.requestDeliveryEndAt,
        requestedSpecification: qualityPolicy,
        paymentExpectation: {
          trigger: "buyer_acceptance",
          offsetCalendarDays: 1,
          timezone: "Africa/Accra",
        },
        commercialMode: "coordination",
        idempotencyKey: fixture.requestCreateKey,
      },
    );
    const submitted =
      draft.status === "draft"
        ? await input.buyerClient.mutation(api.pilotRequests.submit, {
            requestId: draft.requestId,
            expectedVersion: draft.version,
            idempotencyKey: fixture.requestSubmitKey,
          })
        : draft;
    const declaration = await input.farmerClient.mutation(
      api.pilotSupply.createDeclaration,
      {
        programmeId: input.programmeId,
        maizeType: qualityPolicy.maizeType,
        availableGrams: fixture.grams,
        readinessWindowStartAt: fixture.supplyReadyStartAt,
        readinessWindowEndAt: fixture.supplyReadyEndAt,
        collectionLocation: {
          label: `${input.farmerLocation} farm gate`,
          region: input.programme.region,
        },
        idempotencyKey: fixture.declarationKey,
      },
    );
    records.push({
      fixture,
      bags: fixture.bags,
      kilograms: fixture.kilograms,
      grams: fixture.grams,
      buyerRequestId: submitted.requestId,
      buyerRequestStatus: submitted.status,
      buyerRequestVersion: submitted.version,
      destination: submitted.destination,
      deliveryWindowStartAt: submitted.deliveryWindowStartAt,
      deliveryWindowEndAt: submitted.deliveryWindowEndAt,
      supplyDeclarationId: declaration.declarationId,
      supplyVerificationStatus: declaration.verificationStatus,
      supplyDeclarationVersion: declaration.version,
      collectionLocation: declaration.collectionLocation,
    });
  }
  return records;
}

async function validateInspectionEvidence(input) {
  for (const [index, assetId] of input.assetIds.entries()) {
    const starter = input.starterRecords[index];
    const asset = await input.operationsClient.query(api.uploads.getById, {
      actorUserId: input.operationsUserId,
      uploadAssetId: assetId,
    });
    if (asset === null) {
      throw new Error(`Inspection evidence ${assetId} was not found.`);
    }
    const commonValid =
      asset.ownerUserId === input.operationsUserId &&
      asset.purpose === "pilot_inspection_evidence" &&
      asset.accessLevel === "private" &&
      asset.pilotProgrammeId === input.programmeId;
    if (!commonValid) {
      throw new Error(
        `Inspection evidence ${assetId} must be private, owned by the preview operations user, and scoped to the exact programme.`,
      );
    }
    if (
      (asset.status === "uploaded" || asset.status === "verified") &&
      asset.relatedEntityId === undefined
    ) {
      continue;
    }
    if (
      asset.status !== "attached" ||
      asset.relatedEntityType !== "pilotInspections" ||
      asset.relatedEntityId === undefined
    ) {
      throw new Error(
        `Inspection evidence ${assetId} is not available for this setup run.`,
      );
    }
    const receipt = await input.operationsClient.query(
      api.pilotInspections.getReceipt,
      { inspectionId: asset.relatedEntityId },
    );
    if (
      receipt === null ||
      receipt.requestReference !== starter.buyerRequestId ||
      !receipt.inspection.evidenceUploadAssetIds.includes(assetId)
    ) {
      throw new Error(
        `Attached inspection evidence ${assetId} belongs to another transaction branch.`,
      );
    }
  }
}

async function prepareTransporterJobs(input) {
  const records = [];
  for (const [index, starter] of input.starterRecords.entries()) {
    records.push(
      await prepareTransporterJob({
        ...input,
        starter,
        evidenceAssetId: input.assetIds[index],
      }),
    );
  }
  return records;
}

async function prepareTransporterJob(input) {
  const fixture = input.starter.fixture;
  const qualityPolicy =
    input.programme.currentCommercialConfiguration.qualityPolicy;
  const collectionWindowStartAt =
    fixture.requestDeliveryStartAt - 6 * 60 * 60 * 1_000;
  const collectionWindowEndAt =
    fixture.requestDeliveryStartAt - 60 * 60 * 1_000;
  if (collectionWindowStartAt <= Date.now()) {
    throw new Error(
      `${fixture.bags}-bag collection window is no longer in the future. Use a newly reviewed setup window.`,
    );
  }

  let detail = await requireRequestDetail(
    input.operationsClient,
    input.starter.buyerRequestId,
  );
  if (detail.request.status === "submitted") {
    await input.operationsClient.mutation(api.pilotRequests.beginReview, {
      requestId: detail.request.requestId,
      expectedVersion: detail.request.version,
      idempotencyKey: fixture.requestReviewKey,
    });
    detail = await requireRequestDetail(
      input.operationsClient,
      detail.request.requestId,
    );
  }
  if (
    !["under_review", "quoted", "confirmed"].includes(detail.request.status)
  ) {
    throw new Error(
      `${fixture.bags}-bag request is in unexpected status ${detail.request.status}.`,
    );
  }

  if (detail.agreement === null) {
    if (detail.request.status !== "under_review") {
      throw new Error(
        `${fixture.bags}-bag request has no agreement in ${detail.request.status} status.`,
      );
    }
    await input.operationsClient.mutation(
      api.pilotRequests.createAgreementRevision,
      {
        requestId: detail.request.requestId,
        quantityGrams: fixture.grams,
        commercialMode: "coordination",
        specification: qualityPolicy,
        producePriceRate: { numerator: 500, scale: 1, unit: "per_kg" },
        chargeTerms:
          input.programme.currentCommercialConfiguration.chargeTerms ?? [],
        acceptanceRules: [
          {
            code: "quality_cleared_quantity",
            label: "Quality-cleared quantity",
            detail:
              "The buyer accepts only the quantity cleared by the recorded inspection.",
          },
        ],
        deliveryWindowStartAt: fixture.requestDeliveryStartAt,
        deliveryWindowEndAt: fixture.requestDeliveryEndAt,
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
            detail:
              "Cancellation requires a reason before recorded collection begins.",
          },
        ],
        expiresAt: input.cutoffAt,
        expectedRequestVersion: detail.request.version,
        idempotencyKey: fixture.agreementKey,
      },
    );
    detail = await requireRequestDetail(
      input.operationsClient,
      detail.request.requestId,
    );
  }
  assertExpectedAgreement(detail, fixture, qualityPolicy, input.cutoffAt);
  if (detail.agreement.state === "proposed") {
    await input.buyerClient.mutation(api.pilotRequests.acknowledgeAgreement, {
      requestId: detail.request.requestId,
      agreementRevisionId: detail.agreement.revisionId,
      expectedRequestVersion: detail.request.version,
      idempotencyKey: fixture.agreementAcknowledgeKey,
    });
    detail = await requireRequestDetail(
      input.operationsClient,
      detail.request.requestId,
    );
  }
  if (detail.agreement?.state !== "acknowledged") {
    throw new Error(`${fixture.bags}-bag buyer agreement is not acknowledged.`);
  }

  let declaration = await findExactDeclaration(
    input.farmerClient,
    input.programmeId,
    input.starter.supplyDeclarationId,
  );
  if (declaration.verificationStatus === "self_reported") {
    await input.operationsClient.mutation(api.pilotSupply.reviewDeclaration, {
      declarationId: declaration.declarationId,
      decision: "reviewed",
      reason:
        "Operations confirmed the farmer, quantity, readiness window, and collection location.",
      expectedVersion: declaration.version,
      idempotencyKey: fixture.reviewKey,
    });
    declaration = await findExactDeclaration(
      input.farmerClient,
      input.programmeId,
      declaration.declarationId,
    );
  }
  if (declaration.verificationStatus !== "reviewed") {
    throw new Error(`${fixture.bags}-bag supply declaration is not reviewed.`);
  }

  let offer = await findOrCreateExactOffer({
    operationsClient: input.operationsClient,
    detail,
    declaration,
    fixture,
    cutoffAt: input.cutoffAt,
  });
  if (offer.status === "draft") {
    await input.operationsClient.mutation(api.pilotOffers.send, {
      offerId: offer.offerId,
      revisionId: offer.terms.revisionId,
      expectedOfferVersion: offer.version,
      idempotencyKey: fixture.offerSendKey,
    });
    offer = await findExactOffer(
      input.operationsClient,
      detail.request.requestId,
      declaration.declarationId,
    );
  }
  if (offer.status === "sent") {
    await ensureFundingReservation({
      adminClient: input.adminClient,
      programmeId: input.programmeId,
      requestId: detail.request.requestId,
      agreementRevisionId: detail.agreement.revisionId,
      offer,
      fixture,
    });
    await input.farmerClient.mutation(api.pilotOffers.decide, {
      offerId: offer.offerId,
      revisionId: offer.terms.revisionId,
      decision: "accepted",
      expectedOfferVersion: offer.version,
      idempotencyKey: fixture.offerAcceptKey,
    });
    offer = await findExactOffer(
      input.operationsClient,
      detail.request.requestId,
      declaration.declarationId,
    );
  }
  if (offer.status !== "accepted" || offer.quantity === null) {
    throw new Error(`${fixture.bags}-bag farmer offer is not accepted.`);
  }

  detail = await requireRequestDetail(
    input.operationsClient,
    detail.request.requestId,
  );
  if (detail.request.status === "quoted") {
    const confirmation = await input.operationsClient.mutation(
      api.pilotRequests.confirm,
      {
        requestId: detail.request.requestId,
        agreementRevisionId: detail.agreement.revisionId,
        confirmedGrams: fixture.grams,
        expectedRequestVersion: detail.request.version,
        idempotencyKey: fixture.requestConfirmKey,
      },
    );
    if (confirmation.readinessBlockers.length > 0) {
      throw new Error(
        `${fixture.bags}-bag request confirmation is blocked: ${confirmation.readinessBlockers.join(", ")}.`,
      );
    }
    detail = await requireRequestDetail(
      input.operationsClient,
      detail.request.requestId,
    );
  }
  if (detail.request.status !== "confirmed") {
    throw new Error(`${fixture.bags}-bag request is not confirmed.`);
  }

  let lot;
  let inspectionId;
  if (offer.quantity.status === "committed") {
    const recorded = await input.operationsClient.mutation(
      api.pilotInspections.record,
      {
        allocationId: offer.quantity.allocationId,
        buyerAgreementRevisionId: detail.agreement.revisionId,
        lotCode: previewLotCode(input.programmeId, fixture.bags),
        location: declaration.collectionLocation,
        expectedAllocationVersion: offer.quantity.version,
        samplingMethod: "Representative bag sample",
        testMethod: "Calibrated moisture meter and visual contamination check",
        sampleCount: 3,
        ...(qualityPolicy.moistureMaximumPermille === undefined
          ? {}
          : {
              moisturePermille: Math.max(
                0,
                qualityPolicy.moistureMaximumPermille - 5,
              ),
            }),
        contaminationResult: "passed",
        additionalReadings: qualityPolicy.additionalCriteria.map(
          (criterion) => ({
            code: criterion.code,
            label: criterion.label,
            value: "passed",
            passed: true,
          }),
        ),
        grossWeightGrams: fixture.grams,
        tareWeightGrams: 0,
        acceptedGrams: fixture.grams,
        rejectedGrams: 0,
        evidenceUploadAssetIds: [input.evidenceAssetId],
        inspectedAt: Date.now(),
        idempotencyKey: fixture.inspectionKey,
      },
    );
    lot = recorded.lot;
    inspectionId = recorded.inspection.inspectionId;
    offer = await findExactOffer(
      input.operationsClient,
      detail.request.requestId,
      declaration.declarationId,
    );
  } else if (offer.quantity.status === "quality_cleared") {
    lot = await findExactLot(
      input.operationsClient,
      input.programmeId,
      detail.request.requestId,
      previewLotCode(input.programmeId, fixture.bags),
    );
    inspectionId = lot.latestInspectionId;
  } else {
    throw new Error(
      `${fixture.bags}-bag allocation is in unexpected status ${offer.quantity.status}.`,
    );
  }
  if (
    offer.quantity?.status !== "quality_cleared" ||
    offer.quantity.clearedGrams !== fixture.grams ||
    lot.clearedGrams !== fixture.grams ||
    inspectionId === undefined
  ) {
    throw new Error(`${fixture.bags}-bag inspection did not clear the lot.`);
  }

  let planResult = await input.operationsClient.query(
    api.pilotFulfilment.getForRequest,
    { requestId: detail.request.requestId },
  );
  if (planResult === null) {
    const plan = await input.operationsClient.mutation(
      api.pilotFulfilment.createPlan,
      {
        requestId: detail.request.requestId,
        buyerAgreementRevisionId: detail.agreement.revisionId,
        collectionWindowStartAt,
        collectionWindowEndAt,
        deliveryWindowStartAt: fixture.requestDeliveryStartAt,
        deliveryWindowEndAt: fixture.requestDeliveryEndAt,
        destination: { label: input.destinationMarket },
        stops: [
          {
            sequence: 1,
            stopType: "collection",
            location: declaration.collectionLocation,
            packagingNotes:
              "50 kg maize bags; confirm bag count and condition before loading.",
            lotIds: [lot.id ?? lot._id],
            windowStartAt: collectionWindowStartAt,
            windowEndAt: collectionWindowEndAt,
          },
          {
            sequence: 2,
            stopType: "destination",
            location: { label: input.destinationMarket },
            packagingNotes: "Keep the inspected lot identifiable at handover.",
            lotIds: [],
            windowStartAt: fixture.requestDeliveryStartAt,
            windowEndAt: fixture.requestDeliveryEndAt,
          },
        ],
        idempotencyKey: fixture.planCreateKey,
      },
    );
    planResult = { plan, stops: [] };
  }
  assertExpectedPlan(planResult.plan, fixture, input.transporter);
  let plan = planResult.plan;
  if (plan.status === "planning") {
    plan = await input.operationsClient.mutation(
      api.pilotFulfilment.assignDriver,
      {
        planId: plan.planId,
        transporterId: input.transporter.transporterId,
        driverUserId: input.transporter.userId,
        vehicleRegistration: "AS-4026-26",
        vehicleCapacityGrams: 5_000_000,
        expectedVersion: plan.version,
        idempotencyKey: fixture.driverAssignKey,
      },
    );
  }
  if (plan.status === "assigned") {
    plan = await input.operationsClient.mutation(
      api.pilotFulfilment.markReady,
      {
        planId: plan.planId,
        expectedVersion: plan.version,
        idempotencyKey: fixture.planReadyKey,
      },
    );
  }
  if (plan.status !== "ready") {
    throw new Error(
      `${fixture.bags}-bag collection plan did not reach ready status.`,
    );
  }
  return {
    bags: fixture.bags,
    kilograms: fixture.kilograms,
    requestId: detail.request.requestId,
    declarationId: declaration.declarationId,
    offerId: offer.offerId,
    inspectionId,
    lotId: lot.id ?? lot._id,
    planId: plan.planId,
    status: plan.status,
    driver: actorDefinition("transporter").name,
  };
}

async function requireRequestDetail(client, requestId) {
  const detail = await client.query(api.pilotRequests.get, { requestId });
  if (detail === null)
    throw new Error(`Preview request ${requestId} was not found.`);
  return detail;
}

function assertExpectedAgreement(detail, fixture, qualityPolicy, cutoffAt) {
  const agreement = detail.agreement;
  if (
    agreement === null ||
    agreement.quantityGrams !== fixture.grams ||
    agreement.commercialMode !== "coordination" ||
    agreement.specification.maizeType !== qualityPolicy.maizeType ||
    agreement.deliveryWindowStartAt !== fixture.requestDeliveryStartAt ||
    agreement.deliveryWindowEndAt !== fixture.requestDeliveryEndAt ||
    agreement.expiresAt !== cutoffAt ||
    agreement.producePriceRate.numerator !== 500 ||
    agreement.producePriceRate.scale !== 1 ||
    agreement.producePriceRate.unit !== "per_kg" ||
    agreement.state === "superseded" ||
    agreement.state === "expired" ||
    agreement.state === "withdrawn"
  ) {
    throw new Error(
      `${fixture.bags}-bag request contains terms outside the reviewed preview setup.`,
    );
  }
}

async function findExactDeclaration(client, programmeId, declarationId) {
  const declarations = await client.query(api.pilotSupply.listMine, {
    programmeId,
    limit: 50,
  });
  const matches = declarations.page.filter(
    (row) => row.declaration.declarationId === declarationId,
  );
  if (matches.length !== 1) {
    throw new Error(`Preview declaration ${declarationId} is unavailable.`);
  }
  return matches[0].declaration;
}

async function findOrCreateExactOffer(input) {
  const offers = await input.operationsClient.query(
    api.pilotSupply.listForRequest,
    { requestId: input.detail.request.requestId, limit: 50 },
  );
  const matches = offers.page.filter(
    (row) => row.declaration.declarationId === input.declaration.declarationId,
  );
  if (matches.length > 1) {
    throw new Error(
      `${input.fixture.bags}-bag route has conflicting farmer offers.`,
    );
  }
  if (matches.length === 1) {
    assertExpectedOffer(
      matches[0].offer,
      input.detail,
      input.fixture,
      input.cutoffAt,
    );
    return matches[0].offer;
  }
  const expiresAt = input.cutoffAt - 60_000;
  const created = await input.operationsClient.mutation(
    api.pilotOffers.createRevision,
    {
      requestId: input.detail.request.requestId,
      declarationId: input.declaration.declarationId,
      buyerAgreementRevisionId: input.detail.agreement.revisionId,
      commercialMode: "coordination",
      offeredGrams: input.fixture.grams,
      priceBasis: "per_kg",
      priceRate: { numerator: 500, scale: 1, unit: "per_kg" },
      chargeTerms: [
        {
          code: "farmer_coordination",
          label: "Coordination charge",
          payer: "farmer",
          calculation: "per_kg",
          rate: { numerator: 25, scale: 1, unit: "per_kg" },
        },
      ],
      inspectionTerms: [
        {
          code: "field_sampling",
          label: "Inspection before collection",
          detail:
            "Operations records weight, moisture, contamination, and evidence before collection.",
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
          code: "accepted_quantity_only",
          label: "Accepted quantity only",
          detail:
            "Title follows the acknowledged coordination agreement and buyer acceptance.",
        },
      ],
      custodyTransferTerms: [
        {
          code: "recorded_handover",
          label: "Recorded handover",
          detail:
            "Custody changes only through a confirmed collection event with evidence.",
        },
      ],
      cancellationTerms: [
        {
          code: "before_collection",
          label: "Before collection",
          detail: "Cancellation requires a reason before collection.",
        },
      ],
      expiresAt,
      expectedRequestVersion: input.detail.request.version,
      expectedDeclarationVersion: input.declaration.version,
      idempotencyKey: input.fixture.offerCreateKey,
    },
  );
  const offer = await findExactOffer(
    input.operationsClient,
    input.detail.request.requestId,
    input.declaration.declarationId,
  );
  if (
    offer.offerId !== created.offerId ||
    offer.terms?.revisionId !== created.revisionId
  ) {
    throw new Error(`${input.fixture.bags}-bag offer replay did not match.`);
  }
  assertExpectedOffer(offer, input.detail, input.fixture, input.cutoffAt);
  return offer;
}

async function findExactOffer(client, requestId, declarationId) {
  const offers = await client.query(api.pilotSupply.listForRequest, {
    requestId,
    limit: 50,
  });
  const matches = offers.page.filter(
    (row) => row.declaration.declarationId === declarationId,
  );
  if (matches.length !== 1 || matches[0].offer.terms === null) {
    throw new Error(`Exact preview offer for ${declarationId} was not found.`);
  }
  return matches[0].offer;
}

function assertExpectedOffer(offer, detail, fixture, cutoffAt) {
  const charge = offer.terms?.chargeTerms[0];
  if (
    offer.terms === null ||
    offer.requestId !== detail.request.requestId ||
    offer.commercialMode !== "coordination" ||
    offer.terms.offeredGrams !== fixture.grams ||
    offer.terms.priceRate.numerator !== 500 ||
    offer.terms.priceRate.scale !== 1 ||
    offer.terms.priceRate.unit !== "per_kg" ||
    offer.terms.chargeTerms.length !== 1 ||
    charge?.code !== "farmer_coordination" ||
    charge.payer !== "farmer" ||
    charge.calculation !== "per_kg" ||
    charge.rate.numerator !== 25 ||
    charge.rate.scale !== 1 ||
    charge.rate.unit !== "per_kg" ||
    offer.terms.expiresAt !== cutoffAt - 60_000 ||
    ["declined", "expired", "withdrawn"].includes(offer.status)
  ) {
    throw new Error(
      `${fixture.bags}-bag request contains an offer outside the reviewed preview setup.`,
    );
  }
}

async function ensureFundingReservation(input) {
  const queue = await input.adminClient.query(
    api.pilotFinance.listPurchaseApprovalQueue,
    { programmeId: input.programmeId },
  );
  const row = queue.find(
    (candidate) =>
      candidate.farmerOfferRevisionId === input.offer.terms.revisionId,
  );
  if (row === undefined) {
    throw new Error(
      `${input.fixture.bags}-bag offer is missing from the funding approval queue.`,
    );
  }
  if (row.approvalStatus === "approved") return;
  const overview = await input.adminClient.query(
    api.pilotFinance.getFinanceOverview,
    { programmeId: input.programmeId },
  );
  const active = overview.budgets.filter(
    (budget) => budget.status === "active",
  );
  if (active.length !== 1) {
    throw new Error(
      "Preview route setup requires exactly one active programme purchasing budget.",
    );
  }
  const budget = active[0];
  if (budget.availablePesewas < row.expectedNetPesewas) {
    throw new Error(
      `${input.fixture.bags}-bag route lacks reserved settlement capacity.`,
    );
  }
  await input.adminClient.mutation(api.pilotFinance.reserveFunding, {
    budgetId: budget.budgetId,
    requestId: input.requestId,
    buyerAgreementRevisionId: input.agreementRevisionId,
    farmerOfferRevisionId: input.offer.terms.revisionId,
    produceAmountPesewas: row.expectedNetPesewas,
    knownCostAmountPesewas: 0,
    expiresAt: Math.max(
      Date.now() + 60 * 60 * 1_000,
      input.offer.terms.expiresAt,
    ),
    expectedBudgetVersion: budget.version,
    idempotencyKey: input.fixture.fundingReservationKey,
  });
}

async function findExactLot(client, programmeId, requestId, lotCode) {
  const lots = await client.query(api.pilotLots.listForActor, {
    programmeId,
    requestId,
    limit: 50,
  });
  const matches = lots.page.filter((lot) => lot.lotCode === lotCode);
  if (matches.length !== 1) {
    throw new Error(`Preview lot ${lotCode} was not found exactly once.`);
  }
  return matches[0];
}

function assertExpectedPlan(plan, fixture, transporter) {
  const expectedCollectionStartAt =
    fixture.requestDeliveryStartAt - 6 * 60 * 60 * 1_000;
  const expectedCollectionEndAt =
    fixture.requestDeliveryStartAt - 60 * 60 * 1_000;
  if (
    plan.plannedGrams !== fixture.grams ||
    plan.collectionWindowStartAt !== expectedCollectionStartAt ||
    plan.collectionWindowEndAt !== expectedCollectionEndAt ||
    plan.deliveryWindowStartAt !== fixture.requestDeliveryStartAt ||
    plan.deliveryWindowEndAt !== fixture.requestDeliveryEndAt ||
    (plan.transporterId !== undefined &&
      plan.transporterId !== transporter.transporterId) ||
    (plan.driverUserId !== undefined &&
      plan.driverUserId !== transporter.userId) ||
    (plan.vehicleRegistration !== undefined &&
      plan.vehicleRegistration !== "AS-4026-26") ||
    (plan.vehicleCapacityGrams !== undefined &&
      plan.vehicleCapacityGrams !== 5_000_000) ||
    ["collecting", "in_transit", "delivered", "cancelled"].includes(plan.status)
  ) {
    throw new Error(
      `${fixture.bags}-bag collection plan is outside the reviewed preview setup.`,
    );
  }
}

function previewLotCode(programmeId, bags) {
  return `PREVIEW-${programmeId.slice(-6).toUpperCase()}-${bags}`;
}

function toExecutedStarterSummary(record) {
  return {
    bags: record.bags,
    kilograms: record.kilograms,
    buyerRequestId: record.buyerRequestId,
    buyerRequestStatus: record.buyerRequestStatus,
    supplyDeclarationId: record.supplyDeclarationId,
    supplyVerificationStatus: record.supplyVerificationStatus,
  };
}

function sameStringSet(left, right) {
  return (
    left.length === right.length && right.every((value) => left.includes(value))
  );
}

function toSafeStarterSummary(record) {
  return {
    bags: record.bags,
    bagWeightKg: 50,
    kilograms: record.kilograms,
    buyerRequest: "submitted",
    farmerSupply: "self_reported",
  };
}

function printResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

function requiredEnvironmentValue(name) {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function loadLocalEnvironment(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (
      trimmed.length === 0 ||
      trimmed.startsWith("#") ||
      !trimmed.includes("=")
    )
      continue;
    const [rawKey, ...rawValueParts] = trimmed.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").split("#")[0]?.trim();
    if (
      key.length > 0 &&
      process.env[key] === undefined &&
      value !== undefined
    ) {
      process.env[key] = value;
    }
  }
}
