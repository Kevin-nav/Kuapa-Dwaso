"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useQuery } from "convex/react";
import { Camera, CheckCircle, ExternalLink, FileImage, Upload } from "lucide-react";
import type { UploadAssetPurpose, UploadRelatedEntityType } from "@kuapa-dwaso/types";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useOpsAuth } from "./auth/OpsAuthProvider";
import { getEvidenceReadUrl } from "./evidenceReadUrls";
import { uploadEvidenceFile } from "./evidenceUpload";

type EvidencePanelProps = {
  actorUserId: string | undefined;
  relatedEntityType: UploadRelatedEntityType;
  relatedEntityId: string;
  purpose: UploadAssetPurpose;
  title: string;
  canAttach?: boolean;
};

type EvidenceAsset = {
  _id: string;
  status: string;
};

export function EvidencePanel({
  actorUserId,
  relatedEntityType,
  relatedEntityId,
  purpose,
  title,
  canAttach = true,
}: EvidencePanelProps) {
  const { firebaseUser } = useOpsAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [openingAssetId, setOpeningAssetId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const evidence = useQuery(
    api.uploads.listByRelatedEntity,
    actorUserId === undefined
      ? "skip"
      : {
          actorUserId: actorUserId as Id<"users">,
          relatedEntityType,
          relatedEntityId,
          purpose,
          limit: 12,
        },
  ) as EvidenceAsset[] | undefined;
  const readableEvidence = evidence?.filter((asset) => !["pending_upload", "deleted", "expired"].includes(asset.status));

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined || actorUserId === undefined) {
      return;
    }
    setIsUploading(true);
    setError("");
    void uploadEvidenceFile({
      firebaseUser,
      file,
      purpose,
      relatedEntityType,
      relatedEntityId,
      ...(purpose === "produce_intake_photo" ? { accessLevel: "public_read" as const } : {}),
    })
      .catch((uploadError: unknown) => {
        setError(uploadError instanceof Error ? uploadError.message : "Could not upload evidence.");
      })
      .finally(() => setIsUploading(false));
  };

  const openEvidence = (uploadAssetId: string) => {
    const tab = window.open("about:blank", "_blank", "noopener,noreferrer");
    setOpeningAssetId(uploadAssetId);
    setError("");
    void getEvidenceReadUrl({
      firebaseUser,
      uploadAssetId,
    })
      .then((result) => {
        if (tab === null) {
          window.location.assign(result.readUrl);
          return;
        }
        tab.location.href = result.readUrl;
      })
      .catch((openError: unknown) => {
        tab?.close();
        setError(openError instanceof Error ? openError.message : "Could not open evidence.");
      })
      .finally(() => setOpeningAssetId(null));
  };

  return (
    <div className="info-card" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800 }}>
          <Camera size={16} />
          <span>{title}</span>
        </div>
        {canAttach && (
          <>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} hidden />
            <button
              type="button"
              className="btn btn-outline"
              style={{ width: "auto", height: "34px", padding: "0 10px", fontSize: "12px" }}
              disabled={isUploading || actorUserId === undefined}
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={14} />
              <span>{isUploading ? "Uploading..." : "Attach"}</span>
            </button>
          </>
        )}
      </div>
      {error && <div style={{ color: "var(--color-danger)", fontSize: "13px", fontWeight: 700 }}>{error}</div>}
      {readableEvidence === undefined ? (
        <div style={{ color: "var(--gray-500)", fontSize: "13px" }}>Loading evidence...</div>
      ) : readableEvidence.length === 0 ? (
        <div style={{ color: "var(--gray-500)", fontSize: "13px", fontStyle: "italic" }}>No evidence attached yet.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))", gap: "8px" }}>
          {readableEvidence.map((asset) => (
            <button
              key={asset._id}
              type="button"
              onClick={() => openEvidence(asset._id)}
              style={{
                minHeight: "82px",
                border: "1px solid var(--color-line)",
                borderRadius: "8px",
                padding: "8px",
                color: "var(--color-ink)",
                textDecoration: "none",
                backgroundColor: "var(--gray-50)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "8px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {openingAssetId === asset._id ? <ExternalLink size={18} /> : <FileImage size={18} />}
              <span style={{ fontSize: "11px", color: "var(--gray-600)", overflowWrap: "anywhere" }}>
                {asset.status.replace(/_/g, " ")}
              </span>
              {asset.status === "verified" && <CheckCircle size={14} style={{ color: "var(--color-success)" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
