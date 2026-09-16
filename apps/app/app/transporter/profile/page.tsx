"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Upload,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { getSignedReadUrl, uploadPrivateEvidence } from "../../uploads/client";
import { PreviewProfileImage } from "../../preview/PreviewProfileImage";

type UploadAsset = {
  _id: string;
  status: string;
  purpose: string;
  contentType: string;
  createdAt: number;
  rejectionReason?: string;
};

function statusClass(status: string) {
  if (["verified", "active"].includes(status)) return "success";
  if (["pending", "pending_upload", "uploaded", "attached"].includes(status))
    return "warning";
  if (["rejected", "suspended", "deleted", "expired"].includes(status))
    return "danger";
  return "neutral";
}

export default function TransporterProfilePage() {
  const { principal, firebaseUser, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const [truckFile, setTruckFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const transporterProfileLink = principal?.profiles?.find(
    (profile) => profile.profileType === "transporter",
  );
  const transporterId = transporterProfileLink?.profileId as
    | Id<"transporterProfiles">
    | undefined;
  const profile = useQuery(
    api.transporters.getById,
    principal !== null && principal !== undefined && transporterId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, transporterId }
      : "skip",
  );
  const uploads = useQuery(
    api.uploads.listByRelatedEntity,
    principal !== null && principal !== undefined && transporterId !== undefined
      ? {
          actorUserId: principal.userId as Id<"users">,
          relatedEntityType: "transporter_profile",
          relatedEntityId: transporterId,
          purpose: "transporter_truck_photo",
          limit: 20,
        }
      : "skip",
  ) as UploadAsset[] | undefined;

  useEffect(() => {
    if (firebaseUser === null || uploads === undefined) {
      return;
    }
    let isMounted = true;
    void Promise.all(
      uploads
        .filter(
          (upload) =>
            upload.status !== "pending_upload" &&
            previewUrls[upload._id] === undefined,
        )
        .slice(0, 8)
        .map(async (upload) => {
          const readUrl = await getSignedReadUrl(firebaseUser, upload._id);
          return [upload._id, readUrl] as const;
        }),
    )
      .then((entries) => {
        if (isMounted && entries.length > 0) {
          setPreviewUrls((current) => ({
            ...current,
            ...Object.fromEntries(entries),
          }));
        }
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, [firebaseUser, previewUrls, uploads]);

  const handleUpload = async () => {
    if (
      firebaseUser === null ||
      truckFile === null ||
      transporterId === undefined
    ) {
      return;
    }
    setError(undefined);
    setStatusMessage(undefined);
    setIsUploading(true);
    try {
      await uploadPrivateEvidence({
        user: firebaseUser,
        file: truckFile,
        purpose: "transporter_truck_photo",
        ownerProfileType: "transporter",
        ownerProfileId: transporterId,
        relatedEntityType: "transporter_profile",
        relatedEntityId: transporterId,
      });
      setTruckFile(null);
      setStatusMessage("Truck photo uploaded for review.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not upload truck photo.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  if (profile === undefined) {
    return (
      <div
        className="skeleton"
        style={{ minHeight: "420px", borderRadius: "20px" }}
      />
    );
  }

  if (profile === null) {
    return (
      <div className="farmer-card">
        <span className="card-title">Transporter profile not found</span>
        <span className="card-meta">
          Complete signup to create your transporter profile.
        </span>
      </div>
    );
  }

  const showPreviewPortrait =
    process.env.NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED === "true" &&
    profile.fullName === "Kwame Asare";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <p className="eyebrow">Verification</p>
        <h1>Transporter Profile</h1>
      </div>

      {error !== undefined && (
        <div
          className="attention-card"
          style={{
            backgroundColor: "var(--color-danger-bg)",
            borderColor: "var(--color-danger-border)",
            color: "var(--color-danger)",
          }}
        >
          <AlertTriangle size={18} />
          <div className="attention-body">
            <span className="attention-text">{error}</span>
          </div>
        </div>
      )}
      {statusMessage !== undefined && (
        <div
          className="attention-card"
          style={{
            backgroundColor: "var(--color-success-bg)",
            borderColor: "var(--color-success-border)",
            color: "var(--color-success)",
          }}
        >
          <CheckCircle2 size={18} />
          <div className="attention-body">
            <span className="attention-text">{statusMessage}</span>
          </div>
        </div>
      )}

      <div className="farmer-card">
        <div className="card-header">
          <div className="preview-profile-card-identity">
            {showPreviewPortrait ? (
              <PreviewProfileImage
                asset="transporter"
                alt="Kwame Asare"
                className="preview-profile-card-portrait"
              />
            ) : null}
            <span className="card-title">{profile.fullName}</span>
          </div>
          <span
            className={`status-chip status-${statusClass(profile.verificationStatus)}`}
          >
            {profile.verificationStatus}
          </span>
        </div>
        <div className="card-meta">
          Phone: {profile.phoneNumber}
          <br />
          Status: {profile.status}
          <br />
          Base: {profile.baseLocation}
        </div>
        <div className="card-details">
          <span>{profile.vehicleType}</span>
          <span className="card-math">
            {profile.vehicleCapacity ?? "-"} {profile.vehicleCapacityUnit ?? ""}
          </span>
        </div>
      </div>

      <div className="farmer-card">
        <span className="card-title">Routes and destinations</span>
        <div className="card-meta">
          Routes: {profile.routesServed.join(", ")}
          <br />
          Destinations: {profile.destinationsServed.join(", ")}
        </div>
      </div>

      <div className="farmer-card">
        <span className="card-title">
          <Upload size={20} />
          Truck evidence
        </span>
        <span className="card-meta">
          Upload clear truck photos for admin approval. Images stay private and
          use signed access.
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="form-input"
          onChange={(event) => setTruckFile(event.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          className="btn btn-primary btn-full"
          disabled={truckFile === null || isUploading}
          onClick={() => void handleUpload()}
        >
          {isUploading ? "Uploading..." : "Upload truck photo"}
        </button>
      </div>

      <div className="compact-list">
        {uploads === undefined ? (
          <div
            className="skeleton"
            style={{ height: "80px", borderRadius: "12px" }}
          />
        ) : uploads.length === 0 ? (
          <div className="compact-row">
            <div className="row-info">
              <span className="row-title">No truck photos yet</span>
              <span className="row-subtitle">
                Upload evidence to support verification.
              </span>
            </div>
          </div>
        ) : (
          uploads.map((upload) => (
            <div key={upload._id} className="compact-row">
              <div className="row-left">
                <div className="row-icon-wrapper">
                  {previewUrls[upload._id] === undefined ? (
                    <ImageIcon size={18} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrls[upload._id]}
                      alt=""
                      style={{
                        width: "40px",
                        height: "40px",
                        objectFit: "cover",
                        borderRadius: "10px",
                      }}
                    />
                  )}
                </div>
                <div className="row-info">
                  <span className="row-title">
                    {upload.status.replaceAll("_", " ")}
                  </span>
                  <span className="row-subtitle">
                    {new Date(upload.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <span
                className={`status-chip status-${statusClass(upload.status)}`}
              >
                {upload.status}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Navigation Buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          marginTop: "12px",
        }}
      >
        <button
          type="button"
          className="btn btn-danger btn-full"
          onClick={() => {
            void handleSignOut();
          }}
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
