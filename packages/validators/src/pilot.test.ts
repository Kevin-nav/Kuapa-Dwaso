import assert from "node:assert/strict";
import test from "node:test";
import {
  PilotValidationError,
  assertBoundedPagination,
  assertExpectedVersion,
  assertPilotChargeTerm,
  assertPilotFarmerPaymentCommitment,
  assertPilotLocation,
  assertPilotQuantityGrams,
  assertPilotRequestTerms,
  evaluatePilotInspectionQuality,
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

test("farmer payment deadlines never depend on buyer payment", () => {
  assert.doesNotThrow(() =>
    assertPilotFarmerPaymentCommitment("coordination", [
      {
        trigger: "fixed_date",
        offsetCalendarDays: 0,
        fixedDueAt: 2_000,
        timezone: "Africa/Accra",
      },
    ]),
  );
  assert.doesNotThrow(() =>
    assertPilotFarmerPaymentCommitment("kuapa_purchase", [
      {
        trigger: "purchase_collection_acceptance",
        offsetCalendarDays: 1,
        timezone: "Africa/Accra",
      },
    ]),
  );
  for (const trigger of ["buyer_acceptance", "cleared_buyer_funds"] as const) {
    assert.throws(
      () =>
        assertPilotFarmerPaymentCommitment("coordination", [
          { trigger, offsetCalendarDays: 1, timezone: "Africa/Accra" },
        ]),
      /cannot depend on buyer acceptance or cleared buyer funds/,
    );
  }
});

test("requires a named location and bounded integer microdegrees", () => {
  assert.doesNotThrow(() =>
    assertPilotLocation({
      label: "Buyer collection point",
      latitudeE6: 5_603_717,
      longitudeE6: -186_964,
    }),
  );
  assert.throws(() => assertPilotLocation({ label: "  " }), /label/);
  assert.throws(
    () => assertPilotLocation({ label: "Farm", latitudeE6: 90_000_001 }),
    /microdegrees/,
  );
});

const completeInspection = {
  specification,
  grossWeightGrams: 205_000,
  tareWeightGrams: 5_000,
  acceptedGrams: 200_000,
  rejectedGrams: 0,
  moisturePermille: 120,
  contaminationResult: "passed" as const,
  additionalReadings: [
    {
      code: "aflatoxin",
      label: "Aflatoxin test",
      value: "sample pass",
      passed: true,
    },
  ],
  evidenceCount: 1,
};

test("derives passed, partial, failed, and pending inspection states", () => {
  assert.deepEqual(evaluatePilotInspectionQuality(completeInspection), {
    measuredGrams: 200_000,
    qualityStatus: "passed",
    missingRequiredResults: [],
  });
  assert.equal(
    evaluatePilotInspectionQuality({
      ...completeInspection,
      acceptedGrams: 180_000,
      rejectedGrams: 20_000,
    }).qualityStatus,
    "partial",
  );
  assert.equal(
    evaluatePilotInspectionQuality({
      ...completeInspection,
      acceptedGrams: 0,
      rejectedGrams: 200_000,
      moisturePermille: 140,
    }).qualityStatus,
    "failed",
  );
  assert.deepEqual(
    evaluatePilotInspectionQuality({
      ...completeInspection,
      acceptedGrams: 0,
      evidenceCount: 0,
    }),
    {
      measuredGrams: 200_000,
      qualityStatus: "pending",
      missingRequiredResults: ["evidence"],
    },
  );
  assert.deepEqual(
    evaluatePilotInspectionQuality({
      ...completeInspection,
      acceptedGrams: 0,
      contaminationResult: "not_recorded",
      additionalReadings: [],
    }).missingRequiredResults,
    ["contamination", "aflatoxin"],
  );
});

test("rejects impossible inspection weights and premature clearance", () => {
  assert.throws(
    () =>
      evaluatePilotInspectionQuality({
        ...completeInspection,
        tareWeightGrams: 205_000,
      }),
    /Gross weight/,
  );
  assert.throws(
    () =>
      evaluatePilotInspectionQuality({
        ...completeInspection,
        acceptedGrams: 199_999,
      }),
    /reconcile exactly/,
  );
  assert.throws(
    () =>
      evaluatePilotInspectionQuality({
        ...completeInspection,
        evidenceCount: 0,
      }),
    /Pending inspections cannot clear/,
  );
});
