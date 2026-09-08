import type {
  BuyerOrderPaymentStatus,
  BuyerOrderStatus,
  FeeCalculationType,
  FeePayer,
  FeeRuleSnapshot,
  InventoryBatchStatus,
  InventoryReservationStatus,
  InvitationChannel,
  MarketDeliveryRunStatus,
  PlatformInvitationType,
  PlatformInvitationStatus,
  SmsDeliveryStatus,
  SmsMessageKind,
  SmsTemplateKey,
  UploadAssetPurpose,
  UploadRelatedEntityType,
  ProduceGrade,
} from "@kuapa-dwaso/types";

export function formatWorkspaceName(name: string): string {
  return name.trim();
}

export function nowTimestamp(): number {
  return Date.now();
}

export type AuthOperation =
  | "send-phone-code"
  | "verify-phone-code"
  | "sign-in"
  | "send-mfa-code"
  | "verify-mfa-code"
  | "enroll-mfa";

/**
 * KuapaDwaso's application-owned SMS verification window.
 * Firebase does not expose a browser-side expiry timestamp, so every web
 * surface enforces this same limit and requires a fresh challenge afterward.
 */
export const AUTH_CODE_VALIDITY_MS = 5 * 60 * 1000;

const authErrorMessages: Readonly<Record<string, string>> = {
  "auth/app-not-authorized": "This site is not authorized for phone verification. Please contact support.",
  "auth/billing-not-enabled": "SMS sign-in is not available for this service. Please contact support.",
  "auth/captcha-check-failed": "The security check could not be completed. Refresh the page and try again.",
  "auth/code-expired": "That verification code has expired. Request a new code and try again.",
  "auth/credential-already-in-use": "This sign-in method is already linked to another account.",
  "auth/email-already-exists": "An account already exists for this email. Sign in instead.",
  "auth/email-already-in-use": "An account already exists for this email. Sign in with its current password.",
  "auth/internal-error": "The phone verification service returned an error. Please try again in a few minutes.",
  "auth/invalid-app-credential": "The security check expired or was rejected. Refresh the page and try again.",
  "auth/invalid-credential": "The email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address and try again.",
  "auth/invalid-multi-factor-session": "This security check has expired. Start sign-in again.",
  "auth/invalid-phone-number": "Enter a complete, valid phone number and try again.",
  "auth/invalid-verification-code": "That verification code is incorrect. Check the code and try again.",
  "auth/maximum-second-factor-count-exceeded": "This account already has the maximum number of security methods.",
  "auth/missing-app-credential": "The security check did not complete. Refresh the page and try again.",
  "auth/missing-email": "Enter your email address to continue.",
  "auth/missing-multi-factor-info": "Choose a security method to continue.",
  "auth/missing-phone-number": "Enter a phone number to continue.",
  "auth/missing-verification-code": "Enter the complete verification code to continue.",
  "auth/multi-factor-info-not-found": "That security method is no longer available. Start sign-in again.",
  "auth/network-request-failed": "Check your internet connection and try again.",
  "auth/operation-not-allowed": "Phone sign-in is not enabled for this service. Please contact support.",
  "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups and try again.",
  "auth/popup-closed-by-user": "The sign-in window was closed before sign-in finished.",
  "auth/quota-exceeded": "The SMS sending limit has been reached. Please wait and try again later.",
  "auth/requires-recent-login": "For your security, sign in again before making this change.",
  "auth/session-expired": "This verification session has expired. Request a new code and try again.",
  "auth/too-many-requests": "Too many attempts were made. Wait a few minutes, then try again.",
  "auth/unauthorized-domain": "Phone verification is temporarily unavailable. Please try again later.",
  "auth/unsupported-first-factor": "That sign-in method cannot be used with this security check.",
  "auth/user-disabled": "This account has been disabled. Contact support if you think this is a mistake.",
  "auth/user-mismatch": "This security check belongs to a different account. Sign in again.",
  "auth/user-not-found": "The email or password is incorrect.",
  "auth/weak-password": "Choose a stronger password with at least six characters.",
  "auth/wrong-password": "The email or password is incorrect.",
};

export function getAuthErrorCode(error: unknown): string | undefined {
  let current = error;
  const visited = new Set<object>();

  while (typeof current === "object" && current !== null && !visited.has(current)) {
    visited.add(current);
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof candidate.code === "string" && candidate.code.startsWith("auth/")) {
      return candidate.code;
    }
    if (typeof candidate.message === "string") {
      const codeFromMessage = candidate.message.match(/auth\/[a-z0-9-]+/i)?.[0];
      if (codeFromMessage !== undefined) {
        return codeFromMessage.toLowerCase();
      }
    }
    current = candidate.cause;
  }

  return undefined;
}

export function shouldCreateInvitedEmailAccountAfterSignInFailure(error: unknown): boolean {
  const code = getAuthErrorCode(error);
  return code === "auth/invalid-credential" || code === "auth/user-not-found";
}

export function getAuthErrorMessage(error: unknown, operation: AuthOperation): string {
  const code = getAuthErrorCode(error);
  if (code !== undefined) {
    const knownMessage = authErrorMessages[code];
    if (knownMessage !== undefined) {
      return knownMessage;
    }
  }

  switch (operation) {
    case "send-phone-code":
      return "We could not send a verification code. Please try again.";
    case "verify-phone-code":
      return "We could not verify that code. Please check it and try again.";
    case "sign-in":
      return "We could not sign you in. Please try again.";
    case "send-mfa-code":
      return "We could not send a security code. Please try again.";
    case "verify-mfa-code":
      return "We could not verify that security code. Please try again.";
    case "enroll-mfa":
      return "We could not set up phone verification. Please try again.";
  }
}

export function roundMoneyAmount(amount: number, decimalPlaces = 2): number {
  if (!Number.isFinite(amount)) {
    throw new Error("Money amount must be a finite number.");
  }

  const multiplier = 10 ** decimalPlaces;
  return Math.round((amount + Number.EPSILON) * multiplier) / multiplier;
}

export function isInvitationDeliveryAllowed(
  type: PlatformInvitationType,
  channel: InvitationChannel,
): boolean {
  if (type === "admin_invite" || type === "warehouse_manager_invite") {
    return channel === "email";
  }
  return channel === "email" || channel === "manual_link";
}

export function assertInvitationDeliveryAllowed(
  type: PlatformInvitationType,
  channel: InvitationChannel,
): void {
  if (!isInvitationDeliveryAllowed(type, channel)) {
    throw new Error(
      type === "admin_invite" || type === "warehouse_manager_invite"
        ? "Admin and warehouse-manager invitations must be delivered by email."
        : "This invitation delivery method is not supported.",
    );
  }
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

export function assertDispatchRunGroupingCompatible(
  marketDeliveryRunIds: readonly (string | undefined)[],
): void {
  if (marketDeliveryRunIds.length === 0) throw new Error("At least one buyer order is required.");
  const groupingKeys = new Set(marketDeliveryRunIds.map((runId) => runId ?? "legacy"));
  if (groupingKeys.size !== 1) {
    throw new Error("Dispatch grouping cannot combine orders from incompatible market delivery runs.");
  }
}

export function buildMarketRunBuyerNotification(input: {
  event: "opened" | "cancelled" | "postponed";
  runId: string;
  destination: string;
  deliveryLabel: string;
  reason?: string | undefined;
}): {
  title: string;
  message: string;
  actionUrl: string;
  actionRequired: boolean;
  priority: "normal" | "high";
  deduplicationKey: string;
} {
  const title = input.event === "opened"
    ? "Orders open for a market delivery"
    : input.event === "cancelled"
      ? "Market delivery cancelled"
      : "Market delivery postponed";
  const message = input.event === "opened"
    ? `Order by the published cutoff for delivery to ${input.destination} on ${input.deliveryLabel}.`
    : `The ${input.deliveryLabel} delivery to ${input.destination} was ${input.event}.${input.reason?.trim() ? ` ${input.reason.trim()}` : ""}`;
  return {
    title,
    message,
    actionUrl: input.event === "opened" ? `/buyer/orders/create?run=${input.runId}` : "/buyer/orders",
    actionRequired: input.event !== "opened",
    priority: input.event === "opened" ? "normal" : "high",
    deduplicationKey: `run:${input.runId}:${input.event}:in-app`,
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
  if (effectiveStatus === "expired") {
    throw new Error("This invitation has expired. Ask an administrator for a new invitation.");
  }
  if (effectiveStatus === "accepted") {
    throw new Error("This invitation has already been used. Sign in with the account that accepted it or contact support.");
  }
  if (effectiveStatus === "revoked" || effectiveStatus === "cancelled") {
    throw new Error("This invitation is no longer active. Ask an administrator for a new invitation.");
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
  } else if (/^[1-9]\d{8}$/.test(digitsOnly)) {
    normalized = `+233${digitsOnly}`;
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
  let normalized: string;
  try {
    normalized = normalizeE164PhoneNumber(phoneNumber);
  } catch {
    throw new Error("Ghana phone number must be entered as 054 123 4567 or +233 54 123 4567.");
  }
  if (!/^\+233\d{9}$/.test(normalized)) {
    throw new Error("Ghana phone number must be entered as 054 123 4567 or +233 54 123 4567.");
  }
  return normalized;
}

export function phoneNumbersMatch(num1: string, num2: string): boolean {
  let norm1: string;
  let norm2: string;
  try {
    norm1 = normalizeE164PhoneNumber(num1);
  } catch {
    norm1 = normalizePhoneNumber(num1);
  }
  try {
    norm2 = normalizeE164PhoneNumber(num2);
  } catch {
    norm2 = normalizePhoneNumber(num2);
  }
  return norm1 === norm2;
}

export function assertInviteTargetMatchesIdentity(input: {
  targetEmail?: string;
  targetPhoneNumber?: string;
  identityEmail?: string;
  identityPhoneNumber?: string;
}): void {
  if (input.identityPhoneNumber !== undefined) {
    if (input.targetPhoneNumber !== undefined) {
      if (!phoneNumbersMatch(input.targetPhoneNumber, input.identityPhoneNumber)) {
        throw new Error("Invitation phone number does not match the verified identity.");
      }
    }
    return;
  }
  if (input.identityEmail !== undefined) {
    if (input.targetEmail !== undefined) {
      if (normalizeEmailAddress(input.targetEmail) !== normalizeEmailAddress(input.identityEmail)) {
        throw new Error("Invitation email does not match the verified identity.");
      }
    }
    return;
  }
  throw new Error("Invitation target is required.");
}

export function assertInviteIdentityVerification(input: {
  invitationType: PlatformInvitationType;
  targetEmail?: string;
  targetPhoneNumber?: string;
  identityPhoneNumber?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
}): void {
  const phonePrimary =
    input.invitationType === "warehouse_agent_invite" ||
    input.invitationType === "pilot_operations_invite" ||
    input.invitationType === "transporter_invite";
  if (phonePrimary) {
    if (
      input.identityPhoneNumber === undefined ||
      input.phoneVerified !== true
    ) {
      throw new Error(
        "Phone number must be verified to accept this invitation.",
      );
    }
    return;
  }
  if (input.targetEmail !== undefined && input.emailVerified !== true) {
    throw new Error("Invitation email must be verified.");
  }
  if (input.targetPhoneNumber !== undefined && input.phoneVerified !== true) {
    throw new Error("Invitation phone number must be verified.");
  }
}

export function buildUploadObjectKey(input: {
  environment: string;
  purpose: UploadAssetPurpose;
  ownerUserId: string;
  uploadAssetId: string;
  fileName?: string;
}): string {
  const safeEnvironment = normalizeCodeSegment(
    input.environment || "dev",
  ).toLowerCase();
  const safePurpose = normalizeCodeSegment(input.purpose).toLowerCase();
  const safeOwner = normalizeCodeSegment(input.ownerUserId).toLowerCase();
  const safeUpload = normalizeCodeSegment(input.uploadAssetId).toLowerCase();
  const extension = input.fileName
    ?.split(".")
    .pop()
    ?.replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  const suffix =
    extension === undefined || extension.length === 0 ? "" : `.${extension}`;
  return `${safeEnvironment}/${safePurpose}/${safeOwner}/${safeUpload}${suffix}`;
}

export function isUploadPurposeAllowedForRelatedEntity(input: {
  purpose: UploadAssetPurpose;
  relatedEntityType?: UploadRelatedEntityType;
}): boolean {
  if (input.relatedEntityType === undefined) {
    return true;
  }
  switch (input.purpose) {
    case "produce_intake_photo":
    case "condition_evidence":
      return input.relatedEntityType === "inventory_batch";
    case "dispute_evidence":
      return input.relatedEntityType === "dispute";
    case "dispatch_proof_photo":
      return input.relatedEntityType === "dispatch";
    case "transporter_truck_photo":
      return input.relatedEntityType === "transporter_profile";
    case "profile_evidence":
      return (
        input.relatedEntityType === "farmer" ||
        input.relatedEntityType === "buyer" ||
        input.relatedEntityType === "transporter_profile" ||
        input.relatedEntityType === "warehouse_agent"
      );
    case "blog_hero_image":
    case "blog_content_image":
      return input.relatedEntityType === "blog_post";
    case "pilot_inspection_evidence":
      return input.relatedEntityType === "pilotInspections";
    case "pilot_collection_evidence":
      return input.relatedEntityType === "pilotProcurementLots";
    case "pilot_custody_evidence":
      return input.relatedEntityType === "pilotCustodyEvents";
    case "pilot_acceptance_evidence":
      return input.relatedEntityType === "pilotBuyerAcceptances";
    case "pilot_financial_evidence":
      return input.relatedEntityType === "pilotFinancialEntries";
    case "pilot_issue_evidence":
      return input.relatedEntityType === "pilotIssues";
    case "pilot_facility_assessment":
      return input.relatedEntityType === "pilotFacilities";
  }
}

export function assertUploadPurposeAllowedForRelatedEntity(input: {
  purpose: UploadAssetPurpose;
  relatedEntityType?: UploadRelatedEntityType;
}): void {
  if (!isUploadPurposeAllowedForRelatedEntity(input)) {
    throw new Error("Upload purpose is not allowed for this related entity.");
  }
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
    case "queued":
      return "queued";
    case "pending":
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

export type SmsTemplateData = Record<
  string,
  string | number | boolean | undefined
>;

export type RenderSmsTemplateInput = {
  templateKey?: SmsTemplateKey;
  messageKind?: SmsMessageKind;
  title?: string;
  message: string;
  data?: SmsTemplateData;
};

export type RenderedSmsTemplate = {
  templateKey: SmsTemplateKey;
  messageKind: SmsMessageKind;
  message: string;
  segmentEstimate: SmsSegmentEstimate;
};

const templateKeyByMessageKind: Partial<
  Record<SmsMessageKind, SmsTemplateKey>
> = {
  notification: "generic_notification",
  transactional: "generic_notification",
  farmer_receipt: "farmer_receipt",
  storage_fee_reminder: "storage_fee_reminder",
  reservation_alert: "reservation_alert",
  sale_payment_update: "sale_payment_update",
  payout_update: "payout_update",
  buyer_order_update: "buyer_order_update",
  buyer_reservation_update: "buyer_reservation_update",
  buyer_cancellation_update: "buyer_cancellation_update",
  dispatch_assignment: "dispatch_assignment",
  dispatch_status_update: "dispatch_status_update",
  market_run_update: "generic_notification",
  dispute_update: "dispute_update",
};

export function renderSmsTemplate(
  input: RenderSmsTemplateInput,
): RenderedSmsTemplate {
  const messageKind = input.messageKind ?? "notification";
  const templateKey =
    input.templateKey ??
    templateKeyByMessageKind[messageKind] ??
    "generic_notification";
  const data = input.data ?? {};
  const fallbackMessage = normalizeSmsText(input.message);
  const message = renderKnownSmsTemplate(templateKey, data, fallbackMessage);
  const segmentEstimate = estimateSmsSegments(message);

  return {
    templateKey,
    messageKind,
    message,
    segmentEstimate,
  };
}

export function assertTransactionalSmsTemplateBudget(input: {
  message: string;
  maxSegments?: number;
}): SmsSegmentEstimate {
  const estimate = estimateSmsSegments(input.message);
  const maxSegments = input.maxSegments ?? 2;
  if (estimate.segments > maxSegments) {
    throw new Error(
      `SMS template uses ${estimate.segments} segments; expected ${maxSegments} or fewer.`,
    );
  }
  return estimate;
}

function renderKnownSmsTemplate(
  templateKey: SmsTemplateKey,
  data: SmsTemplateData,
  fallbackMessage: string,
): string {
  switch (templateKey) {
    case "farmer_receipt":
      return compactTemplate([
        "Kuapa receipt",
        readTemplateValue(data, "receiptCode", ""),
        `${readTemplateValue(data, "quantity", "")} ${readTemplateValue(data, "unit", "")} ${readTemplateValue(data, "cropType", "produce")}`.trim(),
        `at ${readTemplateValue(data, "warehouseName", "warehouse")}.`,
      ]);
    case "storage_fee_reminder":
      return compactTemplate([
        "Kuapa storage fee reminder:",
        readTemplateValue(data, "amount", "fee due"),
        `for ${readTemplateValue(data, "receiptCode", "your produce")}.`,
      ]);
    case "reservation_alert":
      return compactTemplate([
        "Kuapa reservation alert:",
        readTemplateValue(data, "quantity", ""),
        readTemplateValue(data, "unit", ""),
        readTemplateValue(data, "cropType", "produce"),
        `reserved until ${formatSmsDate(data.expiresAt)}.`,
      ]);
    case "sale_payment_update":
      return compactTemplate([
        "Kuapa sale update:",
        readTemplateValue(data, "receiptCode", "produce"),
        `payment status ${readTemplateValue(data, "paymentStatus", "updated")}.`,
        readTemplateValue(data, "amount", ""),
      ]);
    case "payout_update":
      return compactTemplate([
        "Kuapa payout update:",
        readTemplateValue(data, "amount", "payout"),
        `for ${readTemplateValue(data, "receiptCode", "your sale")}.`,
      ]);
    case "buyer_order_update":
      return compactTemplate([
        "Kuapa order update:",
        readTemplateValue(data, "orderCode", "your order"),
        `is ${readTemplateValue(data, "status", "updated")}.`,
      ]);
    case "buyer_reservation_update":
      return compactTemplate([
        "Kuapa reservation update:",
        readTemplateValue(data, "orderCode", "your order"),
        readTemplateValue(data, "status", "updated"),
        readTemplateValue(data, "warehouseName", ""),
      ]);
    case "buyer_cancellation_update":
      return compactTemplate([
        "Kuapa cancellation:",
        readTemplateValue(data, "orderCode", "your order"),
        readTemplateValue(data, "reason", "was cancelled."),
      ]);
    case "dispatch_assignment":
      return compactTemplate([
        "Kuapa dispatch:",
        readTemplateValue(data, "dispatchCode", "assignment"),
        `to ${readTemplateValue(data, "destination", "destination")}.`,
        readTemplateValue(data, "pickupWindow", ""),
      ]);
    case "dispatch_status_update":
      return compactTemplate([
        "Kuapa dispatch update:",
        readTemplateValue(data, "dispatchCode", "dispatch"),
        `is ${readTemplateValue(data, "status", "updated")}.`,
      ]);
    case "dispute_update":
      return compactTemplate([
        "Kuapa issue update:",
        readTemplateValue(data, "caseCode", "case"),
        `is ${readTemplateValue(data, "status", "updated")}.`,
      ]);
    case "generic_notification":
      return fallbackMessage;
  }
}

function readTemplateValue(data: SmsTemplateData, key: string, fallback: string): string {
  const value = data[key];
  if (value === undefined) {
    return fallback;
  }
  return normalizeSmsText(String(value));
}

function compactTemplate(parts: readonly (string | undefined)[]): string {
  return normalizeSmsText(parts.filter((part): part is string => part !== undefined && part.trim().length > 0).join(" "));
}

function normalizeSmsText(value: string): string {
  return value
    .normalize("NFKD")
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 10 || code === 13 || (code >= 32 && code <= 126);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function formatSmsDate(value: SmsTemplateData[string]): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "soon";
  }
  return new Date(value).toISOString().slice(0, 10);
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

export type MarketScheduleTimingInput = {
  timezone: string;
  deliveryWeekday: number;
  cutoffDaysBefore: number;
  cutoffLocalTime: string;
  arrivalStartLocalTime: string;
  arrivalEndLocalTime: string;
  effectiveDate: string;
  endDate?: string;
};

export type MarketRunOccurrence = {
  deliveryDate: string;
  deliveryDateAt: number;
  orderCutoffAt: number;
  expectedArrivalStartAt: number;
  expectedArrivalEndAt: number;
};

function parseLocalDate(value: string, label: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    throw new Error(`${label} is not a valid calendar date.`);
  }
  return { year, month, day };
}

function parseLocalTime(value: string, label: string): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (match === null) {
    throw new Error(`${label} must use 24-hour HH:mm.`);
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function timeZoneOffsetAt(timestamp: number, timezone: string): number {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new Error("Service timezone must be a valid IANA timezone.");
  }
  const values = Object.fromEntries(
    formatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(
    values.year ?? 0,
    (values.month ?? 1) - 1,
    values.day ?? 1,
    values.hour ?? 0,
    values.minute ?? 0,
    values.second ?? 0,
  );
  return asUtc - Math.floor(timestamp / 1000) * 1000;
}

function zonedLocalTimestamp(
  date: { year: number; month: number; day: number },
  time: { hour: number; minute: number },
  timezone: string,
): number {
  const desiredUtcShape = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    time.hour,
    time.minute,
  );
  let result = desiredUtcShape - timeZoneOffsetAt(desiredUtcShape, timezone);
  result = desiredUtcShape - timeZoneOffsetAt(result, timezone);
  return result;
}

function addCalendarDays(
  date: { year: number; month: number; day: number },
  days: number,
): { year: number; month: number; day: number } {
  const shifted = new Date(
    Date.UTC(date.year, date.month - 1, date.day + days),
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function calculateMarketRunOccurrence(
  schedule: MarketScheduleTimingInput,
  deliveryDate: string,
): MarketRunOccurrence {
  if (
    !Number.isInteger(schedule.deliveryWeekday) ||
    schedule.deliveryWeekday < 0 ||
    schedule.deliveryWeekday > 6
  ) {
    throw new Error(
      "Delivery weekday must be between Sunday (0) and Saturday (6).",
    );
  }
  if (
    !Number.isInteger(schedule.cutoffDaysBefore) ||
    schedule.cutoffDaysBefore < 0 ||
    schedule.cutoffDaysBefore > 14
  ) {
    throw new Error("Cutoff days before delivery must be between 0 and 14.");
  }
  const date = parseLocalDate(deliveryDate, "Delivery date");
  parseLocalDate(schedule.effectiveDate, "Effective date");
  if (
    deliveryDate < schedule.effectiveDate ||
    (schedule.endDate !== undefined && deliveryDate > schedule.endDate)
  ) {
    throw new Error("Delivery date is outside the schedule effective period.");
  }
  if (
    new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() !==
    schedule.deliveryWeekday
  ) {
    throw new Error(
      "Delivery date does not match the schedule delivery weekday.",
    );
  }
  const cutoffDate = addCalendarDays(date, -schedule.cutoffDaysBefore);
  const cutoffTime = parseLocalTime(
    schedule.cutoffLocalTime,
    "Order cutoff time",
  );
  const arrivalStartTime = parseLocalTime(
    schedule.arrivalStartLocalTime,
    "Arrival start time",
  );
  const arrivalEndTime = parseLocalTime(
    schedule.arrivalEndLocalTime,
    "Arrival end time",
  );
  const occurrence = {
    deliveryDate,
    deliveryDateAt: zonedLocalTimestamp(
      date,
      { hour: 0, minute: 0 },
      schedule.timezone,
    ),
    orderCutoffAt: zonedLocalTimestamp(
      cutoffDate,
      cutoffTime,
      schedule.timezone,
    ),
    expectedArrivalStartAt: zonedLocalTimestamp(
      date,
      arrivalStartTime,
      schedule.timezone,
    ),
    expectedArrivalEndAt: zonedLocalTimestamp(
      date,
      arrivalEndTime,
      schedule.timezone,
    ),
  };
  if (occurrence.expectedArrivalEndAt <= occurrence.expectedArrivalStartAt) {
    throw new Error("Expected arrival end must be after the arrival start.");
  }
  if (occurrence.orderCutoffAt >= occurrence.expectedArrivalStartAt) {
    throw new Error("Order cutoff must be before the expected arrival window.");
  }
  return occurrence;
}

export type RunAggregationOrder = {
  cropType: string;
  unit: string;
  requestedQuantity: number;
  reservedQuantity: number;
  paymentStatus: string;
  reservationExpiresAt?: number;
};

export type RunAggregation = {
  orderCount: number;
  groupedTotals: Array<{
    cropType: string;
    unit: string;
    requestedQuantity: number;
    reservedQuantity: number;
    paidQuantity: number;
    unpaidQuantity: number;
  }>;
  buyersAwaitingPayment: number;
  nextReservationExpiry?: number;
  capacity: {
    compatible: boolean;
    configuredQuantity?: number;
    configuredUnit?: string;
    reservedQuantity?: number;
    remainingQuantity?: number;
    percentage?: number;
  };
  minimumLoad: {
    compatible: boolean;
    configuredQuantity?: number;
    configuredUnit?: string;
    reservedQuantity?: number;
    percentage?: number;
  };
};

function normalizedUnit(value: string): string {
  return value.trim().toLowerCase();
}

export function aggregateMarketRunOrders(
  orders: readonly RunAggregationOrder[],
  configuration: {
    capacityQuantity?: number;
    capacityUnit?: string;
    minimumLoadQuantity?: number;
    minimumLoadUnit?: string;
  } = {},
): RunAggregation {
  const grouped = new Map<string, RunAggregation["groupedTotals"][number]>();
  let buyersAwaitingPayment = 0;
  const expiries: number[] = [];
  for (const order of orders) {
    if (!Number.isFinite(order.requestedQuantity) || order.requestedQuantity < 0 || !Number.isFinite(order.reservedQuantity) || order.reservedQuantity < 0) {
      throw new Error("Run quantities must be finite non-negative numbers.");
    }
    const key = `${order.cropType.trim().toLowerCase()}|${normalizedUnit(order.unit)}`;
    const current = grouped.get(key) ?? {
      cropType: order.cropType.trim(),
      unit: order.unit.trim(),
      requestedQuantity: 0,
      reservedQuantity: 0,
      paidQuantity: 0,
      unpaidQuantity: 0,
    };
    current.requestedQuantity += order.requestedQuantity;
    current.reservedQuantity += order.reservedQuantity;
    if (order.paymentStatus === "fully_paid") {
      current.paidQuantity += order.requestedQuantity;
    } else {
      current.unpaidQuantity += order.requestedQuantity;
      buyersAwaitingPayment += 1;
    }
    grouped.set(key, current);
    if (order.reservationExpiresAt !== undefined) expiries.push(order.reservationExpiresAt);
  }
  const groupedTotals = [...grouped.values()].sort((a, b) =>
    `${a.cropType}|${a.unit}`.localeCompare(`${b.cropType}|${b.unit}`),
  );
  const capacityUnit = configuration.capacityUnit?.trim();
  const capacityCompatible =
    configuration.capacityQuantity !== undefined &&
    capacityUnit !== undefined &&
    groupedTotals.every((group) => normalizedUnit(group.unit) === normalizedUnit(capacityUnit));
  const minimumUnit = configuration.minimumLoadUnit?.trim();
  const minimumCompatible =
    configuration.minimumLoadQuantity !== undefined &&
    minimumUnit !== undefined &&
    groupedTotals.every((group) => normalizedUnit(group.unit) === normalizedUnit(minimumUnit));
  const reservedTotal = groupedTotals.reduce((sum, group) => sum + group.reservedQuantity, 0);
  return {
    orderCount: orders.length,
    groupedTotals,
    buyersAwaitingPayment,
    ...(expiries.length === 0 ? {} : { nextReservationExpiry: Math.min(...expiries) }),
    capacity: {
      compatible: capacityCompatible,
      ...(configuration.capacityQuantity === undefined ? {} : { configuredQuantity: configuration.capacityQuantity }),
      ...(capacityUnit === undefined ? {} : { configuredUnit: capacityUnit }),
      ...(capacityCompatible
        ? {
            reservedQuantity: reservedTotal,
            remainingQuantity: Math.max(0, configuration.capacityQuantity! - reservedTotal),
            percentage: roundMoneyAmount((reservedTotal / configuration.capacityQuantity!) * 100, 1),
          }
        : {}),
    },
    minimumLoad: {
      compatible: minimumCompatible,
      ...(configuration.minimumLoadQuantity === undefined ? {} : { configuredQuantity: configuration.minimumLoadQuantity }),
      ...(minimumUnit === undefined ? {} : { configuredUnit: minimumUnit }),
      ...(minimumCompatible
        ? {
            reservedQuantity: reservedTotal,
            percentage: roundMoneyAmount((reservedTotal / configuration.minimumLoadQuantity!) * 100, 1),
          }
        : {}),
    },
  };
}

export function assertOrderCanJoinMarketRun(input: {
  runStatus: MarketDeliveryRunStatus;
  now: number;
  orderCutoffAt: number;
  runOriginWarehouseId: string;
  inventoryWarehouseIds: readonly string[];
  runDestination: string;
  orderDestination: string;
  authorizedAfterCutoff?: boolean;
  exceptionReason?: string;
}): void {
  if (input.runStatus !== "accepting_orders") {
    throw new Error("This delivery run is not accepting orders.");
  }
  if (input.now >= input.orderCutoffAt && !(input.authorizedAfterCutoff === true && input.exceptionReason?.trim())) {
    throw new Error("The published order cutoff has passed.");
  }
  if (input.inventoryWarehouseIds.some((warehouseId) => warehouseId !== input.runOriginWarehouseId)) {
    throw new Error("Selected inventory does not come from the delivery run origin warehouse.");
  }
  if (input.runDestination.trim().toLowerCase() !== input.orderDestination.trim().toLowerCase()) {
    throw new Error("Order destination does not match the delivery run destination.");
  }
}

export function marketRunOrderCountsTowardReadiness(status: BuyerOrderStatus): boolean {
  return status !== "cancelled" && status !== "unfulfilled" && status !== "completed";
}

export function shouldAdvanceMarketRunCutoff(input: {
  status: MarketDeliveryRunStatus;
  orderCutoffAt: number;
  now: number;
}): boolean {
  return input.status === "accepting_orders" && input.orderCutoffAt <= input.now;
}

export function shouldExpireInventoryReservation(input: {
  status: InventoryReservationStatus;
  expiresAt?: number;
  paymentStatus: BuyerOrderPaymentStatus;
  now: number;
}): boolean {
  return (
    (input.status === "active" || input.status === "partially_released") &&
    input.expiresAt !== undefined &&
    input.expiresAt <= input.now &&
    input.paymentStatus !== "fully_paid"
  );
}

export type ActualFinancialSummary = {
  grossProduceValue: number;
  farmerOwnedValue: number;
  serviceFeeRevenue: number;
  storageCharges: number;
  transportCharges: number;
  insuranceCharges: number;
  buyerPaymentsCollected: number;
  unpaidBuyerOrders: number;
  farmerNetPayoutsDue: number;
  payoutsPaid: number;
  paymentFailures: number;
  manualReviewAmounts: number;
  disputedAmounts: number;
};

export function assertNotificationActionAllowed(input: {
  actorUserId: string;
  recipientUserId?: string | undefined;
  action: "read" | "acknowledge" | "archive";
  actionRequired?: boolean | undefined;
  acknowledgedAt?: number | undefined;
  expiresAt?: number | undefined;
  now?: number | undefined;
}): void {
  if (input.recipientUserId !== input.actorUserId) {
    throw new Error("You cannot change another user's notification.");
  }
  const now = input.now ?? Date.now();
  if (input.action === "acknowledge") {
    if (input.actionRequired !== true) throw new Error("This notification does not require acknowledgement.");
    if (input.expiresAt !== undefined && input.expiresAt <= now) throw new Error("This notification has expired.");
  }
  if (input.action === "archive" && input.actionRequired === true && input.acknowledgedAt === undefined && (input.expiresAt === undefined || input.expiresAt > now)) {
    throw new Error("A required action must be acknowledged before archiving.");
  }
}

export function calculateActualFinancialSummary(input: {
  sales: readonly { grossAmount: number; netAmountDueToFarmer: number; paymentStatus: string }[];
  charges: readonly { amount: number; category: "service" | "storage" | "transport" | "insurance" }[];
  buyerOrders: readonly { totalAmount?: number; paymentStatus: string }[];
  payments: readonly { amount: number; status: string }[];
  payouts: readonly { amount: number; status: string }[];
}): ActualFinancialSummary {
  const sum = (values: readonly number[]) => roundMoneyAmount(values.reduce((total, value) => total + value, 0));
  const chargeTotal = (category: "service" | "storage" | "transport" | "insurance") =>
    sum(input.charges.filter((charge) => charge.category === category).map((charge) => charge.amount));
  return {
    grossProduceValue: sum(input.sales.map((sale) => sale.grossAmount)),
    farmerOwnedValue: sum(input.sales.map((sale) => sale.netAmountDueToFarmer)),
    serviceFeeRevenue: chargeTotal("service"),
    storageCharges: chargeTotal("storage"),
    transportCharges: chargeTotal("transport"),
    insuranceCharges: chargeTotal("insurance"),
    buyerPaymentsCollected: sum(input.payments.filter((payment) => payment.status === "successful").map((payment) => payment.amount)),
    unpaidBuyerOrders: sum(input.buyerOrders.filter((order) => order.paymentStatus !== "fully_paid").map((order) => order.totalAmount ?? 0)),
    farmerNetPayoutsDue: sum(input.payouts.filter((payout) => payout.status !== "paid" && payout.status !== "cancelled").map((payout) => payout.amount)),
    payoutsPaid: sum(input.payouts.filter((payout) => payout.status === "paid").map((payout) => payout.amount)),
    paymentFailures: sum(input.payments.filter((payment) => payment.status === "failed").map((payment) => payment.amount)),
    manualReviewAmounts: sum(input.payments.filter((payment) => payment.status === "manual_review").map((payment) => payment.amount)),
    disputedAmounts: sum([
      ...input.sales.filter((sale) => sale.paymentStatus === "disputed").map((sale) => sale.grossAmount),
      ...input.buyerOrders.filter((order) => order.paymentStatus === "disputed").map((order) => order.totalAmount ?? 0),
    ]),
  };
}
