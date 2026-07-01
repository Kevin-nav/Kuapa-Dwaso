import type { ListingStatus, ProduceGrade } from "@kuapa-dwaso/types";

export function formatWorkspaceName(name: string): string {
  return name.trim();
}

export function nowTimestamp(): number {
  return Date.now();
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

export type BulkLotListingSnapshot = {
  farmerId: string;
  cropType: string;
  quantity: number;
  unit: string;
  grade: ProduceGrade;
  askingPrice?: number;
  locationArea: string;
  availableFrom: number;
  availableUntil: number;
  status: ListingStatus;
};

export type BulkLotCalculation = {
  cropType: string;
  locationArea: string;
  totalQuantity: number;
  unit: string;
  farmerCount: number;
  grade: ProduceGrade;
  priceRange?: {
    min: number;
    max: number;
  };
  pickupWindowStart: number;
  pickupWindowEnd: number;
};

export const listingStatusesThatCanEnterBulkLots = ["active", "pending_verification"] as const satisfies readonly ListingStatus[];

export const listingStatusesAllowedInBulkLotCalculations = [
  "active",
  "pending_verification",
  "in_bulk_lot"
] as const satisfies readonly ListingStatus[];

function hasAllowedListingStatus(status: ListingStatus, allowedStatuses: readonly ListingStatus[]): boolean {
  return allowedStatuses.includes(status);
}

export function assertListingCanEnterBulkLot(listing: BulkLotListingSnapshot): void {
  if (!hasAllowedListingStatus(listing.status, listingStatusesThatCanEnterBulkLots)) {
    throw new Error("Only active or pending verification listings can be added to a bulk lot.");
  }

  if (!Number.isFinite(listing.quantity) || listing.quantity <= 0) {
    throw new Error("Bulk lot listings must have positive quantities.");
  }
}

export function calculateBulkLotFromListings(
  listings: BulkLotListingSnapshot[],
  pickupWindowStart: number,
  pickupWindowEnd: number,
  requestedGrade?: ProduceGrade,
  allowedStatuses: readonly ListingStatus[] = listingStatusesAllowedInBulkLotCalculations
): BulkLotCalculation {
  if (pickupWindowEnd < pickupWindowStart) {
    throw new Error("Bulk lot pickup window end must be after the start.");
  }

  const firstListing = listings[0];
  if (firstListing === undefined) {
    throw new Error("A bulk lot needs at least one listing.");
  }

  const cropType = firstListing.cropType;
  const unit = firstListing.unit;
  const locationArea = firstListing.locationArea;

  for (const listing of listings) {
    if (listing.cropType !== cropType) {
      throw new Error("All listings in a bulk lot must use the same crop.");
    }

    if (listing.unit !== unit) {
      throw new Error("All listings in a bulk lot must use the same quantity unit.");
    }

    if (listing.locationArea !== locationArea) {
      throw new Error("All listings in a bulk lot must be in the same location area.");
    }

    if (!Number.isFinite(listing.quantity) || listing.quantity <= 0) {
      throw new Error("Bulk lot listings must have positive quantities.");
    }

    if (!hasAllowedListingStatus(listing.status, allowedStatuses)) {
      throw new Error("One or more listings cannot participate in this bulk lot calculation.");
    }

    if (listing.availableFrom > pickupWindowEnd || listing.availableUntil < pickupWindowStart) {
      throw new Error("Every listing must be available during the bulk lot pickup window.");
    }
  }

  const listingGrades = new Set(listings.map((listing) => listing.grade));
  const grade = requestedGrade ?? (listingGrades.size === 1 ? firstListing.grade : "mixed");

  if (grade !== "mixed") {
    for (const listing of listings) {
      if (listing.grade !== grade) {
        throw new Error("A non-mixed bulk lot can only contain listings with the same grade.");
      }
    }
  }

  const prices = listings
    .map((listing) => listing.askingPrice)
    .filter((price): price is number => price !== undefined);
  const farmerIds = new Set(listings.map((listing) => listing.farmerId));

  const calculation: BulkLotCalculation = {
    cropType,
    locationArea,
    totalQuantity: listings.reduce((total, listing) => total + listing.quantity, 0),
    unit,
    farmerCount: farmerIds.size,
    grade,
    pickupWindowStart,
    pickupWindowEnd
  };

  if (prices.length > 0) {
    calculation.priceRange = {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };
  }

  return calculation;
}
