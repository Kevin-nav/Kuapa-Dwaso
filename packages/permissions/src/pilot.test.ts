import assert from "node:assert/strict";
import test from "node:test";
import {
  canReadPilotResource,
  canTransitionPilotOffer,
  getPilotFieldVisibility,
  getPilotConfirmationBlockers,
  pilotAssignmentAllows,
  canTransitionPilotRequest,
} from "./pilot.ts";

const activeAssignment = {
  programmeId: "programme-a",
  userId: "operator-a",
  capabilities: ["pilot:read", "quality:record"] as const,
  status: "active" as const,
  expiresAt: 2_000,
};

test("programme assignment is explicit, capability-bound, and immediately revocable", () => {
  assert.equal(
    pilotAssignmentAllows(activeAssignment, {
      userId: "operator-a",
      programmeId: "programme-a",
      capability: "pilot:read",
      now: 1_000,
    }),
    true,
  );
  assert.equal(
    pilotAssignmentAllows(activeAssignment, {
      userId: "operator-a",
      programmeId: "programme-b",
      capability: "pilot:read",
      now: 1_000,
    }),
    false,
  );
  assert.equal(
    pilotAssignmentAllows(activeAssignment, {
      userId: "operator-a",
      programmeId: "programme-a",
      capability: "offers:manage",
      now: 1_000,
    }),
    false,
  );
  assert.equal(
    pilotAssignmentAllows(
      { ...activeAssignment, status: "revoked" },
      {
        userId: "operator-a",
        programmeId: "programme-a",
        capability: "pilot:read",
        now: 1_000,
      },
    ),
    false,
  );
  assert.equal(
    pilotAssignmentAllows(activeAssignment, {
      userId: "operator-a",
      programmeId: "programme-a",
      capability: "pilot:read",
      now: 2_000,
    }),
    false,
  );
});

test("buyer request terminal and ordered workflow states cannot be skipped", () => {
  assert.equal(canTransitionPilotRequest("draft", "submitted"), true);
  assert.equal(canTransitionPilotRequest("draft", "confirmed"), false);
  assert.equal(canTransitionPilotRequest("submitted", "under_review"), true);
  assert.equal(canTransitionPilotRequest("quoted", "confirmed"), true);
  assert.equal(canTransitionPilotRequest("quoted", "under_review"), true);
  assert.equal(canTransitionPilotRequest("cancelled", "submitted"), false);
  assert.equal(canTransitionPilotRequest("closed", "disputed"), false);
});

test("confirmation reports stale terms, expiry, quantity mismatch, and supply shortfall", () => {
  assert.deepEqual(
    getPilotConfirmationBlockers({
      revisionState: "superseded",
      expiresAt: 99,
      revisionGrams: 4_900_000,
      confirmedGrams: 5_000_000,
      committedGrams: 4_800_000,
      now: 100,
    }),
    [
      "buyer_agreement_not_acknowledged",
      "buyer_agreement_expired",
      "confirmed_quantity_requires_matching_revision",
      "accepted_farmer_commitments_insufficient",
    ],
  );
  assert.deepEqual(
    getPilotConfirmationBlockers({
      revisionState: "acknowledged",
      expiresAt: 101,
      revisionGrams: 5_000_000,
      confirmedGrams: 5_000_000,
      committedGrams: 5_000_000,
      now: 100,
    }),
    [],
  );
});

test("farmer offers require renewed acceptance after revised sent terms", () => {
  assert.equal(canTransitionPilotOffer("draft", "sent"), true);
  assert.equal(canTransitionPilotOffer("sent", "draft"), true);
  assert.equal(canTransitionPilotOffer("sent", "accepted"), true);
  assert.equal(canTransitionPilotOffer("accepted", "sent"), false);
  assert.equal(canTransitionPilotOffer("declined", "accepted"), false);
});

test("buyer, farmer, and driver reads remain owner or assignment scoped", () => {
  assert.equal(
    canReadPilotResource({
      principalUserId: "buyer-a",
      principalRole: "buyer",
      programmeId: "programme-a",
      resourceProgrammeId: "programme-a",
      buyerUserId: "buyer-a",
      hasProgrammeRead: false,
    }),
    true,
  );
  assert.equal(
    canReadPilotResource({
      principalUserId: "buyer-b",
      principalRole: "buyer",
      programmeId: "programme-a",
      resourceProgrammeId: "programme-a",
      buyerUserId: "buyer-a",
      hasProgrammeRead: false,
    }),
    false,
  );
  assert.equal(
    canReadPilotResource({
      principalUserId: "farmer-a",
      principalRole: "farmer",
      programmeId: "programme-a",
      resourceProgrammeId: "programme-a",
      farmerUserIds: ["farmer-a"],
      hasProgrammeRead: false,
    }),
    true,
  );
  assert.equal(
    canReadPilotResource({
      principalUserId: "driver-a",
      principalRole: "transporter",
      programmeId: "programme-a",
      resourceProgrammeId: "programme-a",
      driverUserId: "driver-b",
      hasProgrammeRead: false,
    }),
    false,
  );
  assert.equal(
    canReadPilotResource({
      principalUserId: "operator-a",
      principalRole: "warehouse_agent",
      programmeId: "programme-a",
      resourceProgrammeId: "programme-b",
      hasProgrammeRead: true,
    }),
    false,
  );
});

test("recipient field visibility never exposes settlements to a driver or buyer", () => {
  assert.equal(
    getPilotFieldVisibility({ principalRole: "transporter" }).farmerSettlement,
    false,
  );
  assert.equal(
    getPilotFieldVisibility({ principalRole: "buyer" }).farmerIdentity,
    false,
  );
  assert.equal(
    getPilotFieldVisibility({
      principalRole: "farmer",
      isOwnFarmerRecord: true,
    }).farmerSettlement,
    true,
  );
  assert.equal(
    getPilotFieldVisibility({
      principalRole: "admin",
      hasFinancePermission: false,
    }).finance,
    false,
  );
  assert.equal(
    getPilotFieldVisibility({
      principalRole: "admin",
      hasFinancePermission: true,
    }).finance,
    true,
  );
});
