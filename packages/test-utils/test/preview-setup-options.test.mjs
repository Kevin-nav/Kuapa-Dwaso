import assert from "node:assert/strict";
import test from "node:test";
import {
  PREVIEW_SETUP_CONFIRMATION,
  buildPreviewStarterRecords,
  parsePreviewSetupOptions,
  previewActorDefinitions,
} from "../src/preview-setup-options.mjs";

const hour = 60 * 60 * 1_000;
const now = Date.now();
const start = new Date(now - hour).toISOString();
const end = new Date(now + 7 * 24 * hour).toISOString();
const cutoff = new Date(now + 6 * 24 * hour).toISOString();
const phones = Array.from(
  { length: 4 },
  (_, index) => `+${"9".repeat(10)}${index + 1}`,
);
const base = [
  "--deployment=example",
  "--convex-url=https://example.convex.cloud",
  "--admin-uid=admin-uid",
  "--farmer-uid=farmer-uid",
  "--buyer-uid=buyer-uid",
  "--transporter-uid=transporter-uid",
  "--operations-uid=operations-uid",
  `--farmer-phone=${phones[0]}`,
  `--buyer-phone=${phones[1]}`,
  `--transporter-phone=${phones[2]}`,
  `--operations-phone=${phones[3]}`,
  `--start=${start}`,
  `--end=${end}`,
  `--cutoff=${cutoff}`,
];

test("setup defaults to a dry run with four distinct actors", () => {
  const options = parsePreviewSetupOptions(["--", ...base], {}, now);
  assert.equal(options.mode, "dry-run");
  assert.equal(options.execute, false);
  assert.equal(options.actors.buyer.phoneNumber, phones[1]);
  assert.equal("programmeId" in options, false);
  assert.equal("inspectionEvidenceUploadAssetIds" in options, false);
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

test("setup rejects former programme and evidence inputs", () => {
  assert.throws(
    () =>
      parsePreviewSetupOptions(
        [...base, "--programme-id=old-programme"],
        {},
        now,
      ),
    /Unknown setup argument/,
  );
  assert.throws(
    () =>
      parsePreviewSetupOptions(
        [...base, "--inspection-evidence-ids=asset1"],
        {},
        now,
      ),
    /Unknown setup argument/,
  );
  assert.throws(
    () => parsePreviewSetupOptions([...base, "--profiles-only"], {}, now),
    /Unknown setup argument/,
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

test("setup requires E.164 phones and a bounded route window", () => {
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
            ? `--start=${new Date(now + hour).toISOString()}`
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
            ? `--cutoff=${new Date(now + 8 * 24 * hour).toISOString()}`
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
            ? `--cutoff=${new Date(now + 8 * hour).toISOString()}`
            : item,
        ),
        {},
        now,
      ),
    /at least ten hours/,
  );
});

test("environment variables no longer require prebuilt programme or evidence", () => {
  const options = parsePreviewSetupOptions(
    [],
    {
      PREVIEW_CLEANUP_DEPLOYMENT: "example",
      PREVIEW_SETUP_CONVEX_URL: "https://example.convex.cloud",
      PREVIEW_SETUP_ADMIN_FIREBASE_UID: "admin-uid",
      PREVIEW_ACCESS_FARMER_FIREBASE_UID: "farmer-uid",
      PREVIEW_ACCESS_BUYER_FIREBASE_UID: "buyer-uid",
      PREVIEW_ACCESS_TRANSPORTER_FIREBASE_UID: "transporter-uid",
      PREVIEW_ACCESS_WAREHOUSE_AGENT_FIREBASE_UID: "operations-uid",
      PREVIEW_FARMER_PHONE_NUMBER: phones[0],
      PREVIEW_BUYER_PHONE_NUMBER: phones[1],
      PREVIEW_TRANSPORTER_PHONE_NUMBER: phones[2],
      PREVIEW_OPERATIONS_PHONE_NUMBER: phones[3],
      PREVIEW_CLEANUP_START_AT: start,
      PREVIEW_CLEANUP_END_AT: end,
      PREVIEW_ACCESS_CUTOFF_UTC: cutoff,
    },
    now,
  );
  assert.equal(options.cutoffAt, Date.parse(cutoff));
});

test("setup rejects a Convex URL from a different cleanup deployment", () => {
  assert.throws(
    () =>
      parsePreviewSetupOptions(
        base.map((item) =>
          item === "--deployment=example" ? "--deployment=another" : item,
        ),
        {},
        now,
      ),
    /same Convex deployment/,
  );
});

test("starter records use three exact 50 kg bag routes", () => {
  const records = buildPreviewStarterRecords(now);
  assert.deepEqual(
    records.map((record) => record.bags),
    [100, 150, 200],
  );
  assert.deepEqual(
    records.map((record) => record.kilograms),
    [5_000, 7_500, 10_000],
  );
  assert.ok(
    records.every((record) => record.grams === record.bags * 50 * 1_000),
  );
  assert.equal(new Set(records.map((record) => record.previewSeedKey)).size, 3);
  assert.deepEqual(records[0].sourceLotBags, [40, 30, 30]);
  assert.ok(
    records.every(
      (record) =>
        record.sourceLotBags.reduce((sum, bags) => sum + bags, 0) ===
          record.bags && record.sellerCoordinationFeePercent === 3,
    ),
  );
  assert.ok(records.every((record) => record.collectionWindowStartAt > now));
});
