import assert from "node:assert/strict";
import test from "node:test";
import {
  PREVIEW_SETUP_CONFIRMATION,
  buildPreviewStarterRecords,
  parsePreviewSetupOptions,
  previewActorDefinitions,
} from "../src/preview-setup-options.mjs";

const hourMs = 60 * 60 * 1_000;
const now = Date.now();
const start = new Date(now - hourMs).toISOString();
const end = new Date(now + 7 * 24 * hourMs).toISOString();
const cutoff = new Date(now + 6 * 24 * hourMs).toISOString();
const phones = Array.from(
  { length: 4 },
  (_, index) => `+${"9".repeat(10)}${index + 1}`,
);
const inspectionEvidenceIds = [
  "evidenceasset0001",
  "evidenceasset0002",
  "evidenceasset0003",
];
const base = [
  "--deployment=example",
  "--convex-url=https://example.convex.cloud",
  "--programme-id=program123456",
  "--admin-uid=admin-uid",
  "--farmer-uid=farmer-uid",
  "--buyer-uid=buyer-uid",
  "--transporter-uid=transporter-uid",
  "--operations-uid=operations-uid",
  `--farmer-phone=${phones[0]}`,
  `--buyer-phone=${phones[1]}`,
  `--transporter-phone=${phones[2]}`,
  `--operations-phone=${phones[3]}`,
  `--inspection-evidence-ids=${inspectionEvidenceIds.join(",")}`,
  `--start=${start}`,
  `--end=${end}`,
  `--cutoff=${cutoff}`,
];

test("setup defaults to a dry run with four distinct actors", () => {
  const options = parsePreviewSetupOptions(["--", ...base], {}, now);
  assert.equal(options.mode, "dry-run");
  assert.equal(options.execute, false);
  assert.equal(options.actors.buyer.phoneNumber, phones[1]);
  assert.deepEqual(
    options.inspectionEvidenceUploadAssetIds,
    inspectionEvidenceIds,
  );
  assert.deepEqual(
    previewActorDefinitions.map(({ role, name }) => ({ role, name })),
    [
      { role: "farmer", name: "Ama Mensah" },
      { role: "buyer", name: "Adwoa Owusu" },
      { role: "transporter", name: "Kwame Asare" },
      { role: "warehouse_agent", name: "Akosua Boateng" },
    ],
  );
});

test("execution requires the exact confirmation token", () => {
  assert.throws(
    () => parsePreviewSetupOptions([...base, "--execute"], {}, now),
    /requires --confirm/,
  );
  const options = parsePreviewSetupOptions(
    [...base, "--execute", `--confirm=${PREVIEW_SETUP_CONFIRMATION}`],
    {},
    now,
  );
  assert.equal(options.mode, "execute");
});

test("dry run rejects a confirmation token", () => {
  assert.throws(
    () =>
      parsePreviewSetupOptions(
        [...base, `--confirm=${PREVIEW_SETUP_CONFIRMATION}`],
        {},
        now,
      ),
    /Do not pass --confirm/,
  );
});

test("setup rejects duplicate UIDs and phone numbers", () => {
  assert.throws(
    () =>
      parsePreviewSetupOptions(
        base.map((item) =>
          item.startsWith("--buyer-uid=") ? "--buyer-uid=farmer-uid" : item,
        ),
        {},
        now,
      ),
    /distinct admin UID and four distinct actor UIDs/,
  );
  assert.throws(
    () =>
      parsePreviewSetupOptions(
        base.map((item) =>
          item.startsWith("--buyer-phone=")
            ? `--buyer-phone=${phones[0]}`
            : item,
        ),
        {},
        now,
      ),
    /four distinct actor phone numbers/,
  );
});

test("setup requires three distinct inspection evidence assets", () => {
  const withoutEvidence = base.filter(
    (item) => !item.startsWith("--inspection-evidence-ids="),
  );
  assert.throws(
    () => parsePreviewSetupOptions(withoutEvidence, {}, now),
    /Full setup requires exactly three distinct/,
  );
  const bootstrap = parsePreviewSetupOptions(
    ["--profiles-only", ...withoutEvidence],
    {},
    now,
  );
  assert.equal(bootstrap.profilesOnly, true);
  assert.deepEqual(bootstrap.inspectionEvidenceUploadAssetIds, []);
  assert.throws(
    () =>
      parsePreviewSetupOptions(
        base.map((item) =>
          item.startsWith("--inspection-evidence-ids=")
            ? "--inspection-evidence-ids=evidenceasset0001,evidenceasset0002"
            : item,
        ),
        {},
        now,
      ),
    /exactly three distinct/,
  );
  assert.throws(
    () =>
      parsePreviewSetupOptions(
        base.map((item) =>
          item.startsWith("--inspection-evidence-ids=")
            ? "--inspection-evidence-ids=evidenceasset0001,evidenceasset0001,evidenceasset0003"
            : item,
        ),
        {},
        now,
      ),
    /exactly three distinct/,
  );
});

test("setup requires E.164 phones and an explicit bounded active window", () => {
  assert.throws(
    () =>
      parsePreviewSetupOptions(
        base.map((item) =>
          item.startsWith("--farmer-phone=") ? "--farmer-phone=invalid" : item,
        ),
        {},
        now,
      ),
    /E.164/,
  );
  assert.throws(
    () =>
      parsePreviewSetupOptions(
        base.map((item) =>
          item.startsWith("--start=")
            ? `--start=${new Date(now + hourMs).toISOString()}`
            : item,
        ),
        {},
        now,
      ),
    /inside the exact cleanup window/,
  );
  assert.throws(
    () =>
      parsePreviewSetupOptions(
        base.map((item) =>
          item.startsWith("--cutoff=")
            ? `--cutoff=${new Date(now + 8 * 24 * hourMs).toISOString()}`
            : item,
        ),
        {},
        now,
      ),
    /no later than cleanup end/,
  );
  assert.throws(
    () =>
      parsePreviewSetupOptions(
        base.map((item) =>
          item.startsWith("--cutoff=")
            ? `--cutoff=${new Date(now + 2 * 24 * hourMs).toISOString()}`
            : item,
        ),
        {},
        now,
      ),
    /include every starter request and supply window/,
  );
  assert.throws(
    () =>
      parsePreviewSetupOptions(
        base.map((item) =>
          item.startsWith("--start=")
            ? `--start=${new Date(now - 4 * 24 * hourMs).toISOString()}`
            : item,
        ),
        {},
        now,
      ),
    /before the first prepared collection window starts/,
  );
});

test("environment variables use the access and cleanup contracts", () => {
  const options = parsePreviewSetupOptions(
    [],
    {
      PREVIEW_CLEANUP_DEPLOYMENT: "example",
      PREVIEW_SETUP_CONVEX_URL: "https://example.convex.cloud",
      PREVIEW_CLEANUP_PROGRAMME_ID: "program123456",
      PREVIEW_SETUP_ADMIN_FIREBASE_UID: "admin-uid",
      PREVIEW_ACCESS_FARMER_FIREBASE_UID: "farmer-uid",
      PREVIEW_ACCESS_BUYER_FIREBASE_UID: "buyer-uid",
      PREVIEW_ACCESS_TRANSPORTER_FIREBASE_UID: "transporter-uid",
      PREVIEW_ACCESS_WAREHOUSE_AGENT_FIREBASE_UID: "operations-uid",
      PREVIEW_FARMER_PHONE_NUMBER: phones[0],
      PREVIEW_BUYER_PHONE_NUMBER: phones[1],
      PREVIEW_TRANSPORTER_PHONE_NUMBER: phones[2],
      PREVIEW_OPERATIONS_PHONE_NUMBER: phones[3],
      PREVIEW_INSPECTION_EVIDENCE_UPLOAD_ASSET_IDS:
        inspectionEvidenceIds.join(","),
      PREVIEW_CLEANUP_START_AT: start,
      PREVIEW_CLEANUP_END_AT: end,
      PREVIEW_ACCESS_CUTOFF_UTC: cutoff,
    },
    now,
  );
  assert.equal(options.programmeId, "program123456");
  assert.equal(options.cutoffAt, Date.parse(cutoff));
  assert.deepEqual(
    options.inspectionEvidenceUploadAssetIds,
    inspectionEvidenceIds,
  );
});

test("setup rejects a Convex URL from a different cleanup deployment", () => {
  assert.throws(
    () =>
      parsePreviewSetupOptions(
        base.map((item) =>
          item === "--deployment=example"
            ? "--deployment=another-deployment"
            : item,
        ),
        {},
        now,
      ),
    /same Convex deployment/,
  );
});

test("starter records use exact 50 kg bags at presentation-scale quantities", () => {
  const records = buildPreviewStarterRecords(now);
  assert.deepEqual(
    records.map((record) => record.bags),
    [40, 60, 100],
  );
  assert.deepEqual(
    records.map((record) => record.kilograms),
    [2_000, 3_000, 5_000],
  );
  assert.ok(
    records.every((record) => record.grams === record.bags * 50 * 1_000),
  );
  assert.equal(
    new Set(records.map((record) => record.requestCreateKey)).size,
    3,
  );
  assert.equal(new Set(records.map((record) => record.planReadyKey)).size, 3);
  assert.ok(
    records.every(
      (record) => record.requestDeliveryStartAt >= now + 72 * hourMs,
    ),
  );
});
