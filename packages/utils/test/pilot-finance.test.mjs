import assert from "node:assert/strict";
import test from "node:test";
import {
  pilotActualContribution,
  pilotObligationStatus,
  pilotPaymentDueAt,
} from "../src/pilotFinance.ts";

const nextDayTerm = {
  trigger: "buyer_acceptance",
  offsetCalendarDays: 1,
  timezone: "Africa/Accra",
};

test("computes the inclusive next Accra calendar-day deadline", () => {
  const triggerAt = Date.UTC(2026, 8, 8, 23, 59, 59, 999);
  assert.equal(
    pilotPaymentDueAt(nextDayTerm, triggerAt),
    Date.UTC(2026, 8, 9, 23, 59, 59, 999),
  );
  assert.equal(
    pilotPaymentDueAt(
      { ...nextDayTerm, trigger: "fixed_date", fixedDueAt: 1_800_000_000_000 },
      triggerAt,
    ),
    1_800_000_000_000,
  );
});

test("marks an unpaid obligation overdue only after its due instant", () => {
  const dueAt = Date.UTC(2026, 8, 9, 23, 59, 59, 999);
  const base = {
    amountPesewas: 10_000,
    settledPesewas: 0,
    reversedPesewas: 0,
    dueAt,
  };
  assert.equal(pilotObligationStatus({ ...base, now: dueAt - 1 }).status, "due");
  assert.equal(pilotObligationStatus({ ...base, now: dueAt }).status, "due");
  assert.equal(
    pilotObligationStatus({ ...base, now: dueAt + 1 }).status,
    "overdue",
  );
  assert.equal(
    pilotObligationStatus({
      ...base,
      settledPesewas: 1,
      now: dueAt + 1,
    }).status,
    "overdue",
  );
});

test("derives partial, paid, disputed, and reversal-adjusted balances", () => {
  assert.deepEqual(
    pilotObligationStatus({
      amountPesewas: 10_000,
      settledPesewas: 4_000,
      reversedPesewas: 1_000,
      now: 0,
    }),
    { status: "partly_paid", outstandingPesewas: 5_000 },
  );
  assert.equal(
    pilotObligationStatus({
      amountPesewas: 10_000,
      settledPesewas: 9_000,
      reversedPesewas: 1_000,
      now: 0,
    }).status,
    "paid",
  );
  assert.equal(
    pilotObligationStatus({
      amountPesewas: 10_000,
      settledPesewas: 0,
      reversedPesewas: 0,
      now: 0,
      disputed: true,
    }).status,
    "disputed",
  );
});

test("reconciles the exact coordination and purchase demo contributions", () => {
  assert.deepEqual(
    pilotActualContribution({
      buyerProducePesewas: 2_500_000,
      buyerTransportPesewas: 150_000,
      farmerPayablesPesewas: 2_375_000,
      operatingCostPesewas: 150_000,
      costsComplete: true,
    }),
    { status: "complete", amountPesewas: 125_000 },
  );
  assert.deepEqual(
    pilotActualContribution({
      buyerProducePesewas: 2_500_000,
      buyerTransportPesewas: 0,
      farmerPayablesPesewas: 2_000_000,
      operatingCostPesewas: 150_000,
      costsComplete: true,
    }),
    { status: "complete", amountPesewas: 350_000 },
  );
  assert.deepEqual(
    pilotActualContribution({
      buyerProducePesewas: 2_500_000,
      buyerTransportPesewas: 150_000,
      farmerPayablesPesewas: 2_375_000,
      operatingCostPesewas: 0,
      costsComplete: false,
    }),
    { status: "incomplete" },
  );
});
