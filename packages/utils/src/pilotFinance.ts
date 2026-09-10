import type { PilotPaymentTerm } from "@kuapa-dwaso/types/pilot";

function assertTimestamp(value: number, fieldName: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative safe integer timestamp.`);
  }
}

/**
 * Resolves the inclusive payment deadline stored on a pilot obligation.
 * Africa/Accra has a UTC offset of zero, so UTC calendar fields are its local
 * calendar fields. The fixed-date form already contains its agreed instant.
 */
export function pilotPaymentDueAt(
  term: PilotPaymentTerm,
  triggerAt: number,
): number {
  assertTimestamp(triggerAt, "triggerAt");
  if (term.timezone !== "Africa/Accra") {
    throw new Error("Pilot payment deadlines require Africa/Accra time.");
  }
  if (
    !Number.isSafeInteger(term.offsetCalendarDays) ||
    term.offsetCalendarDays < 0
  ) {
    throw new Error("Payment offsetCalendarDays must be a non-negative integer.");
  }
  if (term.trigger === "fixed_date") {
    if (term.fixedDueAt === undefined) {
      throw new Error("A fixed-date payment term requires fixedDueAt.");
    }
    assertTimestamp(term.fixedDueAt, "fixedDueAt");
    return term.fixedDueAt;
  }
  if (term.fixedDueAt !== undefined) {
    throw new Error("Only a fixed-date payment term may define fixedDueAt.");
  }
  const trigger = new Date(triggerAt);
  const dueAt =
    Date.UTC(
      trigger.getUTCFullYear(),
      trigger.getUTCMonth(),
      trigger.getUTCDate() + term.offsetCalendarDays + 1,
    ) - 1;
  assertTimestamp(dueAt, "dueAt");
  return dueAt;
}

export function pilotObligationStatus(input: {
  amountPesewas: number;
  settledPesewas: number;
  reversedPesewas: number;
  dueAt?: number;
  now: number;
  disputed?: boolean;
}): {
  status: "due" | "partly_paid" | "paid" | "overdue" | "disputed";
  outstandingPesewas: number;
} {
  for (const [fieldName, value] of Object.entries({
    amountPesewas: input.amountPesewas,
    settledPesewas: input.settledPesewas,
    reversedPesewas: input.reversedPesewas,
    now: input.now,
  })) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${fieldName} must be a non-negative safe integer.`);
    }
  }
  if (input.dueAt !== undefined) assertTimestamp(input.dueAt, "dueAt");
  if (input.settledPesewas + input.reversedPesewas > input.amountPesewas) {
    throw new Error("Settlements and reversals exceed the obligation amount.");
  }
  const outstandingPesewas =
    input.amountPesewas - input.settledPesewas - input.reversedPesewas;
  if (input.disputed === true) return { status: "disputed", outstandingPesewas };
  if (outstandingPesewas === 0) return { status: "paid", outstandingPesewas };
  if (input.dueAt !== undefined && input.now > input.dueAt)
    return { status: "overdue", outstandingPesewas };
  if (input.settledPesewas > 0)
    return { status: "partly_paid", outstandingPesewas };
  return { status: "due", outstandingPesewas };
}

export function pilotActualContribution(input: {
  buyerProducePesewas: number;
  buyerTransportPesewas: number;
  farmerPayablesPesewas: number;
  operatingCostPesewas: number;
  costsComplete: boolean;
}):
  | { status: "complete"; amountPesewas: number }
  | { status: "incomplete" } {
  for (const [fieldName, value] of Object.entries({
    buyerProducePesewas: input.buyerProducePesewas,
    buyerTransportPesewas: input.buyerTransportPesewas,
    farmerPayablesPesewas: input.farmerPayablesPesewas,
    operatingCostPesewas: input.operatingCostPesewas,
  })) {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error(`${fieldName} must be a non-negative safe integer.`);
  }
  if (!input.costsComplete) return { status: "incomplete" };
  return {
    status: "complete",
    amountPesewas:
      input.buyerProducePesewas +
      input.buyerTransportPesewas -
      input.farmerPayablesPesewas -
      input.operatingCostPesewas,
  };
}
