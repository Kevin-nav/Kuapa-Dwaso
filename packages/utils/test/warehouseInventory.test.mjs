import assert from "node:assert/strict";
import test from "node:test";
import {
  assertInventoryBatchCanBeReserved,
  calculateWarehouseInventoryAggregation,
} from "../src/index.ts";

function batch(overrides = {}) {
  return {
    farmerId: "farmer-1",
    warehouseId: "warehouse-1",
    cropType: "tomatoes",
    quantityAvailable: 10,
    unit: "crate",
    grade: "A",
    askingPricePerUnit: 120,
    sellByDate: 300,
    status: "available",
    ...overrides,
  };
}

test("calculates warehouse inventory quantity, farmer count, mixed grade, price range, and sell-by date", () => {
  const result = calculateWarehouseInventoryAggregation([
    batch({ farmerId: "farmer-1", quantityAvailable: 10, grade: "A", askingPricePerUnit: 120, sellByDate: 300 }),
    batch({ farmerId: "farmer-2", quantityAvailable: 15, grade: "B", askingPricePerUnit: 90, sellByDate: 250 }),
  ]);

  assert.equal(result.cropType, "tomatoes");
  assert.equal(result.totalAvailableQuantity, 25);
  assert.equal(result.farmerCount, 2);
  assert.equal(result.grade, "mixed");
  assert.equal(result.earliestSellByDate, 250);
  assert.deepEqual(result.priceRange, { min: 90, max: 120 });
});

test("allows partially sold or reserved inventory to stay buyer-visible", () => {
  const result = calculateWarehouseInventoryAggregation(
    [
      batch({ farmerId: "farmer-1", quantityAvailable: 10, status: "partially_reserved" }),
      batch({ farmerId: "farmer-2", quantityAvailable: 15, status: "partially_sold" }),
    ],
    "A",
  );

  assert.equal(result.totalAvailableQuantity, 25);
  assert.equal(result.grade, "A");
});

test("rejects reserving sold inventory", () => {
  assert.throws(
    () => assertInventoryBatchCanBeReserved(batch({ status: "sold" })),
    /Only available warehouse inventory/,
  );
});

test("rejects incompatible units", () => {
  assert.throws(
    () => calculateWarehouseInventoryAggregation([batch(), batch({ farmerId: "farmer-2", unit: "bag" })]),
    /one quantity unit/,
  );
});

test("rejects non-mixed grade aggregations with mismatched batch grades", () => {
  assert.throws(
    () => calculateWarehouseInventoryAggregation([batch(), batch({ farmerId: "farmer-2", grade: "B" })], "A"),
    /matching grades/,
  );
});

test("rejects aggregation across warehouses", () => {
  assert.throws(
    () => calculateWarehouseInventoryAggregation([batch(), batch({ warehouseId: "warehouse-2" })]),
    /one warehouse/,
  );
});
