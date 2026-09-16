import assert from "node:assert/strict";
import test from "node:test";
import {
  PREVIEW_REVOKE_CONFIRMATION,
  parsePreviewRevokeSessionsOptions,
} from "../src/preview-revoke-sessions-options.mjs";

const env = {
  PREVIEW_ACCESS_ENABLED: "false",
  PREVIEW_ACCESS_FARMER_FIREBASE_UID: "farmer-uid",
  PREVIEW_ACCESS_BUYER_FIREBASE_UID: "buyer-uid",
  PREVIEW_ACCESS_TRANSPORTER_FIREBASE_UID: "transporter-uid",
  PREVIEW_ACCESS_WAREHOUSE_AGENT_FIREBASE_UID: "operations-uid",
};

test("session revocation defaults to a dry run", () => {
  const options = parsePreviewRevokeSessionsOptions(["--"], env);
  assert.equal(options.mode, "dry-run");
  assert.equal(options.actorUids.operations, "operations-uid");
});

test("session revocation needs exact confirmation to execute", () => {
  assert.throws(
    () => parsePreviewRevokeSessionsOptions(["--execute"], env),
    /requires --confirm/,
  );
  const options = parsePreviewRevokeSessionsOptions(
    ["--execute", `--confirm=${PREVIEW_REVOKE_CONFIRMATION}`],
    env,
  );
  assert.equal(options.mode, "execute");
});

test("execution fails while preview access is not explicitly disabled", () => {
  assert.throws(
    () =>
      parsePreviewRevokeSessionsOptions(
        ["--execute", `--confirm=${PREVIEW_REVOKE_CONFIRMATION}`],
        { ...env, PREVIEW_ACCESS_ENABLED: "true" },
      ),
    /PREVIEW_ACCESS_ENABLED=false/,
  );
  assert.throws(
    () =>
      parsePreviewRevokeSessionsOptions(
        ["--execute", `--confirm=${PREVIEW_REVOKE_CONFIRMATION}`],
        { ...env, PREVIEW_ACCESS_ENABLED: undefined },
      ),
    /PREVIEW_ACCESS_ENABLED=false/,
  );
});

test("session revocation rejects duplicate actor UIDs", () => {
  assert.throws(
    () =>
      parsePreviewRevokeSessionsOptions([], {
        ...env,
        PREVIEW_ACCESS_BUYER_FIREBASE_UID:
          env.PREVIEW_ACCESS_FARMER_FIREBASE_UID,
      }),
    /four distinct preview Firebase UIDs/,
  );
});

test("session revocation rejects confirmation during a dry run", () => {
  assert.throws(
    () =>
      parsePreviewRevokeSessionsOptions(
        [`--confirm=${PREVIEW_REVOKE_CONFIRMATION}`],
        env,
      ),
    /Do not pass --confirm/,
  );
});
