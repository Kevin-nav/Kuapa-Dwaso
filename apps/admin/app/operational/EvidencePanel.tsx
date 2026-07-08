"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, ExternalLink, FileImage, X } from "lucide-react";
import { StatusBadge, gray, palette, status } from "@kuapa-dwaso/dashboard-ui";
import type { UploadAssetPurpose, UploadRelatedEntityType } from "@kuapa-dwaso/types";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type EvidencePanelProps = {
  actorUserId: string | undefined;
  relatedEntityType: UploadRelatedEntityType;
  relatedEntityId: string;
  title: string;
  purpose?: UploadAssetPurpose;
  canManage?: boolean;
};

type EvidenceAsset = {
  _id: string;
  purpose: string;
  status: string;
  contentType: string;
  sizeBytes: number;
  objectKey: string;
  publicUrl?: string;
  createdAt: number;
};

export function EvidencePanel({
  actorUserId,
  relatedEntityType,
  relatedEntityId,
  title,
  purpose,
  canManage = false,
}: EvidencePanelProps) {
  const [actionError, setActionError] = useState("");
  const verifyEvidence = useMutation(api.uploads.verify);
  const rejectEvidence = useMutation(api.uploads.reject);
  const evidence = useQuery(
    api.uploads.listByRelatedEntity,
    actorUserId === undefined
      ? "skip"
      : {
          actorUserId: actorUserId as Id<"users">,
          relatedEntityType,
          relatedEntityId,
          ...(purpose === undefined ? {} : { purpose }),
          limit: 20,
        },
  ) as EvidenceAsset[] | undefined;

  const updateEvidence = (uploadAssetId: string, nextStatus: "verified" | "rejected") => {
    if (actorUserId === undefined) {
      return;
    }
    setActionError("");
    const mutation =
      nextStatus === "verified"
        ? verifyEvidence({
            actorUserId: actorUserId as Id<"users">,
            uploadAssetId: uploadAssetId as Id<"uploadAssets">,
            reason: "Evidence verified from admin console.",
          })
        : rejectEvidence({
            actorUserId: actorUserId as Id<"users">,
            uploadAssetId: uploadAssetId as Id<"uploadAssets">,
            reason: "Evidence rejected from admin console.",
          });
    void mutation.catch((error: unknown) => {
      setActionError(error instanceof Error ? error.message : "Could not update evidence status.");
    });
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <span style={{ color: gray[500], fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase" }}>
        {title} ({evidence?.length ?? 0})
      </span>
      {actionError && (
        <div style={{ border: `1px solid ${status.dangerBorder}`, background: status.dangerBg, color: status.danger, borderRadius: "6px", padding: "8px 10px", fontSize: "0.8125rem", fontWeight: 700 }}>
          {actionError}
        </div>
      )}
      {evidence === undefined ? (
        <p style={{ color: gray[500], margin: 0, fontSize: "0.875rem" }}>Loading evidence...</p>
      ) : evidence.length === 0 ? (
        <p style={{ color: gray[500], margin: 0, fontSize: "0.875rem", fontStyle: "italic" }}>No evidence attached.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {evidence.map((asset) => (
            <div key={asset._id} style={{ border: `1px solid ${gray[100]}`, borderRadius: "6px", padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <FileImage size={18} style={{ color: palette.field, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: gray[900], margin: 0, fontSize: "0.8125rem", fontWeight: 800, overflowWrap: "anywhere" }}>
                    {asset.purpose.replace(/_/g, " ")}
                  </p>
                  <p style={{ color: gray[500], margin: "2px 0 0", fontSize: "0.75rem", overflowWrap: "anywhere" }}>
                    {asset.contentType} | {(asset.sizeBytes / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <StatusBadge status={asset.status} />
                {asset.publicUrl !== undefined && (
                  <a href={asset.publicUrl} target="_blank" rel="noreferrer" aria-label="Open evidence" style={{ display: "inline-flex", color: palette.field }}>
                    <ExternalLink size={16} />
                  </a>
                )}
                {canManage && asset.status !== "verified" && asset.status !== "rejected" && (
                  <>
                    <button type="button" onClick={() => updateEvidence(asset._id, "verified")} aria-label="Verify evidence" style={iconButtonStyle}>
                      <Check size={14} />
                    </button>
                    <button type="button" onClick={() => updateEvidence(asset._id, "rejected")} aria-label="Reject evidence" style={{ ...iconButtonStyle, color: status.danger }}>
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const iconButtonStyle = {
  width: "28px",
  height: "28px",
  border: `1px solid ${gray[300]}`,
  borderRadius: "6px",
  background: "white",
  color: palette.field,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
