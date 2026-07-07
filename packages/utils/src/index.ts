import type {
  FeeCalculationType,
  FeePayer,
  FeeRuleSnapshot,
  InventoryBatchStatus,
  InventoryReservationStatus,
  PlatformInvitationStatus,
  SmsDeliveryStatus,
  UploadAssetPurpose,
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
  const soldOrFulfilled = batch.quantityAvailable === undefined ? (batch.fulfilledSaleQuantity ?? 0) : 0;
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

export type FarmerSaleDeductionCalculationInput = {
  snapshot: FeeRuleSnapshot;
  quantity: number;
  grossSaleAmount: number;
  transportCost?: number;
};

export type FarmerSaleDeductionCalculation = {
  label: string;
  amount: number;
  appliedRuleSnapshot: FeeRuleSnapshot;
};

export function calculateFarmerSaleDeductions(
  inputs: readonly FarmerSaleDeductionCalculationInput[],
): FarmerSaleDeductionCalculation[] {
  return inputs
    .filter((input) => input.snapshot.payer === "farmer" || input.snapshot.payer === "shared")
    .filter((input) => {
      if (input.snapshot.calculationType === "per_unit_per_day") {
        return false;
      }
      if (input.snapshot.calculationType === "percentage_of_transport_cost") {
        return input.transportCost !== undefined;
      }
      return true;
    })
    .map((input) => {
      const calculationInput: {
        quantity: number;
        grossSaleAmount: number;
        transportCost?: number;
      } = {
        quantity: input.quantity,
        grossSaleAmount: input.grossSaleAmount,
      };

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

export type StorageFeeSettlementInput = {
  ledgerId: string;
  amount: number;
  amountAlreadyDeducted?: number;
};

export type StorageFeeSettlement = {
  ledgerId: string;
  amountDeducted: number;
  nextAmountDeducted: number;
  fullySettled: boolean;
};

export function allocateStorageFeeDeductions(
  ledgerEntries: readonly StorageFeeSettlementInput[],
  saleQuantity: number,
  sellableQuantityBeforeSale: number,
): StorageFeeSettlement[] {
  if (!Number.isFinite(saleQuantity) || saleQuantity <= 0) {
    throw new Error("Sale quantity must be a positive number.");
  }
  if (!Number.isFinite(sellableQuantityBeforeSale) || sellableQuantityBeforeSale <= 0) {
    throw new Error("Sellable quantity before sale must be a positive number.");
  }

  // Partial-batch sales settle the same share of each outstanding ledger entry as
  // the share of currently sellable inventory converted into this sale.
  const saleRatio = Math.min(1, saleQuantity / sellableQuantityBeforeSale);

  return ledgerEntries
    .map((entry) => {
      const alreadyDeducted = entry.amountAlreadyDeducted ?? 0;
      const outstandingAmount = roundMoneyAmount(entry.amount - alreadyDeducted);
      const amountDeducted = roundMoneyAmount(outstandingAmount * saleRatio);
      const nextAmountDeducted = roundMoneyAmount(alreadyDeducted + amountDeducted);

      return {
        ledgerId: entry.ledgerId,
        amountDeducted,
        nextAmountDeducted,
        fullySettled: nextAmountDeducted >= roundMoneyAmount(entry.amount),
      };
    })
    .filter((settlement) => settlement.amountDeducted > 0);
}

export type SaleNetAmountInput = {
  grossAmount: number;
  storageFeeDeducted?: number;
  handlingFeeDeducted?: number;
  commissionDeducted?: number;
  transportFeeDeducted?: number;
  adjustmentAmount?: number;
  decimalPlaces?: number;
};

export function calculateNetAmountDueToFarmer(input: SaleNetAmountInput): number {
  const decimalPlaces = input.decimalPlaces ?? 2;
  return roundMoneyAmount(
    input.grossAmount -
      (input.storageFeeDeducted ?? 0) -
      (input.handlingFeeDeducted ?? 0) -
      (input.commissionDeducted ?? 0) -
      (input.transportFeeDeducted ?? 0) +
      (input.adjustmentAmount ?? 0),
    decimalPlaces,
  );
}

export type DispatchQuantityLine = {
  warehouseId: string;
  destination: string;
  quantity: number;
  unit: string;
};

export type DispatchQuantityAggregation = {
  warehouseId: string;
  destination: string;
  totalQuantity: number;
  unit: string;
};

export function calculateDispatchQuantityAggregation(
  lines: readonly DispatchQuantityLine[],
): DispatchQuantityAggregation {
  const firstLine = lines[0];
  if (firstLine === undefined) {
    throw new Error("At least one dispatch quantity line is required.");
  }

  for (const line of lines) {
    if (line.warehouseId !== firstLine.warehouseId) {
      throw new Error("Dispatches must stay within one warehouse.");
    }
    if (line.destination !== firstLine.destination) {
      throw new Error("Dispatches must use one destination.");
    }
    if (line.unit !== firstLine.unit) {
      throw new Error("Dispatches must use one quantity unit.");
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error("Dispatch quantities must be positive numbers.");
    }
  }

  return {
    warehouseId: firstLine.warehouseId,
    destination: firstLine.destination,
    totalQuantity: roundMoneyAmount(
      lines.reduce((total, line) => total + line.quantity, 0),
      6,
    ),
    unit: firstLine.unit,
  };
}

export type DispatchTransportCostShare = {
  payer: FeePayer;
  buyerAmount: number;
  farmerAmount: number;
  platformAmount: number;
  includedInPriceAmount: number;
};

export function calculateDispatchTransportCostShare(
  transportCost: number | undefined,
  payer: FeePayer,
  decimalPlaces = 2,
): DispatchTransportCostShare {
  const cost = transportCost ?? 0;
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error("Transport cost must be a non-negative number.");
  }

  const roundedCost = roundMoneyAmount(cost, decimalPlaces);
  const emptyShare = {
    payer,
    buyerAmount: 0,
    farmerAmount: 0,
    platformAmount: 0,
    includedInPriceAmount: 0,
  };

  switch (payer) {
    case "buyer":
      return { ...emptyShare, buyerAmount: roundedCost };
    case "farmer":
      return { ...emptyShare, farmerAmount: roundedCost };
    case "platform":
      return { ...emptyShare, platformAmount: roundedCost };
    case "included_in_price":
      return { ...emptyShare, includedInPriceAmount: roundedCost };
    case "shared": {
      const buyerAmount = roundMoneyAmount(roundedCost / 2, decimalPlaces);
      return {
        ...emptyShare,
        buyerAmount,
        farmerAmount: roundMoneyAmount(roundedCost - buyerAmount, decimalPlaces),
      };
    }
  }
}

export const defaultInviteTtlMs = 7 * 24 * 60 * 60 * 1000;
export const defaultUploadMaxSizeBytes = 8 * 1024 * 1024;

export function calculateInviteExpiry(
  createdAt: number,
  ttlMs = defaultInviteTtlMs,
): number {
  if (!Number.isFinite(createdAt) || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("Invite expiry requires a valid timestamp and positive TTL.");
  }
  return createdAt + ttlMs;
}

export function resolveInvitationStatus(
  status: PlatformInvitationStatus,
  expiresAt: number,
  now = Date.now(),
): PlatformInvitationStatus {
  if (status === "pending" && expiresAt <= now) {
    return "expired";
  }
  return status;
}

export function assertInvitationCanBeAccepted(input: {
  status: PlatformInvitationStatus;
  expiresAt: number;
  now?: number;
}): void {
  const effectiveStatus = resolveInvitationStatus(input.status, input.expiresAt, input.now);
  if (effectiveStatus !== "pending") {
    throw new Error("Invitation is not pending.");
  }
}

export function normalizeEmailAddress(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    throw new Error("Email address is invalid.");
  }
  return normalized;
}

export function normalizePhoneNumber(phoneNumber: string): string {
  const normalized = phoneNumber.trim().replace(/[^\d+]/g, "");
  if (normalized.length < 8) {
    throw new Error("Phone number is invalid.");
  }
  return normalized;
}

export function normalizeE164PhoneNumber(phoneNumber: string): string {
  const compact = phoneNumber.trim().replace(/[\s().-]/g, "");
  const digitsOnly = compact.replace(/\D/g, "");
  let normalized: string;

  if (/^0\d{9}$/.test(digitsOnly)) {
    normalized = `+233${digitsOnly.slice(1)}`;
  } else if (/^233\d{9}$/.test(digitsOnly)) {
    normalized = `+${digitsOnly}`;
  } else if (compact.startsWith("+")) {
    normalized = `+${digitsOnly}`;
  } else {
    throw new Error("Phone number must be in E.164 format.");
  }

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Phone number must be in E.164 format.");
  }

  return normalized;
}

export function normalizeGhanaPhoneNumber(phoneNumber: string): string {
  const normalized = normalizeE164PhoneNumber(phoneNumber);
  if (!/^\+233\d{9}$/.test(normalized)) {
    throw new Error("Ghana phone number must use +233 followed by 9 digits.");
  }
  return normalized;
}

export function assertInviteTargetMatchesIdentity(input: {
  targetEmail?: string;
  targetPhoneNumber?: string;
  identityEmail?: string;
  identityPhoneNumber?: string;
}): void {
  if (input.targetEmail !== undefined) {
    if (input.identityEmail === undefined || normalizeEmailAddress(input.targetEmail) !== normalizeEmailAddress(input.identityEmail)) {
      throw new Error("Invitation email does not match the verified identity.");
    }
    return;
  }
  if (input.targetPhoneNumber !== undefined) {
    if (input.identityPhoneNumber === undefined || normalizePhoneNumber(input.targetPhoneNumber) !== normalizePhoneNumber(input.identityPhoneNumber)) {
      throw new Error("Invitation phone number does not match the verified identity.");
    }
    return;
  }
  throw new Error("Invitation target is required.");
}

export function buildUploadObjectKey(input: {
  environment: string;
  purpose: UploadAssetPurpose;
  ownerUserId: string;
  uploadAssetId: string;
  fileName?: string;
}): string {
  const safeEnvironment = normalizeCodeSegment(input.environment || "dev").toLowerCase();
  const safePurpose = normalizeCodeSegment(input.purpose).toLowerCase();
  const safeOwner = normalizeCodeSegment(input.ownerUserId).toLowerCase();
  const safeUpload = normalizeCodeSegment(input.uploadAssetId).toLowerCase();
  const extension = input.fileName?.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const suffix = extension === undefined || extension.length === 0 ? "" : `.${extension}`;
  return `${safeEnvironment}/${safePurpose}/${safeOwner}/${safeUpload}${suffix}`;
}

const gsm7BasicCharacters =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ" +
  "\u001b" +
  "ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const gsm7ExtensionCharacters = "^{}\\[~]|€";

export type SmsEncoding = "gsm-7" | "ucs-2";

export type SmsSegmentEstimate = {
  encoding: SmsEncoding;
  characterCount: number;
  encodedLength: number;
  segments: number;
  singleSegmentLimit: number;
  multipartSegmentLimit: number;
  credits: number;
  isMultipart: boolean;
};

export function estimateSmsSegments(message: string): SmsSegmentEstimate {
  const gsm7Length = countGsm7Units(message);
  if (gsm7Length !== undefined) {
    return buildSmsSegmentEstimate({
      encoding: "gsm-7",
      characterCount: [...message].length,
      encodedLength: gsm7Length,
      singleSegmentLimit: 160,
      multipartSegmentLimit: 153,
    });
  }

  return buildSmsSegmentEstimate({
    encoding: "ucs-2",
    characterCount: [...message].length,
    encodedLength: message.length,
    singleSegmentLimit: 70,
    multipartSegmentLimit: 67,
  });
}

export function normalizeSmsDeliveryStatus(status: string): SmsDeliveryStatus {
  switch (status.trim().toLowerCase()) {
    case "sent":
    case "submitted":
    case "success":
      return "sent";
    case "delivered":
    case "delivery_success":
      return "delivered";
    case "pending":
    case "queued":
    case "processing":
      return "pending";
    case "expired":
      return "expired";
    case "rejected":
    case "undeliverable":
      return "rejected";
    case "failed":
    case "failure":
    case "error":
      return "failed";
    default:
      return "failed";
  }
}

function countGsm7Units(message: string): number | undefined {
  let units = 0;
  for (const character of message) {
    if (gsm7BasicCharacters.includes(character)) {
      units += 1;
    } else if (gsm7ExtensionCharacters.includes(character)) {
      units += 2;
    } else {
      return undefined;
    }
  }
  return units;
}

function buildSmsSegmentEstimate(input: {
  encoding: SmsEncoding;
  characterCount: number;
  encodedLength: number;
  singleSegmentLimit: number;
  multipartSegmentLimit: number;
}): SmsSegmentEstimate {
  const segments =
    input.encodedLength === 0
      ? 0
      : input.encodedLength <= input.singleSegmentLimit
        ? 1
        : Math.ceil(input.encodedLength / input.multipartSegmentLimit);

  return {
    ...input,
    segments,
    credits: segments,
    isMultipart: segments > 1,
  };
}

export function assertUploadMetadata(input: {
  contentType: string;
  sizeBytes: number;
  maxSizeBytes?: number;
}): void {
  if (!["image/jpeg", "image/png", "image/webp"].includes(input.contentType)) {
    throw new Error("Only JPEG, PNG, and WebP image uploads are allowed.");
  }
  const maxSizeBytes = input.maxSizeBytes ?? defaultUploadMaxSizeBytes;
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > maxSizeBytes) {
    throw new Error("Upload size is outside the allowed range.");
  }
}
