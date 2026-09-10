import assert from "node:assert/strict";
import test from "node:test";
import {
  assertInvitationCanBeAccepted,
  assertInviteTargetMatchesIdentity,
  assertUploadPurposeAllowedForRelatedEntity,
  assertUploadMetadata,
  buildUploadObjectKey,
  calculateInviteExpiry,
  isUploadPurposeAllowedForRelatedEntity,
  resolveInvitationStatus,
} from "../src/index.ts";

test("invitation expiry and status resolution are deterministic", () => {
  assert.equal(calculateInviteExpiry(1_000, 500), 1_500);
  assert.equal(resolveInvitationStatus("pending", 1_500, 1_501), "expired");
  assert.equal(resolveInvitationStatus("accepted", 1_500, 1_501), "accepted");
  assert.doesNotThrow(() =>
    assertInvitationCanBeAccepted({ status: "pending", expiresAt: 2_000, now: 1_500 }),
  );
  assert.throws(
    () => assertInvitationCanBeAccepted({ status: "revoked", expiresAt: 2_000, now: 1_500 }),
    /no longer active/,
  );
});

test("invite targets must match the verified identity", () => {
  assert.doesNotThrow(() =>
    assertInviteTargetMatchesIdentity({
      targetEmail: "Manager@Example.com",
      identityEmail: "manager@example.com",
    }),
  );
  assert.doesNotThrow(() =>
    assertInviteTargetMatchesIdentity({
      targetPhoneNumber: "+233 50 000 0000",
      identityPhoneNumber: "+233500000000",
    }),
  );
  assert.throws(
    () =>
      assertInviteTargetMatchesIdentity({
        targetEmail: "admin@example.com",
        identityEmail: "other@example.com",
      }),
    /does not match/,
  );
});

test("upload metadata accepts only image content within size limits", () => {
  assert.doesNotThrow(() =>
    assertUploadMetadata({ contentType: "image/webp", sizeBytes: 1024 }),
  );
  assert.throws(
    () => assertUploadMetadata({ contentType: "application/pdf", sizeBytes: 1024 }),
    /image uploads/,
  );
  assert.throws(
    () => assertUploadMetadata({ contentType: "image/png", sizeBytes: 10, maxSizeBytes: 9 }),
    /outside/,
  );
});

test("upload object keys are normalized and scoped", () => {
  assert.equal(
    buildUploadObjectKey({
      environment: "local dev",
      purpose: "transporter_truck_photo",
      ownerUserId: "user 123",
      uploadAssetId: "asset 456",
      fileName: "truck.photo.webp",
    }),
    "local-dev/transporter-truck-photo/user-123/asset-456.webp",
  );
});

test("upload purposes are constrained to compatible evidence entities", () => {
  assert.equal(
    isUploadPurposeAllowedForRelatedEntity({
      purpose: "produce_intake_photo",
      relatedEntityType: "inventory_batch",
    }),
    true,
  );
  assert.equal(
    isUploadPurposeAllowedForRelatedEntity({
      purpose: "dispatch_proof_photo",
      relatedEntityType: "dispatch",
    }),
    true,
  );
  assert.equal(
    isUploadPurposeAllowedForRelatedEntity({
      purpose: "transporter_truck_photo",
      relatedEntityType: "inventory_batch",
    }),
    false,
  );
  assert.equal(
    isUploadPurposeAllowedForRelatedEntity({
      purpose: "pilot_inspection_evidence",
      relatedEntityType: "pilotInspections",
    }),
    true,
  );
  assert.equal(
    isUploadPurposeAllowedForRelatedEntity({
      purpose: "pilot_financial_evidence",
      relatedEntityType: "pilotIssues",
    }),
    false,
  );
  assert.equal(
    isUploadPurposeAllowedForRelatedEntity({
      purpose: "pilot_financial_evidence",
      relatedEntityType: "pilotProgrammes",
    }),
    true,
  );
  assert.equal(
    isUploadPurposeAllowedForRelatedEntity({
      purpose: "pilot_financial_evidence",
      relatedEntityType: "pilotBuyerRequests",
    }),
    true,
  );
  assert.throws(
    () =>
      assertUploadPurposeAllowedForRelatedEntity({
        purpose: "dispute_evidence",
        relatedEntityType: "dispatch",
      }),
    /not allowed/,
  );
});

test("custody and acceptance evidence can be staged against an existing pilot lot", () => {
  assert.equal(
    isUploadPurposeAllowedForRelatedEntity({
      purpose: "pilot_custody_evidence",
      relatedEntityType: "pilotProcurementLots",
    }),
    true,
  );
  assert.equal(
    isUploadPurposeAllowedForRelatedEntity({
      purpose: "pilot_acceptance_evidence",
      relatedEntityType: "pilotProcurementLots",
    }),
    true,
  );
});
