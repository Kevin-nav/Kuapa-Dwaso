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
  ["admin-uid", "adminFirebaseUid"],
  ["farmer-uid", "farmerFirebaseUid"],
  ["buyer-uid", "buyerFirebaseUid"],
  ["transporter-uid", "transporterFirebaseUid"],
  ["operations-uid", "operationsFirebaseUid"],
  ["farmer-phone", "farmerPhoneNumber"],
  ["buyer-phone", "buyerPhoneNumber"],
  ["transporter-phone", "transporterPhoneNumber"],
  ["operations-phone", "operationsPhoneNumber"],
  ["start", "start"],
  ["end", "end"],
  ["cutoff", "cutoff"],
  ["confirm", "confirm"],
]);

const environmentNames = {
  deployment: "PREVIEW_CLEANUP_DEPLOYMENT",
  convexUrl: "PREVIEW_SETUP_CONVEX_URL",
  adminFirebaseUid: "PREVIEW_SETUP_ADMIN_FIREBASE_UID",
  farmerFirebaseUid: "PREVIEW_ACCESS_FARMER_FIREBASE_UID",
  buyerFirebaseUid: "PREVIEW_ACCESS_BUYER_FIREBASE_UID",
  transporterFirebaseUid: "PREVIEW_ACCESS_TRANSPORTER_FIREBASE_UID",
  operationsFirebaseUid: "PREVIEW_ACCESS_WAREHOUSE_AGENT_FIREBASE_UID",
  farmerPhoneNumber: "PREVIEW_FARMER_PHONE_NUMBER",
  buyerPhoneNumber: "PREVIEW_BUYER_PHONE_NUMBER",
  transporterPhoneNumber: "PREVIEW_TRANSPORTER_PHONE_NUMBER",
  operationsPhoneNumber: "PREVIEW_OPERATIONS_PHONE_NUMBER",
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
  for (const argument of argv) {
    if (argument === "--") continue;
    if (argument === "--execute") {
      execute = true;
      continue;
    }
    if (!argument.startsWith("--") || !argument.includes("="))
      throw new Error(`Unknown setup argument: ${argument}`);
    const equalsAt = argument.indexOf("=");
    const rawName = argument.slice(2, equalsAt);
    const key = argumentNames.get(rawName);
    if (key === undefined)
      throw new Error(`Unknown setup argument: --${rawName}`);
    if (parsed[key] !== undefined)
      throw new Error(`Setup argument --${rawName} was provided twice.`);
    parsed[key] = argument.slice(equalsAt + 1);
  }
  const value = (key) => {
    const resolved = parsed[key] ?? env[environmentNames[key]];
    if (typeof resolved !== "string" || resolved.trim().length === 0)
      throw new Error(
        `Setup requires --${cliName(key)}=<value> or ${environmentNames[key]}.`,
      );
    return resolved.trim();
  };

  const deployment = value("deployment");
  if (!/^[A-Za-z0-9][A-Za-z0-9_:/.-]*$/.test(deployment))
    throw new Error("Setup deployment target contains unsupported characters.");
  const convexUrl = parseConvexUrl(value("convexUrl"));
  assertDeploymentMatchesConvexUrl(deployment, convexUrl);
  const adminFirebaseUid = parseFirebaseUid(
    value("adminFirebaseUid"),
    "admin Firebase UID",
  );
  const actors = {
    farmer: actorValues(value, "farmer"),
    buyer: actorValues(value, "buyer"),
    transporter: actorValues(value, "transporter"),
    operations: actorValues(value, "operations"),
  };
  const actorUids = Object.values(actors).map((actor) => actor.firebaseUid);
  if (new Set([adminFirebaseUid, ...actorUids]).size !== 5)
    throw new Error(
      "Setup requires a distinct admin UID and four distinct actor UIDs.",
    );
  const actorPhones = Object.values(actors).map((actor) => actor.phoneNumber);
  if (new Set(actorPhones).size !== 4)
    throw new Error("Setup requires four distinct actor phone numbers.");

  const startAt = parseTimestamp(value("start"), "start");
  const endAt = parseTimestamp(value("end"), "end");
  const cutoffAt = parseTimestamp(value("cutoff"), "cutoff");
  if (startAt >= endAt)
    throw new Error("Setup cleanup end must be after its start.");
  if (endAt - startAt > 14 * 24 * 60 * 60 * 1_000)
    throw new Error("Setup cleanup window cannot exceed fourteen days.");
  if (now < startAt || now >= endAt)
    throw new Error("Current time must be inside the exact cleanup window.");
  if (cutoffAt <= now || cutoffAt > endAt)
    throw new Error(
      "Preview cutoff must be in the future and no later than cleanup end.",
    );
  if (cutoffAt - now <= 10 * 60 * 60 * 1_000)
    throw new Error(
      "Preview cutoff must leave at least ten hours for the prepared routes.",
    );

  const confirm = parsed.confirm;
  if (execute && confirm !== PREVIEW_SETUP_CONFIRMATION)
    throw new Error(
      `Execution requires --confirm=${PREVIEW_SETUP_CONFIRMATION}.`,
    );
  if (!execute && confirm !== undefined)
    throw new Error("Do not pass --confirm while previewing setup.");
  return {
    mode: execute ? "execute" : "dry-run",
    execute,
    deployment,
    convexUrl,
    adminFirebaseUid,
    actors,
    startAt,
    endAt,
    cutoffAt,
  };
}

export function buildPreviewStarterRecords(now) {
  return [100, 150, 200].map((bags, index) => ({
    bags,
    kilograms: bags * 50,
    grams: bags * 50 * 1_000,
    collectionWindowStartAt: now + (2 + index * 2) * 60 * 60 * 1_000,
    requestDeliveryEndAt: now + (6 + index * 2) * 60 * 60 * 1_000,
    previewSeedKey: `public-preview-${bags}-bags-v2`,
    sourceLotBags: index === 0 ? [40, 30, 30] : [bags],
    sellerCoordinationFeePercent: 3,
  }));
}

function actorValues(value, key) {
  return {
    firebaseUid: parseFirebaseUid(
      value(`${key}FirebaseUid`),
      `${key} Firebase UID`,
    ),
    phoneNumber: parsePhoneNumber(
      value(`${key}PhoneNumber`),
      `${key} phone number`,
    ),
  };
}
function cliName(key) {
  for (const [name, mappedKey] of argumentNames)
    if (mappedKey === key) return name;
  throw new Error(`No CLI name is registered for ${key}.`);
}
function parseFirebaseUid(value, label) {
  if (value.length > 128 || /\s/.test(value))
    throw new Error(
      `${label} must be a non-empty Firebase UID of at most 128 characters.`,
    );
  return value;
}
function parsePhoneNumber(value, label) {
  if (!/^\+[1-9]\d{7,14}$/.test(value))
    throw new Error(`${label} must use E.164 format.`);
  return value;
}
function parseTimestamp(value, label) {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value))
    throw new Error(`${label} timestamp must include an explicit UTC offset.`);
  const timestamp = Date.parse(value);
  if (!Number.isSafeInteger(timestamp))
    throw new Error(`${label} timestamp is invalid.`);
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
  if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    throw new Error("Setup Convex URL must use HTTPS, except for localhost.");
  return url.toString().replace(/\/$/, "");
}
function assertDeploymentMatchesConvexUrl(deployment, convexUrl) {
  const hostname = new URL(convexUrl).hostname;
  const suffix = ".convex.cloud";
  if (!hostname.endsWith(suffix)) return;
  const hostnameDeployment = hostname.slice(0, -suffix.length);
  const configuredDeployment = deployment.split(":").at(-1);
  if (configuredDeployment !== hostnameDeployment)
    throw new Error(
      "Setup Convex URL and cleanup deployment must identify the same Convex deployment.",
    );
}
