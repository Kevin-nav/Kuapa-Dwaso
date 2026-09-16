import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { previewActorDefinitions } from "./preview-setup-options.mjs";
import { parsePreviewRevokeSessionsOptions } from "./preview-revoke-sessions-options.mjs";

const rootDir = resolve(import.meta.dirname, "../../..");
loadLocalEnvironment(resolve(rootDir, ".env.local"));
const options = parsePreviewRevokeSessionsOptions(process.argv.slice(2));
const auth = createFirebaseAuth();
const actors = [];

for (const definition of previewActorDefinitions) {
  const uid = options.actorUids[definition.key];
  const user = await firebaseUserOrNull(auth, uid);
  if (user === null) {
    if (options.execute) {
      throw new Error(`${definition.key} preview Firebase user was not found.`);
    }
    actors.push({ role: definition.key, account: "missing", action: "none" });
    continue;
  }
  if (options.execute) {
    await auth.revokeRefreshTokens(uid);
  }
  actors.push({
    role: definition.key,
    account: user.disabled ? "disabled" : "enabled",
    action: options.execute
      ? "refresh tokens revoked"
      : "would revoke refresh tokens",
  });
}

console.log(JSON.stringify({ mode: options.mode, actors }, null, 2));

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
    initializeApp({ credential: cert(serviceAccount), projectId });
  return getAuth(app);
}

async function firebaseUserOrNull(auth, uid) {
  try {
    return await auth.getUser(uid);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    if (code === "auth/user-not-found") return null;
    throw error;
  }
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
