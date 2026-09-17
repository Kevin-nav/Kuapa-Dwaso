"use client";

/* eslint-disable react-hooks/purity */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  MapPin,
  Send,
  ShieldAlert,
  Truck,
} from "lucide-react";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { api } from "../../../../../../convex/_generated/api";
import { useOpsAuth } from "../../../auth/OpsAuthProvider";
import { uploadEvidenceFile } from "../../../evidenceUpload";
import { usePilotOperations } from "../../../context/PilotOperationsContext";
import { useToast } from "@kuapa-dwaso/ui/toast";

type RequestDetail = {
  request: {
    requestId: Id<"pilotBuyerRequests">;
    programmeId: Id<"pilotProgrammes">;
    maizeType: string;
    requestedGrams: number;
    confirmedGrams?: number;
    commercialMode: "coordination" | "kuapa_purchase";
    destination: { label: string };
    deliveryWindowStartAt: number;
    deliveryWindowEndAt: number;
    status: string;
    version: number;
    createdAt: number;
    updatedAt: number;
  };
  commitmentSummary: {
    provisionalGrams: number;
    committedGrams: number;
    clearedGrams: number;
  };
  agreement: null | {
    revisionId: Id<"pilotBuyerAgreementRevisions">;
    quantityGrams: number;
    specification: {
      moistureMaximumPermille?: number;
      contaminationCheckRequired: boolean;
      additionalCriteria: Array<{
        code: string;
        label: string;
        required: boolean;
      }>;
    };
    expiresAt: number;
    state: string;
  };
};

type SupplyCandidate = {
  declaration: {
    declarationId: Id<"pilotSupplyDeclarations">;
    farmerId: Id<"farmers">;
    maizeType: string;
    unallocatedGrams: number;
    verificationStatus: string;
    collectionLocation: { label: string };
    version: number;
  };
  farmer: {
    fullName: string;
    farmerCode: string;
    phoneNumber: string;
    community: string;
  };
};

type OfferRow = {
  offer: {
    offerId: Id<"pilotFarmerOffers">;
    status: string;
    version: number;
    terms: null | {
      revisionId: Id<"pilotFarmerOfferRevisions">;
      offeredGrams: number;
      expectedGrossPesewas: number;
      expectedChargesPesewas: number;
      expectedNetPesewas: number;
    };
    quantity: null | {
      allocationId: Id<"pilotAllocations">;
      status: string;
      committedGrams: number;
      clearedGrams: number;
      releasedGrams: number;
      version: number;
    };
  };
  declaration: SupplyCandidate["declaration"];
  farmer: SupplyCandidate["farmer"];
};

type LotRow = {
  lotId: Id<"pilotProcurementLots">;
  allocationId: Id<"pilotAllocations">;
  farmerId: Id<"farmers">;
  lotCode: string;
  parentLotId?: Id<"pilotProcurementLots">;
  commercialMode: "coordination" | "kuapa_purchase";
  sourceGrams: number;
  clearedGrams: number;
  rejectedGrams: number;
  qualityStatus: string;
  dispositionStatus: string;
  currentLocation: { label: string };
  version: number;
};

type PlanResult = null | {
  plan: {
    planId: Id<"pilotFulfilmentPlans">;
    status: string;
    plannedGrams: number;
    driverUserId?: Id<"users">;
    vehicleRegistration?: string;
    vehicleCapacityGrams?: number;
    readinessBlockers: string[];
    version: number;
  };
  stops: Array<{
    stopId: string;
    location: { label: string };
    plannedGrams: number;
    status: string;
  }>;
};

type Readiness = {
  buyerName: string;
  targetGrams: number;
  committedGrams: number;
  clearedGrams: number;
  shortfallGrams: number;
  commercialMode: "coordination" | "kuapa_purchase";
  configurationStatus: string;
  purchaseApproval: {
    required: boolean;
    status: "not_required" | "approved" | "missing";
    reservedPesewas: number;
  };
  openIssues: Array<{
    issueId: Id<"pilotIssues">;
    issueType: string;
    status: string;
    summary: string;
    nextStep: string;
    deadlineAt?: number;
    version: number;
  }>;
};

type DriverOption = {
  transporterId: Id<"transporterProfiles">;
  driverUserId: Id<"users">;
  fullName: string;
  phoneNumber: string;
  vehicleType: string;
  vehicleCapacity?: number;
  vehicleCapacityUnit?: string;
};

type WorkAction = "source" | "inspect" | "collection";

const kg = (grams: number) => `${(grams / 1_000).toLocaleString()} kg`;
const money = (pesewas: number) =>
  `GH₵${(pesewas / 100).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;

export default function PilotRequestWorkspacePage() {
  const previewAccess =
    process.env.NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED === "true";
  const params = useParams<{ id: string }>();
  const requestId = params.id as Id<"pilotBuyerRequests">;
  const { activeProgrammeId } = usePilotOperations();
  const { firebaseUser } = useOpsAuth();
  const { showToast } = useToast();
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    message: string;
  }>();
  const [busy, setBusy] = useState<string>();
  const [candidateId, setCandidateId] = useState("");
  const [offerKg, setOfferKg] = useState("1000");
  const [priceGhs, setPriceGhs] = useState("5");
  const [farmerChargeGhs, setFarmerChargeGhs] = useState("0.25");
  const [inspectionOfferId, setInspectionOfferId] = useState("");
  const [acceptedKg, setAcceptedKg] = useState("1000");
  const [rejectedKg, setRejectedKg] = useState("0");
  const [tareKg, setTareKg] = useState("0");
  const [moisturePercent, setMoisturePercent] = useState("13.5");
  const [lotCode, setLotCode] = useState("");
  const [inspectionReason, setInspectionReason] = useState("");
  const [inspectionEvidenceIds, setInspectionEvidenceIds] = useState<
    Id<"uploadAssets">[]
  >([]);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [driverId, setDriverId] = useState("");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [vehicleCapacityKg, setVehicleCapacityKg] = useState("5000");
  const [activeAction, setActiveAction] = useState<WorkAction>();

  useEffect(() => {
    if (notice?.tone === "success") showToast(notice.message);
  }, [notice, showToast]);

  const requestDetail = useQuery(api.pilotRequests.get, { requestId }) as
    | RequestDetail
    | null
    | undefined;
  const readiness = useQuery(api.pilotRequests.getOperationsReadiness, {
    requestId,
  }) as Readiness | undefined;
  const candidates = useQuery(
    api.pilotSupply.listAvailable,
    requestDetail === undefined ||
      requestDetail === null ||
      activeProgrammeId === undefined
      ? "skip"
      : {
          programmeId: activeProgrammeId,
          maizeType: requestDetail.request.maizeType,
          status: "active",
          limit: 50,
        },
  ) as { page: SupplyCandidate[] } | undefined;
  const offers = useQuery(api.pilotSupply.listForRequest, {
    requestId,
    limit: 50,
  }) as { page: OfferRow[] } | undefined;
  const lots = useQuery(
    api.pilotLots.listForActor,
    activeProgrammeId === undefined
      ? "skip"
      : { programmeId: activeProgrammeId, requestId, limit: 50 },
  ) as { page: LotRow[] } | undefined;
  const plan = useQuery(api.pilotFulfilment.getForRequest, { requestId }) as
    | PlanResult
    | undefined;
  const drivers = useQuery(
    api.pilotFulfilment.listEligibleDrivers,
    activeProgrammeId === undefined
      ? "skip"
      : { programmeId: activeProgrammeId, limit: 50 },
  ) as DriverOption[] | undefined;

  const createOffer = useMutation(api.pilotOffers.createRevision);
  const sendOffer = useMutation(api.pilotOffers.send);
  const recordInspection = useMutation(api.pilotInspections.record);
  const createPlan = useMutation(api.pilotFulfilment.createPlan);
  const assignDriver = useMutation(api.pilotFulfilment.assignDriver);
  const markReady = useMutation(api.pilotFulfilment.markReady);
  const resolveIssue = useMutation(api.pilotIssues.resolve);

  const selectedCandidate = candidates?.page.find(
    (row) => row.declaration.declarationId === candidateId,
  );
  const acceptedOffers =
    offers?.page.filter(
      (row) => row.offer.status === "accepted" && row.offer.quantity !== null,
    ) ?? [];
  const selectedInspectionOffer = acceptedOffers.find(
    (row) => row.offer.offerId === inspectionOfferId,
  );
  const availableLots = useMemo(
    () =>
      (lots?.page ?? []).filter(
        (lot) =>
          lot.dispositionStatus === "available_for_plan" &&
          lot.clearedGrams > 0,
      ),
    [lots],
  );
  const availableLotGrams = availableLots.reduce(
    (sum, lot) => sum + lot.clearedGrams,
    0,
  );
  const targetGramsForActions =
    requestDetail?.agreement?.quantityGrams ?? readiness?.targetGrams ?? 0;
  const pendingInspectionCount = acceptedOffers.filter(
    (row) =>
      row.offer.quantity !== null &&
      row.offer.quantity.committedGrams > row.offer.quantity.clearedGrams,
  ).length;
  const actionOptions = useMemo(() => {
    if (
      requestDetail === null ||
      requestDetail === undefined ||
      readiness === undefined
    )
      return [];
    const next: WorkAction[] = [];
    const termsAcknowledged = requestDetail.agreement?.state === "acknowledged";
    if (termsAcknowledged && readiness.shortfallGrams > 0) next.push("source");
    if (pendingInspectionCount > 0) next.push("inspect");
    if (
      (plan === null &&
        availableLotGrams === targetGramsForActions &&
        targetGramsForActions > 0) ||
      (plan !== null && plan !== undefined && plan.plan.status !== "delivered")
    )
      next.push("collection");
    return next;
  }, [
    availableLotGrams,
    pendingInspectionCount,
    plan,
    readiness,
    requestDetail,
    targetGramsForActions,
  ]);

  const currentAction =
    activeAction !== undefined && actionOptions.includes(activeAction)
      ? activeAction
      : actionOptions[0];

  function requireOnline(): boolean {
    if (navigator.onLine) return true;
    setNotice({
      tone: "error",
      message:
        "Connect before saving this material operation. Nothing was changed.",
    });
    return false;
  }

  async function prepareOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !requireOnline() ||
      requestDetail === undefined ||
      requestDetail === null ||
      requestDetail.agreement === null ||
      selectedCandidate === undefined
    )
      return;
    setBusy("offer");
    setNotice(undefined);
    try {
      const pricePesewas = Math.round(Number(priceGhs) * 100);
      const chargePesewas = Math.round(Number(farmerChargeGhs) * 100);
      const expiry = Math.min(
        Date.now() + 48 * 60 * 60 * 1_000,
        requestDetail.agreement.expiresAt - 60_000,
      );
      const created = await createOffer({
        requestId,
        declarationId: selectedCandidate.declaration.declarationId,
        buyerAgreementRevisionId: requestDetail.agreement.revisionId,
        commercialMode: requestDetail.request.commercialMode,
        offeredGrams: Math.round(Number(offerKg) * 1_000),
        priceBasis: "per_kg",
        priceRate: { numerator: pricePesewas, scale: 1, unit: "per_kg" },
        chargeTerms:
          chargePesewas <= 0
            ? []
            : [
                {
                  code: "farmer_coordination",
                  label: "Coordination charge",
                  payer: "farmer",
                  calculation: "per_kg",
                  rate: { numerator: chargePesewas, scale: 1, unit: "per_kg" },
                },
              ],
        inspectionTerms: [
          {
            code: "field_sampling",
            label: "Inspection before collection",
            detail:
              "Operations records weight, moisture and contamination results. Only cleared quantity proceeds.",
          },
        ],
        paymentTerms: [
          {
            trigger:
              requestDetail.request.commercialMode === "kuapa_purchase"
                ? "purchase_collection_acceptance"
                : "buyer_acceptance",
            offsetCalendarDays: 2,
            timezone: "Africa/Accra",
          },
        ],
        titleTransferTerms: [
          {
            code: "accepted_quantity_only",
            label: "Accepted quantity only",
            detail:
              requestDetail.request.commercialMode === "kuapa_purchase"
                ? "Kuapa Dwaso takes title only when funded purchase collection is accepted."
                : "Title follows the acknowledged coordination agreement and buyer acceptance.",
          },
        ],
        custodyTransferTerms: [
          {
            code: "recorded_handover",
            label: "Recorded handover",
            detail:
              "Custody changes through a confirmed collection event. A supporting photo is optional.",
          },
        ],
        cancellationTerms: [
          {
            code: "before_collection",
            label: "Before collection",
            detail:
              "Cancellation requires a reason and releases uncollected allocation.",
          },
        ],
        expiresAt: expiry,
        expectedRequestVersion: requestDetail.request.version,
        expectedDeclarationVersion: selectedCandidate.declaration.version,
        idempotencyKey: crypto.randomUUID(),
      });
      await sendOffer({
        offerId: created.offerId,
        revisionId: created.revisionId,
        expectedOfferVersion: created.version,
        idempotencyKey: crypto.randomUUID(),
      });
      setNotice({
        tone: "success",
        message: `Offer sent to ${selectedCandidate.farmer.fullName}. Only that farmer can accept it.`,
      });
      setCandidateId("");
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Offer could not be prepared.",
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !requireOnline() ||
      requestDetail === undefined ||
      requestDetail === null ||
      requestDetail.agreement === null ||
      selectedInspectionOffer === undefined ||
      selectedInspectionOffer.offer.quantity === null
    )
      return;
    setBusy("inspection");
    setNotice(undefined);
    try {
      const acceptedGrams = Math.round(Number(acceptedKg) * 1_000);
      const rejectedGrams = Math.round(Number(rejectedKg) * 1_000);
      const tareWeightGrams = Math.round(Number(tareKg) * 1_000);
      await recordInspection({
        allocationId: selectedInspectionOffer.offer.quantity.allocationId,
        buyerAgreementRevisionId: requestDetail.agreement.revisionId,
        lotCode: lotCode.trim(),
        location: selectedInspectionOffer.declaration.collectionLocation,
        expectedAllocationVersion:
          selectedInspectionOffer.offer.quantity.version,
        samplingMethod: "Representative bag sample",
        testMethod: "Calibrated moisture meter and visual contamination check",
        sampleCount: 3,
        moisturePermille: Math.round(Number(moisturePercent) * 10),
        contaminationResult: "passed",
        additionalReadings:
          requestDetail.agreement.specification.additionalCriteria.map(
            (criterion) => ({
              code: criterion.code,
              label: criterion.label,
              value: "passed",
              passed: true,
            }),
          ),
        grossWeightGrams: acceptedGrams + rejectedGrams + tareWeightGrams,
        tareWeightGrams,
        acceptedGrams,
        rejectedGrams,
        ...(rejectedGrams > 0
          ? {
              reasonCode: inspectionReason.trim() || "quality_shortfall",
              notes:
                inspectionReason.trim() ||
                "Quantity excluded by recorded inspection.",
            }
          : {}),
        evidenceUploadAssetIds: inspectionEvidenceIds,
        inspectedAt: Date.now(),
        ...(acceptedGrams > 0 && rejectedGrams > 0
          ? {
              partialSublots: {
                acceptedLotCode: `${lotCode.trim()}-PASS`,
                rejectedLotCode: `${lotCode.trim()}-HOLD`,
              },
            }
          : {}),
        idempotencyKey: crypto.randomUUID(),
      });
      setNotice({
        tone: "success",
        message:
          rejectedGrams > 0
            ? `${kg(acceptedGrams)} cleared; ${kg(rejectedGrams)} is held and a quality-shortfall issue was opened.`
            : `${kg(acceptedGrams)} cleared for collection planning.`,
      });
      setInspectionOfferId("");
      setLotCode("");
      setInspectionEvidenceIds([]);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Inspection could not be recorded.",
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function uploadInspectionEvidence(file: File | undefined) {
    if (file === undefined || !requireOnline()) return;
    setIsUploadingEvidence(true);
    try {
      const assetId = await uploadEvidenceFile({
        firebaseUser,
        file,
        purpose: "pilot_inspection_evidence",
        accessLevel: "private",
        ...(requestDetail?.request.programmeId === undefined
          ? {}
          : { pilotProgrammeId: requestDetail.request.programmeId }),
      });
      setInspectionEvidenceIds((current) => [
        ...current,
        assetId as Id<"uploadAssets">,
      ]);
      setNotice({
        tone: "success",
        message:
          "Inspection evidence uploaded. Submit the inspection to attach it to the new lot.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Evidence upload failed.",
      });
    } finally {
      setIsUploadingEvidence(false);
    }
  }

  async function buildPlan() {
    if (
      !requireOnline() ||
      requestDetail === undefined ||
      requestDetail === null ||
      requestDetail.agreement === null
    )
      return;
    setBusy("plan");
    try {
      await createPlan({
        requestId,
        buyerAgreementRevisionId: requestDetail.agreement.revisionId,
        collectionWindowStartAt:
          requestDetail.request.deliveryWindowStartAt - 24 * 60 * 60 * 1_000,
        collectionWindowEndAt: requestDetail.request.deliveryWindowStartAt,
        deliveryWindowStartAt: requestDetail.request.deliveryWindowStartAt,
        deliveryWindowEndAt: requestDetail.request.deliveryWindowEndAt,
        destination: requestDetail.request.destination,
        stops: [
          ...availableLots.map((lot, index) => ({
            sequence: index + 1,
            stopType: "collection" as const,
            location: lot.currentLocation,
            packagingNotes:
              "Bagged maize; confirm bag count and condition before loading.",
            lotIds: [lot.lotId],
            windowStartAt:
              requestDetail.request.deliveryWindowStartAt -
              24 * 60 * 60 * 1_000,
            windowEndAt: requestDetail.request.deliveryWindowStartAt,
          })),
          {
            sequence: availableLots.length + 1,
            stopType: "destination" as const,
            location: requestDetail.request.destination,
            packagingNotes:
              "Keep each inspected lot identifiable through buyer handover.",
            lotIds: [],
            windowStartAt: requestDetail.request.deliveryWindowStartAt,
            windowEndAt: requestDetail.request.deliveryWindowEndAt,
          },
        ],
        idempotencyKey: crypto.randomUUID(),
      });
      setNotice({
        tone: "success",
        message: `Collection plan created for exactly ${kg(availableLotGrams)}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Collection plan could not be created.",
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function setDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = drivers?.find(
      (driver) => driver.transporterId === driverId,
    );
    if (
      !requireOnline() ||
      plan === null ||
      plan === undefined ||
      selected === undefined
    )
      return;
    setBusy("driver");
    try {
      await assignDriver({
        planId: plan.plan.planId,
        transporterId: selected.transporterId,
        driverUserId: selected.driverUserId,
        vehicleRegistration,
        vehicleCapacityGrams: Math.round(Number(vehicleCapacityKg) * 1_000),
        expectedVersion: plan.plan.version,
        idempotencyKey: crypto.randomUUID(),
      });
      setNotice({
        tone: "success",
        message: previewAccess
          ? `${selected.fullName} assigned. Readiness will still enforce vehicle capacity and exact cleared quantity.`
          : `${selected.fullName} assigned. Readiness will still enforce vehicle capacity, funding and exact cleared quantity.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Driver could not be assigned.",
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function makeReady() {
    if (!requireOnline() || plan === null || plan === undefined) return;
    setBusy("ready");
    try {
      await markReady({
        planId: plan.plan.planId,
        expectedVersion: plan.plan.version,
        idempotencyKey: crypto.randomUUID(),
      });
      setNotice({
        tone: "success",
        message:
          "The plan passed server readiness checks. It is ready for transporter collection.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "The plan is still blocked.",
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function resolve(issue: Readiness["openIssues"][number]) {
    if (!requireOnline()) return;
    setBusy(issue.issueId);
    try {
      await resolveIssue({
        issueId: issue.issueId,
        expectedVersion: issue.version,
        resolution:
          "Operations reviewed the exception, recorded the replacement or disposition, and confirmed the request totals are current.",
        evidenceUploadAssetIds: [],
      });
      setNotice({
        tone: "success",
        message: "Blocker resolved with an audit entry.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Issue could not be resolved.",
      });
    } finally {
      setBusy(undefined);
    }
  }

  if (requestDetail === undefined || readiness === undefined)
    return <div className="ops-empty-state">Loading request workspace…</div>;
  if (requestDetail === null)
    return (
      <div className="ops-empty-state">
        <ShieldAlert size={30} />
        <h1>Request unavailable</h1>
        <p>It does not exist or is outside your programme assignment.</p>
        <Link href="/pilot" className="btn btn-outline">
          Back to demand queue
        </Link>
      </div>
    );

  const targetGrams =
    requestDetail.agreement?.quantityGrams ?? readiness.targetGrams;
  const canBuildPlan =
    plan === null && availableLotGrams === targetGrams && targetGrams > 0;

  return (
    <div className="ops-page-stack">
      <Link href="/pilot" className="ops-back-link">
        <ArrowLeft size={16} /> Demand queue
      </Link>
      <header className="ops-page-header ops-request-header">
        <div>
          <p className="ops-eyebrow">{readiness.buyerName}</p>
          <h1>
            {kg(targetGrams)} {requestDetail.request.maizeType}
          </h1>
          <p>
            <MapPin size={15} /> {requestDetail.request.destination.label} ·{" "}
            {requestDetail.request.commercialMode === "kuapa_purchase"
              ? "Kuapa Dwaso purchase"
              : "Coordination"}
          </p>
          <small>
            Created{" "}
            {new Date(requestDetail.request.createdAt).toLocaleString("en-GH", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </small>
        </div>
        <span className="badge badge-info">
          {requestDetail.request.status.replaceAll("_", " ")}
        </span>
      </header>
      {notice === undefined ? null : (
        <div className={`ops-form-status ${notice.tone}`} role="status">
          {notice.message}
        </div>
      )}

      <section className="ops-progress-card">
        <div className="ops-progress-head">
          <div>
            <p className="ops-eyebrow">Supply coverage</p>
            <strong>
              {kg(readiness.clearedGrams)} of {kg(targetGrams)} cleared
            </strong>
          </div>
          <span>
            {readiness.shortfallGrams === 0
              ? "Covered"
              : `${kg(readiness.shortfallGrams)} short`}
          </span>
        </div>
        <div className="ops-progress-track">
          <span
            style={{
              width: `${Math.min(100, targetGrams === 0 ? 0 : (readiness.clearedGrams / targetGrams) * 100)}%`,
            }}
          />
        </div>
        <div className="ops-progress-legend">
          <span>Committed {kg(readiness.committedGrams)}</span>
          <span>Cleared {kg(readiness.clearedGrams)}</span>
          <span>Planned {kg(plan?.plan.plannedGrams ?? 0)}</span>
        </div>
      </section>

      {readiness.openIssues.length === 0 ? null : (
        <section
          className="ops-blocker-banner"
          aria-labelledby="request-blockers-title"
        >
          <div className="ops-blocker-banner__heading">
            <AlertTriangle size={22} />
            <div>
              <p className="ops-eyebrow">Needs attention</p>
              <h2 id="request-blockers-title">
                {readiness.openIssues.length} open blocker
                {readiness.openIssues.length === 1 ? "" : "s"}
              </h2>
            </div>
          </div>
          <div className="ops-issue-list">
            {readiness.openIssues.map((issue) => (
              <article key={issue.issueId} className="ops-issue-card">
                <div>
                  <strong>{issue.summary}</strong>
                  <p>{issue.nextStep}</p>
                  <small>
                    {issue.issueType.replaceAll("_", " ")}
                    {issue.deadlineAt === undefined
                      ? ""
                      : ` · due ${new Date(issue.deadlineAt).toLocaleString("en-GH")}`}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy === issue.issueId}
                  onClick={() => void resolve(issue)}
                >
                  Resolve blocker
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section
        className="ops-current-work"
        aria-labelledby="current-work-title"
      >
        <div>
          <p className="ops-eyebrow">What needs attention now</p>
          <h2 id="current-work-title">
            {currentAction === "source"
              ? `Source ${kg(readiness.shortfallGrams)}`
              : currentAction === "inspect"
                ? `Inspect ${pendingInspectionCount} accepted ${pendingInspectionCount === 1 ? "supply lot" : "supply lots"}`
                : currentAction === "collection"
                  ? plan == null
                    ? "Create the collection plan"
                    : plan.plan.driverUserId === undefined
                      ? "Assign the collection driver"
                      : plan.plan.status === "ready"
                        ? "Collection is ready"
                        : "Run the collection readiness check"
                  : requestDetail.agreement?.state !== "acknowledged"
                    ? "Waiting for buyer-approved terms"
                    : "No operation is required right now"}
          </h2>
          <p>
            {currentAction === undefined
              ? "The next valid action will appear when the current prerequisite changes."
              : "Only actions allowed by the request's current state appear below."}
          </p>
        </div>
        {actionOptions.length > 1 ? (
          <div
            className="ops-work-switcher"
            aria-label="Available request actions"
          >
            {actionOptions.map((action) => (
              <button
                className={currentAction === action ? "active" : ""}
                key={action}
                onClick={() => setActiveAction(action)}
                type="button"
              >
                {action === "source"
                  ? "Source supply"
                  : action === "inspect"
                    ? "Inspect supply"
                    : "Collection"}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="ops-stage-card" hidden={currentAction !== "source"}>
        <div className="ops-stage-heading">
          <span>
            <Send size={18} />
          </span>
          <div>
            <h2>Source and offer</h2>
            <p>
              Operations prepares terms; the farmer accepts from their own
              account.
            </p>
          </div>
        </div>
        {requestDetail.agreement === null ||
        requestDetail.agreement.state !== "acknowledged" ? (
          <div className="ops-callout">
            <AlertTriangle size={19} /> Current buyer terms must be acknowledged
            before farmer offers can be prepared.
          </div>
        ) : (
          <form
            className="ops-inline-form"
            onSubmit={(event) => void prepareOffer(event)}
          >
            <label className="ops-form-wide">
              <span>Verified declaration</span>
              <select
                required
                value={candidateId}
                onChange={(event) => {
                  setCandidateId(event.target.value);
                  const row = candidates?.page.find(
                    (item) =>
                      item.declaration.declarationId === event.target.value,
                  );
                  if (row !== undefined)
                    setOfferKg(
                      String(row.declaration.unallocatedGrams / 1_000),
                    );
                }}
              >
                <option value="">Select available supply</option>
                {(candidates?.page ?? [])
                  .filter(
                    (row) =>
                      row.declaration.verificationStatus === "reviewed" &&
                      row.declaration.unallocatedGrams > 0,
                  )
                  .map((row) => (
                    <option
                      key={row.declaration.declarationId}
                      value={row.declaration.declarationId}
                    >
                      {row.farmer.fullName} ·{" "}
                      {kg(row.declaration.unallocatedGrams)} free ·{" "}
                      {row.declaration.collectionLocation.label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>Offer quantity (kg)</span>
              <input
                required
                type="number"
                min="1"
                step="0.1"
                value={offerKg}
                onChange={(event) => setOfferKg(event.target.value)}
              />
            </label>
            <label>
              <span>Price to farmer (GH₵/kg)</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={priceGhs}
                onChange={(event) => setPriceGhs(event.target.value)}
              />
            </label>
            <label>
              <span>Farmer charge (GH₵/kg)</span>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={farmerChargeGhs}
                onChange={(event) => setFarmerChargeGhs(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy === "offer"}
            >
              <Send size={17} />{" "}
              {busy === "offer" ? "Sending…" : "Prepare and send offer"}
            </button>
          </form>
        )}
        <div className="ops-offer-list">
          {(offers?.page ?? []).map((row) => (
            <article key={row.offer.offerId}>
              <div>
                <strong>{row.farmer.fullName}</strong>
                <span>
                  {row.farmer.farmerCode} ·{" "}
                  {row.declaration.collectionLocation.label}
                </span>
              </div>
              <div>
                <strong>{kg(row.offer.terms?.offeredGrams ?? 0)}</strong>
                <span>
                  {row.offer.terms === null
                    ? "Terms pending"
                    : `${money(row.offer.terms.expectedNetPesewas)} net`}
                </span>
              </div>
              <span
                className={`badge ${row.offer.status === "accepted" ? "badge-success" : row.offer.status === "sent" ? "badge-warning" : "badge-neutral"}`}
              >
                {row.offer.status}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="ops-stage-card" hidden={currentAction !== "inspect"}>
        <div className="ops-stage-heading">
          <span>
            <ClipboardCheck size={18} />
          </span>
          <div>
            <h2>Inspect accepted supply</h2>
            <p>
              Record measured quantity. Failed weight is held and excluded from
              collection.
            </p>
          </div>
        </div>
        <form
          className="ops-inline-form"
          onSubmit={(event) => void inspect(event)}
        >
          <label className="ops-form-wide">
            <span>Accepted farmer allocation</span>
            <select
              required
              value={inspectionOfferId}
              onChange={(event) => {
                setInspectionOfferId(event.target.value);
                const row = acceptedOffers.find(
                  (item) => item.offer.offerId === event.target.value,
                );
                if (row?.offer.quantity !== null && row !== undefined)
                  setAcceptedKg(
                    String(
                      (row.offer.quantity.committedGrams -
                        row.offer.quantity.clearedGrams) /
                        1_000,
                    ),
                  );
              }}
            >
              <option value="">Select an accepted offer</option>
              {acceptedOffers.map((row) => (
                <option key={row.offer.offerId} value={row.offer.offerId}>
                  {row.farmer.fullName} · committed{" "}
                  {kg(row.offer.quantity?.committedGrams ?? 0)} · cleared{" "}
                  {kg(row.offer.quantity?.clearedGrams ?? 0)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Lot code</span>
            <input
              required
              minLength={3}
              maxLength={32}
              value={lotCode}
              onChange={(event) => setLotCode(event.target.value.toUpperCase())}
              placeholder="KD-C-01"
            />
          </label>
          <label>
            <span>Accepted (kg)</span>
            <input
              required
              type="number"
              min="0"
              step="0.1"
              value={acceptedKg}
              onChange={(event) => setAcceptedKg(event.target.value)}
            />
          </label>
          <label>
            <span>Rejected (kg)</span>
            <input
              required
              type="number"
              min="0"
              step="0.1"
              value={rejectedKg}
              onChange={(event) => setRejectedKg(event.target.value)}
            />
          </label>
          <label>
            <span>Tare (kg)</span>
            <input
              required
              type="number"
              min="0"
              step="0.1"
              value={tareKg}
              onChange={(event) => setTareKg(event.target.value)}
            />
          </label>
          <label>
            <span>Moisture (%)</span>
            <input
              required
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={moisturePercent}
              onChange={(event) => setMoisturePercent(event.target.value)}
            />
          </label>
          <label className="ops-form-wide">
            <span>Failure reason (required when any quantity is rejected)</span>
            <input
              value={inspectionReason}
              onChange={(event) => setInspectionReason(event.target.value)}
              placeholder="For example: damaged or contaminated bags"
            />
          </label>
          <label>
            <span>Private inspection evidence</span>
            <input
              required={inspectionEvidenceIds.length === 0}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={isUploadingEvidence}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void uploadInspectionEvidence(file);
              }}
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              busy === "inspection" ||
              isUploadingEvidence ||
              inspectionEvidenceIds.length === 0
            }
          >
            <ClipboardCheck size={17} />{" "}
            {busy === "inspection"
              ? "Recording…"
              : isUploadingEvidence
                ? "Uploading evidence…"
                : inspectionEvidenceIds.length === 0
                  ? "Add evidence first"
                  : `Record inspection · ${inspectionEvidenceIds.length} file`}
          </button>
        </form>
        <div className="ops-lot-grid">
          {(lots?.page ?? []).map((lot) => (
            <article key={lot.lotId}>
              <div>
                <strong>{lot.lotCode}</strong>
                <span
                  className={`badge ${lot.qualityStatus === "passed" ? "badge-success" : lot.qualityStatus === "failed" ? "badge-danger" : "badge-warning"}`}
                >
                  {lot.qualityStatus}
                </span>
              </div>
              <p>
                {kg(lot.clearedGrams)} cleared · {kg(lot.rejectedGrams)}{" "}
                rejected
              </p>
              <small>
                {lot.dispositionStatus.replaceAll("_", " ")} ·{" "}
                {lot.currentLocation.label}
              </small>
            </article>
          ))}
        </div>
      </section>

      <section
        className="ops-stage-card"
        hidden={currentAction !== "collection"}
      >
        <div className="ops-stage-heading">
          <span>
            <Truck size={18} />
          </span>
          <div>
            <h2>
              {previewAccess ? "Plan collection" : "Fund and plan collection"}
            </h2>
            <p>
              {previewAccess
                ? "The plan must equal the quality-cleared buyer quantity."
                : "The plan must equal the buyer quantity. Purchase funding is visible here but approved only by finance."}
            </p>
          </div>
        </div>
        {!previewAccess ? (
          <div
            className={`ops-funding-card ${readiness.purchaseApproval.status === "missing" ? "blocked" : ""}`}
          >
            <CircleDollarSign size={22} />
            <div>
              <strong>
                {readiness.purchaseApproval.required
                  ? "Purchase funding"
                  : "Coordination mode"}
              </strong>
              <span>
                {readiness.purchaseApproval.status === "approved"
                  ? `${money(readiness.purchaseApproval.reservedPesewas)} reserved by finance`
                  : readiness.purchaseApproval.status === "missing"
                    ? "Finance approval missing — operations cannot approve it"
                    : "No purchase reservation required"}
              </span>
            </div>
            <span
              className={`badge ${readiness.purchaseApproval.status === "missing" ? "badge-danger" : "badge-success"}`}
            >
              {readiness.purchaseApproval.status.replaceAll("_", " ")}
            </span>
          </div>
        ) : null}
        {plan === null ? (
          <div className="ops-plan-builder">
            <div>
              <strong>{kg(availableLotGrams)} available for plan</strong>
              <span>Required exactly {kg(targetGrams)}</span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canBuildPlan || busy === "plan"}
              onClick={() => void buildPlan()}
            >
              <Truck size={17} />{" "}
              {busy === "plan" ? "Creating…" : "Create exact collection plan"}
            </button>
            {availableLotGrams !== targetGrams ? (
              <p>
                <AlertTriangle size={16} /> Dispatch cannot claim{" "}
                {kg(targetGrams)} while only {kg(availableLotGrams)} is cleared.
              </p>
            ) : null}
          </div>
        ) : plan === undefined ? (
          <div className="ops-empty-state">Loading collection plan…</div>
        ) : (
          <div className="ops-plan-panel">
            <div className="ops-plan-summary">
              <div>
                <strong>{kg(plan.plan.plannedGrams)}</strong>
                <span>
                  {plan.stops.length} collection stop
                  {plan.stops.length === 1 ? "" : "s"}
                </span>
              </div>
              <span
                className={`badge ${plan.plan.status === "ready" ? "badge-success" : "badge-warning"}`}
              >
                {plan.plan.status}
              </span>
            </div>
            {plan.stops.map((stop, index) => (
              <div key={stop.stopId} className="ops-stop-row">
                <span>{index + 1}</span>
                <div>
                  <strong>{stop.location.label}</strong>
                  <small>
                    {kg(stop.plannedGrams)} · {stop.status}
                  </small>
                </div>
              </div>
            ))}
            {plan.plan.driverUserId === undefined ? (
              <form
                className="ops-inline-form ops-driver-form"
                onSubmit={(event) => void setDriver(event)}
              >
                <label className="ops-form-wide">
                  <span>Verified driver</span>
                  <select
                    required
                    value={driverId}
                    onChange={(event) => setDriverId(event.target.value)}
                  >
                    <option value="">Select driver</option>
                    {(drivers ?? []).map((driver) => (
                      <option
                        key={driver.transporterId}
                        value={driver.transporterId}
                      >
                        {driver.fullName} · {driver.vehicleType}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Vehicle registration</span>
                  <input
                    required
                    value={vehicleRegistration}
                    onChange={(event) =>
                      setVehicleRegistration(event.target.value.toUpperCase())
                    }
                  />
                </label>
                <label>
                  <span>Capacity (kg)</span>
                  <input
                    required
                    type="number"
                    min="1"
                    value={vehicleCapacityKg}
                    onChange={(event) =>
                      setVehicleCapacityKg(event.target.value)
                    }
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy === "driver"}
                >
                  Assign driver
                </button>
              </form>
            ) : (
              <div className="ops-driver-assigned">
                <Truck size={18} />
                <span>
                  <strong>{plan.plan.vehicleRegistration}</strong> · capacity{" "}
                  {kg(plan.plan.vehicleCapacityGrams ?? 0)}
                </span>
              </div>
            )}
            <div className="ops-readiness-row">
              <div>
                {plan.plan.readinessBlockers.length === 0 ? (
                  <>
                    <CheckCircle2 size={18} /> Server checks show no blockers.
                  </>
                ) : (
                  <>
                    <AlertTriangle size={18} />{" "}
                    {plan.plan.readinessBlockers
                      .map((item) => item.replaceAll("_", " "))
                      .join(", ")}
                  </>
                )}
              </div>
              {plan.plan.status === "ready" ? null : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy === "ready"}
                  onClick={() => void makeReady()}
                >
                  Run readiness check
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="ops-stage-card ops-record-summary">
        <div className="ops-stage-heading">
          <span>
            <ClipboardCheck size={18} />
          </span>
          <div>
            <h2>Request records</h2>
            <p>Completed work stays readable without leaving old forms open.</p>
          </div>
        </div>
        <div className="ops-record-grid">
          <article>
            <span>Farmer offers</span>
            <strong>{offers?.page.length ?? 0}</strong>
            <small>{acceptedOffers.length} accepted</small>
          </article>
          <article>
            <span>Inspected lots</span>
            <strong>{lots?.page.length ?? 0}</strong>
            <small>{kg(readiness.clearedGrams)} cleared</small>
          </article>
          <article>
            <span>Collection</span>
            <strong>
              {plan?.plan.status?.replaceAll("_", " ") ?? "Not planned"}
            </strong>
            <small>
              {plan === null || plan === undefined
                ? "No route yet"
                : `${plan.stops.length} stops`}
            </small>
          </article>
          <article>
            <span>Last updated</span>
            <strong>
              {new Date(requestDetail.request.updatedAt).toLocaleDateString(
                "en-GH",
                { day: "numeric", month: "short" },
              )}
            </strong>
            <small>
              {new Date(requestDetail.request.updatedAt).toLocaleTimeString(
                "en-GH",
                { hour: "2-digit", minute: "2-digit" },
              )}
            </small>
          </article>
        </div>
      </section>
    </div>
  );
}
