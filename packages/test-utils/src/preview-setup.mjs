import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import {
  PREVIEW_SETUP_CONFIRMATION,
  buildPreviewStarterRecords,
  parsePreviewSetupOptions,
  previewActorDefinitions,
} from "./preview-setup-options.mjs";

const rootDir = resolve(import.meta.dirname, "../../..");
loadLocalEnvironment(resolve(rootDir, ".env.local"));

const options = parsePreviewSetupOptions(process.argv.slice(2));
const firebaseAuth = createFirebaseAuth();
const firebaseApiKey = requiredEnvironmentValue("NEXT_PUBLIC_FIREBASE_API_KEY");
const actors = previewActorDefinitions.map((definition) => ({
  ...definition,
  ...options.actors[definition.key],
}));

await requireExistingFirebaseAdmin(firebaseAuth, options.adminFirebaseUid);
const firebasePlan = await inspectFirebaseActors(firebaseAuth, actors);
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
if (adminPrincipal.role !== "admin")
  throw new Error(
    "PREVIEW_SETUP_ADMIN_FIREBASE_UID is not linked to an admin user.",
  );

const baseClient = new ConvexHttpClient(options.convexUrl);
const convexPlan = [];
for (const actor of actors) {
  const existing = await baseClient.query(api.users.getByAuthProviderId, {
    authProviderId: actor.firebaseUid,
  });
  if (existing !== null && existing.role !== actor.role)
    throw new Error(
      `${actor.key} Firebase UID is already linked to the ${existing.role} role.`,
    );
  if (
    existing?.phoneNumber !== undefined &&
    existing.phoneNumber !== actor.phoneNumber
  )
    throw new Error(`${actor.key} Convex user has a different phone number.`);
  convexPlan.push({
    role: actor.key,
    user: existing === null ? "create" : "reuse",
    profile:
      actor.key === "operations" ? "no warehouse profile" : "create or reuse",
  });
}

if (!options.execute) {
  printResult({
    mode: "dry-run",
    deployment: options.deployment,
    programme: "create or update MAIZE-PREVIEW-2026",
    firebasePlan,
    convexPlan,
    finance:
      "buyer-to-farmer produce obligations, a configurable 3% seller coordination fee, and buyer transport/handling charges; no purchasing budget or reservation",
    warehouse:
      "one approved operations profile with zero warehouse assignments",
    starterRecords: buildPreviewStarterRecords(Date.now()),
    nextStep: `Run again with --execute --confirm=${PREVIEW_SETUP_CONFIRMATION} after reviewing this plan.`,
  });
  process.exit(0);
}

for (const actor of actors) await provisionFirebaseActor(firebaseAuth, actor);
const clients = Object.fromEntries(
  await Promise.all(
    actors.map(async (actor) => [
      actor.key,
      await createAuthenticatedConvexClient(
        firebaseAuth,
        firebaseApiKey,
        options.convexUrl,
        actor.firebaseUid,
      ),
    ]),
  ),
);
const identity = (key) => {
  const actor = actorDefinition(key);
  return {
    authProviderId: actor.firebaseUid,
    phoneNumber: actor.phoneNumber,
    displayName: actor.name,
    phoneVerified: true,
    signInProvider: "custom",
  };
};

const farmer = await clients.farmer.mutation(
  api.auth.createSelfAppFarmerProfile,
  {
    identity: identity("farmer"),
    fullName: actorDefinition("farmer").name,
    community: "Ejura",
    region: "Ashanti",
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
    destinationMarket: "Kumasi Central Market",
  },
);
const transporter = await clients.transporter.mutation(
  api.auth.createOrLinkTransporterProfileAfterPhoneAuth,
  {
    identity: identity("transporter"),
    fullName: actorDefinition("transporter").name,
    vehicleType: "Cargo truck",
    vehicleCapacity: 200,
    vehicleCapacityUnit: "50kg bags",
    baseLocation: "Ejura",
    routesServed: ["Ejura to Kumasi"],
    destinationsServed: ["Kumasi Central Market"],
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

const setup = await adminClient.mutation(api.demoPreviewSetup.run, {
  farmerUserId: farmer.userId,
  farmerId: farmer.farmerId,
  buyerUserId: buyer.userId,
  buyerId: buyer.buyerId,
  transporterUserId: transporter.userId,
  transporterId: transporter.transporterId,
  operationsUserId,
  startAt: options.startAt,
  endAt: options.endAt,
  cutoffAt: options.cutoffAt,
  confirm: PREVIEW_SETUP_CONFIRMATION,
});

printResult({
  mode: "executed",
  deployment: options.deployment,
  programme: {
    id: setup.programmeId,
    code: setup.programmeCode,
    previewCoordinationUntil: new Date(
      setup.previewCoordinationUntil,
    ).toISOString(),
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
      profileId: setup.operationsProfileId,
    },
  },
  assignmentId: setup.assignmentId,
  backgroundFarmers: setup.backgroundFarmers,
  transporterJobs: setup.jobs,
  cleanupEnvironment: {
    PREVIEW_CLEANUP_PROGRAMME_ID: setup.programmeId,
    PREVIEW_FARMER_USER_ID: farmer.userId,
    PREVIEW_BUYER_USER_ID: buyer.userId,
    PREVIEW_TRANSPORTER_USER_ID: transporter.userId,
    PREVIEW_OPERATIONS_USER_ID: operationsUserId,
    PREVIEW_BACKGROUND_FARMER_USER_IDS: setup.backgroundFarmers
      .map((farmer) => farmer.userId)
      .join(","),
    PREVIEW_CLEANUP_START_AT: new Date(options.startAt).toISOString(),
    PREVIEW_CLEANUP_END_AT: new Date(options.endAt).toISOString(),
  },
  nextStep:
    "Open the transporter profile to review its three ready collection jobs.",
});

function actorDefinition(key) {
  const actor = actors.find((candidate) => candidate.key === key);
  if (actor === undefined) throw new Error(`Unknown preview actor ${key}.`);
  return actor;
}

function createFirebaseAuth() {
  const projectId = requiredEnvironmentValue("FIREBASE_PROJECT_ID");
  const serviceAccount = JSON.parse(
    Buffer.from(
      requiredEnvironmentValue("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64"),
      "base64",
    ).toString("utf8"),
  );
  if (typeof serviceAccount.private_key === "string")
    serviceAccount.private_key = serviceAccount.private_key.replaceAll(
      "\\n",
      "\n",
    );
  const app =
    getApps()[0] ??
    initializeApp({ credential: cert(serviceAccount), projectId });
  return getAuth(app);
}

async function requireExistingFirebaseAdmin(auth, uid) {
  const user = await firebaseUserOrNull(auth, uid);
  if (user === null || user.disabled)
    throw new Error(
      "The setup admin Firebase user must already exist and be enabled.",
    );
}

async function inspectFirebaseActors(auth, definitions) {
  const plan = [];
  for (const actor of definitions) {
    const [byUid, byPhone] = await Promise.all([
      firebaseUserOrNull(auth, actor.firebaseUid),
      firebaseUserByPhoneOrNull(auth, actor.phoneNumber),
    ]);
    if (byPhone !== null && byPhone.uid !== actor.firebaseUid)
      throw new Error(
        `${actor.key} phone number belongs to another Firebase user.`,
      );
    if (
      byUid?.phoneNumber !== undefined &&
      byUid.phoneNumber !== actor.phoneNumber
    )
      throw new Error(
        `${actor.key} Firebase user has a different phone number.`,
      );
    const actions = [];
    if (byUid === null) actions.push("create");
    else {
      if (byUid.displayName !== actor.name) actions.push("set display name");
      if (byUid.phoneNumber === undefined) actions.push("set phone number");
      if (byUid.disabled) actions.push("enable");
    }
    plan.push({
      role: actor.key,
      actions: actions.length === 0 ? ["reuse"] : actions,
    });
  }
  return plan;
}

async function provisionFirebaseActor(auth, actor) {
  const existing = await firebaseUserOrNull(auth, actor.firebaseUid);
  if (existing === null) {
    await auth.createUser({
      uid: actor.firebaseUid,
      phoneNumber: actor.phoneNumber,
      displayName: actor.name,
      disabled: false,
    });
    return;
  }
  await auth.updateUser(actor.firebaseUid, {
    phoneNumber: actor.phoneNumber,
    displayName: actor.name,
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
  if (!response.ok || typeof body.idToken !== "string")
    throw new Error(
      `Firebase token exchange failed with status ${response.status}.`,
    );
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(body.idToken);
  return client;
}

function loadLocalEnvironment(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const equalsAt = trimmed.indexOf("=");
    if (equalsAt <= 0) continue;
    const key = trimmed.slice(0, equalsAt).trim();
    let value = trimmed.slice(equalsAt + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
function requiredEnvironmentValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
function printResult(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
