import assert from "node:assert/strict";
import test from "node:test";
import {
  canReadPilotResource,
  getPilotFieldVisibility,
  pilotAssignmentAllows,
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
