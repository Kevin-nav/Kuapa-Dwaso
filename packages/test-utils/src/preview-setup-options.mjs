export const PREVIEW_SETUP_CONFIRMATION = "PROVISION_PREVIEW_ACTORS";

export const previewActorDefinitions = [
  {
    key: "farmer",
    role: "farmer",
    name: "Ama Mensah",
    uidEnvironmentName: "PREVIEW_ACCESS_FARMER_FIREBASE_UID",
    phoneEnvironmentName: "PREVIEW_FARMER_PHONE_NUMBER",
  },
  {
    key: "buyer",
    role: "buyer",
    name: "Adwoa Owusu",
    uidEnvironmentName: "PREVIEW_ACCESS_BUYER_FIREBASE_UID",
    phoneEnvironmentName: "PREVIEW_BUYER_PHONE_NUMBER",
  },
  {
    key: "transporter",
    role: "transporter",
    name: "Kwame Asare",
    uidEnvironmentName: "PREVIEW_ACCESS_TRANSPORTER_FIREBASE_UID",
    phoneEnvironmentName: "PREVIEW_TRANSPORTER_PHONE_NUMBER",
  },
  {
    key: "operations",
    role: "warehouse_agent",
    name: "Akosua Boateng",
    uidEnvironmentName: "PREVIEW_ACCESS_WAREHOUSE_AGENT_FIREBASE_UID",
    phoneEnvironmentName: "PREVIEW_OPERATIONS_PHONE_NUMBER",
  },
];

const argumentNames = new Map([
  ["deployment", "deployment"],
  ["convex-url", "convexUrl"],
  ["programme-id", "programmeId"],
  ["admin-uid", "adminFirebaseUid"],
  ["farmer-uid", "farmerFirebaseUid"],
  ["buyer-uid", "buyerFirebaseUid"],
  ["transporter-uid", "transporterFirebaseUid"],
  ["operations-uid", "operationsFirebaseUid"],
  ["farmer-phone", "farmerPhoneNumber"],
  ["buyer-phone", "buyerPhoneNumber"],
  ["transporter-phone", "transporterPhoneNumber"],
  ["operations-phone", "operationsPhoneNumber"],
  ["inspection-evidence-ids", "inspectionEvidenceUploadAssetIds"],
  ["start", "start"],
  ["end", "end"],
  ["cutoff", "cutoff"],
  ["confirm", "confirm"],
]);

const environmentNames = {
  deployment: "PREVIEW_CLEANUP_DEPLOYMENT",
  convexUrl: "PREVIEW_SETUP_CONVEX_URL",
  programmeId: "PREVIEW_CLEANUP_PROGRAMME_ID",
  adminFirebaseUid: "PREVIEW_SETUP_ADMIN_FIREBASE_UID",
  farmerFirebaseUid: "PREVIEW_ACCESS_FARMER_FIREBASE_UID",
  buyerFirebaseUid: "PREVIEW_ACCESS_BUYER_FIREBASE_UID",
  transporterFirebaseUid: "PREVIEW_ACCESS_TRANSPORTER_FIREBASE_UID",
  operationsFirebaseUid: "PREVIEW_ACCESS_WAREHOUSE_AGENT_FIREBASE_UID",
  farmerPhoneNumber: "PREVIEW_FARMER_PHONE_NUMBER",
  buyerPhoneNumber: "PREVIEW_BUYER_PHONE_NUMBER",
  transporterPhoneNumber: "PREVIEW_TRANSPORTER_PHONE_NUMBER",
  operationsPhoneNumber: "PREVIEW_OPERATIONS_PHONE_NUMBER",
  inspectionEvidenceUploadAssetIds:
    "PREVIEW_INSPECTION_EVIDENCE_UPLOAD_ASSET_IDS",
  start: "PREVIEW_CLEANUP_START_AT",
  end: "PREVIEW_CLEANUP_END_AT",
  cutoff: "PREVIEW_ACCESS_CUTOFF_UTC",
};

export function parsePreviewSetupOptions(
  argv,
  env = process.env,
  now = Date.now(),
) {
  const parsed = {};
  let execute = false;
  let profilesOnly = false;
  for (const argument of argv) {
    if (argument === "--") {
      continue;
    }
    if (argument === "--execute") {
      execute = true;
      continue;
    }
    if (argument === "--profiles-only") {
      profilesOnly = true;
      continue;
    }
    if (!argument.startsWith("--") || !argument.includes("=")) {
      throw new Error(`Unknown setup argument: ${argument}`);
    }
    const equalsAt = argument.indexOf("=");
    const rawName = argument.slice(2, equalsAt);
    const key = argumentNames.get(rawName);
    if (key === undefined) {
      throw new Error(`Unknown setup argument: --${rawName}`);
    }
    if (parsed[key] !== undefined) {
      throw new Error(`Setup argument --${rawName} was provided twice.`);
    }
    parsed[key] = argument.slice(equalsAt + 1);
  }

  const value = (key) => {
    const resolved = parsed[key] ?? env[environmentNames[key]];
    if (typeof resolved !== "string" || resolved.trim().length === 0) {
      throw new Error(
        `Setup requires --${cliName(key)}=<value> or ${environmentNames[key]}.`,
      );
    }
    return resolved.trim();
  };

  const deployment = value("deployment");
  if (!/^[A-Za-z0-9][A-Za-z0-9_:/.-]*$/.test(deployment)) {
    throw new Error("Setup deployment target contains unsupported characters.");
  }
  const convexUrl = parseConvexUrl(value("convexUrl"));
  assertDeploymentMatchesConvexUrl(deployment, convexUrl);
  const programmeId = parseId(value("programmeId"), "programme ID");
  const adminFirebaseUid = parseFirebaseUid(
    value("adminFirebaseUid"),
    "admin Firebase UID",
  );
  const actorValues = {
    farmer: {
      firebaseUid: parseFirebaseUid(
        value("farmerFirebaseUid"),
        "farmer Firebase UID",
      ),
      phoneNumber: parsePhoneNumber(
        value("farmerPhoneNumber"),
        "farmer phone number",
      ),
    },
    buyer: {
      firebaseUid: parseFirebaseUid(
        value("buyerFirebaseUid"),
        "buyer Firebase UID",
      ),
      phoneNumber: parsePhoneNumber(
        value("buyerPhoneNumber"),
        "buyer phone number",
      ),
    },
    transporter: {
      firebaseUid: parseFirebaseUid(
        value("transporterFirebaseUid"),
        "transporter Firebase UID",
      ),
      phoneNumber: parsePhoneNumber(
        value("transporterPhoneNumber"),
        "transporter phone number",
      ),
    },
    operations: {
      firebaseUid: parseFirebaseUid(
        value("operationsFirebaseUid"),
        "operations Firebase UID",
      ),
      phoneNumber: parsePhoneNumber(
        value("operationsPhoneNumber"),
        "operations phone number",
      ),
    },
  };
  const actorUids = Object.values(actorValues).map(
    (actor) => actor.firebaseUid,
  );
  if (new Set([adminFirebaseUid, ...actorUids]).size !== 5) {
    throw new Error(
      "Setup requires a distinct admin UID and four distinct actor UIDs.",
    );
  }
  const actorPhones = Object.values(actorValues).map(
    (actor) => actor.phoneNumber,
  );
  if (new Set(actorPhones).size !== 4) {
    throw new Error("Setup requires four distinct actor phone numbers.");
  }
  const rawInspectionEvidenceIds =
    parsed.inspectionEvidenceUploadAssetIds ??
    env[environmentNames.inspectionEvidenceUploadAssetIds];
  const inspectionEvidenceUploadAssetIds =
    typeof rawInspectionEvidenceIds === "string" &&
    rawInspectionEvidenceIds.trim().length > 0
      ? rawInspectionEvidenceIds
          .split(",")
          .map((item) =>
            parseId(item.trim(), "inspection evidence upload asset ID"),
          )
      : [];
  if (
    (!profilesOnly && inspectionEvidenceUploadAssetIds.length !== 3) ||
    new Set(inspectionEvidenceUploadAssetIds).size !==
      inspectionEvidenceUploadAssetIds.length
  ) {
    throw new Error(
      "Full setup requires exactly three distinct inspection evidence upload asset IDs. Use --profiles-only only for the initial actor bootstrap.",
    );
  }

  const startAt = parseTimestamp(value("start"), "start");
  const endAt = parseTimestamp(value("end"), "end");
  const cutoffAt = parseTimestamp(value("cutoff"), "cutoff");
  if (startAt >= endAt) {
    throw new Error("Setup cleanup end must be after its start.");
  }
  if (endAt - startAt > 14 * 24 * 60 * 60 * 1_000) {
    throw new Error("Setup cleanup window cannot exceed fourteen days.");
  }
  if (now < startAt || now >= endAt) {
    throw new Error("Current time must be inside the exact cleanup window.");
  }
  if (cutoffAt <= now || cutoffAt > endAt) {
    throw new Error(
      "Preview cutoff must be in the future and no later than cleanup end.",
    );
  }
  const starterRecords = buildPreviewStarterRecords(startAt);
  const latestStarterWindow = Math.max(
    ...starterRecords.flatMap((record) => [
      record.requestDeliveryEndAt,
      record.supplyReadyEndAt,
    ]),
  );
  if (cutoffAt <= latestStarterWindow) {
    throw new Error(
      "Preview cutoff must include every starter request and supply window.",
    );
  }
  const earliestCollectionWindowStartAt = Math.min(
    ...starterRecords.map(
      (record) => record.requestDeliveryStartAt - 6 * 60 * 60 * 1_000,
    ),
  );
  if (!profilesOnly && earliestCollectionWindowStartAt <= now) {
    throw new Error(
      "Full setup must run before the first prepared collection window starts.",
    );
  }

  const confirm = parsed.confirm;
  if (execute && confirm !== PREVIEW_SETUP_CONFIRMATION) {
    throw new Error(
      `Execution requires --confirm=${PREVIEW_SETUP_CONFIRMATION}.`,
    );
  }
  if (!execute && confirm !== undefined) {
    throw new Error("Do not pass --confirm while previewing setup.");
  }

  return {
    mode: execute ? "execute" : "dry-run",
    execute,
    profilesOnly,
    deployment,
    convexUrl,
    programmeId,
    adminFirebaseUid,
    actors: actorValues,
    inspectionEvidenceUploadAssetIds,
    startAt,
    endAt,
    cutoffAt,
  };
}

export function buildPreviewStarterRecords(startAt) {
  const bagCounts = [100, 150, 200];
  return bagCounts.map((bags, index) => ({
    bags,
    kilograms: bags * 50,
    grams: bags * 50 * 1_000,
    requestDeliveryStartAt: startAt + (72 + index * 12) * 60 * 60 * 1_000,
    requestDeliveryEndAt: startAt + (80 + index * 12) * 60 * 60 * 1_000,
    supplyReadyStartAt: startAt + (6 + index * 6) * 60 * 60 * 1_000,
    supplyReadyEndAt: startAt + (30 + index * 6) * 60 * 60 * 1_000,
    requestCreateKey: `preview-buyer-request-${bags}-bags-v1`,
    requestSubmitKey: `preview-buyer-submit-${bags}-bags-v1`,
    declarationKey: `preview-farmer-supply-${bags}-bags-v1`,
    reviewKey: `preview-supply-review-${bags}-bags-v1`,
    requestReviewKey: `preview-request-review-${bags}-bags-v1`,
    agreementKey: `preview-buyer-agreement-${bags}-bags-v1`,
    agreementAcknowledgeKey: `preview-buyer-ack-${bags}-bags-v1`,
    offerCreateKey: `preview-farmer-offer-${bags}-bags-v1`,
    offerSendKey: `preview-farmer-offer-send-${bags}-bags-v1`,
    fundingReservationKey: `preview-funding-reservation-${bags}-bags-v1`,
    offerAcceptKey: `preview-farmer-offer-accept-${bags}-bags-v1`,
    requestConfirmKey: `preview-request-confirm-${bags}-bags-v1`,
    inspectionKey: `preview-inspection-${bags}-bags-v1`,
    planCreateKey: `preview-collection-plan-${bags}-bags-v1`,
    driverAssignKey: `preview-driver-assign-${bags}-bags-v1`,
    planReadyKey: `preview-plan-ready-${bags}-bags-v1`,
  }));
}

function cliName(key) {
  for (const [name, mappedKey] of argumentNames) {
    if (mappedKey === key) return name;
  }
  throw new Error(`No CLI name is registered for ${key}.`);
}

function parseId(value, label) {
  if (!/^[A-Za-z0-9]{8,128}$/.test(value)) {
    throw new Error(`${label} is not a valid exact Convex ID.`);
  }
  return value;
}

function parseFirebaseUid(value, label) {
  if (value.length > 128 || /\s/.test(value)) {
    throw new Error(
      `${label} must be a non-empty Firebase UID of at most 128 characters.`,
    );
  }
  return value;
}

function parsePhoneNumber(value, label) {
  if (!/^\+[1-9]\d{7,14}$/.test(value)) {
    throw new Error(`${label} must use E.164 format.`);
  }
  return value;
}

function parseTimestamp(value, label) {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new Error(`${label} timestamp must include an explicit UTC offset.`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isSafeInteger(timestamp)) {
    throw new Error(`${label} timestamp is invalid.`);
  }
  return timestamp;
}

function parseConvexUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Setup Convex URL is invalid.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("Setup Convex URL must use HTTPS, except for localhost.");
  }
  return url.toString().replace(/\/$/, "");
}

function assertDeploymentMatchesConvexUrl(deployment, convexUrl) {
  const hostname = new URL(convexUrl).hostname;
  const cloudSuffix = ".convex.cloud";
  if (!hostname.endsWith(cloudSuffix)) return;

  const hostnameDeployment = hostname.slice(0, -cloudSuffix.length);
  const configuredDeployment = deployment.split(":").at(-1);
  if (configuredDeployment !== hostnameDeployment) {
    throw new Error(
      "Setup Convex URL and cleanup deployment must identify the same Convex deployment.",
    );
  }
}
