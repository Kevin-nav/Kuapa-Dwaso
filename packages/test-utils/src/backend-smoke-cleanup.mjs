import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";

const rootDir = resolve(import.meta.dirname, "../../..");
loadEnvFile(resolve(rootDir, ".env.local"));

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
if (convexUrl === undefined || convexUrl.trim().length === 0) {
  throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is required to run backend smoke cleanup.");
}

const options = parseArgs(process.argv.slice(2));
const runId = options.runId ?? process.env.SMOKE_RUN_ID ?? process.env.SMOKE_CLEANUP_RUN_ID;
if (!options.all && (runId === undefined || runId.trim().length === 0)) {
  throw new Error("Smoke cleanup requires --run-id=<id> or SMOKE_RUN_ID.");
}
if (!options.confirm) {
  throw new Error("Smoke cleanup requires --confirm. It only deletes records derived from the exact run id.");
}

const client = new ConvexHttpClient(convexUrl);
const result = options.all
  ? await client.mutation(api.smokeCleanup.cleanupAllBackendSmokeRecords, {
      confirm: "DELETE_SMOKE_BACKEND_RECORDS",
      dryRun: options.dryRun,
    })
  : await client.mutation(api.smokeCleanup.cleanupBackendRun, {
      runId,
      confirm: "DELETE_SMOKE_BACKEND_RECORDS",
      dryRun: options.dryRun,
    });

console.log(JSON.stringify(result, null, 2));

function parseArgs(args) {
  const options = {
    confirm: false,
    dryRun: false,
    all: false,
    runId: undefined,
  };
  for (const arg of args) {
    if (arg === "--confirm") {
      options.confirm = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--all") {
      options.all = true;
    } else if (arg.startsWith("--run-id=")) {
      options.runId = arg.slice("--run-id=".length);
    }
  }
  return options;
}

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [rawKey, ...rawValueParts] = trimmed.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").split("#")[0]?.trim();
    if (key.length > 0 && process.env[key] === undefined && value !== undefined) {
      process.env[key] = value;
    }
  }
}
