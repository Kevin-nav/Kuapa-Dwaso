import assert from "node:assert/strict";
import test from "node:test";
import { isBlogCategory, isBlogStatus, normalizeBlogSlug } from "./index.ts";

test("normalizes stable shareable story slugs", () => {
  assert.equal(
    normalizeBlogSlug("  Official Farm Visit: Akwapim!  "),
    "official-farm-visit-akwapim",
  );
  assert.equal(normalizeBlogSlug("Partnership à Ghana"), "partnership-a-ghana");
  assert.equal(
    normalizeBlogSlug(`${"a".repeat(89)} crossing-boundary`),
    "a".repeat(89),
  );
});

test("recognizes the supported editorial categories and states", () => {
  assert.equal(isBlogCategory("partnerships"), true);
  assert.equal(isBlogCategory("comments"), false);
  assert.equal(isBlogStatus("published"), true);
  assert.equal(isBlogStatus("scheduled"), false);
});
