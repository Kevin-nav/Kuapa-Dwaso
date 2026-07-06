import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDispatchQuantityAggregation,
  calculateDispatchTransportCostShare,
} from "../src/index.ts";

test("aggregates dispatch quantities within one warehouse destination and unit", () => {
  assert.deepEqual(
    calculateDispatchQuantityAggregation([
      {
        warehouseId: "warehouse-1",
        destination: "Tarkwa",
        quantity: 4,
        unit: "crate",
      },
      {
        warehouseId: "warehouse-1",
        destination: "Tarkwa",
        quantity: 6,
        unit: "crate",
      },
    ]),
    {
      warehouseId: "warehouse-1",
      destination: "Tarkwa",
      totalQuantity: 10,
      unit: "crate",
    },
  );
});

test("rejects dispatch aggregation across routes or units", () => {
  assert.throws(
    () =>
      calculateDispatchQuantityAggregation([
        {
          warehouseId: "warehouse-1",
          destination: "Tarkwa",
          quantity: 4,
          unit: "crate",
        },
        {
          warehouseId: "warehouse-2",
          destination: "Tarkwa",
          quantity: 6,
          unit: "crate",
        },
      ]),
    /one warehouse/,
  );

  assert.throws(
    () =>
      calculateDispatchQuantityAggregation([
        {
          warehouseId: "warehouse-1",
          destination: "Tarkwa",
          quantity: 4,
          unit: "crate",
        },
        {
          warehouseId: "warehouse-1",
          destination: "Accra",
          quantity: 6,
          unit: "crate",
        },
      ]),
    /one destination/,
  );
});

test("calculates transport cost share by payer", () => {
  assert.deepEqual(calculateDispatchTransportCostShare(101, "shared"), {
    payer: "shared",
    buyerAmount: 50.5,
    farmerAmount: 50.5,
    platformAmount: 0,
    includedInPriceAmount: 0,
  });

  assert.deepEqual(calculateDispatchTransportCostShare(25, "platform"), {
    payer: "platform",
    buyerAmount: 0,
    farmerAmount: 0,
    platformAmount: 25,
    includedInPriceAmount: 0,
  });
});
