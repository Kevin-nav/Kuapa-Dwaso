import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const rootDir = resolve(import.meta.dirname, "../../..");
const stagingEnvPath = resolve(rootDir, ".env.staging");
if (existsSync(stagingEnvPath)) {
  loadEnvFile(stagingEnvPath);
}

const projectId = requireValue("FIREBASE_PROJECT_ID");
const serviceAccountBase64 = requireValue(
  "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64",
);
const adjacentIntervals = readAdjacentIntervals();
const confirmed = process.argv.includes("--confirm");
const serviceAccount = JSON.parse(
  Buffer.from(serviceAccountBase64, "base64").toString("utf8"),
);
const firebaseApp =
  getApps()[0] ??
  initializeApp({
    credential: cert(serviceAccount),
    projectId,
  });
const projectConfigManager = getAuth(firebaseApp).projectConfigManager();
const currentConfig = await projectConfigManager.getProjectConfig();
const currentMfa = currentConfig.multiFactorConfig;
const currentTotp = currentMfa?.providerConfigs.find(
  (provider) => provider.totpProviderConfig !== undefined,
);

if (!confirmed) {
  console.log(
    JSON.stringify(
      {
        mode: "status-only",
        projectId,
        mfaState: currentMfa?.state ?? "DISABLED",
        enabledFactors: currentMfa?.factorIds ?? [],
        totpState: currentTotp?.state ?? "DISABLED",
        adjacentIntervals:
          currentTotp?.totpProviderConfig.adjacentIntervals ?? null,
        nextCommand:
          "corepack pnpm firebase:totp -- --confirm --adjacent-intervals=1",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (
  currentTotp?.state === "ENABLED" &&
  currentTotp.totpProviderConfig.adjacentIntervals === adjacentIntervals
) {
  console.log(
    JSON.stringify(
      {
        changed: false,
        projectId,
        totpState: "ENABLED",
        adjacentIntervals,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const updatedConfig = await projectConfigManager.updateProjectConfig({
  multiFactorConfig: {
    providerConfigs: [
      {
        state: "ENABLED",
        totpProviderConfig: { adjacentIntervals },
      },
    ],
  },
});
const updatedTotp = updatedConfig.multiFactorConfig?.providerConfigs.find(
  (provider) => provider.totpProviderConfig !== undefined,
);
if (updatedTotp?.state !== "ENABLED") {
  throw new Error("Firebase did not report TOTP as enabled after the update.");
}

console.log(
  JSON.stringify(
    {
      changed: true,
      projectId,
      mfaState: updatedConfig.multiFactorConfig?.state ?? "DISABLED",
      enabledFactors: updatedConfig.multiFactorConfig?.factorIds ?? [],
      totpState: updatedTotp.state,
      adjacentIntervals:
        updatedTotp.totpProviderConfig.adjacentIntervals ?? null,
    },
    null,
    2,
  ),
);

function readAdjacentIntervals() {
  const prefix = "--adjacent-intervals=";
  const rawValue = process.argv.find((value) => value.startsWith(prefix));
  const value =
    rawValue === undefined ? 1 : Number(rawValue.slice(prefix.length));
  if (!Number.isInteger(value) || value < 0 || value > 10) {
    throw new Error(
      "--adjacent-intervals must be an integer from 0 through 10.",
    );
  }
  return value;
}

function requireValue(name) {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}
