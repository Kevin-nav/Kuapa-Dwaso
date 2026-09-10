"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { AlertTriangle, Camera } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";
import { useAuth } from "../../auth/AuthProvider";
import { uploadPrivateEvidence } from "../../uploads/client";

export function DiscrepancyForm({
  planId,
  stopId,
  lotId,
  clearedGrams,
}: {
  planId: Id<"pilotFulfilmentPlans">;
  stopId: Id<"pilotFulfilmentStops">;
  lotId: Id<"pilotProcurementLots">;
  clearedGrams: number;
}) {
  const { firebaseUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [observedKg, setObservedKg] = useState(String(clearedGrams / 1_000));
  const [reason, setReason] = useState("");
  const [assetId, setAssetId] = useState<Id<"uploadAssets">>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const report = useMutation(api.pilotFulfilment.reportDriverDiscrepancy);

  async function upload(file: File | undefined) {
    if (file === undefined || firebaseUser === null) return;
    if (!navigator.onLine) {
      setMessage("Connect before uploading discrepancy evidence.");
      return;
    }
    setBusy(true);
    try {
      const result = await uploadPrivateEvidence({ user: firebaseUser, file, purpose: "pilot_collection_evidence", relatedEntityType: "pilotProcurementLots", relatedEntityId: lotId });
      setAssetId(result.uploadAssetId as Id<"uploadAssets">);
      setMessage("Evidence uploaded. Submit the mismatch to notify operations.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evidence upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (assetId === undefined) return;
    if (!navigator.onLine) {
      setMessage("Connect before reporting a discrepancy. Nothing was submitted.");
      return;
    }
    setBusy(true);
    try {
      await report({ planId, stopId, lotId, observedGrams: Math.round(Number(observedKg) * 1_000), reason: reason.trim(), evidenceUploadAssetIds: [assetId], idempotencyKey });
      setMessage("Mismatch reported. Do not move this lot until operations resolves it.");
      setIdempotencyKey(crypto.randomUUID());
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mismatch could not be reported.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="driver-discrepancy">
      <button type="button" className="driver-text-button" onClick={() => setOpen((value) => !value)}><AlertTriangle size={15} /> Quantity or condition does not match</button>
      {open ? <form onSubmit={(event) => void submit(event)}><label><span>Observed quantity (kg)</span><input required min="0" step="0.1" type="number" value={observedKg} onChange={(event) => setObservedKg(event.target.value)} /></label><label><span>What is different?</span><textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></label><label><span><Camera size={14} /> Evidence</span><input required={assetId === undefined} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} /></label><button type="submit" className="btn btn-secondary btn-full" disabled={busy || assetId === undefined || Math.round(Number(observedKg) * 1_000) === clearedGrams}>{busy ? "Reporting…" : "Report and stop movement"}</button></form> : null}
      {message === undefined ? null : <p className="driver-helper">{message}</p>}
    </div>
  );
}
