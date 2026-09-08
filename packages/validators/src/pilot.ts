import {
  datasetProvenances,
  pilotCommercialModes,
  type BoundedPageInput,
  type DatasetProvenance,
  type PilotChargeTerm,
  type PilotCommercialMode,
  type PilotMaizeSpecification,
  type PilotPaymentTerm,
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
