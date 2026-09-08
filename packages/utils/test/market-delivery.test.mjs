import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateMarketRunOrders,
  assertInviteIdentityVerification,
  assertInviteTargetMatchesIdentity,
  assertNotificationActionAllowed,
  assertInvitationDeliveryAllowed,
  assertDispatchRunGroupingCompatible,
  assertOrderCanJoinMarketRun,
  calculateActualFinancialSummary,
  buildMarketRunBuyerNotification,
  calculateMarketRunOccurrence,
  isInvitationDeliveryAllowed,
  marketRunOrderCountsTowardReadiness,
  shouldAdvanceMarketRunCutoff,
  shouldExpireInventoryReservation,
} from "../src/index.ts";

test("invitation delivery combinations are role safe", () => {
  assert.equal(isInvitationDeliveryAllowed("admin_invite", "email"), true);
  assert.equal(isInvitationDeliveryAllowed("warehouse_manager_invite", "email"), true);
  assert.equal(isInvitationDeliveryAllowed("admin_invite", "manual_link"), false);
  assert.equal(isInvitationDeliveryAllowed("warehouse_manager_invite", "manual_link"), false);
  assert.equal(isInvitationDeliveryAllowed("warehouse_agent_invite", "email"), true);
  assert.equal(isInvitationDeliveryAllowed("warehouse_agent_invite", "manual_link"), true);
  assert.equal(isInvitationDeliveryAllowed("pilot_operations_invite", "email"), true);
  assert.equal(isInvitationDeliveryAllowed("pilot_operations_invite", "manual_link"), true);
  assert.equal(isInvitationDeliveryAllowed("transporter_invite", "email"), true);
  assert.equal(isInvitationDeliveryAllowed("transporter_invite", "manual_link"), true);
  assert.equal(isInvitationDeliveryAllowed("warehouse_agent_invite", "sms"), false);
  assert.equal(isInvitationDeliveryAllowed("transporter_invite", "sms"), false);
  assert.throws(
    () => assertInvitationDeliveryAllowed("admin_invite", "manual_link"),
    /must be delivered by email/,
  );
});

test("privileged invitation acceptance always requires a verified email", () => {
  assert.throws(
    () => assertInviteIdentityVerification({
      invitationType: "admin_invite",
      targetEmail: "admin@example.com",
      identityPhoneNumber: "+233201234567",
      phoneVerified: true,
      emailVerified: false,
    }),
    /email must be verified/,
  );
  assert.doesNotThrow(() => assertInviteIdentityVerification({
    invitationType: "warehouse_manager_invite",
    targetEmail: "manager@example.com",
    identityPhoneNumber: "+233201234567",
    emailVerified: true,
  }));
  assert.doesNotThrow(() => assertInviteIdentityVerification({
    invitationType: "warehouse_agent_invite",
    targetPhoneNumber: "+233201234567",
    identityPhoneNumber: "+233201234567",
    phoneVerified: true,
  }));
});

test("pilot operator invitation acceptance requires a verified matching phone", () => {
  assert.doesNotThrow(() =>
    assertInviteIdentityVerification({
      invitationType: "pilot_operations_invite",
      targetPhoneNumber: "+233201234567",
      identityPhoneNumber: "+233201234567",
      phoneVerified: true,
    }),
  );
  assert.throws(
    () => assertInviteTargetMatchesIdentity({
      targetPhoneNumber: "+233201234567",
      identityPhoneNumber: "+233209999999",
    }),
    /does not match/,
  );
});

test("notification actions belong to the recipient and required actions need acknowledgement", () => {
  assert.doesNotThrow(() => assertNotificationActionAllowed({ actorUserId: "user-a", recipientUserId: "user-a", action: "read" }));
  assert.throws(() => assertNotificationActionAllowed({ actorUserId: "user-b", recipientUserId: "user-a", action: "read" }), /another user's/);
  assert.throws(() => assertNotificationActionAllowed({ actorUserId: "user-a", recipientUserId: "user-a", action: "archive", actionRequired: true, expiresAt: 300, now: 100 }), /acknowledged/);
  assert.doesNotThrow(() => assertNotificationActionAllowed({ actorUserId: "user-a", recipientUserId: "user-a", action: "archive", actionRequired: true, acknowledgedAt: 50, expiresAt: 300, now: 100 }));
  assert.throws(() => assertNotificationActionAllowed({ actorUserId: "user-a", recipientUserId: "user-a", action: "acknowledge", actionRequired: true, expiresAt: 90, now: 100 }), /expired/);
});

test("weekly run timing respects Africa/Accra date, cutoff, and arrival window", () => {
  const occurrence = calculateMarketRunOccurrence(
    {
      timezone: "Africa/Accra",
      deliveryWeekday: 5,
      cutoffDaysBefore: 2,
      cutoffLocalTime: "17:00",
      arrivalStartLocalTime: "06:00",
      arrivalEndLocalTime: "08:00",
      effectiveDate: "2026-08-01",
    },
    "2026-08-07",
  );
  assert.equal(new Date(occurrence.orderCutoffAt).toISOString(), "2026-08-05T17:00:00.000Z");
  assert.equal(new Date(occurrence.expectedArrivalStartAt).toISOString(), "2026-08-07T06:00:00.000Z");
  assert.equal(new Date(occurrence.expectedArrivalEndAt).toISOString(), "2026-08-07T08:00:00.000Z");
  assert.throws(
    () => calculateMarketRunOccurrence({
      timezone: "Africa/Accra",
      deliveryWeekday: 5,
      cutoffDaysBefore: 2,
      cutoffLocalTime: "17:00",
      arrivalStartLocalTime: "06:00",
      arrivalEndLocalTime: "08:00",
      effectiveDate: "2026-08-01",
    }, "2026-08-08"),
    /weekday/,
  );
});

test("run aggregation never combines incompatible units", () => {
  const summary = aggregateMarketRunOrders([
    { cropType: "Produce A", unit: "bags", requestedQuantity: 10, reservedQuantity: 8, paymentStatus: "fully_paid" },
    { cropType: "Produce A", unit: "crates", requestedQuantity: 4, reservedQuantity: 4, paymentStatus: "awaiting_payment", reservationExpiresAt: 200 },
    { cropType: "Produce B", unit: "bags", requestedQuantity: 5, reservedQuantity: 5, paymentStatus: "deposit_paid", reservationExpiresAt: 100 },
  ], { capacityQuantity: 30, capacityUnit: "bags", minimumLoadQuantity: 15, minimumLoadUnit: "bags" });
  assert.equal(summary.groupedTotals.length, 3);
  assert.equal(summary.capacity.compatible, false);
  assert.equal(summary.capacity.percentage, undefined);
  assert.equal(summary.minimumLoad.percentage, undefined);
  assert.equal(summary.buyersAwaitingPayment, 2);
  assert.equal(summary.nextReservationExpiry, 100);
});

test("run assignment enforces cutoff, origin, destination, and open state", () => {
  const valid = {
    runStatus: "accepting_orders",
    now: 100,
    orderCutoffAt: 200,
    runOriginWarehouseId: "warehouse-a",
    inventoryWarehouseIds: ["warehouse-a"],
    runDestination: "Tarkwa Market",
    orderDestination: "tarkwa market",
  };
  assert.doesNotThrow(() => assertOrderCanJoinMarketRun(valid));
  assert.throws(() => assertOrderCanJoinMarketRun({ ...valid, now: 200 }), /cutoff/);
  assert.doesNotThrow(() => assertOrderCanJoinMarketRun({ ...valid, now: 200, authorizedAfterCutoff: true, exceptionReason: "Manager approved late institutional order" }));
  assert.throws(() => assertOrderCanJoinMarketRun({ ...valid, inventoryWarehouseIds: ["warehouse-b"] }), /origin/);
  assert.throws(() => assertOrderCanJoinMarketRun({ ...valid, orderDestination: "Another market" }), /destination/);
  assert.throws(() => assertOrderCanJoinMarketRun({ ...valid, runStatus: "cancelled" }), /not accepting/);
});

test("scheduled run lifecycle advances at cutoff and expires only unpaid reservations", () => {
  assert.equal(shouldAdvanceMarketRunCutoff({ status: "accepting_orders", orderCutoffAt: 100, now: 100 }), true);
  assert.equal(shouldAdvanceMarketRunCutoff({ status: "draft", orderCutoffAt: 100, now: 100 }), false);
  assert.equal(shouldAdvanceMarketRunCutoff({ status: "accepting_orders", orderCutoffAt: 101, now: 100 }), false);
  assert.equal(shouldExpireInventoryReservation({ status: "active", expiresAt: 100, paymentStatus: "awaiting_payment", now: 100 }), true);
  assert.equal(shouldExpireInventoryReservation({ status: "active", expiresAt: 100, paymentStatus: "fully_paid", now: 100 }), false);
  assert.equal(shouldExpireInventoryReservation({ status: "expired", expiresAt: 100, paymentStatus: "awaiting_payment", now: 100 }), false);
});

test("cancelled, unfulfilled, and completed orders do not count toward run readiness", () => {
  assert.equal(marketRunOrderCountsTowardReadiness("reserved"), true);
  assert.equal(marketRunOrderCountsTowardReadiness("cancelled"), false);
  assert.equal(marketRunOrderCountsTowardReadiness("unfulfilled"), false);
  assert.equal(marketRunOrderCountsTowardReadiness("completed"), false);
});

test("dispatch grouping preserves delivery-run and legacy boundaries", () => {
  assert.doesNotThrow(() => assertDispatchRunGroupingCompatible(["run-a", "run-a"]));
  assert.doesNotThrow(() => assertDispatchRunGroupingCompatible([undefined, undefined]));
  assert.throws(() => assertDispatchRunGroupingCompatible(["run-a", "run-b"]), /incompatible/);
  assert.throws(() => assertDispatchRunGroupingCompatible(["run-a", undefined]), /incompatible/);
});

test("run cancellation notifications are actionable, durable, and deduplicated", () => {
  const notification = buildMarketRunBuyerNotification({ event: "cancelled", runId: "run-a", destination: "Selected Market", deliveryLabel: "7 Aug 2026", reason: "Vehicle unavailable" });
  assert.equal(notification.actionRequired, true);
  assert.equal(notification.priority, "high");
  assert.equal(notification.actionUrl, "/buyer/orders");
  assert.equal(notification.deduplicationKey, "run:run-a:cancelled:in-app");
  assert.match(notification.message, /Vehicle unavailable/);
});

test("actual finance separates gross value, platform charges, cash, and payouts", () => {
  assert.deepEqual(calculateActualFinancialSummary({
    sales: [
      { grossAmount: 1000, netAmountDueToFarmer: 850, paymentStatus: "pending" },
      { grossAmount: 500, netAmountDueToFarmer: 430, paymentStatus: "disputed" },
    ],
    charges: [
      { amount: 80, category: "service" },
      { amount: 30, category: "storage" },
      { amount: 25, category: "transport" },
      { amount: 5, category: "insurance" },
    ],
    buyerOrders: [
      { totalAmount: 1080, paymentStatus: "fully_paid" },
      { totalAmount: 540, paymentStatus: "disputed" },
    ],
    payments: [
      { amount: 1080, status: "successful" },
      { amount: 540, status: "failed" },
      { amount: 50, status: "manual_review" },
    ],
    payouts: [
      { amount: 850, status: "paid" },
      { amount: 430, status: "pending" },
    ],
  }), {
    grossProduceValue: 1500,
    farmerOwnedValue: 1280,
    serviceFeeRevenue: 80,
    storageCharges: 30,
    transportCharges: 25,
    insuranceCharges: 5,
    buyerPaymentsCollected: 1080,
    unpaidBuyerOrders: 540,
    farmerNetPayoutsDue: 430,
    payoutsPaid: 850,
    paymentFailures: 540,
    manualReviewAmounts: 50,
    disputedAmounts: 1040,
  });
});
