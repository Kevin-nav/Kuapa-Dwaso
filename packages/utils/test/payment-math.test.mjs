import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFarmerSaleDeductions,
  calculateNetAmountDueToFarmer,
} from "../src/index.ts";

test("farmer payout amount uses existing sale deduction math", () => {
  const deductions = calculateFarmerSaleDeductions([
    {
      snapshot: {
        label: "Handling",
        calculationType: "per_unit",
        payer: "farmer",
        ratePerUnit: 0.25,
        currency: "GHS",
        snapshottedAt: 1,
      },
      quantity: 5,
      grossSaleAmount: 900,
    },
    {
      snapshot: {
        label: "Commission",
        calculationType: "percentage_of_gross_sale",
        payer: "farmer",
        percentage: 1,
        currency: "GHS",
        snapshottedAt: 1,
      },
      quantity: 5,
      grossSaleAmount: 900,
    },
  ]);

  assert.deepEqual(
    deductions.map((deduction) => deduction.amount),
    [1.25, 9],
  );
  assert.equal(
    calculateNetAmountDueToFarmer({
      grossAmount: 900,
      storageFeeDeducted: 22.5,
      handlingFeeDeducted: deductions[0].amount,
      commissionDeducted: deductions[1].amount,
    }),
    867.25,
  );
});
