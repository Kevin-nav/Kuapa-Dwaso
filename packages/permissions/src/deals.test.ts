import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBulkLotAvailableQuantity,
  canTransitionDealStatus,
  isQuantityHoldingDealStatus
} from "./index.ts";

test("deal status transitions require farmer approval before accepted", () => {
  assert.equal(canTransitionDealStatus("offer_received", "accepted"), false);
  assert.equal(canTransitionDealStatus("offer_received", "accepted_pending_farmer_approval"), true);
  assert.equal(canTransitionDealStatus("accepted_pending_farmer_approval", "accepted"), false);
});

test("terminal offer states cannot be reopened", () => {
  assert.equal(canTransitionDealStatus("cancelled", "offer_received"), false);
  assert.equal(canTransitionDealStatus("rejected", "countered"), false);
});

test("quantity availability subtracts active, completed, and disputed deal quantities", () => {
  const availableQuantity = calculateBulkLotAvailableQuantity(100, [{ quantity: 25 }, { quantity: 15 }]);

  assert.equal(availableQuantity, 60);
  assert.equal(isQuantityHoldingDealStatus("countered"), true);
  assert.equal(isQuantityHoldingDealStatus("completed"), true);
  assert.equal(isQuantityHoldingDealStatus("cancelled"), false);
  assert.equal(isQuantityHoldingDealStatus("rejected"), false);
});
