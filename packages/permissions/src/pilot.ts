import type { MarketplaceRole } from "@kuapa-dwaso/types";
import type { PilotCapability } from "@kuapa-dwaso/types/pilot";

export type PilotAssignmentGrant = {
  programmeId: string;
  userId: string;
  capabilities: readonly PilotCapability[];
  status: "active" | "revoked" | "expired";
  expiresAt?: number;
};

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
