import type { MarketplaceRole } from "@kuapa-dwaso/types";
import type { PilotCapability } from "@kuapa-dwaso/types/pilot";
import type { PilotPartyRef } from "@kuapa-dwaso/types/pilot";
import type { PilotRequestStatus } from "@kuapa-dwaso/types/pilot";
import type { PilotOfferStatus } from "@kuapa-dwaso/types/pilot";

export type PilotAssignmentGrant = {
  programmeId: string;
  userId: string;
  capabilities: readonly PilotCapability[];
  status: "active" | "revoked" | "expired";
  expiresAt?: number;
};

type PreviewProgrammeInput = {
  status: "draft" | "active" | "suspended" | "closed";
  datasetProvenance: "live" | "sample_only";
  previewCoordinationUntil?: number;
};

/**
 * The temporary public preview is deliberately narrow and expires in data.
 * Environment flags never grant backend access or relax financial rules.
 */
export function isActivePreviewProgramme(
  programme: PreviewProgrammeInput,
  now: number,
): boolean {
  return (
    programme.status === "active" &&
    programme.datasetProvenance === "live" &&
    programme.previewCoordinationUntil !== undefined &&
    programme.previewCoordinationUntil > now
  );
}

export function isActivePreviewCoordination(input: {
  programme: PreviewProgrammeInput;
  request: {
    commercialMode: "coordination" | "kuapa_purchase";
    previewSeedKey?: string;
  };
  now: number;
}): boolean {
  return (
    isActivePreviewProgramme(input.programme, input.now) &&
    input.request.commercialMode === "coordination" &&
    input.request.previewSeedKey !== undefined &&
    input.request.previewSeedKey.trim().length > 0
  );
}

export function pilotCollectionStopForBuyer(sequence: number): {
  location: { label: string };
  currentLocation: { label: string };
} {
  const location = { label: `Verified collection point ${sequence}` };
  return {
    location,
    currentLocation: location,
  };
}

/**
 * Keep trading counterparties anonymous on participant-facing finance reads.
 * Admin finance retains the stored identity references for reconciliation.
 */
export function pilotFinancialPartyForAudience(
  party: PilotPartyRef,
  audience: MarketplaceRole,
): PilotPartyRef {
  if (audience === "buyer" && party.kind === "farmer") {
    return { kind: "farmer", displayNameSnapshot: "Farmer" };
  }
  if (audience === "farmer" && party.kind === "buyer") {
    return { kind: "buyer", displayNameSnapshot: "Buyer" };
  }
  return party;
}

export function pilotAssignmentAllows(
  assignment: PilotAssignmentGrant,
  input: {
    userId: string;
    programmeId: string;
    capability: PilotCapability;
    now: number;
  },
): boolean {
  return (
    assignment.userId === input.userId &&
    assignment.programmeId === input.programmeId &&
    assignment.status === "active" &&
    (assignment.expiresAt === undefined || assignment.expiresAt > input.now) &&
    assignment.capabilities.includes(input.capability)
  );
}

export type PilotResourceAccessInput = {
  principalUserId: string;
  principalRole: MarketplaceRole;
  programmeId: string;
  resourceProgrammeId: string;
  buyerUserId?: string;
  farmerUserIds?: readonly string[];
  driverUserId?: string;
  hasProgrammeRead: boolean;
};

export function canReadPilotResource(input: PilotResourceAccessInput): boolean {
  if (input.programmeId !== input.resourceProgrammeId) return false;
  if (input.principalRole === "buyer") {
    return input.buyerUserId === input.principalUserId;
  }
  if (input.principalRole === "farmer") {
    return input.farmerUserIds?.includes(input.principalUserId) === true;
  }
  if (input.principalRole === "transporter") {
    return input.driverUserId === input.principalUserId;
  }
  return input.hasProgrammeRead;
}

export type PilotFieldVisibility = {
  farmerIdentity: boolean;
  farmerSettlement: boolean;
  finance: boolean;
  custody: boolean;
};

export function getPilotFieldVisibility(input: {
  principalRole: MarketplaceRole;
  isOwnFarmerRecord?: boolean;
  hasFinancePermission?: boolean;
}): PilotFieldVisibility {
  if (input.principalRole === "admin") {
    return {
      farmerIdentity: true,
      farmerSettlement: input.hasFinancePermission === true,
      finance: input.hasFinancePermission === true,
      custody: true,
    };
  }
  if (input.principalRole === "farmer") {
    return {
      farmerIdentity: input.isOwnFarmerRecord === true,
      farmerSettlement: input.isOwnFarmerRecord === true,
      finance: false,
      custody: input.isOwnFarmerRecord === true,
    };
  }
  if (input.principalRole === "buyer") {
    return {
      farmerIdentity: false,
      farmerSettlement: false,
      finance: false,
      custody: true,
    };
  }
  if (input.principalRole === "transporter") {
    return {
      farmerIdentity: false,
      farmerSettlement: false,
      finance: false,
      custody: true,
    };
  }
  return {
    farmerIdentity: true,
    farmerSettlement: false,
    finance: false,
    custody: true,
  };
}

export const allowedPilotRequestTransitions: Readonly<
  Record<PilotRequestStatus, readonly PilotRequestStatus[]>
> = {
  draft: ["submitted", "cancelled"],
  submitted: ["under_review", "cancelled"],
  under_review: ["quoted", "cancelled", "disputed"],
  quoted: ["under_review", "quoted", "confirmed", "cancelled", "disputed"],
  confirmed: ["fulfilling", "cancelled", "disputed"],
  fulfilling: ["delivered", "cancelled", "disputed"],
  delivered: ["closed", "disputed"],
  closed: [],
  cancelled: [],
  disputed: ["cancelled", "closed"],
};

export function canTransitionPilotRequest(
  current: PilotRequestStatus,
  next: PilotRequestStatus,
): boolean {
  return allowedPilotRequestTransitions[current].includes(next);
}

export type PilotConfirmationBlocker =
  | "buyer_agreement_not_acknowledged"
  | "buyer_agreement_expired"
  | "confirmed_quantity_requires_matching_revision"
  | "accepted_farmer_commitments_insufficient";

export function getPilotConfirmationBlockers(input: {
  revisionState:
    | "proposed"
    | "acknowledged"
    | "superseded"
    | "expired"
    | "withdrawn";
  expiresAt: number;
  revisionGrams: number;
  confirmedGrams: number;
  committedGrams: number;
  now: number;
}): PilotConfirmationBlocker[] {
  const blockers: PilotConfirmationBlocker[] = [];
  if (input.revisionState !== "acknowledged")
    blockers.push("buyer_agreement_not_acknowledged");
  if (input.expiresAt <= input.now) blockers.push("buyer_agreement_expired");
  if (input.revisionGrams !== input.confirmedGrams)
    blockers.push("confirmed_quantity_requires_matching_revision");
  if (input.committedGrams < input.confirmedGrams)
    blockers.push("accepted_farmer_commitments_insufficient");
  return blockers;
}

export const allowedPilotOfferTransitions: Readonly<
  Record<PilotOfferStatus, readonly PilotOfferStatus[]>
> = {
  draft: ["sent", "expired", "withdrawn"],
  sent: ["draft", "accepted", "declined", "expired", "withdrawn"],
  accepted: [],
  declined: [],
  expired: [],
  withdrawn: [],
};

export function canTransitionPilotOffer(
  current: PilotOfferStatus,
  next: PilotOfferStatus,
): boolean {
  return allowedPilotOfferTransitions[current].includes(next);
}

export type PilotSettlementReservationCoverageInput = {
  expectedNetPesewas: number;
  offerExpiresAt: number;
  now: number;
  reservation: {
    status:
      | "active"
      | "partly_consumed"
      | "consumed"
      | "released"
      | "expired"
      | "reversed";
    produceAmountPesewas: number;
    knownCostAmountPesewas: number;
    consumedPesewas: number;
    releasedPesewas: number;
    expiresAt: number;
  };
  budget: {
    status: "draft" | "active" | "suspended" | "closed";
    reservedPesewas: number;
  };
};

/** A sent or accepted offer must retain its complete farmer-payment reserve. */
export function pilotSettlementReservationCoversOffer(
  input: PilotSettlementReservationCoverageInput,
): boolean {
  const reservedForThisOffer =
    input.reservation.produceAmountPesewas +
    input.reservation.knownCostAmountPesewas;
  return (
    Number.isSafeInteger(input.expectedNetPesewas) &&
    input.expectedNetPesewas > 0 &&
    input.reservation.status === "active" &&
    input.reservation.consumedPesewas === 0 &&
    input.reservation.releasedPesewas === 0 &&
    input.reservation.produceAmountPesewas >= input.expectedNetPesewas &&
    input.reservation.expiresAt > input.now &&
    input.reservation.expiresAt >= input.offerExpiresAt &&
    input.budget.status === "active" &&
    input.budget.reservedPesewas >= reservedForThisOffer
  );
}
