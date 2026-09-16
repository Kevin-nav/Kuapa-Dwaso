export const PREVIEW_CLEANUP_CONFIRMATION = "DELETE_PREVIEW_WINDOW_DATA";

const envNames = {
  deployment: "PREVIEW_CLEANUP_DEPLOYMENT",
  programmeId: "PREVIEW_CLEANUP_PROGRAMME_ID",
  farmerUserId: "PREVIEW_FARMER_USER_ID",
  buyerUserId: "PREVIEW_BUYER_USER_ID",
  transporterUserId: "PREVIEW_TRANSPORTER_USER_ID",
  operationsUserId: "PREVIEW_OPERATIONS_USER_ID",
  start: "PREVIEW_CLEANUP_START_AT",
  end: "PREVIEW_CLEANUP_END_AT",
};

const argumentNames = new Map([
  ["deployment", "deployment"],
  ["programme-id", "programmeId"],
  ["farmer-user-id", "farmerUserId"],
  ["buyer-user-id", "buyerUserId"],
  ["transporter-user-id", "transporterUserId"],
  ["operations-user-id", "operationsUserId"],
  ["start", "start"],
  ["end", "end"],
  ["confirm", "confirm"],
]);

export function parsePreviewCleanupOptions(argv, env = process.env) {
  const parsed = {};
  let execute = false;
  for (const argument of argv) {
    if (argument === "--") {
      continue;
    }
    if (argument === "--execute") {
      execute = true;
      continue;
    }
    if (!argument.startsWith("--") || !argument.includes("=")) {
      throw new Error(`Unknown cleanup argument: ${argument}`);
    }
    const equalsAt = argument.indexOf("=");
    const rawName = argument.slice(2, equalsAt);
    const key = argumentNames.get(rawName);
    if (key === undefined) {
      throw new Error(`Unknown cleanup argument: --${rawName}`);
    }
    if (parsed[key] !== undefined) {
      throw new Error(`Cleanup argument --${rawName} was provided twice.`);
    }
    parsed[key] = argument.slice(equalsAt + 1);
  }

  const value = (key) => {
    const resolved = parsed[key] ?? env[envNames[key]];
    if (typeof resolved !== "string" || resolved.trim().length === 0) {
      throw new Error(
        `Cleanup requires --${cliName(key)}=<value> or ${envNames[key]}.`,
      );
    }
    return resolved.trim();
  };

  const deployment = value("deployment");
  if (!/^[A-Za-z0-9][A-Za-z0-9_:/.-]*$/.test(deployment)) {
    throw new Error(
      "Cleanup deployment target contains unsupported characters.",
    );
  }
  const programmeId = parseId(value("programmeId"), "programme ID");
  const farmerUserId = parseId(value("farmerUserId"), "farmer user ID");
  const buyerUserId = parseId(value("buyerUserId"), "buyer user ID");
  const transporterUserId = parseId(
    value("transporterUserId"),
    "transporter user ID",
  );
  const operationsUserId = parseId(
    value("operationsUserId"),
    "operations user ID",
  );
  if (
    new Set([farmerUserId, buyerUserId, transporterUserId, operationsUserId])
      .size !== 4
  ) {
    throw new Error("Cleanup requires four distinct actor user IDs.");
  }

  const startAt = parseTimestamp(value("start"), "start");
  const endAt = parseTimestamp(value("end"), "end");
  if (startAt >= endAt) {
    throw new Error("Cleanup end must be after its start.");
  }
  if (endAt - startAt > 14 * 24 * 60 * 60 * 1_000) {
    throw new Error("Cleanup window cannot exceed fourteen days.");
  }

  const confirm = parsed.confirm;
  if (execute && confirm !== PREVIEW_CLEANUP_CONFIRMATION) {
    throw new Error(
      `Execution requires --confirm=${PREVIEW_CLEANUP_CONFIRMATION}.`,
    );
  }
  if (!execute && confirm !== undefined) {
    throw new Error("Do not pass --confirm while previewing cleanup.");
  }

  return {
    deployment,
    mutationArgs: {
      programmeId,
      farmerUserId,
      buyerUserId,
      transporterUserId,
      operationsUserId,
      startAt,
      endAt,
      execute,
      ...(execute ? { confirm } : {}),
    },
  };
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
