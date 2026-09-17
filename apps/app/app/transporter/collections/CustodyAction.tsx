"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Scale,
  Truck,
} from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";
import { useAuth } from "../../auth/AuthProvider";
import { uploadPrivateEvidence } from "../../uploads/client";
import { useToast } from "@kuapa-dwaso/ui/toast";

export type PurchaseCollectionBundle = {
  farmerOfferRevisionId: Id<"pilotFarmerOfferRevisions">;
  inspectionId: Id<"pilotInspections">;
  buyerAgreementRevisionId: Id<"pilotBuyerAgreementRevisions">;
  fundingReservationId: Id<"pilotFundingReservations">;
  expectedFundingReservationVersion: number;
  expectedBudgetVersion: number;
};

type CustodyActionProps = {
  programmeId: Id<"pilotProgrammes">;
  planId: Id<"pilotFulfilmentPlans">;
  planVersion: number;
  planStatus: string;
  collectionStopId: Id<"pilotFulfilmentStops">;
  destinationStopId: Id<"pilotFulfilmentStops"> | undefined;
  lot: {
    lotId: Id<"pilotProcurementLots">;
    lotCode: string;
    commercialMode: "coordination" | "kuapa_purchase";
    clearedGrams: number;
    version: number;
    milestones: string[];
    purchaseCollection: PurchaseCollectionBundle | null;
  };
};

export function CustodyAction({
  programmeId,
  planId,
  planVersion,
  planStatus,
  collectionStopId,
  destinationStopId,
  lot,
}: CustodyActionProps) {
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const [assetId, setAssetId] = useState<Id<"uploadAssets">>();
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    message: string;
  }>();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const recordCustody = useMutation(api.pilotFulfilment.recordCustody);

  const next = !lot.milestones.includes("collected")
    ? {
        eventType: "collected" as const,
        label: "Confirm collection",
        stopId: collectionStopId,
      }
    : !lot.milestones.includes("loaded")
      ? {
          eventType: "loaded" as const,
          label: "Confirm loaded",
          stopId: collectionStopId,
        }
      : !lot.milestones.includes("delivered") && destinationStopId !== undefined
        ? {
            eventType: "delivered" as const,
            label: "Record buyer handover",
            stopId: destinationStopId,
          }
        : null;
  const purchaseBlocked =
    next?.eventType === "collected" &&
    lot.commercialMode === "kuapa_purchase" &&
    lot.purchaseCollection === null;
  const collectionAllowed = ["ready", "collecting"].includes(planStatus);

  async function upload(file: File | undefined) {
    if (file === undefined || firebaseUser === null) return;
    if (!navigator.onLine) {
      setNotice({
        tone: "error",
        message: "Connect before uploading custody evidence.",
      });
      return;
    }
    setIsUploading(true);
    setNotice(undefined);
    try {
      const result = await uploadPrivateEvidence({
        user: firebaseUser,
        file,
        purpose: "pilot_collection_evidence",
        relatedEntityType: "pilotProcurementLots",
        relatedEntityId: lot.lotId,
        pilotProgrammeId: programmeId,
      });
      setAssetId(result.uploadAssetId as Id<"uploadAssets">);
      setNotice({
        tone: "success",
        message: "Evidence uploaded. Confirm the milestone to attach it.",
      });
      showToast("Optional photo uploaded.");
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Evidence upload failed.",
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function confirm() {
    if (next === null) return;
    if (!navigator.onLine) {
      setNotice({
        tone: "error",
        message: "Connect before confirming custody. Nothing was recorded.",
      });
      return;
    }
    setIsSaving(true);
    setNotice(undefined);
    try {
      await recordCustody({
        planId,
        stopId: next.stopId,
        lotId: lot.lotId,
        eventType: next.eventType,
        grams: lot.clearedGrams,
        evidenceUploadAssetIds: assetId === undefined ? [] : [assetId],
        expectedPlanVersion: planVersion,
        expectedLotVersion: lot.version,
        occurredAt: Date.now(),
        ...(next.eventType === "collected" &&
        lot.commercialMode === "kuapa_purchase" &&
        lot.purchaseCollection !== null
          ? { purchase: lot.purchaseCollection }
          : {}),
        idempotencyKey,
      });
      setNotice({
        tone: "success",
        message: `${next.label} recorded on the server.`,
      });
      showToast(`${next.label} recorded.`);
      setAssetId(undefined);
      setIdempotencyKey(crypto.randomUUID());
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Custody milestone could not be recorded.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (next === null)
    return (
      <div className="driver-complete">
        <CheckCircle2 size={18} /> Driver handover complete. Buyer acceptance
        remains separate.
      </div>
    );

  return (
    <div className="driver-action-panel">
      <div className="driver-action-title">
        <Truck size={18} />
        <strong>{next.label}</strong>
      </div>
      {purchaseBlocked ? (
        <div className="driver-alert">
          <AlertTriangle size={17} /> Purchase collection is waiting for an
          approved, current funding reservation. The driver cannot override it.
        </div>
      ) : null}
      {!collectionAllowed && next.eventType === "collected" ? (
        <div className="driver-alert">
          <AlertTriangle size={17} /> Operations must mark this plan ready
          before collection.
        </div>
      ) : null}
      <label className="driver-file-field">
        <span>
          <Camera size={16} /> Optional milestone photo
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void upload(file);
          }}
        />
      </label>
      <small className="driver-evidence-help">
        You can record the milestone without a photo. Add one only when it helps
        document a condition or handover.
      </small>
      {notice === undefined ? null : (
        <div className={`driver-notice ${notice.tone}`}>{notice.message}</div>
      )}
      <button
        type="button"
        className="btn btn-primary btn-full"
        disabled={
          isUploading ||
          isSaving ||
          purchaseBlocked ||
          (next.eventType === "collected" && !collectionAllowed)
        }
        onClick={() => void confirm()}
      >
        <Scale size={17} />{" "}
        {isSaving ? "Recording…" : isUploading ? "Uploading…" : next.label}
      </button>
    </div>
  );
}
