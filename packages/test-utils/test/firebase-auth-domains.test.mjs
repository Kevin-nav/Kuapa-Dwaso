import assert from "node:assert/strict";
import test from "node:test";
import {
  findMissingFirebaseAuthDomains,
  parseFirebaseAuthOrigins,
} from "../src/firebase-auth-domains.mjs";

test("parses unique HTTPS auth origins into normalized hostnames", () => {
  assert.deepEqual(
    parseFirebaseAuthOrigins(
      "https://App-Staging.kuapadwaso.com, https://ops-staging.kuapadwaso.com,https://app-staging.kuapadwaso.com",
    ),
    ["app-staging.kuapadwaso.com", "ops-staging.kuapadwaso.com"],
  );
});

test("rejects non-HTTPS origins and origins containing paths", () => {
  assert.throws(() => parseFirebaseAuthOrigins("http://app.example.com"), /HTTPS/);
  assert.throws(() => parseFirebaseAuthOrigins("https://app.example.com/signup"), /origin without a path/);
  assert.throws(() => parseFirebaseAuthOrigins(" , "), /at least one/);
});

test("compares required and authorized domains case-insensitively", () => {
  assert.deepEqual(
    findMissingFirebaseAuthDomains(
      ["app.example.com", "ops.example.com", "admin.example.com"],
      ["APP.EXAMPLE.COM", "admin.example.com", "ops.example.com"],
    ),
    [],
  );
});

test("returns every required domain absent from Firebase", () => {
  assert.deepEqual(
    findMissingFirebaseAuthDomains(
      ["app.example.com", "ops.example.com", "admin.example.com"],
      ["app.example.com"],
    ),
    ["ops.example.com", "admin.example.com"],
  );
});
