import assert from "node:assert/strict";
import test from "node:test";
import {
  bagsToGrams,
  calculatePilotAmountPesewas,
  calculatePilotOfferAmounts,
  createPilotBagMeasurement,
  getPilotExactAmount,
  kilogramsToGrams,
  pilotAllocationFits,
  getPilotReadinessBlockers,
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

test("scenario A offer snapshots produce GH₵23,750 net after a five percent farmer charge", () => {
  assert.deepEqual(
    calculatePilotOfferAmounts({
      offeredGrams: 5_000_000,
      priceRate: { numerator: 500, scale: 1, unit: "per_kg" },
      chargeTerms: [
        {
          code: "coordination",
          label: "Coordination fee",
          payer: "farmer",
          calculation: "percent_of_produce",
          rate: { numerator: 5, scale: 100, unit: "percent" },
        },
      ],
    }),
    {
      expectedGrossPesewas: 2_500_000,
      expectedChargesPesewas: 125_000,
      expectedNetPesewas: 2_375_000,
    },
  );
});

test("scenario A final accepted farmer quantities reconcile line by line", () => {
  const finalQuantities = [2_000_000, 1_500_000, 1_300_000, 200_000];
  const lines = finalQuantities.map((offeredGrams) =>
    calculatePilotOfferAmounts({
      offeredGrams,
      priceRate: { numerator: 500, scale: 1, unit: "per_kg" },
      chargeTerms: [
        {
          code: "coordination",
          label: "Coordination fee",
          payer: "farmer",
          calculation: "percent_of_produce",
          rate: { numerator: 5, scale: 100, unit: "percent" },
        },
      ],
    }),
  );
  assert.deepEqual(
    lines.map((line) => line.expectedNetPesewas),
    [950_000, 712_500, 617_500, 95_000],
  );
  assert.equal(
    lines.reduce((sum, line) => sum + line.expectedGrossPesewas, 0),
    2_500_000,
  );
  assert.equal(
    lines.reduce((sum, line) => sum + line.expectedNetPesewas, 0),
    2_375_000,
  );
});

test("competing commitments cannot allocate more than declared supply", () => {
  assert.equal(
    pilotAllocationFits({
      declaredGrams: 2_000_000,
      activeAllocatedGrams: 1_500_000,
      proposedGrams: 500_000,
    }),
    true,
  );
  assert.equal(
    pilotAllocationFits({
      declaredGrams: 2_000_000,
      activeAllocatedGrams: 1_500_000,
      proposedGrams: 500_001,
    }),
    false,
  );
  assert.equal(
    pilotAllocationFits({
      declaredGrams: 2_000_000,
      activeAllocatedGrams: 2_000_000,
      replacingActiveGrams: 500_000,
      proposedGrams: 500_000,
    }),
    true,
  );
});

test("readiness blocks the 4,800 kg shortfall and over-capacity plan", () => {
  const blockers = getPilotReadinessBlockers({
    plannedGrams: 5_000_000,
    clearedGrams: 4_800_000,
    agreementCurrent: true,
    agreementExpiresAt: 10_000,
    now: 1_000,
    collectionWindowStartAt: 2_000,
    collectionWindowEndAt: 3_000,
    deliveryWindowStartAt: 4_000,
    deliveryWindowEndAt: 5_000,
    agreementDeliveryWindowStartAt: 3_500,
    agreementDeliveryWindowEndAt: 5_500,
    driverAssigned: true,
    driverEligible: true,
    vehicleCapacityGrams: 4_900_000,
    financialReleaseSatisfied: true,
    hasBlockingIssue: false,
  });
  assert.deepEqual(blockers, [
    "cleared_quantity_shortfall",
    "vehicle_capacity_shortfall",
  ]);
});

test("readiness fails closed when the agreement or finance release is stale", () => {
  const blockers = getPilotReadinessBlockers({
    plannedGrams: 200_000,
    clearedGrams: 200_000,
    agreementCurrent: false,
    agreementExpiresAt: 900,
    now: 1_000,
    collectionWindowStartAt: 2_000,
    collectionWindowEndAt: 3_000,
    deliveryWindowStartAt: 4_000,
    deliveryWindowEndAt: 5_000,
    agreementDeliveryWindowStartAt: 4_000,
    agreementDeliveryWindowEndAt: 5_000,
    driverAssigned: true,
    driverEligible: true,
    vehicleCapacityGrams: 200_000,
    financialReleaseSatisfied: false,
    hasBlockingIssue: false,
  });
  assert.deepEqual(blockers, [
    "agreement_not_current",
    "agreement_expired",
    "financial_release_required",
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
