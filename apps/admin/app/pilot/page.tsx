"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ShieldCheck,
  Sprout,
  UserPlus,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAdminAuth } from "../auth/AdminAuthProvider";
import { uploadFinancialEvidence } from "./evidenceUpload";

type Programme = {
  id: Id<"pilotProgrammes">;
  code: string;
  name: string;
  region: string;
  status: "draft" | "active" | "suspended" | "closed";
  datasetProvenance: "live" | "sample_only";
  datasetId?: string;
  commercialConfigurationStatus: "missing" | "draft" | "approved";
  currentCommercialConfiguration?: {
    qualityPolicy?: { maizeType: string; moistureMaximumPermille?: number };
    chargeTerms?: Array<{ rate: { numerator: number; scale: number } }>;
    paymentTerms?: Array<{ trigger: string; offsetCalendarDays: number }>;
    purchaseLimitPesewas?: number;
    approvalReferences: string[];
  };
  version: number;
};

const capabilities = [
  "pilot:read",
  "requests:review",
  "supply:manage",
  "offers:manage",
  "quality:record",
  "fulfilment:manage",
  "custody:record",
  "issues:manage",
] as const;

export default function PilotAdminPage() {
  const { principal } = useAdminAuth();
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
  const permissionSet = useMemo(
    () => new Set(access?.permissions ?? []),
    [access],
  );
  const canManageProgrammes = permissionSet.has("pilotProgrammes:manage");
  const canManageAssignments = permissionSet.has("pilotAssignments:manage");
  const canReadFinance = permissionSet.has("pilotFinance:read");
  const canManageFinance = permissionSet.has("pilotFinance:manage");
  const programmes = useQuery(
    api.pilotProgrammes.listAvailable,
    actorUserId === undefined ? "skip" : { limit: 50 },
  ) as { page: Programme[] } | undefined;
  const demoPresentation = process.env.NEXT_PUBLIC_DEMO_PRESENTATION === "true";
  const visibleProgrammes = useMemo(
    () =>
      (programmes?.page ?? []).filter((programme) =>
        demoPresentation
          ? programme.datasetProvenance === "sample_only"
          : programme.datasetProvenance === "live",
      ),
    [demoPresentation, programmes],
  );
  const [selectedId, setSelectedId] = useState<string>("");
  const selected =
    visibleProgrammes.find((programme) => programme.id === selectedId) ??
    visibleProgrammes[0];
  const [now] = useState(() => Date.now());

  const requests = useQuery(
    api.pilotRequests.listAssigned,
    selected === undefined ? "skip" : { programmeId: selected.id, limit: 50 },
  ) as
    | {
        page: Array<{
          requestId: Id<"pilotBuyerRequests">;
          status: string;
          requestedGrams: number;
          confirmedGrams?: number;
          commercialMode: string;
          deliveryWindowEndAt: number;
        }>;
      }
    | undefined;
  const issues = useQuery(
    api.pilotIssues.listForProgramme,
    selected === undefined ? "skip" : { programmeId: selected.id },
  ) as
    | Array<{
        _id: string;
        requestId: string;
        status: string;
        summary: string;
        nextStep: string;
        deadlineAt?: number;
      }>
    | undefined;
  const assignments = useQuery(
    api.pilotAssignments.list,
    selected === undefined
      ? "skip"
      : { programmeId: selected.id, status: "active", limit: 50 },
  ) as
    | {
        page: Array<{
          assignmentId: Id<"pilotAssignments">;
          userId: Id<"users">;
          capabilities: string[];
          version: number;
        }>;
      }
    | undefined;
  const candidates = useQuery(
    api.pilotAssignments.listCandidates,
    selected === undefined ? "skip" : { programmeId: selected.id },
  ) as
    | Array<{
        userId: Id<"users">;
        name: string;
        identityKind: string;
        warehouseCount: number;
      }>
    | undefined;
  const finance = useQuery(
    api.pilotFinance.getProgrammeSummary,
    selected === undefined || !canReadFinance
      ? "skip"
      : { programmeId: selected.id },
  ) as FinanceSummary | undefined;
  const queue = useQuery(
    api.pilotFinance.listPurchaseApprovalQueue,
    selected === undefined || !canReadFinance
      ? "skip"
      : { programmeId: selected.id },
  ) as ApprovalRow[] | undefined;
  const entries = useQuery(
    api.pilotFinance.listFinancialEntries,
    selected === undefined || !canReadFinance
      ? "skip"
      : { programmeId: selected.id, limit: 50 },
  ) as { page: FinancialEntry[] } | undefined;

  if (actorUserId === undefined)
    return (
      <StateCard
        title="Administrator required"
        detail="Sign in with an active administrator identity to manage maize sourcing."
      />
    );
  if (programmes === undefined || access === undefined)
    return (
      <StateCard
        title="Loading maize control room"
        detail="Checking programme access and current records."
      />
    );

  const requestRows = requests?.page ?? [];
  const openIssues = (issues ?? []).filter(
    (issue) => !["resolved", "closed"].includes(issue.status),
  );
  const overdueIssues = openIssues.filter(
    (issue) => issue.deadlineAt !== undefined && issue.deadlineAt < now,
  );
  const atRiskCollections = requestRows.filter(
    (request) =>
      request.deliveryWindowEndAt < now &&
      !["delivered", "closed", "cancelled"].includes(request.status),
  );
  const outstanding = (entries?.page ?? [])
    .filter((entry) => entry.postingKind === "obligation")
    .reduce(
      (sum, entry) => sum + (entry.obligation?.outstandingPesewas ?? 0),
      0,
    );

  return (
    <main className="pilot-admin">
      <header className="pilot-admin__hero">
        <div>
          <span className="pilot-admin__eyebrow">Maize control room</span>
          <h1>Act on the next operational risk.</h1>
          <p>Track supply, collections, funding and payments.</p>
        </div>
        <div className="pilot-admin__selector">
          <label htmlFor="programme">Programme</label>
          <select
            id="programme"
            value={selected?.id ?? ""}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {visibleProgrammes.map((programme) => (
              <option key={programme.id} value={programme.id}>
                {programme.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {selected === undefined ? (
        <CreateProgramme
          canManage={canManageProgrammes}
          demoPresentation={demoPresentation}
        />
      ) : (
        <>
          {demoPresentation ? (
            <div className="pilot-admin__sample">
              <Sprout size={18} />
              <strong>Demonstration</strong>
              <span>No real orders or payments.</span>
            </div>
          ) : null}
          <section className="pilot-admin__metrics" aria-label="Priority risks">
            <Metric
              label="Supply requests"
              value={requestRows.length}
              detail={`${requestRows.filter((row) => ["submitted", "under_review", "quoted"].includes(row.status)).length} still sourcing`}
            />
            <Metric
              label="Overdue actions"
              value={overdueIssues.length}
              detail={`${openIssues.length} open issues`}
              danger={overdueIssues.length > 0}
            />
            <Metric
              label="Collection risk"
              value={atRiskCollections.length}
              detail="Past delivery window"
              danger={atRiskCollections.length > 0}
            />
            <Metric
              label="Unpaid obligations"
              value={money(outstanding)}
              detail="Actual outstanding ledger"
              danger={outstanding > 0}
            />
          </section>

          <div className="pilot-admin__grid">
            <section className="pilot-admin__panel pilot-admin__panel--wide">
              <div className="pilot-admin__panel-head">
                <div>
                  <span className="pilot-admin__eyebrow">
                    Demand and exceptions
                  </span>
                  <h2>Work that needs attention</h2>
                </div>
              </div>
              <div className="pilot-admin__request-list">
                {requestRows.map((request) => (
                  <Link
                    key={request.requestId}
                    href={`/pilot/requests/${request.requestId}`}
                    className="pilot-admin__request"
                  >
                    <div>
                      <strong>
                        {kg(request.confirmedGrams ?? request.requestedGrams)}{" "}
                        maize
                      </strong>
                      <span>
                        {request.commercialMode.replaceAll("_", " ")} ·{" "}
                        {request.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <span>Statement →</span>
                  </Link>
                ))}
                {requestRows.length === 0 ? (
                  <p className="pilot-admin__muted">
                    No requests are recorded for this programme.
                  </p>
                ) : null}
              </div>
              {openIssues.length > 0 ? (
                <div className="pilot-admin__issues">
                  {openIssues.slice(0, 5).map((issue) => (
                    <article key={issue._id}>
                      <AlertTriangle size={18} />
                      <div>
                        <strong>{issue.summary}</strong>
                        <p>{issue.nextStep}</p>
                        <small>
                          {issue.deadlineAt === undefined
                            ? "No deadline"
                            : new Date(issue.deadlineAt).toLocaleString()}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>

            <ProgrammeConfiguration
              programme={selected}
              canManage={canManageProgrammes}
            />
            <AssignmentManager
              programme={selected}
              assignments={assignments?.page ?? []}
              candidates={candidates ?? []}
              canManage={canManageAssignments}
            />
            <FinancePanel
              programme={selected}
              summary={finance}
              queue={queue ?? []}
              canRead={canReadFinance}
              canManage={canManageFinance}
            />
          </div>
          <CreateProgramme
            canManage={canManageProgrammes}
            compact
            demoPresentation={demoPresentation}
          />
        </>
      )}
    </main>
  );
}

function ProgrammeConfiguration({
  programme,
  canManage,
}: {
  programme: Programme;
  canManage: boolean;
}) {
  const simplifiedPresentation =
    process.env.NEXT_PUBLIC_DEMO_PRESENTATION === "true" ||
    process.env.NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED === "true";
  const configure = useMutation(api.pilotProgrammes.configure);
  const setStatus = useMutation(api.pilotProgrammes.setStatus);
  const current = programme.currentCommercialConfiguration;
  const [maizeType, setMaizeType] = useState(
    current?.qualityPolicy?.maizeType ?? "Yellow maize",
  );
  const [moisture, setMoisture] = useState(
    String((current?.qualityPolicy?.moistureMaximumPermille ?? 135) / 10),
  );
  const [fee, setFee] = useState(
    String(
      (current?.chargeTerms?.[0]?.rate.numerator ?? 25) /
        (current?.chargeTerms?.[0]?.rate.scale ?? 1) /
        100,
    ),
  );
  const [paymentDays, setPaymentDays] = useState(
    String(current?.paymentTerms?.[0]?.offsetCalendarDays ?? 2),
  );
  const [limit, setLimit] = useState(
    String((current?.purchaseLimitPesewas ?? 500_000) / 100),
  );
  const [reference, setReference] = useState(
    current?.approvalReferences.join(", ") ??
      (programme.datasetProvenance === "sample_only"
        ? "DEMO-ASSUMPTION-01"
        : ""),
  );
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save(configurationStatus: "draft" | "approved") {
    setBusy(true);
    setMessage(undefined);
    try {
      await configure({
        programmeId: programme.id,
        configurationStatus,
        qualityPolicy: {
          maizeType: maizeType.trim(),
          moistureMaximumPermille: Math.round(Number(moisture) * 10),
          contaminationCheckRequired: true,
          additionalCriteria: [
            {
              code: "VISIBLE_MOULD",
              label: "No visible mould",
              required: true,
            },
          ],
          policyProvenance: programme.datasetProvenance,
        },
        chargeTerms: [
          {
            code: "COORDINATION_FEE",
            label: "Coordination fee",
            payer: "buyer",
            calculation: "per_kg",
            rate: {
              numerator: Math.round(Number(fee) * 100),
              scale: 1,
              unit: "per_kg",
            },
          },
        ],
        paymentTerms: [
          {
            trigger: "buyer_acceptance",
            offsetCalendarDays: Number(paymentDays),
            timezone: "Africa/Accra",
          },
        ],
        purchaseLimitPesewas: Math.round(Number(limit) * 100),
        taxTerms: [
          {
            code: "TAX_REVIEW",
            label: "Tax treatment",
            detail:
              "Apply only documented taxes for the transaction; no tax is inferred by the demo.",
          },
        ],
        approvalReferences: reference
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        expectedVersion: programme.version,
        idempotencyKey: crypto.randomUUID(),
      });
      setMessage(
        configurationStatus === "approved"
          ? "Configuration approved."
          : "Draft saved.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Configuration was not saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: Programme["status"]) {
    setBusy(true);
    setMessage(undefined);
    try {
      await setStatus({
        programmeId: programme.id,
        status,
        expectedVersion: programme.version,
        reason:
          status === "active"
            ? "Approved for pilot operations"
            : "Administrative programme state change",
        idempotencyKey: crypto.randomUUID(),
      });
      setMessage(`Programme changed to ${status}.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Programme status was not changed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pilot-admin__panel">
      <div className="pilot-admin__panel-head">
        <div>
          <span className="pilot-admin__eyebrow">Commercial policy</span>
          <h2>Configuration</h2>
        </div>
        <StatusPill>{programme.commercialConfigurationStatus}</StatusPill>
      </div>
      <fieldset disabled={!canManage || busy} className="pilot-admin__form">
        <label>
          Maize type
          <input
            value={maizeType}
            onChange={(event) => setMaizeType(event.target.value)}
          />
        </label>
        <label>
          Maximum moisture (%)
          <input
            type="number"
            step="0.1"
            value={moisture}
            onChange={(event) => setMoisture(event.target.value)}
          />
        </label>
        <label>
          Buyer coordination fee (GHS/kg)
          <input
            type="number"
            step="0.01"
            value={fee}
            onChange={(event) => setFee(event.target.value)}
          />
        </label>
        <label>
          Farmer payment after acceptance (days)
          <input
            type="number"
            min="0"
            value={paymentDays}
            onChange={(event) => setPaymentDays(event.target.value)}
          />
        </label>
        {!simplifiedPresentation ? (
          <label>
            Per-transaction funding limit (GHS)
            <input
              type="number"
              min="0"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
            />
          </label>
        ) : null}
        <label>
          Approval reference(s)
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Board minute or approval record"
          />
        </label>
      </fieldset>
      <div className="pilot-admin__actions">
        <button
          disabled={!canManage || busy}
          onClick={() => void save("draft")}
        >
          Save draft
        </button>
        <button
          className="primary"
          disabled={!canManage || busy}
          onClick={() => void save("approved")}
        >
          <CheckCircle2 size={16} /> Approve terms
        </button>
        {programme.status !== "active" ? (
          <button
            disabled={!canManage || busy}
            onClick={() => void changeStatus("active")}
          >
            Enable programme
          </button>
        ) : (
          <button
            disabled={!canManage || busy}
            onClick={() => void changeStatus("suspended")}
          >
            Suspend
          </button>
        )}
      </div>
      {!canManage ? (
        <p className="pilot-admin__muted">
          Your role can read this policy but cannot change or enable it.
        </p>
      ) : null}
      {message ? (
        <p role="status" className="pilot-admin__message">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function AssignmentManager({
  programme,
  assignments,
  candidates,
  canManage,
}: {
  programme: Programme;
  assignments: Array<{
    assignmentId: Id<"pilotAssignments">;
    userId: Id<"users">;
    capabilities: string[];
    version: number;
  }>;
  candidates: Array<{
    userId: Id<"users">;
    name: string;
    identityKind: string;
    warehouseCount: number;
  }>;
  canManage: boolean;
}) {
  const grant = useMutation(api.pilotAssignments.grant);
  const revoke = useMutation(api.pilotAssignments.revoke);
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState<string>();
  const candidateName = (id: string) =>
    candidates.find((item) => item.userId === id)?.name ?? id.slice(-8);
  return (
    <section className="pilot-admin__panel">
      <div className="pilot-admin__panel-head">
        <div>
          <span className="pilot-admin__eyebrow">Scoped access</span>
          <h2>Programme team</h2>
        </div>
        <UserPlus size={22} />
      </div>
      <div className="pilot-admin__assignment-form">
        <select
          aria-label="Assignment target"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        >
          <option value="">Choose an approved operator</option>
          {candidates.map((candidate) => (
            <option key={candidate.userId} value={candidate.userId}>
              {candidate.name} · {candidate.identityKind} ·{" "}
              {candidate.warehouseCount} warehouses
            </option>
          ))}
        </select>
        <button
          disabled={!canManage || target === ""}
          onClick={() =>
            void grant({
              programmeId: programme.id,
              targetUserId: target as Id<"users">,
              capabilities: [...capabilities],
              idempotencyKey: crypto.randomUUID(),
            })
              .then(() => setMessage("Programme access granted."))
              .catch((error: unknown) =>
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Access was not granted.",
                ),
              )
          }
        >
          Grant access
        </button>
      </div>
      <Link
        className="pilot-admin__text-link"
        href={`/access?type=pilot_operations_invite&pilotProgrammeId=${programme.id}`}
      >
        Invite an operator →
      </Link>
      <div className="pilot-admin__assignments">
        {assignments.map((assignment) => (
          <div key={assignment.assignmentId}>
            <div>
              <strong>{candidateName(assignment.userId)}</strong>
              <span>{assignment.capabilities.length} capabilities</span>
            </div>
            <button
              disabled={!canManage}
              onClick={() =>
                void revoke({
                  assignmentId: assignment.assignmentId,
                  expectedVersion: assignment.version,
                  reason: "Programme access removed by administrator",
                  idempotencyKey: crypto.randomUUID(),
                })
                  .then(() => setMessage("Assignment revoked."))
                  .catch((error: unknown) =>
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "Assignment was not revoked.",
                    ),
                  )
              }
            >
              Revoke
            </button>
          </div>
        ))}
      </div>
      {message ? (
        <p role="status" className="pilot-admin__message">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function FinancePanel({
  summary,
  queue,
  canRead,
  canManage,
  programme,
}: {
  summary: FinanceSummary | undefined;
  queue: ApprovalRow[];
  canRead: boolean;
  canManage: boolean;
  programme?: Programme;
}) {
  const { firebaseUser } = useAdminAuth();
  const reserve = useMutation(api.pilotFinance.reserveFunding);
  const createBudget = useMutation(api.pilotFinance.createBudget);
  const [costByRevision, setCostByRevision] = useState<Record<string, string>>(
    {},
  );
  const [message, setMessage] = useState<string>();
  const demoPresentation = process.env.NEXT_PUBLIC_DEMO_PRESENTATION === "true";
  const [budgetForm, setBudgetForm] = useState({
    label: demoPresentation ? "Demonstration fund" : "",
    reference: demoPresentation ? "DEMO-FUND-01" : "",
    capacity: demoPresentation ? "50000" : "",
  });
  const [budgetEvidence, setBudgetEvidence] = useState<File>();
  if (!canRead)
    return (
      <section className="pilot-admin__panel">
        <ShieldCheck size={24} />
        <h2>Finance is restricted</h2>
        <p className="pilot-admin__muted">
          A programme-scoped finance permission is required to read statements
          or purchasing capacity.
        </p>
      </section>
    );
  const budget = summary?.budgets.find((item) => item.status === "active");
  const actuals = summary?.actuals;
  return (
    <section className="pilot-admin__panel pilot-admin__panel--wide">
      <div className="pilot-admin__panel-head">
        <div>
          <span className="pilot-admin__eyebrow">Finance-only actions</span>
          <h2>Purchasing exposure and actuals</h2>
        </div>
        <CircleDollarSign size={24} />
      </div>
      <div className="pilot-admin__finance-grid">
        <FinanceMetric
          label="Gross produce value"
          value={actuals?.buyerProducePesewas}
        />
        <FinanceMetric
          label="Coordination fees"
          value={actuals?.coordinationRevenuePesewas}
        />
        <FinanceMetric
          label="Farmer liabilities"
          value={actuals?.farmerPayablesPesewas}
        />
        <FinanceMetric
          label="Operating costs"
          value={actuals?.operatingCostPesewas}
        />
        <FinanceMetric
          label="Cash received"
          value={actuals?.buyerReceiptsPesewas}
        />
        <FinanceMetric
          label="Actual contribution"
          value={
            actuals?.contribution.status === "complete"
              ? actuals.contribution.amountPesewas
              : undefined
          }
          incomplete={actuals?.contribution.status === "incomplete"}
        />
      </div>
      <p className="pilot-admin__muted">
        Gross produce value is not revenue. Contribution remains incomplete
        until required actual costs and corrections are recorded.
      </p>
      <h3>Purchase approvals</h3>
      {budget === undefined ? (
        <>
          <p className="pilot-admin__warning">
            No active purchasing budget. A finance manager must create approved
            capacity with private funding evidence.
          </p>
          {canManage && programme !== undefined ? (
            <div className="pilot-admin__form pilot-admin__form--row">
              <label>
                Funding source
                <input
                  value={budgetForm.label}
                  onChange={(event) =>
                    setBudgetForm((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Approval reference
                <input
                  value={budgetForm.reference}
                  onChange={(event) =>
                    setBudgetForm((current) => ({
                      ...current,
                      reference: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Capacity (GHS)
                <input
                  type="number"
                  min="0.01"
                  value={budgetForm.capacity}
                  onChange={(event) =>
                    setBudgetForm((current) => ({
                      ...current,
                      capacity: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Private funding evidence
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(event) =>
                    setBudgetEvidence(event.target.files?.[0])
                  }
                />
              </label>
              <button
                className="primary"
                disabled={firebaseUser === null || budgetEvidence === undefined}
                onClick={() =>
                  firebaseUser === null || budgetEvidence === undefined
                    ? undefined
                    : void uploadFinancialEvidence({
                        user: firebaseUser,
                        file: budgetEvidence,
                        programmeId: programme.id,
                        relatedEntityType: "pilotProgrammes",
                        relatedEntityId: programme.id,
                      })
                        .then((assetId) =>
                          createBudget({
                            programmeId: programme.id,
                            fundingSourceLabel: budgetForm.label,
                            fundingSourceReference: budgetForm.reference,
                            fundingEvidenceUploadAssetIds: [
                              assetId as Id<"uploadAssets">,
                            ],
                            approvedCapacityPesewas: Math.round(
                              Number(budgetForm.capacity) * 100,
                            ),
                            datasetProvenance: programme.datasetProvenance,
                            idempotencyKey: crypto.randomUUID(),
                          }),
                        )
                        .then(() =>
                          setMessage(
                            "Purchasing budget created from the documented funding source.",
                          ),
                        )
                        .catch((error: unknown) =>
                          setMessage(
                            error instanceof Error
                              ? error.message
                              : "Budget was not created.",
                          ),
                        )
                }
              >
                Create purchasing budget
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="pilot-admin__budget">
          Available capacity <strong>{money(budget.availablePesewas)}</strong> ·{" "}
          {budget.fundingSourceLabel}
        </p>
      )}
      <div className="pilot-admin__queue">
        {queue.map((row) => (
          <div key={row.farmerOfferRevisionId}>
            <div>
              <strong>
                {row.farmerName} · {kg(row.offeredGrams)}
              </strong>
              <span>
                {money(row.expectedNetPesewas)} farmer proceeds ·{" "}
                {row.approvalStatus.replaceAll("_", " ")}
              </span>
            </div>
            {row.approvalStatus === "awaiting_approval" ? (
              <div className="pilot-admin__approve">
                <label>
                  Known costs (GHS)
                  <input
                    type="number"
                    min="0"
                    value={costByRevision[row.farmerOfferRevisionId] ?? "0"}
                    onChange={(event) =>
                      setCostByRevision((current) => ({
                        ...current,
                        [row.farmerOfferRevisionId]: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  disabled={!canManage || budget === undefined}
                  onClick={() =>
                    budget === undefined
                      ? undefined
                      : void reserve({
                          budgetId: budget.budgetId,
                          requestId: row.requestId,
                          buyerAgreementRevisionId:
                            row.buyerAgreementRevisionId,
                          farmerOfferRevisionId: row.farmerOfferRevisionId,
                          produceAmountPesewas: row.expectedNetPesewas,
                          knownCostAmountPesewas: Math.round(
                            Number(
                              costByRevision[row.farmerOfferRevisionId] ?? 0,
                            ) * 100,
                          ),
                          expiresAt: Math.max(
                            Date.now() + 3_600_000,
                            row.expiresAt,
                          ),
                          expectedBudgetVersion: budget.version,
                          idempotencyKey: crypto.randomUUID(),
                        })
                          .then(() => setMessage("Purchase capacity reserved."))
                          .catch((error: unknown) =>
                            setMessage(
                              error instanceof Error
                                ? error.message
                                : "Purchase approval failed.",
                            ),
                          )
                  }
                >
                  Approve funding
                </button>
              </div>
            ) : (
              <StatusPill>approved</StatusPill>
            )}
          </div>
        ))}
      </div>
      {!canManage ? (
        <p className="pilot-admin__muted">
          Read-only finance access: approval and settlement controls are
          disabled.
        </p>
      ) : null}
      {message ? (
        <p role="status" className="pilot-admin__message">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function CreateProgramme({
  canManage,
  compact = false,
  demoPresentation,
}: {
  canManage: boolean;
  compact?: boolean;
  demoPresentation: boolean;
}) {
  const create = useMutation(api.pilotProgrammes.create);
  const [open, setOpen] = useState(!compact);
  const [message, setMessage] = useState<string>();
  const [form, setForm] = useState({
    code: demoPresentation ? "MAIZE_DEMO" : "MAIZE_WESTERN",
    name: "Maize sourcing",
    region: "Western Region",
    datasetId: "maize-demo-v1",
  });
  if (!canManage) return null;
  if (!open)
    return (
      <button className="pilot-admin__new" onClick={() => setOpen(true)}>
        Create another programme
      </button>
    );
  return (
    <section className="pilot-admin__panel pilot-admin__create">
      <div>
        <span className="pilot-admin__eyebrow">Programme setup</span>
        <h2>Create maize programme</h2>
      </div>
      <div className="pilot-admin__form pilot-admin__form--row">
        {(["code", "name", "region"] as const).map((key) => (
          <label key={key}>
            {key}
            <input
              value={form[key]}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
            />
          </label>
        ))}
        {demoPresentation ? (
          <label>
            Dataset ID
            <input
              value={form.datasetId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  datasetId: event.target.value,
                }))
              }
            />
          </label>
        ) : null}
      </div>
      <div className="pilot-admin__actions">
        <button
          className="primary"
          onClick={() =>
            void create({
              code: form.code,
              name: form.name,
              region: form.region,
              datasetProvenance: demoPresentation ? "sample_only" : "live",
              ...(demoPresentation ? { datasetId: form.datasetId } : {}),
              idempotencyKey: crypto.randomUUID(),
            })
              .then(() => setMessage("Programme created."))
              .catch((error: unknown) =>
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Programme was not created.",
                ),
              )
          }
        >
          Create programme
        </button>
        {compact ? (
          <button onClick={() => setOpen(false)}>Cancel</button>
        ) : null}
      </div>
      {message ? (
        <p role="status" className="pilot-admin__message">
          {message}
        </p>
      ) : null}
    </section>
  );
}

type FinancialEntry = {
  postingKind: string;
  obligation?: { outstandingPesewas: number };
};
type ApprovalRow = {
  requestId: Id<"pilotBuyerRequests">;
  buyerAgreementRevisionId: Id<"pilotBuyerAgreementRevisions">;
  farmerOfferRevisionId: Id<"pilotFarmerOfferRevisions">;
  farmerName: string;
  offeredGrams: number;
  expectedNetPesewas: number;
  expiresAt: number;
  approvalStatus: "approved" | "awaiting_approval";
};
type FinanceSummary = {
  budgets: Array<{
    budgetId: Id<"pilotPurchasingBudgets">;
    fundingSourceLabel: string;
    availablePesewas: number;
    status: string;
    version: number;
  }>;
  actuals: {
    buyerProducePesewas: number;
    farmerPayablesPesewas: number;
    coordinationRevenuePesewas: number;
    operatingCostPesewas: number;
    buyerReceiptsPesewas: number;
    contribution:
      | { status: "complete"; amountPesewas: number }
      | { status: "incomplete" };
  };
};
function Metric({
  label,
  value,
  detail,
  danger = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  danger?: boolean;
}) {
  return (
    <article
      className={`pilot-admin__metric${danger ? " pilot-admin__metric--danger" : ""}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function FinanceMetric({
  label,
  value,
  incomplete = false,
}: {
  label: string;
  value: number | undefined;
  incomplete?: boolean;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{incomplete ? "Incomplete" : money(value ?? 0)}</strong>
    </div>
  );
}
function StatusPill({ children }: { children: string }) {
  return (
    <span className="pilot-admin__pill">{children.replaceAll("_", " ")}</span>
  );
}
function StateCard({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="pilot-admin">
      <section className="pilot-admin__panel">
        <h1>{title}</h1>
        <p>{detail}</p>
      </section>
    </main>
  );
}
function money(pesewas: number) {
  return `GHS ${(pesewas / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function kg(grams: number) {
  return `${(grams / 1000).toLocaleString()} kg`;
}
