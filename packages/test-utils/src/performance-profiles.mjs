const profiles = {
  standard: {
    name: "standard",
    label: "Standard Lighthouse",
    description: "Unchanged Lighthouse 13 simulated-mobile baseline.",
    method: "simulate",
    rttMs: 150,
    downloadKbps: 1474.56,
    uploadKbps: 675,
    cpuSlowdownMultiplier: 4,
    lighthouseArguments: [],
  },
  ghana: {
    name: "ghana",
    label: "Ghana-like laptop profile",
    description:
      "Bandwidth, latency, and CPU approximation without jitter or packet loss.",
    method: "devtools",
    rttMs: 120,
    downloadKbps: 8192,
    uploadKbps: 3072,
    cpuSlowdownMultiplier: 4,
    lighthouseArguments: [
      "--throttling-method=devtools",
      "--throttling.rttMs=120",
      "--throttling.throughputKbps=8192",
      "--throttling.requestLatencyMs=120",
      "--throttling.downloadThroughputKbps=8192",
      "--throttling.uploadThroughputKbps=3072",
      "--throttling.cpuSlowdownMultiplier=4",
    ],
  },
  poor: {
    name: "poor",
    label: "Poor mobile",
    description:
      "Low-bandwidth mobile approximation without jitter or packet loss.",
    method: "devtools",
    rttMs: 180,
    downloadKbps: 1024,
    uploadKbps: 409.6,
    cpuSlowdownMultiplier: 4,
    lighthouseArguments: [
      "--throttling-method=devtools",
      "--throttling.rttMs=180",
      "--throttling.throughputKbps=1024",
      "--throttling.requestLatencyMs=180",
      "--throttling.downloadThroughputKbps=1024",
      "--throttling.uploadThroughputKbps=409.6",
      "--throttling.cpuSlowdownMultiplier=4",
    ],
  },
  stress: {
    name: "stress",
    label: "Low-end stress",
    description: "Poor-mobile bandwidth with stronger low-end CPU emulation.",
    method: "devtools",
    rttMs: 180,
    downloadKbps: 1024,
    uploadKbps: 409.6,
    cpuSlowdownMultiplier: 6,
    lighthouseArguments: [
      "--throttling-method=devtools",
      "--throttling.rttMs=180",
      "--throttling.throughputKbps=1024",
      "--throttling.requestLatencyMs=180",
      "--throttling.downloadThroughputKbps=1024",
      "--throttling.uploadThroughputKbps=409.6",
      "--throttling.cpuSlowdownMultiplier=6",
    ],
  },
};

export const performanceProfileNames = Object.freeze(Object.keys(profiles));

export function getPerformanceProfile(name) {
  const profile = profiles[name];
  if (profile === undefined) {
    throw new Error(
      `Unknown performance profile "${name}". Choose one of: ${performanceProfileNames.join(", ")}.`,
    );
  }
  return profile;
}
