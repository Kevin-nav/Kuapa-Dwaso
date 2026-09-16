"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ArrowLeft, FileCheck2 } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useAdminAuth } from "../../../auth/AdminAuthProvider";
import { uploadFinancialEvidence } from "../../evidenceUpload";

type Entry = {
  id: Id<"pilotFinancialEntries">;
  postingKind: string;
  purpose: string;
  basis: string;
  payer: { displayNameSnapshot: string };
  payee: { displayNameSnapshot: string };
  amountPesewas: number;
  createdAt: number;
  provenance: "live" | "sample_only";
  obligation?: {
    status: string;
    outstandingPesewas: number;
    settledPesewas: number;
    dueAt?: number;
  };
};
type Statement = {
  requestId: string;
  totals: {
    obligationPesewas: number;
    settledPesewas: number;
    outstandingPesewas: number;
  };
  costCompleteness?: { status: "complete" | "incomplete" };
  entries: Entry[];
};
type RequestDetail = {
  request: {
    programmeId: Id<"pilotProgrammes">;
    requestId: Id<"pilotBuyerRequests">;
    maizeType: string;
    commercialMode: "coordination" | "kuapa_purchase";
    status: string;
    requestedGrams: number;
    confirmedGrams?: number;
    destination: { label: string };
  };
};

export default function PilotStatementPage() {
  const { id } = useParams<{ id: string }>();
  const requestId = id as Id<"pilotBuyerRequests">;
  const { firebaseUser, principal } = useAdminAuth();
  const actorUserId =
    principal?.role === "admin" && principal.status === "active"
      ? (principal.userId as Id<"users">)
      : undefined;
  const access = useQuery(
    api.adminAccess.getEffectiveAccess,
    actorUserId === undefined
      ? "skip"
      : { actorUserId, adminUserId: actorUserId },
  );
  const canManage = useMemo(
    () => new Set(access?.permissions ?? []).has("pilotFinance:manage"),
    [access],
  );
  const detail = useQuery(api.pilotRequests.get, { requestId }) as
    | RequestDetail
    | null
    | undefined;
  const statement = useQuery(api.pilotFinance.getRequestStatement, {
    requestId,
  }) as Statement | undefined;
  const settle = useMutation(api.pilotFinance.recordExternalSettlement);
  const recordCost = useMutation(api.pilotFinance.recordCoordinationActualCost);
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [costAmount, setCostAmount] = useState("");
  const [costPayee, setCostPayee] = useState("");
  const [costFile, setCostFile] = useState<File>();
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pageNow] = useState(() => Date.now());

  if (detail === undefined || statement === undefined || access === undefined)
    return (
      <main className="pilot-admin">
        <section className="pilot-admin__panel">
          <h1>Loading transaction statement</h1>
        </section>
      </main>
    );
  if (detail === null)
    return (
      <main className="pilot-admin">
        <section className="pilot-admin__panel">
          <h1>Request unavailable</h1>
          <p>This request is outside your assigned programme scope.</p>
          <Link href="/pilot">Return to maize sourcing</Link>
        </section>
      </main>
    );
  const sample = statement.entries.some(
    (entry) => entry.provenance === "sample_only",
  );
  const demoPresentation = process.env.NEXT_PUBLIC_DEMO_PRESENTATION === "true";
  const previewAccess =
    process.env.NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED === "true";

  if (previewAccess) {
    return (
      <main className="pilot-admin">
        <Link className="pilot-admin__text-link" href="/pilot">
          <ArrowLeft size={15} /> Maize control room
        </Link>
        <header className="pilot-admin__hero">
          <div>
            <span className="pilot-admin__eyebrow">
              Marketplace coordination
            </span>
            <h1>
              {detail.request.maizeType} to {detail.request.destination.label}
            </h1>
            <p>
              {(detail.request.confirmedGrams ??
                detail.request.requestedGrams) / 1000}{" "}
              kg · {detail.request.status.replaceAll("_", " ")}
            </p>
          </div>
        </header>
        <section className="pilot-admin__metrics">
          <Metric
            label="Buyer total"
            value={money(statement.totals.obligationPesewas)}
          />
          <Metric label="Paid" value={money(statement.totals.settledPesewas)} />
          <Metric
            label="Outstanding"
            value={money(statement.totals.outstandingPesewas)}
            danger={statement.totals.outstandingPesewas > 0}
          />
        </section>
        <section className="pilot-admin__panel">
          <div className="pilot-admin__panel-head">
            <div>
              <span className="pilot-admin__eyebrow">Who pays whom</span>
              <h2>Coordinated marketplace amounts</h2>
            </div>
            <FileCheck2 size={22} />
          </div>
          <div className="pilot-admin__statement">
            {statement.entries.map((entry) => (
              <article key={entry.id}>
                <div className="pilot-admin__statement-main">
                  <span className="pilot-admin__pill">{entry.postingKind}</span>
                  <div>
                    <strong>
                      {previewPurpose(entry.purpose)} ·{" "}
                      {money(entry.amountPesewas)}
                    </strong>
                    <p>
                      {entry.payer.displayNameSnapshot} →{" "}
                      {entry.payee.displayNameSnapshot}
                    </p>
                    {entry.obligation ? (
                      <small>
                        {money(entry.obligation.outstandingPesewas)} outstanding
                      </small>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  }

  async function upload(file: File) {
    if (firebaseUser === null || detail === null || detail === undefined)
      throw new Error("Sign in before attaching evidence.");
    return await uploadFinancialEvidence({
      user: firebaseUser,
      file,
      programmeId: detail.request.programmeId,
      relatedEntityType: "pilotBuyerRequests",
      relatedEntityId: requestId,
    });
  }
  async function recordSettlement(entry: Entry) {
    const file = files[entry.id];
    if (file === undefined) {
      setMessage(
        "Choose private payment evidence before recording a settlement.",
      );
      return;
    }
    setBusy(entry.id);
    setMessage("Uploading payment evidence…");
    try {
      const assetId = await upload(file);
      const typedAmount = amounts[entry.id]?.trim();
      const amountPesewas = typedAmount
        ? Math.round(Number(typedAmount) * 100)
        : (entry.obligation?.outstandingPesewas ?? 0);
      await settle({
        obligationId: entry.id,
        amountPesewas,
        evidenceUploadAssetIds: [assetId as Id<"uploadAssets">],
        paidAt: pageNow,
        idempotencyKey: crypto.randomUUID(),
      });
      setMessage(
        "Settlement recorded against the obligation. The ledger—not the button—determines whether it is paid in full.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Settlement was not recorded.",
      );
    } finally {
      setBusy(undefined);
    }
  }
  async function addCoordinationCost() {
    if (
      detail?.request.commercialMode !== "coordination" ||
      costFile === undefined ||
      !costPayee.trim()
    ) {
      setMessage(
        "A coordination cost needs an amount, payee, and private evidence.",
      );
      return;
    }
    setBusy("cost");
    setMessage("Uploading cost evidence…");
    try {
      const assetId = await upload(costFile);
      await recordCost({
        requestId,
        purpose: "transport_cost",
        amountPesewas: Math.round(Number(costAmount) * 100),
        payee: { kind: "transporter", displayNameSnapshot: costPayee.trim() },
        evidenceUploadAssetIds: [assetId as Id<"uploadAssets">],
        reasonCode: "verified_transport_invoice",
        idempotencyKey: crypto.randomUUID(),
      });
      setMessage(
        "Actual transport cost and its payable obligation were posted.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Cost was not recorded.",
      );
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <main className="pilot-admin">
      <Link className="pilot-admin__text-link" href="/pilot">
        <ArrowLeft size={15} /> Maize control room
      </Link>
      <header className="pilot-admin__hero">
        <div>
          <span className="pilot-admin__eyebrow">
            Transaction statement · {String(requestId).slice(-8)}
          </span>
          <h1>
            {detail.request.maizeType} to {detail.request.destination.label}
          </h1>
          <p>
            {(detail.request.confirmedGrams ?? detail.request.requestedGrams) /
              1000}{" "}
            kg · {detail.request.commercialMode.replaceAll("_", " ")} ·{" "}
            {detail.request.status.replaceAll("_", " ")}
          </p>
        </div>
      </header>
      {demoPresentation && sample ? (
        <div className="pilot-admin__sample">
          <AlertTriangle size={18} />
          <strong>Demonstration</strong>
          <span>No real orders or payments.</span>
        </div>
      ) : null}
      <section className="pilot-admin__metrics">
        <Metric
          label="Obligations"
          value={money(statement.totals.obligationPesewas)}
        />
        <Metric
          label="Settled"
          value={money(statement.totals.settledPesewas)}
        />
        <Metric
          label="Outstanding"
          value={money(statement.totals.outstandingPesewas)}
          danger={statement.totals.outstandingPesewas > 0}
        />
        <Metric
          label="Cost completeness"
          value={statement.costCompleteness?.status ?? "Not applicable"}
          danger={statement.costCompleteness?.status === "incomplete"}
        />
      </section>
      {message ? (
        <p className="pilot-admin__message" role="status">
          {message}
        </p>
      ) : null}
      <section className="pilot-admin__panel">
        <div className="pilot-admin__panel-head">
          <div>
            <span className="pilot-admin__eyebrow">Immutable ledger</span>
            <h2>Postings and balances</h2>
          </div>
          <FileCheck2 size={22} />
        </div>
        <div className="pilot-admin__statement">
          {statement.entries.map((entry) => (
            <article key={entry.id}>
              <div className="pilot-admin__statement-main">
                <span className="pilot-admin__pill">{entry.postingKind}</span>
                <div>
                  <strong>
                    {entry.purpose.replaceAll("_", " ")} ·{" "}
                    {money(entry.amountPesewas)}
                  </strong>
                  <p>
                    {entry.payer.displayNameSnapshot} →{" "}
                    {entry.payee.displayNameSnapshot} · {entry.basis} ·{" "}
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                  {entry.obligation ? (
                    <small>
                      {entry.obligation.status.replaceAll("_", " ")} ·{" "}
                      {money(entry.obligation.outstandingPesewas)} outstanding
                      {entry.obligation.dueAt
                        ? ` · due ${new Date(entry.obligation.dueAt).toLocaleDateString()}`
                        : ""}
                    </small>
                  ) : null}
                </div>
              </div>
              {entry.obligation !== undefined &&
              entry.obligation.outstandingPesewas > 0 ? (
                <div className="pilot-admin__settle">
                  <input
                    aria-label="Settlement amount in GHS"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder={`GHS ${(entry.obligation.outstandingPesewas / 100).toFixed(2)}`}
                    value={amounts[entry.id] ?? ""}
                    onChange={(event) =>
                      setAmounts((current) => ({
                        ...current,
                        [entry.id]: event.target.value,
                      }))
                    }
                  />
                  <input
                    aria-label="Payment evidence"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) =>
                      setFiles((current) => ({
                        ...current,
                        [entry.id]: event.target.files?.[0],
                      }))
                    }
                  />
                  <button
                    disabled={!canManage || busy !== undefined}
                    onClick={() => void recordSettlement(entry)}
                  >
                    Record settlement
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
        {statement.entries.length === 0 ? (
          <p className="pilot-admin__muted">
            No financial postings exist for this request yet.
          </p>
        ) : null}
        {!canManage ? (
          <p className="pilot-admin__muted">
            Your role can inspect the statement but cannot create payments or
            costs.
          </p>
        ) : null}
      </section>
      {detail.request.commercialMode === "coordination" ? (
        <section className="pilot-admin__panel">
          <span className="pilot-admin__eyebrow">Actual cost completeness</span>
          <h2>Record verified transport cost</h2>
          <p className="pilot-admin__muted">
            Contribution stays incomplete until actual operating costs replace
            assumptions. This action creates both the cost and the amount Kuapa
            Dwaso owes the named provider.
          </p>
          <div className="pilot-admin__form pilot-admin__form--row">
            <label>
              Amount (GHS)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={costAmount}
                onChange={(event) => setCostAmount(event.target.value)}
              />
            </label>
            <label>
              Payee
              <input
                value={costPayee}
                onChange={(event) => setCostPayee(event.target.value)}
                placeholder="Transport provider"
              />
            </label>
            <label>
              Private invoice or receipt
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(event) => setCostFile(event.target.files?.[0])}
              />
            </label>
          </div>
          <button
            className="primary"
            disabled={!canManage || busy !== undefined}
            onClick={() => void addCoordinationCost()}
          >
            Record actual cost
          </button>
        </section>
      ) : null}
    </main>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <article
      className={`pilot-admin__metric${danger ? " pilot-admin__metric--danger" : ""}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
function money(pesewas: number) {
  return `GHS ${(pesewas / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function previewPurpose(purpose: string) {
  const labels: Record<string, string> = {
    buyer_produce: "Maize value",
    coordination_fee: "Seller coordination fee",
    buyer_transport: "Transport charge",
    other_agreed_cost: "Handling charge",
  };
  return labels[purpose] ?? purpose.replaceAll("_", " ");
}
