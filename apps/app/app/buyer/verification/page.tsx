"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, FileCheck2, Mail, ShieldCheck, Upload } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAuth } from "../../auth/AuthProvider";
import { uploadPrivateEvidence } from "../../uploads/client";
import { sendInstitutionWelcomeEmail } from "../institutionEmailApi";

export default function BuyerVerificationPage() {
  const { principal, firebaseUser } = useAuth();
  const buyerLink = principal?.profiles?.find((profile) => profile.profileType === "buyer");
  const buyerId = buyerLink?.profileId as Id<"buyers"> | undefined;
  const buyer = useQuery(api.buyers.getById, principal && buyerId ? { actorUserId: principal.userId as Id<"users">, buyerId } : "skip");
  const evidence = useQuery(api.uploads.listByRelatedEntity, principal && buyerId ? { actorUserId: principal.userId as Id<"users">, relatedEntityType: "buyer", relatedEntityId: buyerId, purpose: "profile_evidence", limit: 20 } : "skip");
  const submitVerification = useMutation(api.buyers.submitEnhancedVerification);
  const [file, setFile] = useState<File | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  if (buyer === undefined || evidence === undefined) return <div className="skeleton" style={{ minHeight: "420px", borderRadius: "20px" }} />;
  if (buyer === null || buyerId === undefined || principal === null || principal === undefined) return <div className="attention-card">Buyer profile not found.</div>;

  const uploadEvidence = async () => {
    if (file === null || firebaseUser === null) return;
    setIsWorking(true); setError(undefined); setMessage(undefined);
    try {
      await uploadPrivateEvidence({ user: firebaseUser, file, purpose: "profile_evidence", ownerProfileType: "buyer", ownerProfileId: buyerId, relatedEntityType: "buyer", relatedEntityId: buyerId });
      setFile(null); setMessage("Registration evidence uploaded securely.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Evidence upload failed."); }
    finally { setIsWorking(false); }
  };

  const submit = async () => {
    setIsWorking(true); setError(undefined); setMessage(undefined);
    try {
      await submitVerification({ actorUserId: principal.userId as Id<"users">, buyerId });
      setMessage("Enhanced verification submitted. An administrator can now review your dossier.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Verification submission failed."); }
    finally { setIsWorking(false); }
  };

  const resendWelcome = async () => {
    if (firebaseUser === null) return;
    setIsWorking(true); setError(undefined);
    try { await sendInstitutionWelcomeEmail(firebaseUser, buyerId); setMessage("Institution welcome email sent."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Email delivery failed."); }
    finally { setIsWorking(false); }
  };

  const status = buyer.enhancedVerificationStatus ?? (buyer.buyerType === "institution" ? "required" : "not_required");
  const canSubmit = evidence.some((asset) => ["attached", "verified"].includes(asset.status)) && !["pending_review", "verified"].includes(status);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <header className="home-header">
        <p className="eyebrow">Institution trust desk</p>
        <h1>Enhanced verification</h1>
        <p>Complete one clear dossier for payment and dispatch access.</p>
      </header>
      {error ? <div className="attention-card" style={{ color: "var(--color-danger)", borderColor: "var(--color-danger-border)" }}>{error}</div> : null}
      {message ? <div className="attention-card" style={{ color: "var(--color-success)", borderColor: "var(--color-success-border)" }}>{message}</div> : null}

      <div className="farmer-card" style={{ background: "var(--color-ink)", color: "white" }}>
        <div className="card-header"><span className="card-title" style={{ color: "white" }}><ShieldCheck size={20} /> {buyer.organizationName}</span><span className={`status-chip status-${status === "verified" ? "success" : status === "rejected" ? "danger" : "warning"}`}>{String(status).replaceAll("_", " ")}</span></div>
        <div className="card-meta" style={{ color: "rgba(255,255,255,.75)" }}>{buyer.email}<br />Registration: {buyer.organizationRegistrationNumber}<br />Representative: {buyer.fullName}, {buyer.contactRole}</div>
        {buyer.enhancedVerificationReason ? <div className="attention-card"><strong>Review note:</strong> {buyer.enhancedVerificationReason}</div> : null}
      </div>

      <div className="summary-strip">
        <div className="summary-card"><Mail size={18} /><span className="summary-label">Welcome email</span><span className="summary-value" style={{ fontSize: "1rem" }}>{buyer.institutionWelcomeEmailSentAt ? "Sent" : "Pending"}</span></div>
        <div className="summary-card"><FileCheck2 size={18} /><span className="summary-label">Evidence files</span><span className="summary-value">{evidence.length}</span></div>
      </div>

      <section className="farmer-card" style={{ gap: "14px" }}>
        <div><span className="card-title"><Upload size={20} /> Registration evidence</span><p className="card-meta">Upload a clear JPG, PNG, or WebP image of the organization registration certificate or procurement authorization.</p></div>
        <input className="form-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <button className="btn btn-secondary btn-full" type="button" disabled={file === null || isWorking} onClick={() => void uploadEvidence()}>{isWorking ? "Working..." : "Upload evidence"}</button>
        <div className="compact-list">{evidence.map((asset) => <div key={asset._id} className="compact-row"><span>{new Date(asset.createdAt).toLocaleDateString()}</span><span className={`status-chip status-${asset.status === "verified" ? "success" : asset.status === "rejected" ? "danger" : "warning"}`}>{asset.status}</span></div>)}</div>
      </section>

      <button className="btn btn-primary btn-full" type="button" disabled={!canSubmit || isWorking} onClick={() => void submit()}>{status === "changes_requested" || status === "rejected" ? "Resubmit dossier" : "Submit for enhanced review"}</button>
      {!buyer.institutionWelcomeEmailSentAt ? <button className="btn btn-ghost btn-full" type="button" disabled={isWorking} onClick={() => void resendWelcome()}><Mail size={18} /> Send welcome email</button> : null}
      {status === "verified" ? <div className="attention-card" style={{ color: "var(--color-success)" }}><CheckCircle2 size={20} /> Enhanced verification is complete. Payment and dispatch access are enabled.</div> : null}
    </div>
  );
}
