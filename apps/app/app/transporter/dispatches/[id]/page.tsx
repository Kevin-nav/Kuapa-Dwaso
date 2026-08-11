"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { DispatchStatus } from "@kuapa-dwaso/types";
import { AlertTriangle, ArrowLeft, CheckCircle2, Image as ImageIcon, Phone, Upload } from "lucide-react";
import { useAuth } from "../../../auth/AuthProvider";
import { getSignedReadUrl, uploadPrivateEvidence } from "../../../uploads/client";
import { createClientActionId, enqueueOfflineAction } from "@kuapa-dwaso/utils/pwa";

type Props = {
  params: Promise<{ id: string }>;
};

type DispatchDetail = {
  dispatchId: string;
  destination: string;
  status: DispatchStatus;
  totalQuantity: number;
  unit: string;
  plannedDepartureAt?: number;
  departedAt?: number;
  expectedArrivalAt?: number;
  arrivedAt?: number;
  driverName?: string;
  driverPhoneNumber?: string;
  vehicleType?: string;
  vehicleCapacity?: number;
  vehicleCapacityUnit?: string;
  buyerOrderCount: number;
};

type UploadAsset = {
  _id: string;
  status: string;
  purpose: string;
  fileName?: string;
  contentType: string;
  createdAt: number;
};

const nextStatusesByCurrent: Partial<Record<DispatchStatus, DispatchStatus[]>> = {
  planned: ["loading", "cancelled", "issue_reported"],
  loading: ["departed", "cancelled", "issue_reported"],
  departed: ["in_transit", "arrived", "issue_reported"],
  in_transit: ["arrived", "issue_reported"],
  arrived: ["delivered", "issue_reported"],
  delivered: ["closed"],
  issue_reported: ["loading", "cancelled"],
};

function statusClass(status: string) {
  if (["delivered", "closed"].includes(status)) return "success";
  if (["cancelled", "issue_reported"].includes(status)) return "danger";
  if (["planned", "loading", "departed", "in_transit", "arrived"].includes(status)) return "warning";
  return "neutral";
}

function formatDate(value?: number) {
  return value === undefined ? "Not set" : new Date(value).toLocaleString();
}

export default function TransporterDispatchDetailPage({ params }: Props) {
  const { id } = use(params);
  const { principal, firebaseUser } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<DispatchStatus | "">("");
  const [reason, setReason] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const updateStatus = useMutation(api.dispatches.updateStatus);
  const detail = useQuery(
    api.dispatches.getTransporterDispatchDetail,
    principal !== null && principal !== undefined
      ? { actorUserId: principal.userId as Id<"users">, dispatchId: id as Id<"dispatches"> }
      : "skip",
  ) as DispatchDetail | null | undefined;
  const proofUploads = useQuery(
    api.uploads.listByRelatedEntity,
    principal !== null && principal !== undefined
      ? {
          actorUserId: principal.userId as Id<"users">,
          relatedEntityType: "dispatch",
          relatedEntityId: id,
          purpose: "dispatch_proof_photo",
          limit: 10,
        }
      : "skip",
  ) as UploadAsset[] | undefined;

  const nextStatuses = useMemo(() => {
    if (detail === null || detail === undefined) {
      return [];
    }
    return nextStatusesByCurrent[detail.status] ?? [];
  }, [detail]);

  useEffect(() => {
    if (firebaseUser === null || proofUploads === undefined) {
      return;
    }
    let isMounted = true;
    void Promise.all(
      proofUploads
        .filter((upload) => upload.status !== "pending_upload" && previewUrls[upload._id] === undefined)
        .slice(0, 4)
        .map(async (upload) => {
          const readUrl = await getSignedReadUrl(firebaseUser, upload._id);
          return [upload._id, readUrl] as const;
        }),
    )
      .then((entries) => {
        if (isMounted && entries.length > 0) {
          setPreviewUrls((current) => ({ ...current, ...Object.fromEntries(entries) }));
        }
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, [firebaseUser, previewUrls, proofUploads]);

  const handleStatusUpdate = async () => {
    if (principal === null || principal === undefined || selectedStatus === "" || detail === null || detail === undefined) {
      return;
    }
    setError(undefined);
    setStatusMessage(undefined);
    setIsUpdating(true);
    try {
      const updateArgs: {
        actorUserId: Id<"users">;
        dispatchId: Id<"dispatches">;
        status: DispatchStatus;
        reason?: string;
        clientActionId: string;
        expectedStatus: DispatchStatus;
      } = {
        actorUserId: principal.userId as Id<"users">,
        dispatchId: id as Id<"dispatches">,
        status: selectedStatus,
        clientActionId: createClientActionId(),
        expectedStatus: detail.status,
      };
      if (reason.trim().length > 0) {
        updateArgs.reason = reason.trim();
      }
      if (!navigator.onLine) {
        if (["cancelled", "closed"].includes(selectedStatus)) throw new Error("Reconnect before cancelling or closing a dispatch.");
        await enqueueOfflineAction({ schemaVersion: 1, clientActionId: updateArgs.clientActionId, ownerUserId: principal.userId, surface: "app", workspace: "transporter", kind: "transporter_dispatch_status", payload: updateArgs, attachmentIds: [], expectedEntityStatus: detail.status, createdAt: Date.now(), attemptCount: 0, state: "pending" });
        setStatusMessage("Saved on this device. Keep the app open when your connection returns so the update can be sent.");
      } else {
        await updateStatus(updateArgs);
        setStatusMessage("Dispatch status updated.");
      }
      setSelectedStatus("");
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update dispatch status.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpload = async () => {
    if (firebaseUser === null || proofFile === null) {
      return;
    }
    setError(undefined);
    setStatusMessage(undefined);
    setIsUploading(true);
    try {
      await uploadPrivateEvidence({
        user: firebaseUser,
        file: proofFile,
        purpose: "dispatch_proof_photo",
        relatedEntityType: "dispatch",
        relatedEntityId: id,
      });
      setStatusMessage("Proof photo uploaded and attached.");
      setProofFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload proof photo.");
    } finally {
      setIsUploading(false);
    }
  };

  if (detail === undefined) {
    return <div className="skeleton" style={{ minHeight: "420px", borderRadius: "20px" }} />;
  }

  if (detail === null) {
    return (
      <div className="farmer-card">
        <span className="card-title">Dispatch not available</span>
        <span className="card-meta">This assignment may have been removed or is not assigned to your transporter profile.</span>
        <Link href="/transporter/dispatches" className="btn btn-primary">Back to dispatches</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <Link href="/transporter/dispatches" style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "var(--color-primary)", fontWeight: 700 }}>
        <ArrowLeft size={18} />
        Back to dispatches
      </Link>

      <div>
        <p className="eyebrow">Dispatch detail</p>
        <h1>{detail.destination}</h1>
      </div>

      {error !== undefined && (
        <div className="attention-card" style={{ backgroundColor: "var(--color-danger-bg)", borderColor: "var(--color-danger-border)", color: "var(--color-danger)" }}>
          <AlertTriangle size={18} />
          <div className="attention-body"><span className="attention-text">{error}</span></div>
        </div>
      )}
      {statusMessage !== undefined && (
        <div className="attention-card" style={{ backgroundColor: "var(--color-success-bg)", borderColor: "var(--color-success-border)", color: "var(--color-success)" }}>
          <CheckCircle2 size={18} />
          <div className="attention-body"><span className="attention-text">{statusMessage}</span></div>
        </div>
      )}

      <div className="receipt-slip">
        <div className="slip-header">
          <span className="slip-title">DISPATCH</span>
          <div style={{ marginTop: "12px" }}>
            <span className={`status-chip status-${statusClass(detail.status)}`}>{detail.status.replaceAll("_", " ")}</span>
          </div>
        </div>
        <div className="slip-body">
          <div className="slip-row"><span className="slip-label">Quantity</span><span className="slip-value">{detail.totalQuantity} {detail.unit}</span></div>
          <div className="slip-row"><span className="slip-label">Buyer orders</span><span className="slip-value">{detail.buyerOrderCount}</span></div>
          <div className="slip-row"><span className="slip-label">Vehicle</span><span className="slip-value">{detail.vehicleType ?? "Not set"}</span></div>
          <div className="slip-row"><span className="slip-label">Planned pickup</span><span className="slip-value">{formatDate(detail.plannedDepartureAt)}</span></div>
          <div className="slip-row"><span className="slip-label">Expected arrival</span><span className="slip-value">{formatDate(detail.expectedArrivalAt)}</span></div>
          <div className="slip-row"><span className="slip-label">Departed</span><span className="slip-value">{formatDate(detail.departedAt)}</span></div>
          <div className="slip-row"><span className="slip-label">Arrived</span><span className="slip-value">{formatDate(detail.arrivedAt)}</span></div>
        </div>
      </div>

      {detail.driverPhoneNumber !== undefined && (
        <a href={`tel:${detail.driverPhoneNumber}`} className="btn btn-secondary btn-full">
          <Phone size={18} />
          <span>Call listed driver number</span>
        </a>
      )}

      <div className="farmer-card">
        <span className="card-title">Update status</span>
        {nextStatuses.length === 0 ? (
          <span className="card-meta">No further transporter updates are available for this status.</span>
        ) : (
          <>
            <div className="filter-container">
              {nextStatuses.map((status) => (
                <button
                  type="button"
                  key={status}
                  className={`filter-chip ${selectedStatus === status ? "filter-chip-active" : ""}`}
                  onClick={() => setSelectedStatus(status)}
                >
                  {status.replaceAll("_", " ")}
                </button>
              ))}
            </div>
            <textarea
              className="form-input form-textarea"
              placeholder="Optional note for warehouse operations"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <button type="button" className="btn btn-primary btn-full" disabled={selectedStatus === "" || isUpdating} onClick={() => void handleStatusUpdate()}>
              {isUpdating ? "Updating..." : "Update dispatch"}
            </button>
          </>
        )}
      </div>

      <div className="farmer-card">
        <span className="card-title">
          <Upload size={20} />
          Proof photos
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="form-input"
          onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
        />
        <button type="button" className="btn btn-primary btn-full" disabled={proofFile === null || isUploading} onClick={() => void handleUpload()}>
          {isUploading ? "Uploading..." : "Upload proof photo"}
        </button>
        <div className="compact-list">
          {proofUploads === undefined ? (
            <div className="skeleton" style={{ height: "64px" }} />
          ) : proofUploads.length === 0 ? (
            <span className="card-meta">No proof photos uploaded yet.</span>
          ) : (
            proofUploads.map((upload) => (
              <div key={upload._id} className="compact-row">
                <div className="row-left">
                  <div className="row-icon-wrapper">
                    {previewUrls[upload._id] === undefined ? (
                      <ImageIcon size={18} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewUrls[upload._id]} alt="" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "10px" }} />
                    )}
                  </div>
                  <div className="row-info">
                    <span className="row-title">{upload.status.replaceAll("_", " ")}</span>
                    <span className="row-subtitle">{new Date(upload.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <span className={`status-chip status-${statusClass(upload.status)}`}>{upload.status}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
