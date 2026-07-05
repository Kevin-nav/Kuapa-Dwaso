import type {
  FeeCalculationType,
  FeeRuleSnapshot,
  InventoryBatchStatus,
  InventoryReservationStatus,
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

export type ReservationQuantitySnapshot = {
  quantityReserved: number;
  quantityReleased?: number;
  quantityFulfilled?: number;
  status: InventoryReservationStatus;
};

export type ReservableInventoryBatch = {
  inventoryBatchId: string;
  quantityReceived: number;
  quantityAvailable?: number;
  fulfilledSaleQuantity?: number;
  reservations?: readonly ReservationQuantitySnapshot[];
  unit: string;
  askingPricePerUnit?: number;
  receivedAt?: number;
  sellByDate?: number;
};

export type InventoryReservationAllocation = {
  inventoryBatchId: string;
  quantityReserved: number;
};

export function calculateActiveReservedQuantity(
  reservations: readonly ReservationQuantitySnapshot[],
): number {
  return reservations
    .filter(
      (reservation) =>
        reservation.status === "active" ||
        reservation.status === "partially_released",
    )
    .reduce(
      (total, reservation) =>
        total +
        reservation.quantityReserved -
        (reservation.quantityReleased ?? 0) -
        (reservation.quantityFulfilled ?? 0),
      0,
    );
}

export function calculateReservableBatchQuantity(
  batch: ReservableInventoryBatch,
): number {
  const baselineAvailable = batch.quantityAvailable ?? batch.quantityReceived;
  const soldOrFulfilled = batch.fulfilledSaleQuantity ?? 0;
  const activeReserved = calculateActiveReservedQuantity(batch.reservations ?? []);

  return Math.max(0, baselineAvailable - soldOrFulfilled - activeReserved);
}

export function allocateInventoryReservations(
  batches: readonly ReservableInventoryBatch[],
  requestedQuantity: number,
): InventoryReservationAllocation[] {
  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
    throw new Error("Requested quantity must be a positive number.");
  }

  const allocations: InventoryReservationAllocation[] = [];
  let remainingQuantity = requestedQuantity;

  const sortedBatches = [...batches].sort((left, right) => {
    const leftSellBy = left.sellByDate ?? Number.POSITIVE_INFINITY;
    const rightSellBy = right.sellByDate ?? Number.POSITIVE_INFINITY;
    if (leftSellBy !== rightSellBy) {
      return leftSellBy - rightSellBy;
    }

    return (left.receivedAt ?? 0) - (right.receivedAt ?? 0);
  });

  for (const batch of sortedBatches) {
    if (remainingQuantity <= 0) {
      break;
    }

    const availableQuantity = calculateReservableBatchQuantity(batch);
    if (availableQuantity <= 0) {
      continue;
    }

    const quantityReserved = Math.min(availableQuantity, remainingQuantity);
    allocations.push({
      inventoryBatchId: batch.inventoryBatchId,
      quantityReserved,
    });
    remainingQuantity -= quantityReserved;
  }

  if (remainingQuantity > 0) {
    throw new Error("Requested quantity cannot be fully reserved from available inventory.");
  }

  return allocations;
}

export type BuyerChargeCalculationInput = {
  snapshot: FeeRuleSnapshot;
  quantity: number;
  grossSaleAmount?: number;
  transportCost?: number;
};

export type BuyerChargeCalculation = {
  label: string;
  amount: number;
  appliedRuleSnapshot: FeeRuleSnapshot;
};

export function calculateBuyerOrderCharges(
  inputs: readonly BuyerChargeCalculationInput[],
): BuyerChargeCalculation[] {
  return inputs
    .filter(
      (input) =>
        input.snapshot.payer === "buyer" ||
        input.snapshot.payer === "shared" ||
        input.snapshot.payer === "included_in_price",
    )
    .map((input) => {
      const calculationInput: {
        quantity: number;
        grossSaleAmount?: number;
        transportCost?: number;
      } = { quantity: input.quantity };

      if (input.grossSaleAmount !== undefined) {
        calculationInput.grossSaleAmount = input.grossSaleAmount;
      }
      if (input.transportCost !== undefined) {
        calculationInput.transportCost = input.transportCost;
      }

      return {
        label: input.snapshot.label,
        amount: calculateFeeAmountFromSnapshot(input.snapshot, calculationInput),
        appliedRuleSnapshot: input.snapshot,
      };
    });
}
