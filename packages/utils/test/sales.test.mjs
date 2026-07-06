import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateStorageFeeDeductions,
  calculateFarmerSaleDeductions,
  calculateNetAmountDueToFarmer,
} from "../src/index.ts";

test("calculates farmer-side deductions from farmer and shared fee snapshots", () => {
  const deductions = calculateFarmerSaleDeductions([
    {
      snapshot: {
        feeRuleId: "handling",
        feeRuleVersion: 1,
        label: "Handling fee",
        calculationType: "per_unit",
        payer: "farmer",
        ratePerUnit: 2,
        currency: "GHS",
        snapshottedAt: 1000,
      },
      quantity: 5,
      grossSaleAmount: 200,
    },
    {
      snapshot: {
        feeRuleId: "commission",
        feeRuleVersion: 1,
        label: "Platform commission",
        calculationType: "percentage_of_gross_sale",
        payer: "shared",
        percentage: 5,
        currency: "GHS",
        snapshottedAt: 1000,
      },
      quantity: 5,
      grossSaleAmount: 200,
    },
    {
      snapshot: {
        feeRuleId: "buyer-service",
        feeRuleVersion: 1,
        label: "Buyer service fee",
        calculationType: "fixed_amount",
        payer: "buyer",
        amount: 8,
        currency: "GHS",
        snapshottedAt: 1000,
      },
      quantity: 5,
      grossSaleAmount: 200,
    },
  ]);

  assert.deepEqual(
    deductions.map((deduction) => [deduction.label, deduction.amount]),
    [
      ["Handling fee", 10],
      ["Platform commission", 10],
    ],
  );
});

test("allocates storage fees proportionally for partial-batch sales", () => {
  const settlements = allocateStorageFeeDeductions(
    [
      { ledgerId: "fee-1", amount: 30 },
      { ledgerId: "fee-2", amount: 10, amountAlreadyDeducted: 4 },
    ],
    5,
    10,
  );

  assert.deepEqual(settlements, [
    {
      ledgerId: "fee-1",
      amountDeducted: 15,
      nextAmountDeducted: 15,
      fullySettled: false,
    },
    {
      ledgerId: "fee-2",
      amountDeducted: 3,
      nextAmountDeducted: 7,
      fullySettled: false,
    },
  ]);
});

test("calculates net farmer amount after deductions and adjustments", () => {
  assert.equal(
    calculateNetAmountDueToFarmer({
      grossAmount: 200,
      storageFeeDeducted: 18,
      handlingFeeDeducted: 10,
      commissionDeducted: 10,
      adjustmentAmount: 5,
    }),
    167,
  );
});
