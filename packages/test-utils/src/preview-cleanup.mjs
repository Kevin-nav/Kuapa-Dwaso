import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { parsePreviewCleanupOptions } from "./preview-cleanup-options.mjs";

const rootDir = resolve(import.meta.dirname, "../../..");
const convexCli = resolve(rootDir, "node_modules/convex/bin/main.js");
if (process.argv.includes("--help")) {
  console.log(`Usage: corepack pnpm preview:cleanup -- [options]

Required:
  --deployment=<target>
  --programme-id=<convex-id>
  --farmer-user-id=<convex-id>
  --buyer-user-id=<convex-id>
  --transporter-user-id=<convex-id>
  --operations-user-id=<convex-id>
  --background-farmer-user-ids=<convex-id>,<convex-id>
  --start=<ISO timestamp with UTC offset>
  --end=<ISO timestamp with UTC offset>

Preview is the default. Execution additionally requires:
  --execute --confirm=DELETE_PREVIEW_WINDOW_DATA`);
  process.exit(0);
}
const options = parsePreviewCleanupOptions(process.argv.slice(2));

const result = spawnSync(
  process.execPath,
  [
    convexCli,
    "run",
    "demoPreviewCleanup:run",
    JSON.stringify(options.mutationArgs),
    "--deployment",
    options.deployment,
    "--typecheck",
    "enable",
    "--codegen",
    "disable",
  ],
  { cwd: rootDir, stdio: "inherit" },
);

if (result.error !== undefined) {
  throw result.error;
}
if (result.signal !== null) {
  throw new Error(`Preview cleanup stopped after signal ${result.signal}.`);
}
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
