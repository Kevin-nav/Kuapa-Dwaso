import assert from "node:assert/strict";
import test from "node:test";
import {
  getPerformanceProfile,
  performanceProfileNames,
} from "../src/performance-profiles.mjs";

test("keeps the standard Lighthouse profile unchanged", () => {
  const profile = getPerformanceProfile("standard");
  assert.equal(profile.method, "simulate");
  assert.equal(profile.rttMs, 150);
  assert.equal(profile.cpuSlowdownMultiplier, 4);
  assert.deepEqual(profile.lighthouseArguments, []);
});

test("defines the Ghana, poor-mobile, and low-end stress profiles", () => {
  assert.deepEqual(performanceProfileNames, [
    "standard",
    "ghana",
    "poor",
    "stress",
  ]);
  assert.equal(getPerformanceProfile("ghana").downloadKbps, 8192);
  assert.equal(getPerformanceProfile("poor").rttMs, 180);
  assert.equal(getPerformanceProfile("stress").cpuSlowdownMultiplier, 6);
});

test("rejects unknown profiles", () => {
  assert.throws(
    () => getPerformanceProfile("satellite"),
    /Unknown performance profile/,
  );
});
