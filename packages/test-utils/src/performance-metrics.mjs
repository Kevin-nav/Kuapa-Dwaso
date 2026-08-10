import { readFileSync } from "node:fs";

const auditMetrics = {
  fcpMs: "first-contentful-paint",
  lcpMs: "largest-contentful-paint",
  speedIndexMs: "speed-index",
  tbtMs: "total-blocking-time",
  cls: "cumulative-layout-shift",
  transferBytes: "total-byte-weight",
};

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function readLighthouseRun(filePath) {
  const report = JSON.parse(readFileSync(filePath, "utf8"));
  const networkRequests = report.audits[
    "network-requests"
  ].details.items.filter(
    (request) =>
      request.url.startsWith("http://") || request.url.startsWith("https://"),
  );
  const imageRequests = networkRequests.filter(
    (request) => request.resourceType === "Image",
  );
  const longTasks = report.audits["long-tasks"].details.items;
  const metrics = {
    performanceScore: report.categories.performance.score * 100,
    requestCount: networkRequests.length,
    failedRequestCount: networkRequests.filter(
      (request) => request.statusCode >= 400 || request.statusCode === 0,
    ).length,
    imageRequestCount: imageRequests.length,
    imageTransferBytes: imageRequests.reduce(
      (total, request) => total + (request.transferSize ?? 0),
      0,
    ),
    lastImageLoadedMs: imageRequests.reduce(
      (latest, request) => Math.max(latest, request.networkEndTime ?? 0),
      0,
    ),
    longTaskCount: longTasks.length,
    longestTaskMs: longTasks.reduce(
      (longest, task) => Math.max(longest, task.duration ?? 0),
      0,
    ),
  };

  for (const [metric, auditId] of Object.entries(auditMetrics)) {
    metrics[metric] = report.audits[auditId].numericValue;
  }

  return metrics;
}

export function readLighthouseEnvironment(filePath) {
  const report = JSON.parse(readFileSync(filePath, "utf8"));
  return {
    lighthouseVersion: report.lighthouseVersion,
    userAgent: report.userAgent,
    formFactor: report.configSettings.formFactor,
    screenEmulation: report.configSettings.screenEmulation,
    throttlingMethod: report.configSettings.throttlingMethod,
    throttling: report.configSettings.throttling,
  };
}

export function summarizeLighthouseRuns(filePaths) {
  if (filePaths.length < 1) {
    throw new Error("At least one Lighthouse report is required.");
  }

  const runs = filePaths.map(readLighthouseRun);
  const summary = { runCount: runs.length };
  for (const metric of Object.keys(runs[0])) {
    summary[metric] = median(runs.map((run) => run[metric]));
  }
  return summary;
}
