import type {
  FeeCalculationType,
  FeeRuleSnapshot,
  InventoryBatchStatus,
  ProduceGrade,
} from "@kuapa-dwaso/types";

export function formatWorkspaceName(name: string): string {
  return name.trim();
}

export function nowTimestamp(): number {
  return Date.now();
}

export function roundMoneyAmount(amount: number, decimalPlaces = 2): number {
  if (!Number.isFinite(amount)) {
    throw new Error("Money amount must be a finite number.");
  }

  const multiplier = 10 ** decimalPlaces;
  return Math.round((amount + Number.EPSILON) * multiplier) / multiplier;
}

export type FeeCalculationInput = {
  calculationType: FeeCalculationType;
  amount?: number;
  percentage?: number;
  ratePerUnit?: number;
  ratePerUnitPerDay?: number;
  quantity?: number;
  days?: number;
  grossSaleAmount?: number;
  transportCost?: number;
  decimalPlaces?: number;
};

function requireFiniteNumber(value: number | undefined, label: string): number {
  if (value === undefined || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return value;
}

export function calculateFeeAmount(input: FeeCalculationInput): number {
  const decimalPlaces = input.decimalPlaces ?? 2;

  switch (input.calculationType) {
    case "fixed_amount":
      return roundMoneyAmount(requireFiniteNumber(input.amount, "Fixed fee amount"), decimalPlaces);
    case "per_unit":
      return roundMoneyAmount(
        requireFiniteNumber(input.ratePerUnit, "Rate per unit") *
          requireFiniteNumber(input.quantity, "Quantity"),
        decimalPlaces,
      );
    case "per_unit_per_day":
      return roundMoneyAmount(
        requireFiniteNumber(input.ratePerUnitPerDay, "Rate per unit per day") *
          requireFiniteNumber(input.quantity, "Quantity") *
          requireFiniteNumber(input.days, "Days"),
        decimalPlaces,
      );
    case "percentage_of_gross_sale":
      return roundMoneyAmount(
        requireFiniteNumber(input.grossSaleAmount, "Gross sale amount") *
          (requireFiniteNumber(input.percentage, "Percentage") / 100),
        decimalPlaces,
      );
    case "percentage_of_transport_cost":
      return roundMoneyAmount(
        requireFiniteNumber(input.transportCost, "Transport cost") *
          (requireFiniteNumber(input.percentage, "Percentage") / 100),
        decimalPlaces,
      );
  }
}

export function calculateFeeAmountFromSnapshot(
  snapshot: FeeRuleSnapshot,
  input: Omit<FeeCalculationInput, "calculationType" | "amount" | "percentage" | "ratePerUnit" | "ratePerUnitPerDay">,
): number {
  const calculationInput: FeeCalculationInput = {
    ...input,
    calculationType: snapshot.calculationType,
  };

  if (snapshot.amount !== undefined) {
    calculationInput.amount = snapshot.amount;
  }
  if (snapshot.percentage !== undefined) {
    calculationInput.percentage = snapshot.percentage;
  }
  if (snapshot.ratePerUnit !== undefined) {
    calculationInput.ratePerUnit = snapshot.ratePerUnit;
  }
  if (snapshot.ratePerUnitPerDay !== undefined) {
    calculationInput.ratePerUnitPerDay = snapshot.ratePerUnitPerDay;
  }

  return calculateFeeAmount(calculationInput);
}

export function normalizeCodeSegment(value: string | number): string {
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildReadableCode(prefix: string, value: string | number): string {
  const normalizedPrefix = normalizeCodeSegment(prefix);
  const normalizedValue = normalizeCodeSegment(value);

  if (normalizedPrefix.length === 0) {
    return normalizedValue;
  }

  if (normalizedValue.length === 0) {
    return normalizedPrefix;
  }

  return `${normalizedPrefix}-${normalizedValue}`;
}

export type WarehouseInventoryBatchSnapshot = {
  farmerId: string;
  warehouseId: string;
  cropType: string;
  quantityAvailable: number;
  unit: string;
  grade: ProduceGrade;
  askingPricePerUnit?: number;
  sellByDate?: number;
  status: InventoryBatchStatus;
};

export type WarehouseInventoryAggregation = {
  warehouseId: string;
  cropType: string;
  totalAvailableQuantity: number;
  unit: string;
  farmerCount: number;
  grade: ProduceGrade;
  priceRange?: {
    min: number;
    max: number;
  };
  earliestSellByDate?: number;
};

export const inventoryBatchStatusesVisibleToBuyers = [
  "available",
  "partially_reserved",
  "partially_sold",
] as const satisfies readonly InventoryBatchStatus[];

export const inventoryBatchStatusesEligibleForReservation = [
  "available",
  "partially_reserved",
  "partially_sold",
] as const satisfies readonly InventoryBatchStatus[];

export function isInventoryBatchBuyerVisible(
  status: InventoryBatchStatus,
): boolean {
  return inventoryBatchStatusesVisibleToBuyers.some(
    (visibleStatus) => visibleStatus === status,
  );
}

export function assertInventoryBatchCanBeReserved(
  batch: WarehouseInventoryBatchSnapshot,
): void {
  if (
    !inventoryBatchStatusesEligibleForReservation.some(
      (eligibleStatus) => eligibleStatus === batch.status,
    )
  ) {
    throw new Error("Only available warehouse inventory can be reserved.");
  }

  if (!Number.isFinite(batch.quantityAvailable) || batch.quantityAvailable <= 0) {
    throw new Error("Inventory batches must have positive available quantities.");
  }
}

export function calculateWarehouseInventoryAggregation(
  batches: WarehouseInventoryBatchSnapshot[],
  requestedGrade?: ProduceGrade,
): WarehouseInventoryAggregation {
  const firstBatch = batches[0];
  if (firstBatch === undefined) {
    throw new Error("At least one inventory batch is required.");
  }

  const warehouseId = firstBatch.warehouseId;
  const cropType = firstBatch.cropType;
  const unit = firstBatch.unit;

  for (const batch of batches) {
    if (batch.warehouseId !== warehouseId) {
      throw new Error("Inventory aggregation must stay within one warehouse.");
    }

    if (batch.cropType !== cropType) {
      throw new Error("Inventory aggregation must use one crop type.");
    }

    if (batch.unit !== unit) {
      throw new Error("Inventory aggregation must use one quantity unit.");
    }

    assertInventoryBatchCanBeReserved(batch);
  }

  const batchGrades = new Set(batches.map((batch) => batch.grade));
  const grade = requestedGrade ?? (batchGrades.size === 1 ? firstBatch.grade : "mixed");

  if (grade !== "mixed") {
    for (const batch of batches) {
      if (batch.grade !== grade) {
        throw new Error("A single-grade inventory aggregation can only contain matching grades.");
      }
    }
  }

  const prices = batches
    .map((batch) => batch.askingPricePerUnit)
    .filter((price): price is number => price !== undefined);
  const farmerIds = new Set(batches.map((batch) => batch.farmerId));
  const sellByDates = batches
    .map((batch) => batch.sellByDate)
    .filter((sellByDate): sellByDate is number => sellByDate !== undefined);

  const aggregation: WarehouseInventoryAggregation = {
    warehouseId,
    cropType,
    totalAvailableQuantity: batches.reduce(
      (total, batch) => total + batch.quantityAvailable,
      0,
    ),
    unit,
    farmerCount: farmerIds.size,
    grade,
  };

  if (prices.length > 0) {
    aggregation.priceRange = {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }

  if (sellByDates.length > 0) {
    aggregation.earliestSellByDate = Math.min(...sellByDates);
  }

  return aggregation;
}
