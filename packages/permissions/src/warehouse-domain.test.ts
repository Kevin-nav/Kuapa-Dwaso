import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateInventoryBatchAvailableQuantity,
  canConfigureFees,
  canCreateDispatch,
  canCreateInventoryBatch,
  canReserveInventory,
  canTransitionBuyerOrderStatus,
  canTransitionDispatchStatus,
  canTransitionInventoryBatchStatus,
} from "./index.ts";

test("warehouse agent owns operational permissions but cannot configure fees", () => {
  assert.equal(canCreateInventoryBatch("warehouse_agent"), true);
  assert.equal(canReserveInventory("warehouse_agent"), true);
  assert.equal(canCreateDispatch("warehouse_agent"), true);
  assert.equal(canConfigureFees("warehouse_agent"), false);
  assert.equal(canConfigureFees("admin"), true);
});

test("inventory batch transitions pin warehouse lifecycle rules", () => {
  assert.equal(canTransitionInventoryBatchStatus("received", "verified"), true);
  assert.equal(canTransitionInventoryBatchStatus("verified", "available"), true);
  assert.equal(canTransitionInventoryBatchStatus("available", "reserved"), true);
  assert.equal(canTransitionInventoryBatchStatus("reserved", "prepared_for_dispatch"), true);
  assert.equal(canTransitionInventoryBatchStatus("dispatched", "available"), false);
  assert.equal(canTransitionInventoryBatchStatus("spoiled", "available"), false);
});

test("buyer order and dispatch transitions reject reopening terminal states", () => {
  assert.equal(canTransitionBuyerOrderStatus("draft", "submitted"), true);
  assert.equal(canTransitionBuyerOrderStatus("reserved", "preparing"), true);
  assert.equal(canTransitionBuyerOrderStatus("completed", "submitted"), false);
  assert.equal(canTransitionDispatchStatus("planned", "loading"), true);
  assert.equal(canTransitionDispatchStatus("delivered", "closed"), true);
  assert.equal(canTransitionDispatchStatus("closed", "in_transit"), false);
});

test("inventory availability subtracts sold quantity and active reservations", () => {
  const availableQuantity = calculateInventoryBatchAvailableQuantity(100, 25, [
    {
      quantityReserved: 30,
      quantityReleased: 5,
      quantityFulfilled: 0,
      status: "active",
    },
    {
      quantityReserved: 10,
      quantityReleased: 0,
      quantityFulfilled: 0,
      status: "cancelled",
    },
  ]);

  assert.equal(availableQuantity, 50);
});
