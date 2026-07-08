import { resolve } from "node:path";
import { appEnvStatus, repoRoot } from "./next-local-env.mjs";

const apps = ["www", "app", "ops", "admin"];
let missingCount = 0;

console.log("Next public env check");
console.log("Sources: root .env.local, root .env, then optional app env overrides");

for (const appName of apps) {
  const appDir = resolve(repoRoot, "apps", appName);
  const statuses = appEnvStatus(appName, appDir);
  console.log("");
  console.log(`@kuapa-dwaso/${appName}`);
  for (const status of statuses) {
    if (!status.present) {
      missingCount += 1;
    }
    console.log(`- ${status.key}: ${status.present ? "set" : "missing"}`);
  }
}

if (missingCount > 0) {
  console.error("");
  console.error(`${missingCount} required public env value(s) are missing.`);
  process.exitCode = 1;
}
