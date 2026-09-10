"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Leaf, MapPin, Plus, ShieldCheck } from "lucide-react";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { api } from "../../../../../convex/_generated/api";
import { usePilotOperations } from "../../context/PilotOperationsContext";

type FarmerOption = {
  farmerId: Id<"farmers">;
  farmerCode: string;
  fullName: string;
  phoneNumber: string;
  community: string;
};

type SupplyRow = {
  declaration: {
    declarationId: Id<"pilotSupplyDeclarations">;
    maizeType: string;
    availableGrams: number;
    allocatedGrams: number;
    unallocatedGrams: number;
    collectionLocation: { label: string };
    verificationStatus: string;
    status: string;
    version: number;
  };
  farmer: FarmerOption & { verificationStatus: string };
};

function dateValue(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return date.toISOString().slice(0, 10);
}

export default function PilotSupplyPage() {
  const { activeProgramme, activeProgrammeId } = usePilotOperations();
  const [showForm, setShowForm] = useState(false);
  const [farmerId, setFarmerId] = useState("");
  const [maizeType, setMaizeType] = useState("Yellow maize");
  const [quantityKg, setQuantityKg] = useState("1000");
  const [locationLabel, setLocationLabel] = useState("");
  const [readyFrom, setReadyFrom] = useState(() => dateValue(1));
  const [readyTo, setReadyTo] = useState(() => dateValue(4));
  const [assistanceReason, setAssistanceReason] = useState("");
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string }>();
  const [busyId, setBusyId] = useState<string>();
  const farmers = useQuery(
    api.pilotSupply.listEligibleFarmers,
    activeProgrammeId === undefined ? "skip" : { programmeId: activeProgrammeId, limit: 100 },
  ) as FarmerOption[] | undefined;
  const supply = useQuery(
    api.pilotSupply.listAvailable,
    activeProgrammeId === undefined
      ? "skip"
      : { programmeId: activeProgrammeId, limit: 50 },
  ) as { page: SupplyRow[] } | undefined;
  const createDeclaration = useMutation(api.pilotSupply.createDeclaration);
  const reviewDeclaration = useMutation(api.pilotSupply.reviewDeclaration);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeProgrammeId === undefined || !navigator.onLine) {
      setStatus({ tone: "error", message: "Connect before recording assisted supply. Nothing was submitted." });
      return;
    }
    setBusyId("create");
    setStatus(undefined);
    try {
      await createDeclaration({
        programmeId: activeProgrammeId,
        farmerId: farmerId as Id<"farmers">,
        maizeType: maizeType.trim(),
        availableGrams: Math.round(Number(quantityKg) * 1_000),
        readinessWindowStartAt: new Date(`${readyFrom}T08:00:00+00:00`).getTime(),
        readinessWindowEndAt: new Date(`${readyTo}T17:00:00+00:00`).getTime(),
        collectionLocation: { label: locationLabel.trim() },
        assistanceReason: assistanceReason.trim(),
        idempotencyKey: crypto.randomUUID(),
      });
      setStatus({ tone: "success", message: "Supply declaration recorded with operations assistance clearly attributed." });
      setShowForm(false);
      setAssistanceReason("");
      setLocationLabel("");
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Supply could not be recorded." });
    } finally {
      setBusyId(undefined);
    }
  }

  async function review(row: SupplyRow) {
    if (!navigator.onLine) {
      setStatus({ tone: "error", message: "Connect before verifying supply." });
      return;
    }
    setBusyId(row.declaration.declarationId);
    try {
      await reviewDeclaration({
        declarationId: row.declaration.declarationId,
        decision: "reviewed",
        reason: "Operations confirmed the farmer, quantity, readiness window and collection location.",
        expectedVersion: row.declaration.version,
        idempotencyKey: crypto.randomUUID(),
      });
      setStatus({ tone: "success", message: `${row.farmer.fullName}'s declaration is verified and can be offered against demand.` });
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Review could not be saved." });
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <div className="ops-page-stack">
      <header className="ops-page-header">
        <div><p className="ops-eyebrow">{activeProgramme?.name ?? "Maize pilot"}</p><h1>Supply desk</h1><p>Verify farmer declarations and match real, unallocated maize to buyer demand.</p></div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm((open) => !open)}><Plus size={18} /> Assisted supply</button>
      </header>

      {status === undefined ? null : <div className={`ops-form-status ${status.tone}`} role="status">{status.message}</div>}

      {showForm ? (
        <form className="section-card ops-form-grid" onSubmit={(event) => void submit(event)}>
          <div className="ops-form-intro"><span className="ops-icon-tile"><Leaf size={21} /></span><div><h2>Record on a farmer&apos;s behalf</h2><p>The farmer remains the named owner. This does not accept an offer for them.</p></div></div>
          <label><span>Farmer</span><select required value={farmerId} onChange={(event) => setFarmerId(event.target.value)}><option value="">Select a verified farmer</option>{(farmers ?? []).map((farmer) => <option key={farmer.farmerId} value={farmer.farmerId}>{farmer.fullName} · {farmer.farmerCode}</option>)}</select></label>
          <label><span>Maize type</span><input required value={maizeType} onChange={(event) => setMaizeType(event.target.value)} /></label>
          <label><span>Available quantity (kg)</span><input required min="1" step="0.1" type="number" value={quantityKg} onChange={(event) => setQuantityKg(event.target.value)} /></label>
          <label><span>Collection location</span><input required value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} placeholder="Community and landmark" /></label>
          <label><span>Ready from</span><input required type="date" value={readyFrom} onChange={(event) => setReadyFrom(event.target.value)} /></label>
          <label><span>Ready until</span><input required type="date" value={readyTo} onChange={(event) => setReadyTo(event.target.value)} /></label>
          <label className="ops-form-wide"><span>Why operations is assisting</span><textarea required value={assistanceReason} onChange={(event) => setAssistanceReason(event.target.value)} placeholder="For example: farmer called the field officer to record the declaration." /></label>
          <div className="ops-form-actions"><button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busyId === "create"}>{busyId === "create" ? "Recording…" : "Record attributed supply"}</button></div>
        </form>
      ) : null}

      <section className="section-card ops-table-card">
        <div className="section-title"><span>Programme supply</span><small>{supply?.page.length ?? 0} declarations</small></div>
        {supply === undefined ? <div className="ops-empty-state">Loading supply…</div> : supply.page.length === 0 ? <div className="ops-empty-state"><Leaf size={30} /><h2>No maize declared yet</h2><p>Farmers can declare from their portal, or operations can assist with attribution.</p></div> : (
          <div className="ops-supply-list">
            {supply.page.map((row) => (
              <article key={row.declaration.declarationId} className="ops-supply-row">
                <div><strong>{row.farmer.fullName}</strong><span>{row.farmer.farmerCode} · {row.farmer.phoneNumber}</span></div>
                <div><strong>{(row.declaration.unallocatedGrams / 1_000).toLocaleString()} kg free</strong><span>of {(row.declaration.availableGrams / 1_000).toLocaleString()} kg · {row.declaration.maizeType}</span></div>
                <div><strong><MapPin size={14} /> {row.declaration.collectionLocation.label}</strong><span className={`badge ${row.declaration.verificationStatus === "reviewed" ? "badge-success" : "badge-warning"}`}>{row.declaration.verificationStatus.replaceAll("_", " ")}</span></div>
                {row.declaration.verificationStatus === "self_reported" ? <button type="button" className="btn btn-outline" onClick={() => void review(row)} disabled={busyId === row.declaration.declarationId}><ShieldCheck size={16} /> Verify</button> : <Link href="/pilot" className="ops-arrow-link"><CheckCircle2 size={16} /> Match to demand</Link>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
