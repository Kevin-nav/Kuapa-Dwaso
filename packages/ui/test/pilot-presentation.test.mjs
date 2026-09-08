import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPilotMoney,
  formatPilotQuantity,
  pilotEventSourceLabel,
  quantityPercent,
  validateQuantityProgress,
} from "../src/pilot/model.ts";

test("quantity presentation preserves distinct transaction stages", () => {
  const values = [
    { stage: "requested", grams: 5_000_000 },
    { stage: "committed", grams: 5_000_000 },
    { stage: "cleared", grams: 4_800_000 },
    { stage: "delivered", grams: 0 },
  ];
  assert.doesNotThrow(() => validateQuantityProgress(values));
  assert.equal(quantityPercent(4_800_000, 5_000_000), 96);
  assert.equal(formatPilotQuantity(4_800_000), "4,800 kg");
});

test("presentation rejects fabricated quantity shapes and formats supplied money only", () => {
  assert.throws(() =>
    validateQuantityProgress([
      { stage: "requested", grams: 1 },
      { stage: "requested", grams: 2 },
    ]),
  );
  assert.throws(() =>
    validateQuantityProgress([{ stage: "cleared", grams: -1 }]),
  );
  assert.equal(formatPilotMoney(1_234_567), "GH₵12,345.67");
});

test("simulation provenance stays explicit at the event", () => {
  assert.equal(pilotEventSourceLabel("live"), undefined);
  assert.equal(pilotEventSourceLabel("mock_payment"), "Mock payment");
  assert.equal(pilotEventSourceLabel("mock_sms"), "Mock SMS");
  assert.equal(
    pilotEventSourceLabel("sample_manual_inspection"),
    "Manually entered sample inspection",
  );
});
