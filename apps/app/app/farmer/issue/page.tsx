"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/app/auth/AuthProvider";
import { ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import type { FormEvent } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { createClientActionId, enqueueOfflineAction } from "@kuapa-dwaso/utils/pwa";

type CategoryType = "Wrong Quantity" | "Fee Dispute" | "Produce Damaged" | "Payment Issue" | "Other";

function IssueFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const receiptId = searchParams.get("receiptId") || "";

  const { principal } = useAuth();
  const [category, setCategory] = useState<CategoryType>("Fee Dispute");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);
  const [wasQueued, setWasQueued] = useState(false);

  const farmerProfile = principal?.profiles?.find((p) => p.profileType === "farmer");
  const farmerId = farmerProfile?.profileId as Id<"farmers"> | undefined;

  const farmer = useQuery(
    api.farmers.getById,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId }
      : "skip"
  );

  const createDispute = useMutation(api.disputes.create);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!principal || !farmer) {
      setError("Unable to resolve farmer identity. Please sign in.");
      return;
    }

    if (note.trim().length < 5) {
      setError("Please provide a more detailed note (at least 5 characters).");
      return;
    }

    setError(undefined);
    setIsSubmitting(true);

    try {
      if (receiptId === "") {
        setError("Please open this form from a receipt so the issue can be linked to a real warehouse record.");
        return;
      }

      const clientActionId = createClientActionId();
      const disputeArgs = {
        actorId: farmer.farmerCode,
        actorUserId: principal.userId as Id<"users">,
        actorRole: "farmer" as const,
        entityType: "inventory_batch" as const,
        entityId: receiptId,
        openedByUserId: principal.userId as Id<"users">,
        summary: `[${category}] ${note}`,
        clientActionId,
        ...(farmer.preferredWarehouseId !== undefined ? { warehouseId: farmer.preferredWarehouseId } : {}),
      };
      if (!navigator.onLine) {
        await enqueueOfflineAction({ schemaVersion: 1, clientActionId, ownerUserId: principal.userId, surface: "app", workspace: "farmer", kind: "farmer_dispute_create", payload: disputeArgs, attachmentIds: [], createdAt: Date.now(), attemptCount: 0, state: "pending" });
        setWasQueued(true);
      } else await createDispute(disputeArgs);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit dispute.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories: CategoryType[] = [
    "Wrong Quantity",
    "Fee Dispute",
    "Produce Damaged",
    "Payment Issue",
    "Other",
  ];

  if (success) {
    return (
      <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "24px", justifyContent: "center", alignItems: "center", minHeight: "60vh", textAlign: "center" }}>
        <CheckCircle2 size={64} style={{ color: "var(--color-success)" }} />
        <div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>{wasQueued ? "Issue saved on this device" : "Dispute Submitted"}</h1>
          <p style={{ maxWidth: "320px", margin: "0 auto" }}>
            {wasQueued ? "Keep the app open when your connection returns so the issue can be sent. It has not reached Kuapa Dwaso yet." : "Your issue has been reported. A warehouse manager or platform administrator will review it shortly."}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ minWidth: "160px" }}
          onClick={() => router.push("/farmer")}
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "20px" }}>
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "1rem",
          fontWeight: "700",
          color: "var(--color-primary)",
          padding: "8px 0"
        }}
      >
        <ArrowLeft size={18} />
        <span>Back</span>
      </button>

      <div>
        <p className="eyebrow">Recourse & Support</p>
        <h1>Report an Issue</h1>
      </div>

      <form onSubmit={(e) => { void handleSubmit(e); }} className="auth-card" style={{ padding: "20px" }}>
        {error && (
          <div className="attention-card" style={{ backgroundColor: "var(--color-danger-bg)", borderColor: "var(--color-danger-border)", color: "var(--color-danger)" }}>
            <AlertCircle size={18} />
            <div className="attention-body">
              <span className="attention-text">{error}</span>
            </div>
          </div>
        )}

        {/* Selected receipt reference if available */}
        {receiptId && (
          <div style={{ padding: "10px 14px", backgroundColor: "var(--color-bg)", borderRadius: "8px", border: "1px solid var(--color-line)", fontSize: "0.875rem", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--color-text-muted)" }}>Receipt Reference:</span>
            <strong style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink)" }}>{receiptId}</strong>
          </div>
        )}

        {/* Category tags */}
        <div className="form-group">
          <label className="form-label">What is the problem?</label>
          <div className="tag-grid">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`tag-btn ${category === cat ? "tag-btn-selected" : ""}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Description textarea */}
        <div className="form-group">
          <label htmlFor="note" className="form-label">Note / Explain the problem</label>
          <textarea
            id="note"
            className="form-input form-textarea"
            placeholder="Tell us what is wrong..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ minHeight: "120px", fontFamily: "inherit" }}
            required
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="btn btn-primary btn-full"
          style={{ marginTop: "8px" }}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </div>
  );
}

export default function IssuePage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: "400px", borderRadius: "20px" }} />}>
      <IssueFormContent />
    </Suspense>
  );
}
