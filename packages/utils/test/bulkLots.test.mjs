import assert from "node:assert/strict";
import test from "node:test";
import { assertListingCanEnterBulkLot, calculateBulkLotFromListings } from "../src/index.ts";

function listing(overrides = {}) {
  return {
    farmerId: "farmer-1",
    cropType: "maize",
    quantity: 10,
    unit: "bag",
    grade: "A",
    askingPrice: 120,
    locationArea: "Ejura",
    availableFrom: 100,
    availableUntil: 300,
    status: "active",
    ...overrides
  };
}

test("calculates derived bulk lot quantity, farmer count, mixed grade, and price range", () => {
  const result = calculateBulkLotFromListings(
    [
      listing({ farmerId: "farmer-1", quantity: 10, grade: "A", askingPrice: 120 }),
      listing({ farmerId: "farmer-2", quantity: 15, grade: "B", askingPrice: 90 })
    ],
    150,
    250
  );

  assert.equal(result.cropType, "maize");
  assert.equal(result.totalQuantity, 25);
  assert.equal(result.farmerCount, 2);
  assert.equal(result.grade, "mixed");
  assert.deepEqual(result.priceRange, { min: 90, max: 120 });
});

test("allows existing in_bulk_lot members during recalculation", () => {
  const result = calculateBulkLotFromListings(
    [
      listing({ farmerId: "farmer-1", quantity: 10, status: "in_bulk_lot" }),
      listing({ farmerId: "farmer-2", quantity: 15, status: "in_bulk_lot" })
    ],
    150,
    250,
    "A"
  );

  assert.equal(result.totalQuantity, 25);
  assert.equal(result.grade, "A");
});

test("rejects adding a listing that is already in a bulk lot as a new member", () => {
  assert.throws(
    () => assertListingCanEnterBulkLot(listing({ status: "in_bulk_lot" })),
    /Only active or pending verification listings/
  );
});

test("rejects incompatible listing units", () => {
  assert.throws(
    () => calculateBulkLotFromListings([listing(), listing({ farmerId: "farmer-2", unit: "crate" })], 150, 250),
    /same quantity unit/
  );
});

test("rejects non-mixed grade lots with mismatched listing grades", () => {
  assert.throws(
    () => calculateBulkLotFromListings([listing(), listing({ farmerId: "farmer-2", grade: "B" })], 150, 250, "A"),
    /same grade/
  );
});

test("rejects listings outside the pickup window", () => {
  assert.throws(
    () => calculateBulkLotFromListings([listing({ availableUntil: 140 })], 150, 250),
    /available during the bulk lot pickup window/
  );
});
