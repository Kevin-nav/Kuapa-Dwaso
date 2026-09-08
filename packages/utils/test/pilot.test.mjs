import assert from "node:assert/strict";
import test from "node:test";
import {
  bagsToGrams,
  calculatePilotAmountPesewas,
  createPilotBagMeasurement,
  getPilotExactAmount,
  kilogramsToGrams,
  pilotOrderSource,
  pilotPurchasingBudgetAvailablePesewas,
  reconcilePilotLineAmounts,
} from "../src/pilot.ts";

test("uses exact canonical grams for pilot quantities and measured bags", () => {
  assert.equal(kilogramsToGrams(5_000), 5_000_000);
  assert.equal(kilogramsToGrams(200), 200_000);
  assert.equal(bagsToGrams(40, kilogramsToGrams(50)), 2_000_000);
  assert.deepEqual(
    createPilotBagMeasurement({
      bagCount: 40,
      declaredGramsPerBag: 50_000,
      measuredTotalGrams: 1_980_000,
    }),
    {
      bagCount: 40,
      declaredGramsPerBag: 50_000,
      declaredTotalGrams: 2_000_000,
      measuredTotalGrams: 1_980_000,
    },
  );
  assert.throws(() => kilogramsToGrams(0.0001), /whole/);
});

test("rounds half-up to one pesewa with integer arithmetic", () => {
  const onePesewaPerKg = { numerator: 1, scale: 1, unit: "per_kg" };
  assert.equal(
    calculatePilotAmountPesewas({ quantityGrams: 499, rate: onePesewaPerKg }),
    0,
  );
  assert.equal(
    calculatePilotAmountPesewas({ quantityGrams: 500, rate: onePesewaPerKg }),
    1,
  );
  assert.equal(
    calculatePilotAmountPesewas({
      quantityGrams: 5_000_000,
      rate: { numerator: 500, scale: 1, unit: "per_kg" },
    }),
    2_500_000,
  );
});

test("allocates an aggregate rounding remainder by stable line ID", () => {
  const lines = ["farmer-c", "farmer-a", "farmer-b"].map((id) => ({
    id,
    exact: getPilotExactAmount({
      quantityGrams: 400,
      rate: { numerator: 1, scale: 1, unit: "per_kg" },
    }),
  }));
  assert.deepEqual(reconcilePilotLineAmounts(lines), [
    { id: "farmer-a", amountPesewas: 1 },
    { id: "farmer-b", amountPesewas: 0 },
    { id: "farmer-c", amountPesewas: 0 },
  ]);
});

test("keeps warehouse and pilot references discriminated", () => {
  assert.equal(
    pilotOrderSource({ source: "warehouse_run", buyerOrderId: "order-1" }),
    "warehouse_run",
  );
  assert.equal(
    pilotOrderSource({ source: "pilot_request", pilotRequestId: "request-1" }),
    "pilot_request",
  );
});

test("rejects purchasing counters that exceed approved capacity", () => {
  assert.equal(
    pilotPurchasingBudgetAvailablePesewas({
      approvedCapacityPesewas: 2_150_000,
      reservedPesewas: 2_000_000,
      committedPesewas: 0,
      spentPesewas: 150_000,
    }),
    0,
  );
  assert.throws(
    () =>
      pilotPurchasingBudgetAvailablePesewas({
        approvedCapacityPesewas: 100,
        reservedPesewas: 101,
        committedPesewas: 0,
        spentPesewas: 0,
      }),
    /exceed/,
  );
});
