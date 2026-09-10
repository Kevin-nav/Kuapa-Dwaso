import type {
  PilotBagMeasurement,
  PilotChargeTerm,
  PilotOrderRef,
  PilotRate,
} from "@kuapa-dwaso/types/pilot";

const GRAMS_PER_KILOGRAM = 1_000;
const GRAMS_PER_TONNE = 1_000_000;

function assertSafeInteger(
  value: number,
  fieldName: string,
  allowZero: boolean,
): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    (!allowZero && value === 0)
  ) {
    throw new Error(
      `${fieldName} must be ${allowZero ? "a non-negative" : "a positive"} safe integer.`,
    );
  }
}

function toSafeNumber(value: bigint, fieldName: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${fieldName} exceeds the supported safe integer range.`);
  }
  return Number(value);
}

export function kilogramsToGrams(kilograms: number): number {
  if (!Number.isFinite(kilograms) || kilograms <= 0) {
    throw new Error("kilograms must be positive.");
  }
  const grams = kilograms * GRAMS_PER_KILOGRAM;
  if (!Number.isSafeInteger(grams)) {
    throw new Error(
      "kilograms must resolve to a whole, safe integer number of grams.",
    );
  }
  return grams;
}

export function tonnesToGrams(tonnes: number): number {
  if (!Number.isFinite(tonnes) || tonnes <= 0) {
    throw new Error("tonnes must be positive.");
  }
  const grams = tonnes * GRAMS_PER_TONNE;
  if (!Number.isSafeInteger(grams)) {
    throw new Error(
      "tonnes must resolve to a whole, safe integer number of grams.",
    );
  }
  return grams;
}

export function bagsToGrams(bagCount: number, gramsPerBag: number): number {
  assertSafeInteger(bagCount, "bagCount", false);
  assertSafeInteger(gramsPerBag, "gramsPerBag", false);
  return toSafeNumber(BigInt(bagCount) * BigInt(gramsPerBag), "bag weight");
}

export function createPilotBagMeasurement(input: {
  bagCount: number;
  declaredGramsPerBag: number;
  measuredTotalGrams?: number;
}): PilotBagMeasurement {
  const declaredTotalGrams = bagsToGrams(
    input.bagCount,
    input.declaredGramsPerBag,
  );
  if (input.measuredTotalGrams !== undefined) {
    assertSafeInteger(input.measuredTotalGrams, "measuredTotalGrams", false);
    return { ...input, declaredTotalGrams };
  }
  return {
    bagCount: input.bagCount,
    declaredGramsPerBag: input.declaredGramsPerBag,
    declaredTotalGrams,
  };
}

export function gramsToKilograms(grams: number): number {
  assertSafeInteger(grams, "grams", true);
  return grams / GRAMS_PER_KILOGRAM;
}

function roundHalfUpRatio(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) {
    throw new Error(
      "Rounding inputs must be non-negative with a positive denominator.",
    );
  }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return quotient + (remainder * 2n >= denominator ? 1n : 0n);
}

export type PilotExactAmount = {
  numerator: bigint;
  denominator: bigint;
};

export function getPilotExactAmount(input: {
  quantityGrams?: number;
  basisPesewas?: number;
  rate: PilotRate;
}): PilotExactAmount {
  assertSafeInteger(input.rate.numerator, "rate.numerator", true);
  assertSafeInteger(input.rate.scale, "rate.scale", false);
  const rateNumerator = BigInt(input.rate.numerator);
  const rateScale = BigInt(input.rate.scale);

  if (input.rate.unit === "per_kg") {
    if (input.quantityGrams === undefined)
      throw new Error("A per_kg rate requires quantityGrams.");
    assertSafeInteger(input.quantityGrams, "quantityGrams", true);
    return {
      numerator: BigInt(input.quantityGrams) * rateNumerator,
      denominator: BigInt(GRAMS_PER_KILOGRAM) * rateScale,
    };
  }

  if (input.rate.unit === "percent") {
    if (input.basisPesewas === undefined)
      throw new Error("A percent rate requires basisPesewas.");
    assertSafeInteger(input.basisPesewas, "basisPesewas", true);
    return {
      numerator: BigInt(input.basisPesewas) * rateNumerator,
      denominator: rateScale,
    };
  }

  return { numerator: rateNumerator, denominator: rateScale };
}

export function calculatePilotAmountPesewas(input: {
  quantityGrams?: number;
  basisPesewas?: number;
  rate: PilotRate;
}): number {
  const exact = getPilotExactAmount(input);
  return toSafeNumber(
    roundHalfUpRatio(exact.numerator, exact.denominator),
    "amountPesewas",
  );
}

export function calculatePilotOfferAmounts(input: {
  offeredGrams: number;
  priceRate: PilotRate;
  chargeTerms: readonly PilotChargeTerm[];
}): {
  expectedGrossPesewas: number;
  expectedChargesPesewas: number;
  expectedNetPesewas: number;
} {
  const expectedGrossPesewas = calculatePilotAmountPesewas({
    quantityGrams: input.offeredGrams,
    rate: input.priceRate,
  });
  const expectedChargesPesewas = input.chargeTerms
    .filter((term) => term.payer === "farmer")
    .reduce(
      (sum, term) =>
        sum +
        calculatePilotAmountPesewas({
          quantityGrams: input.offeredGrams,
          basisPesewas: expectedGrossPesewas,
          rate: term.rate,
        }),
      0,
    );
  if (expectedChargesPesewas > expectedGrossPesewas)
    throw new Error("Farmer charges cannot exceed expected gross proceeds.");
  return {
    expectedGrossPesewas,
    expectedChargesPesewas,
    expectedNetPesewas: expectedGrossPesewas - expectedChargesPesewas,
  };
}

export function pilotAllocationFits(input: {
  declaredGrams: number;
  activeAllocatedGrams: number;
  proposedGrams: number;
  replacingActiveGrams?: number;
}): boolean {
  assertSafeInteger(input.declaredGrams, "declaredGrams", true);
  assertSafeInteger(input.activeAllocatedGrams, "activeAllocatedGrams", true);
  assertSafeInteger(input.proposedGrams, "proposedGrams", false);
  const replacingActiveGrams = input.replacingActiveGrams ?? 0;
  assertSafeInteger(replacingActiveGrams, "replacingActiveGrams", true);
  if (replacingActiveGrams > input.activeAllocatedGrams)
    throw new Error("Replacement quantity exceeds active allocation.");
  return (
    input.activeAllocatedGrams - replacingActiveGrams + input.proposedGrams <=
    input.declaredGrams
  );
}

export type PilotReadinessBlocker =
  | "agreement_not_current"
  | "agreement_expired"
  | "cleared_quantity_shortfall"
  | "collection_window_invalid"
  | "delivery_window_invalid"
  | "driver_not_assigned"
  | "driver_not_eligible"
  | "vehicle_capacity_shortfall"
  | "financial_release_required"
  | "blocking_issue";

export function getPilotReadinessBlockers(input: {
  plannedGrams: number;
  clearedGrams: number;
  agreementCurrent: boolean;
  agreementExpiresAt: number;
  now: number;
  collectionWindowStartAt: number;
  collectionWindowEndAt: number;
  deliveryWindowStartAt: number;
  deliveryWindowEndAt: number;
  agreementDeliveryWindowStartAt: number;
  agreementDeliveryWindowEndAt: number;
  driverAssigned: boolean;
  driverEligible: boolean;
  vehicleCapacityGrams?: number;
  financialReleaseSatisfied: boolean;
  hasBlockingIssue: boolean;
}): PilotReadinessBlocker[] {
  assertSafeInteger(input.plannedGrams, "plannedGrams", false);
  assertSafeInteger(input.clearedGrams, "clearedGrams", true);
  const blockers: PilotReadinessBlocker[] = [];
  if (!input.agreementCurrent) blockers.push("agreement_not_current");
  if (input.agreementExpiresAt <= input.now) blockers.push("agreement_expired");
  if (input.clearedGrams < input.plannedGrams)
    blockers.push("cleared_quantity_shortfall");
  if (
    input.collectionWindowStartAt >= input.collectionWindowEndAt ||
    input.collectionWindowStartAt < input.now
  )
    blockers.push("collection_window_invalid");
  if (
    input.deliveryWindowStartAt >= input.deliveryWindowEndAt ||
    input.deliveryWindowStartAt < input.agreementDeliveryWindowStartAt ||
    input.deliveryWindowEndAt > input.agreementDeliveryWindowEndAt
  )
    blockers.push("delivery_window_invalid");
  if (!input.driverAssigned) blockers.push("driver_not_assigned");
  if (input.driverAssigned && !input.driverEligible)
    blockers.push("driver_not_eligible");
  if (
    input.vehicleCapacityGrams === undefined ||
    input.vehicleCapacityGrams < input.plannedGrams
  )
    blockers.push("vehicle_capacity_shortfall");
  if (!input.financialReleaseSatisfied)
    blockers.push("financial_release_required");
  if (input.hasBlockingIssue) blockers.push("blocking_issue");
  return blockers;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function leastCommonMultiple(left: bigint, right: bigint): bigint {
  return (left / greatestCommonDivisor(left, right)) * right;
}

export function reconcilePilotLineAmounts(
  lines: readonly { id: string; exact: PilotExactAmount }[],
): Array<{ id: string; amountPesewas: number }> {
  if (lines.length === 0) return [];
  const sorted = [...lines].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  for (const line of sorted) {
    if (
      line.id.length === 0 ||
      line.exact.numerator < 0n ||
      line.exact.denominator <= 0n
    ) {
      throw new Error(
        "Reconciliation lines need a stable ID and non-negative exact amount.",
      );
    }
  }

  const commonDenominator = sorted.reduce(
    (current, line) => leastCommonMultiple(current, line.exact.denominator),
    1n,
  );
  const aggregateNumerator = sorted.reduce(
    (total, line) =>
      total +
      line.exact.numerator * (commonDenominator / line.exact.denominator),
    0n,
  );
  const target = roundHalfUpRatio(aggregateNumerator, commonDenominator);
  const amounts = sorted.map((line) =>
    roundHalfUpRatio(line.exact.numerator, line.exact.denominator),
  );
  let delta = target - amounts.reduce((total, amount) => total + amount, 0n);
  let cursor = 0;
  while (delta !== 0n) {
    const index = cursor % amounts.length;
    const current = amounts[index];
    if (current === undefined)
      throw new Error("Reconciliation line disappeared.");
    if (delta > 0n) {
      amounts[index] = current + 1n;
      delta -= 1n;
    } else if (current > 0n) {
      amounts[index] = current - 1n;
      delta += 1n;
    }
    cursor += 1;
  }

  return sorted.map((line, index) => ({
    id: line.id,
    amountPesewas: toSafeNumber(amounts[index] ?? 0n, "amountPesewas"),
  }));
}

export function pilotPurchasingBudgetAvailablePesewas(input: {
  approvedCapacityPesewas: number;
  reservedPesewas: number;
  committedPesewas: number;
  spentPesewas: number;
}): number {
  for (const [fieldName, value] of [
    ["approvedCapacityPesewas", input.approvedCapacityPesewas],
    ["reservedPesewas", input.reservedPesewas],
    ["committedPesewas", input.committedPesewas],
    ["spentPesewas", input.spentPesewas],
  ] as const)
    assertSafeInteger(value, fieldName, true);
  const available =
    input.approvedCapacityPesewas -
    input.reservedPesewas -
    input.committedPesewas -
    input.spentPesewas;
  if (available < 0)
    throw new Error("Purchasing budget counters exceed approved capacity.");
  return available;
}

export function pilotOrderSource(
  orderRef: PilotOrderRef,
): "warehouse_run" | "pilot_request" {
  return orderRef.source;
}
