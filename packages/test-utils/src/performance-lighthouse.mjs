import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  readLighthouseEnvironment,
  summarizeLighthouseRuns,
} from "./performance-metrics.mjs";
import { getPerformanceProfile } from "./performance-profiles.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const url = option("url", "http://127.0.0.1:3000");
const label = option("label", "local");
const runs = Number(option("runs", "3"));
const profile = getPerformanceProfile(option("profile", "standard"));
const defaultOutputDir = fileURLToPath(
  new URL("../../../docs/performance/results/", import.meta.url),
);
const outputDir = resolve(option("output-dir", defaultOutputDir));
const chromePath = option(
  "chrome-path",
  process.env.CHROME_PATH ??
    (process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : "google-chrome"),
);

if (!Number.isInteger(runs) || runs < 1) {
  throw new Error("--runs must be a positive integer.");
}

mkdirSync(outputDir, { recursive: true });
const reports = [];

function runLighthouse(reportPath) {
  const chromeFlags = ["--headless=new", "--no-sandbox", "--disable-gpu"];

  const corepackScript = resolve(
    dirname(process.execPath),
    "node_modules/corepack/dist/corepack.js",
  );
  const command =
    process.platform === "win32" && existsSync(corepackScript)
      ? process.execPath
      : "corepack";
  const commandPrefix = command === process.execPath ? [corepackScript] : [];
  const result = spawnSync(
    command,
    [
      ...commandPrefix,
      "pnpm",
      "dlx",
      "lighthouse@13.0.1",
      url,
      `--chrome-path=${chromePath}`,
      "--output=json",
      `--output-path=${reportPath}`,
      "--quiet",
      `--chrome-flags=${chromeFlags.join(" ")}`,
      "--only-categories=performance",
      "--max-wait-for-load=45000",
      ...profile.lighthouseArguments,
    ],
    { stdio: "inherit", timeout: 90_000 },
  );

  // Chrome on Windows can report an EPERM while removing its temporary profile
  // after Lighthouse has already written a complete report.
  if (result.status !== 0 && !existsSync(reportPath)) {
    throw new Error("Lighthouse failed before producing a report.");
  }
}

for (let run = 1; run <= runs; run += 1) {
  const reportPath = resolve(outputDir, `${label}-${run}.json`);
  reports.push(reportPath);
  runLighthouse(reportPath);
}

const summary = {
  label,
  url,
  generatedAt: new Date().toISOString(),
  profile: profile.name,
  profileLabel: profile.label,
  profileDescription: profile.description,
  requestedConditions: {
    method: profile.method,
    rttMs: profile.rttMs,
    downloadKbps: profile.downloadKbps,
    uploadKbps: profile.uploadKbps,
    cpuSlowdownMultiplier: profile.cpuSlowdownMultiplier,
    jitterMs: null,
    packetLossPercent: null,
  },
  cacheMode: "cold",
  environment: readLighthouseEnvironment(reports[0]),
  ...summarizeLighthouseRuns(reports),
};
const summaryPath = resolve(outputDir, `${label}-summary.json`);
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
console.log(`Summary written to ${summaryPath}`);
