import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBuyerOrderCharges,
  calculateFeeAmount,
  calculateFeeAmountFromSnapshot,
  roundMoneyAmount,
} from "../src/index.ts";

test("rounds money amounts to two decimal places by default", () => {
  assert.equal(roundMoneyAmount(10.005), 10.01);
  assert.equal(roundMoneyAmount(10.004), 10);
});

test("calculates fixed, per-unit, and per-unit-per-day fees", () => {
  assert.equal(calculateFeeAmount({ calculationType: "fixed_amount", amount: 12 }), 12);
  assert.equal(calculateFeeAmount({ calculationType: "per_unit", ratePerUnit: 1.5, quantity: 10 }), 15);
  assert.equal(
    calculateFeeAmount({
      calculationType: "per_unit_per_day",
      ratePerUnitPerDay: 1.5,
      quantity: 10,
      days: 3,
    }),
    45,
  );
});

test("calculates percentage-based fees", () => {
  assert.equal(
    calculateFeeAmount({
      calculationType: "percentage_of_gross_sale",
      percentage: 7.5,
      grossSaleAmount: 200,
    }),
    15,
  );
  assert.equal(
    calculateFeeAmount({
      calculationType: "percentage_of_transport_cost",
      percentage: 12.5,
      transportCost: 80,
    }),
    10,
  );
});

test("calculates from an applied rule snapshot", () => {
  const snapshot = {
    feeRuleId: "rule-1",
    feeRuleVersion: 2,
    label: "Tomato storage",
    calculationType: "per_unit_per_day",
    payer: "farmer",
    ratePerUnitPerDay: 1.5,
    currency: "GHS",
    snapshottedAt: 1000,
  };

  assert.equal(
    calculateFeeAmountFromSnapshot(snapshot, {
      quantity: 10,
      days: 3,
    }),
    45,
  );
});

test("rejects missing fee inputs", () => {
  assert.throws(
    () => calculateFeeAmount({ calculationType: "per_unit", quantity: 10 }),
    /Rate per unit/,
  );
});

test("calculates buyer order charges from buyer-facing snapshots only", () => {
  const charges = calculateBuyerOrderCharges([
    {
      snapshot: {
        feeRuleId: "buyer-service",
        feeRuleVersion: 1,
        label: "Buyer service fee",
        calculationType: "percentage_of_gross_sale",
        payer: "buyer",
        percentage: 5,
        currency: "GHS",
        snapshottedAt: 1000,
      },
      quantity: 10,
      grossSaleAmount: 200,
    },
    {
      snapshot: {
        feeRuleId: "farmer-storage",
        feeRuleVersion: 1,
        label: "Farmer storage",
        calculationType: "per_unit_per_day",
        payer: "farmer",
        ratePerUnitPerDay: 1.5,
        currency: "GHS",
        snapshottedAt: 1000,
      },
      quantity: 10,
    },
  ]);

  assert.equal(charges.length, 1);
  assert.equal(charges[0].label, "Buyer service fee");
  assert.equal(charges[0].amount, 10);
});
