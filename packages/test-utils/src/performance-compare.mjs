import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function requiredOption(name) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value) throw new Error(`--${name} is required.`);
  return value;
}

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const fromRepoRoot = (filePath) =>
  isAbsolute(filePath) ? filePath : resolve(repoRoot, filePath);
const beforePath = fromRepoRoot(requiredOption("before"));
const afterPath = fromRepoRoot(requiredOption("after"));
const outputPath = fromRepoRoot(requiredOption("output"));
const before = JSON.parse(readFileSync(beforePath, "utf8"));
const after = JSON.parse(readFileSync(afterPath, "utf8"));

function percentReduction(beforeValue, afterValue) {
  return ((beforeValue - afterValue) / beforeValue) * 100;
}

function row(label, key, unit, lowerIsBetter = true) {
  const beforeValue = before[key];
  const afterValue = after[key];
  const delta = lowerIsBetter
    ? percentReduction(beforeValue, afterValue)
    : ((afterValue - beforeValue) / beforeValue) * 100;
  const format = (value) =>
    unit === "MB"
      ? (value / 1_000_000).toFixed(2)
      : unit === "ms"
        ? Math.round(value).toLocaleString("en-US")
        : value.toFixed(0);
  return `| ${label} | ${format(beforeValue)} ${unit} | ${format(afterValue)} ${unit} | ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% |`;
}

function optionalRow(label, key, unit, lowerIsBetter = true) {
  return Number.isFinite(before[key]) && Number.isFinite(after[key])
    ? `\n${row(label, key, unit, lowerIsBetter)}`
    : "";
}

const markdown = `# Kuapa Dwaso performance benchmark

Generated ${new Date().toISOString()} from the median of ${before.runCount} before runs and ${after.runCount} after runs using ${after.profile}.

| Metric | Before | After | Improvement |
| --- | ---: | ---: | ---: |
${row("Performance score", "performanceScore", "points", false)}
${row("Largest Contentful Paint", "lcpMs", "ms")}
${row("First Contentful Paint", "fcpMs", "ms")}
${row("Speed Index", "speedIndexMs", "ms")}
${row("Total Blocking Time", "tbtMs", "ms")}
${row("Transferred data", "transferBytes", "MB")}
${row("Network requests", "requestCount", "requests")}${optionalRow("Failed requests", "failedRequestCount", "requests")}${optionalRow("Image transfer", "imageTransferBytes", "MB")}${optionalRow("Last image loaded", "lastImageLoadedMs", "ms")}${optionalRow("Longest task", "longestTaskMs", "ms")}

## Investor-readable takeaway

Under the same simulated constrained-mobile conditions, the measured page showed its first content ${percentReduction(before.fcpMs, after.fcpMs).toFixed(1)}% sooner, visually completed ${percentReduction(before.speedIndexMs, after.speedIndexMs).toFixed(1)}% faster, reached its largest visible content ${percentReduction(before.lcpMs, after.lcpMs).toFixed(1)}% sooner, and transferred ${percentReduction(before.transferBytes, after.transferBytes).toFixed(1)}% less data. The Lighthouse performance score moved from ${before.performanceScore.toFixed(0)} to ${after.performanceScore.toFixed(0)}.

These are repeatable lab measurements, not guarantees for every device or carrier. Total Blocking Time changed from ${before.tbtMs.toFixed(0)} ms to ${after.tbtMs.toFixed(0)} ms${after.tbtMs <= before.tbtMs ? ", an improvement of " + percentReduction(before.tbtMs, after.tbtMs).toFixed(1) + "%" : " and remains a follow-up metric"}. Production field data should be reported separately once enough real visits are available.
`;

writeFileSync(outputPath, markdown);
console.log(markdown);
