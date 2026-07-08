import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { loadNextLocalEnv, inferMode } from "./next-local-env.mjs";

const args = process.argv.slice(2);
const nextArgs = args.length > 0 ? args : ["dev"];
const appDir = process.cwd();

loadNextLocalEnv({ appDir, mode: inferMode(nextArgs) });
process.env.KUAPA_DWASO_NEXT_ENV_LOADED = "true";

const nextBin = resolve(appDir, "node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  cwd: appDir,
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
