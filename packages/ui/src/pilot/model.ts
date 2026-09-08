export type QuantityStage = "requested" | "committed" | "cleared" | "delivered";

export type QuantityProgressValue = {
  stage: QuantityStage;
  grams: number;
};

export function validateQuantityProgress(
  values: readonly QuantityProgressValue[],
): void {
  const seen = new Set<QuantityStage>();
  for (const value of values) {
    if (seen.has(value.stage))
      throw new Error(`Quantity stage ${value.stage} is duplicated.`);
    if (!Number.isSafeInteger(value.grams) || value.grams < 0) {
      throw new Error(
        `Quantity stage ${value.stage} must use non-negative safe integer grams.`,
      );
    }
    seen.add(value.stage);
  }
}

export function quantityPercent(grams: number, requestedGrams: number): number {
  if (
    !Number.isSafeInteger(grams) ||
    grams < 0 ||
    !Number.isSafeInteger(requestedGrams) ||
    requestedGrams <= 0
  )
    return 0;
  return Math.min(100, Math.round((grams / requestedGrams) * 100));
}

export function formatPilotQuantity(grams: number): string {
  if (!Number.isSafeInteger(grams) || grams < 0)
    throw new Error("Quantity must use non-negative safe integer grams.");
  return `${new Intl.NumberFormat("en-GH", { maximumFractionDigits: 3 }).format(grams / 1_000)} kg`;
}

export function formatPilotMoney(pesewas: number): string {
  if (!Number.isSafeInteger(pesewas))
    throw new Error("Money must use safe integer pesewas.");
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
  }).format(pesewas / 100);
}

export type PilotEventSource =
  | "live"
  | "mock_payment"
  | "mock_sms"
  | "sample_manual_inspection";

export function pilotEventSourceLabel(
  source: PilotEventSource,
): string | undefined {
  if (source === "mock_payment") return "Mock payment";
  if (source === "mock_sms") return "Mock SMS";
  if (source === "sample_manual_inspection")
    return "Manually entered sample inspection";
  return undefined;
}
