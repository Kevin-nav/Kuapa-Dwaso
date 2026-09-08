import assert from "node:assert/strict";
import test from "node:test";
import {
  PilotValidationError,
  assertBoundedPagination,
  assertExpectedVersion,
  assertPilotChargeTerm,
  assertPilotQuantityGrams,
  assertPilotRequestTerms,
} from "./pilot.ts";

const specification = {
  maizeType: "yellow maize",
  moistureMaximumPermille: 130,
  contaminationCheckRequired: true,
  additionalCriteria: [
    { code: "aflatoxin", label: "Aflatoxin test", required: true },
  ],
  policyProvenance: "sample_only" as const,
};

test("validates canonical pilot quantities and request terms", () => {
  assert.doesNotThrow(() => assertPilotQuantityGrams(5_000_000));
  assert.doesNotThrow(() => assertPilotQuantityGrams(200_000));
  assert.doesNotThrow(() =>
    assertPilotRequestTerms({
      requestedGrams: 5_000_000,
      deliveryWindowStartAt: 1_000,
      deliveryWindowEndAt: 2_000,
      commercialMode: "coordination",
      requestedSpecification: specification,
      paymentExpectation: {
        trigger: "buyer_acceptance",
        offsetCalendarDays: 1,
        timezone: "Africa/Accra",
      },
    }),
  );
});

test("rejects fractional, unsafe, zero, and negative quantities with a stable code", () => {
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => assertPilotQuantityGrams(value),
      (error) =>
        error instanceof PilotValidationError &&
        error.code === "INVALID_QUANTITY",
    );
  }
});

test("validates revision, paging, and matching rate units", () => {
  assert.doesNotThrow(() => assertExpectedVersion(0));
  assert.throws(() => assertExpectedVersion(-1), /expectedVersion/);
  assert.doesNotThrow(() =>
    assertBoundedPagination({ programmeId: "programme-1", limit: 50 }),
  );
  assert.throws(
    () => assertBoundedPagination({ programmeId: "programme-1", limit: 51 }),
    /limit from 1 to 50/,
  );
  assert.doesNotThrow(() =>
    assertPilotChargeTerm({
      code: "service",
      label: "Service fee",
      payer: "farmer",
      calculation: "percent_of_produce",
      rate: { numerator: 5, scale: 100, unit: "percent" },
    }),
  );
  assert.throws(
    () =>
      assertPilotChargeTerm({
        code: "service",
        label: "Service fee",
        payer: "farmer",
        calculation: "per_kg",
        rate: { numerator: 5, scale: 100, unit: "percent" },
      }),
    /do not match/,
  );
});

test("rejects missing terms and invalid windows", () => {
  assert.throws(
    () =>
      assertPilotRequestTerms({
        requestedGrams: 200_000,
        deliveryWindowStartAt: 2_000,
        deliveryWindowEndAt: 1_000,
        commercialMode: "coordination",
        requestedSpecification: specification,
        paymentExpectation: {
          trigger: "buyer_acceptance",
          offsetCalendarDays: 1,
          timezone: "Africa/Accra",
        },
      }),
    (error) =>
      error instanceof PilotValidationError && error.code === "INVALID_WINDOW",
  );
});
