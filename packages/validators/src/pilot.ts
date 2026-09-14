import {
  datasetProvenances,
  pilotCommercialModes,
  type BoundedPageInput,
  type DatasetProvenance,
  type PilotChargeTerm,
  type PilotCommercialMode,
  type PilotAdditionalReading,
  type PilotLocation,
  type PilotMaizeSpecification,
  type PilotPaymentTerm,
  type PilotQualityStatus,
  type PilotRate,
} from "@kuapa-dwaso/types/pilot";

export type PilotValidationErrorCode =
  | "INVALID_INTEGER"
  | "INVALID_QUANTITY"
  | "INVALID_MONEY"
  | "INVALID_RATE"
  | "INVALID_WINDOW"
  | "INVALID_REVISION"
  | "INVALID_PAGINATION"
  | "INVALID_MODE"
  | "INVALID_LOCATION"
  | "INVALID_INSPECTION"
  | "INVALID_SPECIFICATION"
  | "INVALID_PAYMENT_TERM"
  | "INVALID_CHARGE_TERM";

export class PilotValidationError extends Error {
  readonly code: PilotValidationErrorCode;

  constructor(code: PilotValidationErrorCode, message: string) {
    super(message);
    this.name = "PilotValidationError";
    this.code = code;
  }
}

function isOneOf<const Values extends readonly string[]>(
  values: Values,
  value: unknown,
): value is Values[number] {
  return typeof value === "string" && values.includes(value);
}

export function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function isPositiveInteger(value: unknown): value is number {
  return isSafeInteger(value) && value > 0;
}

export function isNonNegativeInteger(value: unknown): value is number {
  return isSafeInteger(value) && value >= 0;
}

export function isDatasetProvenance(
  value: unknown,
): value is DatasetProvenance {
  return isOneOf(datasetProvenances, value);
}

export function isPilotCommercialMode(
  value: unknown,
): value is PilotCommercialMode {
  return isOneOf(pilotCommercialModes, value);
}

export function assertPilotLocation(
  value: unknown,
): asserts value is PilotLocation {
  if (typeof value !== "object" || value === null) {
    throw new PilotValidationError(
      "INVALID_LOCATION",
      "Collection or delivery location is required.",
    );
  }
  const location = value as Partial<PilotLocation>;
  if (
    typeof location.label !== "string" ||
    location.label.trim().length === 0
  ) {
    throw new PilotValidationError(
      "INVALID_LOCATION",
      "Location label is required.",
    );
  }
  if (
    (location.latitudeE6 !== undefined &&
      (!isSafeInteger(location.latitudeE6) ||
        location.latitudeE6 < -90_000_000 ||
        location.latitudeE6 > 90_000_000)) ||
    (location.longitudeE6 !== undefined &&
      (!isSafeInteger(location.longitudeE6) ||
        location.longitudeE6 < -180_000_000 ||
        location.longitudeE6 > 180_000_000))
  ) {
    throw new PilotValidationError(
      "INVALID_LOCATION",
      "Location coordinates must be valid integer microdegrees.",
    );
  }
}

export function assertPilotQuantityGrams(
  value: unknown,
  fieldName = "quantityGrams",
): asserts value is number {
  if (!isPositiveInteger(value)) {
    throw new PilotValidationError(
      "INVALID_QUANTITY",
      `${fieldName} must be a positive integer number of grams.`,
    );
  }
}

export type PilotInspectionQualityInput = {
  specification: PilotMaizeSpecification;
  grossWeightGrams: unknown;
  tareWeightGrams: unknown;
  acceptedGrams: unknown;
  rejectedGrams: unknown;
  moisturePermille?: unknown;
  contaminationResult: "passed" | "failed" | "not_recorded";
  additionalReadings: PilotAdditionalReading[];
  evidenceCount: number;
};

export type PilotInspectionQualityResult = {
  measuredGrams: number;
  qualityStatus: Exclude<PilotQualityStatus, "superseded">;
  missingRequiredResults: string[];
};

export function evaluatePilotInspectionQuality(
  input: PilotInspectionQualityInput,
): PilotInspectionQualityResult {
  assertPilotMaizeSpecification(input.specification);
  if (
    !isPositiveInteger(input.grossWeightGrams) ||
    !isNonNegativeInteger(input.tareWeightGrams) ||
    input.tareWeightGrams >= input.grossWeightGrams
  ) {
    throw new PilotValidationError(
      "INVALID_INSPECTION",
      "Gross weight must be positive and greater than the non-negative tare weight.",
    );
  }
  if (
    !isNonNegativeInteger(input.acceptedGrams) ||
    !isNonNegativeInteger(input.rejectedGrams)
  ) {
    throw new PilotValidationError(
      "INVALID_INSPECTION",
      "Accepted and rejected weights must be non-negative integer grams.",
    );
  }
  const measuredGrams = input.grossWeightGrams - input.tareWeightGrams;
  const classifiedGrams = input.acceptedGrams + input.rejectedGrams;
  if (classifiedGrams !== 0 && classifiedGrams !== measuredGrams) {
    throw new PilotValidationError(
      "INVALID_INSPECTION",
      "Accepted and rejected weights must reconcile exactly to net measured weight.",
    );
  }
  const missingRequiredResults: string[] = [];
  let hasFailure = false;
  const readingCodes = new Set<string>();
  for (const reading of input.additionalReadings) {
    if (
      reading.code.trim().length === 0 ||
      reading.label.trim().length === 0 ||
      reading.value.trim().length === 0 ||
      readingCodes.has(reading.code)
    ) {
      throw new PilotValidationError(
        "INVALID_INSPECTION",
        "Additional readings require unique codes, labels, and recorded values.",
      );
    }
    readingCodes.add(reading.code);
    if (reading.passed === false) hasFailure = true;
  }
  const moistureMaximum = input.specification.moistureMaximumPermille;
  if (moistureMaximum !== undefined) {
    if (!isNonNegativeInteger(input.moisturePermille)) {
      missingRequiredResults.push("moisture");
    } else if (input.moisturePermille > moistureMaximum) {
      hasFailure = true;
    }
  } else if (
    input.moisturePermille !== undefined &&
    (!isNonNegativeInteger(input.moisturePermille) ||
      input.moisturePermille > 1000)
  ) {
    throw new PilotValidationError(
      "INVALID_INSPECTION",
      "Moisture must be an integer from 0 to 1000 permille.",
    );
  }
  if (input.specification.contaminationCheckRequired) {
    if (input.contaminationResult === "not_recorded") {
      missingRequiredResults.push("contamination");
    } else if (input.contaminationResult === "failed") {
      hasFailure = true;
    }
  } else if (input.contaminationResult === "failed") {
    hasFailure = true;
  }
  const readings = new Map(
    input.additionalReadings.map((reading) => [reading.code, reading]),
  );
  for (const criterion of input.specification.additionalCriteria) {
    if (!criterion.required) continue;
    const reading = readings.get(criterion.code);
    if (reading === undefined || reading.passed === undefined) {
      missingRequiredResults.push(criterion.code);
    } else if (!reading.passed) {
      hasFailure = true;
    }
  }
  if (!isNonNegativeInteger(input.evidenceCount)) {
    throw new PilotValidationError(
      "INVALID_INSPECTION",
      "Evidence count must be a non-negative integer.",
    );
  }
  if (input.evidenceCount === 0) missingRequiredResults.push("evidence");
  if (missingRequiredResults.length > 0) {
    if (classifiedGrams !== 0) {
      throw new PilotValidationError(
        "INVALID_INSPECTION",
        "Pending inspections cannot clear or reject quantity until required results and evidence exist.",
      );
    }
    return { measuredGrams, qualityStatus: "pending", missingRequiredResults };
  }
  if (input.acceptedGrams > 0 && input.rejectedGrams > 0) {
    return { measuredGrams, qualityStatus: "partial", missingRequiredResults };
  }
  if (hasFailure) {
    if (input.acceptedGrams !== 0 || input.rejectedGrams !== measuredGrams) {
      throw new PilotValidationError(
        "INVALID_INSPECTION",
        "A failed whole-lot inspection must reject the full net weight.",
      );
    }
    return { measuredGrams, qualityStatus: "failed", missingRequiredResults };
  }
  if (input.acceptedGrams !== measuredGrams || input.rejectedGrams !== 0) {
    throw new PilotValidationError(
      "INVALID_INSPECTION",
      "A passing whole-lot inspection must clear the full net weight; use identified sublots for a partial result.",
    );
  }
  return { measuredGrams, qualityStatus: "passed", missingRequiredResults };
}

export function assertPilotMoneyPesewas(
  value: unknown,
  fieldName = "amountPesewas",
): asserts value is number {
  if (!isNonNegativeInteger(value)) {
    throw new PilotValidationError(
      "INVALID_MONEY",
      `${fieldName} must be a non-negative integer number of pesewas.`,
    );
  }
}

export function assertExpectedVersion(value: unknown): asserts value is number {
  if (!isNonNegativeInteger(value)) {
    throw new PilotValidationError(
      "INVALID_REVISION",
      "expectedVersion must be a non-negative integer.",
    );
  }
}

export function assertPilotWindow(
  startAt: unknown,
  endAt: unknown,
  fieldName = "window",
): void {
  if (!isSafeInteger(startAt) || !isSafeInteger(endAt) || startAt >= endAt) {
    throw new PilotValidationError(
      "INVALID_WINDOW",
      `${fieldName} start must be before its end.`,
    );
  }
}

export function assertPilotRate(value: unknown): asserts value is PilotRate {
  if (typeof value !== "object" || value === null) {
    throw new PilotValidationError("INVALID_RATE", "Rate is required.");
  }
  const rate = value as Partial<PilotRate>;
  if (!isNonNegativeInteger(rate.numerator) || !isPositiveInteger(rate.scale)) {
    throw new PilotValidationError(
      "INVALID_RATE",
      "Rate numerator must be non-negative and scale must be positive integers.",
    );
  }
  if (
    rate.unit !== "per_kg" &&
    rate.unit !== "percent" &&
    rate.unit !== "fixed"
  ) {
    throw new PilotValidationError(
      "INVALID_RATE",
      "Rate unit must be per_kg, percent, or fixed.",
    );
  }
}

export function assertPilotPaymentTerm(
  value: unknown,
): asserts value is PilotPaymentTerm {
  if (typeof value !== "object" || value === null) {
    throw new PilotValidationError(
      "INVALID_PAYMENT_TERM",
      "Payment term is required.",
    );
  }
  const term = value as Partial<PilotPaymentTerm>;
  const validTrigger =
    term.trigger === "buyer_acceptance" ||
    term.trigger === "cleared_buyer_funds" ||
    term.trigger === "purchase_collection_acceptance" ||
    term.trigger === "fixed_date";
  if (
    !validTrigger ||
    !isNonNegativeInteger(term.offsetCalendarDays) ||
    term.timezone !== "Africa/Accra"
  ) {
    throw new PilotValidationError(
      "INVALID_PAYMENT_TERM",
      "Payment term has an invalid trigger, offset, or timezone.",
    );
  }
  if (term.trigger === "fixed_date" && !isSafeInteger(term.fixedDueAt)) {
    throw new PilotValidationError(
      "INVALID_PAYMENT_TERM",
      "A fixed-date payment term requires fixedDueAt.",
    );
  }
  if (term.trigger !== "fixed_date" && term.fixedDueAt !== undefined) {
    throw new PilotValidationError(
      "INVALID_PAYMENT_TERM",
      "fixedDueAt is allowed only for a fixed-date payment term.",
    );
  }
}

export function assertPilotFarmerPaymentCommitment(
  commercialMode: PilotCommercialMode,
  paymentTerms: readonly PilotPaymentTerm[],
): void {
  if (paymentTerms.length !== 1) {
    throw new PilotValidationError(
      "INVALID_PAYMENT_TERM",
      "A farmer offer requires one payment deadline.",
    );
  }
  const term = paymentTerms[0];
  assertPilotPaymentTerm(term);
  const triggerIsIndependentOfBuyerPayment =
    term.trigger === "fixed_date" ||
    (commercialMode === "kuapa_purchase" &&
      term.trigger === "purchase_collection_acceptance");
  if (!triggerIsIndependentOfBuyerPayment) {
    throw new PilotValidationError(
      "INVALID_PAYMENT_TERM",
      "Farmer payment cannot depend on buyer acceptance or cleared buyer funds.",
    );
  }
}

export function assertPilotMaizeSpecification(
  value: unknown,
): asserts value is PilotMaizeSpecification {
  if (typeof value !== "object" || value === null) {
    throw new PilotValidationError(
      "INVALID_SPECIFICATION",
      "Maize specification is required.",
    );
  }
  const specification = value as Partial<PilotMaizeSpecification>;
  if (
    typeof specification.maizeType !== "string" ||
    specification.maizeType.trim().length === 0
  ) {
    throw new PilotValidationError(
      "INVALID_SPECIFICATION",
      "Maize type is required.",
    );
  }
  if (
    specification.moistureMaximumPermille !== undefined &&
    (!isNonNegativeInteger(specification.moistureMaximumPermille) ||
      specification.moistureMaximumPermille > 1000)
  ) {
    throw new PilotValidationError(
      "INVALID_SPECIFICATION",
      "Moisture maximum must be an integer from 0 to 1000 permille.",
    );
  }
  if (
    typeof specification.contaminationCheckRequired !== "boolean" ||
    !isDatasetProvenance(specification.policyProvenance) ||
    !Array.isArray(specification.additionalCriteria)
  ) {
    throw new PilotValidationError(
      "INVALID_SPECIFICATION",
      "Specification policy, contamination rule, and criteria are required.",
    );
  }
  const codes = new Set<string>();
  for (const criterion of specification.additionalCriteria) {
    if (
      typeof criterion !== "object" ||
      criterion === null ||
      typeof criterion.code !== "string" ||
      criterion.code.trim().length === 0 ||
      typeof criterion.label !== "string" ||
      criterion.label.trim().length === 0 ||
      typeof criterion.required !== "boolean" ||
      codes.has(criterion.code)
    ) {
      throw new PilotValidationError(
        "INVALID_SPECIFICATION",
        "Specification criteria need unique codes, labels, and required flags.",
      );
    }
    codes.add(criterion.code);
  }
}

export function assertPilotChargeTerm(
  value: unknown,
): asserts value is PilotChargeTerm {
  if (typeof value !== "object" || value === null) {
    throw new PilotValidationError(
      "INVALID_CHARGE_TERM",
      "Charge term is required.",
    );
  }
  const term = value as Partial<PilotChargeTerm>;
  if (
    typeof term.code !== "string" ||
    term.code.trim().length === 0 ||
    typeof term.label !== "string" ||
    term.label.trim().length === 0
  ) {
    throw new PilotValidationError(
      "INVALID_CHARGE_TERM",
      "Charge term code and label are required.",
    );
  }
  if (
    term.payer !== "buyer" &&
    term.payer !== "farmer" &&
    term.payer !== "kuapa_dwaso"
  ) {
    throw new PilotValidationError(
      "INVALID_CHARGE_TERM",
      "Every charge must name a valid payer.",
    );
  }
  const expectedUnit =
    term.calculation === "fixed"
      ? "fixed"
      : term.calculation === "per_kg"
        ? "per_kg"
        : term.calculation === "percent_of_produce"
          ? "percent"
          : undefined;
  assertPilotRate(term.rate);
  if (expectedUnit === undefined || term.rate.unit !== expectedUnit) {
    throw new PilotValidationError(
      "INVALID_CHARGE_TERM",
      "Charge calculation and rate unit do not match.",
    );
  }
}

export function assertBoundedPagination(
  value: unknown,
): asserts value is BoundedPageInput {
  if (typeof value !== "object" || value === null) {
    throw new PilotValidationError(
      "INVALID_PAGINATION",
      "Pagination input is required.",
    );
  }
  const input = value as Partial<BoundedPageInput>;
  if (
    typeof input.programmeId !== "string" ||
    input.programmeId.length === 0 ||
    !isPositiveInteger(input.limit) ||
    input.limit > 50 ||
    (input.cursor !== undefined && typeof input.cursor !== "string")
  ) {
    throw new PilotValidationError(
      "INVALID_PAGINATION",
      "Pagination requires a programme, a limit from 1 to 50, and an optional cursor.",
    );
  }
}

export function assertPilotRequestTerms(input: {
  requestedGrams: unknown;
  deliveryWindowStartAt: unknown;
  deliveryWindowEndAt: unknown;
  commercialMode: unknown;
  requestedSpecification: unknown;
  paymentExpectation: unknown;
}): void {
  assertPilotQuantityGrams(input.requestedGrams, "requestedGrams");
  assertPilotWindow(
    input.deliveryWindowStartAt,
    input.deliveryWindowEndAt,
    "deliveryWindow",
  );
  if (!isPilotCommercialMode(input.commercialMode)) {
    throw new PilotValidationError(
      "INVALID_MODE",
      "Commercial mode must be coordination or kuapa_purchase.",
    );
  }
  assertPilotMaizeSpecification(input.requestedSpecification);
  assertPilotPaymentTerm(input.paymentExpectation);
}
