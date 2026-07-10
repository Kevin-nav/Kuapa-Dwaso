const arkeselSmsEndpoint = "https://sms.arkesel.com/api/v2/sms/send";
const recipient = "+233549037907";
const message =
  "Kuapa Dwaso staging SMS test. If you received this message, Arkesel delivery is working.";

try {
  if (!process.argv.slice(2).includes("--confirm")) {
    console.error(
      "This command sends a live staging SMS and may consume provider credits.",
    );
    console.error("Re-run with --confirm to send one SMS to +233549037907.");
    process.exitCode = 2;
  } else {
    await sendStagingSms();
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "The staging SMS test failed.",
  );
  process.exitCode = 1;
}

async function sendStagingSms() {
  const apiKey = requireEnvironmentValue("ARKESEL_SMS_API_KEY");
  const sender = requireEnvironmentValue("SMS_FROM_NAME").trim();
  const provider = requireEnvironmentValue("SMS_PROVIDER").trim();

  if (provider !== "arkesel") {
    throw new Error(
      `Expected SMS_PROVIDER=arkesel, received ${JSON.stringify(provider)}.`,
    );
  }
  if (!/^(?=.*[A-Za-z])[A-Za-z0-9]{1,11}$/.test(sender)) {
    throw new Error(
      "SMS_FROM_NAME must be 1-11 alphanumeric characters and contain at least one letter.",
    );
  }

  console.log(`Sending one staging SMS to ${recipient} from ${sender}...`);
  const response = await fetch(arkeselSmsEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender,
      message,
      recipients: [recipient],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJson(response);

  if (!response.ok || body.status === "error") {
    const code =
      body.code === undefined ? String(response.status) : String(body.code);
    throw new Error(
      `Arkesel rejected the SMS (code ${code}): ${body.message ?? "No provider message returned."}`,
    );
  }

  const messageId = findMessageId(body.data);
  if (typeof messageId !== "string" || messageId.trim().length === 0) {
    throw new Error(
      "Arkesel accepted the request but did not return a message ID.",
    );
  }

  console.log(`SMS accepted by Arkesel. Message ID: ${messageId}`);
  const creditsUsed = findCreditsUsed(body.data);
  if (creditsUsed !== undefined) {
    console.log(`Credits used: ${creditsUsed}`);
  }
}

function requireEnvironmentValue(name) {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0 || value === "<set>") {
    throw new Error(`${name} must be set in .env.staging.`);
  }
  return value;
}

async function readJson(response) {
  try {
    const body = await response.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findMessageId(data) {
  const entries = Array.isArray(data) ? data : [data];
  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue;
    }
    for (const key of ["id", "message_id", "messageId", "ID"]) {
      const value = entry[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
  }
  return undefined;
}

function findCreditsUsed(data) {
  const entries = Array.isArray(data) ? data : [data];
  const credits = entries
    .filter(isRecord)
    .map((entry) => entry.credits_used ?? entry.creditsUsed)
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  return credits.length > 0
    ? credits.reduce((total, value) => total + value, 0)
    : undefined;
}
