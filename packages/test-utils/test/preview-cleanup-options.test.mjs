import assert from "node:assert/strict";
import test from "node:test";
import {
  PREVIEW_CLEANUP_CONFIRMATION,
  parsePreviewCleanupOptions,
} from "../src/preview-cleanup-options.mjs";

const base = [
  "--deployment=prod",
  "--programme-id=program123456",
  "--farmer-user-id=farmer123456",
  "--buyer-user-id=buyer1234567",
  "--transporter-user-id=transport12345",
  "--operations-user-id=operations123",
  "--start=2026-09-14T00:00:00Z",
  "--end=2026-09-18T00:00:00Z",
];

test("preview is the default and does not send a confirmation token", () => {
  const options = parsePreviewCleanupOptions(["--", ...base], {});
  assert.equal(options.deployment, "prod");
  assert.deepEqual(options.mutationArgs, {
    programmeId: "program123456",
    farmerUserId: "farmer123456",
    buyerUserId: "buyer1234567",
    transporterUserId: "transport12345",
    operationsUserId: "operations123",
    startAt: Date.parse("2026-09-14T00:00:00Z"),
    endAt: Date.parse("2026-09-18T00:00:00Z"),
    execute: false,
  });
});

test("execution needs both switches and the exact confirmation token", () => {
  assert.throws(
    () => parsePreviewCleanupOptions([...base, "--execute"], {}),
    /requires --confirm/,
  );
  const options = parsePreviewCleanupOptions(
    [...base, "--execute", `--confirm=${PREVIEW_CLEANUP_CONFIRMATION}`],
    {},
  );
  assert.equal(options.mutationArgs.execute, true);
  assert.equal(options.mutationArgs.confirm, PREVIEW_CLEANUP_CONFIRMATION);
});

test("preview rejects a confirmation token", () => {
  assert.throws(
    () =>
      parsePreviewCleanupOptions(
        [...base, `--confirm=${PREVIEW_CLEANUP_CONFIRMATION}`],
        {},
      ),
    /Do not pass --confirm/,
  );
});

test("timestamps require explicit offsets and a bounded ordered window", () => {
  assert.throws(
    () =>
      parsePreviewCleanupOptions(
        base.map((value) =>
          value.startsWith("--start=") ? "--start=2026-09-14T00:00:00" : value,
        ),
        {},
      ),
    /explicit UTC offset/,
  );
  assert.throws(
    () =>
      parsePreviewCleanupOptions(
        base.map((value) =>
          value.startsWith("--end=") ? "--end=2026-10-18T00:00:00Z" : value,
        ),
        {},
      ),
    /fourteen days/,
  );
});

test("four distinct actor IDs are required", () => {
  assert.throws(
    () =>
      parsePreviewCleanupOptions(
        base.map((value) =>
          value.startsWith("--buyer-user-id=")
            ? "--buyer-user-id=farmer123456"
            : value,
        ),
        {},
      ),
    /four distinct actor user IDs/,
  );
});

test("environment variables provide the same exact contract", () => {
  const options = parsePreviewCleanupOptions([], {
    PREVIEW_CLEANUP_DEPLOYMENT: "prod",
    PREVIEW_CLEANUP_PROGRAMME_ID: "program123456",
    PREVIEW_FARMER_USER_ID: "farmer123456",
    PREVIEW_BUYER_USER_ID: "buyer1234567",
    PREVIEW_TRANSPORTER_USER_ID: "transport12345",
    PREVIEW_OPERATIONS_USER_ID: "operations123",
    PREVIEW_CLEANUP_START_AT: "2026-09-14T00:00:00+00:00",
    PREVIEW_CLEANUP_END_AT: "2026-09-18T00:00:00+00:00",
  });
  assert.equal(options.mutationArgs.execute, false);
});

test("unknown arguments and malformed IDs fail closed", () => {
  assert.throws(
    () => parsePreviewCleanupOptions([...base, "--dry-run"], {}),
    /Unknown cleanup argument/,
  );
  assert.throws(
    () =>
      parsePreviewCleanupOptions(
        base.map((value) =>
          value.startsWith("--programme-id=")
            ? "--programme-id=not an id"
            : value,
        ),
        {},
      ),
    /not a valid exact Convex ID/,
  );
});
