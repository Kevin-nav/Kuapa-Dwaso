"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, CloudOff } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useToast } from "@kuapa-dwaso/ui/toast";

const DRAFT_KEY = "kuapa:buyer-maize-request:v1";
type Draft = {
  maizeType: string;
  kilograms: string;
  destination: string;
  deliveryDate: string;
  moisturePercent: string;
  /** Legacy drafts may contain this backend-only field. Buyers do not edit it. */
  commercialMode?: "coordination" | "kuapa_purchase";
  serverRequestId?: string;
  serverVersion?: number;
  creationIdempotencyKey?: string;
};
const initialDraft: Draft = {
  maizeType: "Yellow maize",
  kilograms: "5000",
  destination: "",
  deliveryDate: "",
  moisturePercent: "13.5",
};
const BACKEND_COMMERCIAL_MODE = "coordination" as const;
const previewAccessEnabled =
  process.env.NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED === "true";
const previewProgrammeId = process.env.NEXT_PUBLIC_PREVIEW_PROGRAMME_ID;

export default function NewBuyerRequestPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const programmes = useQuery(api.pilotProgrammes.listAvailable, {
    limit: 20,
  }) as
    | {
        page: Array<{
          id: Id<"pilotProgrammes">;
          name: string;
          status: string;
          datasetProvenance: "live" | "sample_only";
        }>;
      }
    | undefined;
  const createDraft = useMutation(api.pilotRequests.createDraft);
  const submitRequest = useMutation(api.pilotRequests.submit);

  function changeDraft(changes: Partial<Draft>) {
    setDraft((current) => {
      const {
        serverRequestId: _serverRequestId,
        serverVersion: _serverVersion,
        creationIdempotencyKey: _creationIdempotencyKey,
        commercialMode: _commercialMode,
        ...editable
      } = current;
      return { ...editable, ...changes };
    });
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      if (saved === null) return;
      try {
        const parsed = JSON.parse(saved) as {
          value?: Draft;
          expiresAt?: number;
        };
        if (
          parsed.value !== undefined &&
          (parsed.expiresAt ?? 0) > Date.now()
        ) {
          setDraft(parsed.value);
          setRestored(true);
        } else window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        window.localStorage.removeItem(DRAFT_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        value: draft,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      }),
    );
  }, [draft]);

  const programme = programmes?.page.find(
    (item) =>
      item.status === "active" &&
      (!previewAccessEnabled || item.id === previewProgrammeId),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!navigator.onLine) {
      setError(
        "You are offline. Your draft is safe on this device; reconnect before submitting commercial terms.",
      );
      return;
    }
    if (programme === undefined) {
      setError(
        "Maize requests are temporarily unavailable. Please try again later.",
      );
      return;
    }
    const kilograms = Number(draft.kilograms);
    const maizeType = draft.maizeType.trim() || initialDraft.maizeType;
    const moisturePercent = Number(
      draft.moisturePercent || initialDraft.moisturePercent,
    );
    const deliveryStart = new Date(
      `${draft.deliveryDate}T08:00:00+00:00`,
    ).getTime();
    if (
      !Number.isFinite(kilograms) ||
      kilograms <= 0 ||
      !Number.isFinite(deliveryStart)
    ) {
      setError("Enter a valid quantity and delivery date.");
      return;
    }
    setError(undefined);
    setIsSubmitting(true);
    try {
      const creationIdempotencyKey =
        draft.creationIdempotencyKey ?? crypto.randomUUID();
      const created =
        draft.serverRequestId === undefined || draft.serverVersion === undefined
          ? await createDraft({
              programmeId: programme.id,
              maizeType,
              requestedGrams: Math.round(kilograms * 1000),
              destination: { label: draft.destination },
              deliveryWindowStartAt: deliveryStart,
              deliveryWindowEndAt: deliveryStart + 8 * 60 * 60 * 1000,
              requestedSpecification: {
                maizeType,
                moistureMaximumPermille: Math.round(moisturePercent * 10),
                contaminationCheckRequired: true,
                additionalCriteria: [],
                policyProvenance: programme.datasetProvenance,
              },
              paymentExpectation: {
                trigger: "buyer_acceptance",
                offsetCalendarDays: 1,
                timezone: "Africa/Accra",
              },
              commercialMode: BACKEND_COMMERCIAL_MODE,
              idempotencyKey: creationIdempotencyKey,
            })
          : {
              requestId: draft.serverRequestId as Id<"pilotBuyerRequests">,
              version: draft.serverVersion,
            };
      const recoverable = {
        ...draft,
        serverRequestId: created.requestId,
        serverVersion: created.version,
        creationIdempotencyKey,
      };
      setDraft(recoverable);
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          value: recoverable,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }),
      );
      await submitRequest({
        requestId: created.requestId,
        expectedVersion: created.version,
        idempotencyKey: crypto.randomUUID(),
      });
      window.localStorage.removeItem(DRAFT_KEY);
      showToast("Maize request submitted. You can track it here.");
      router.push(`/buyer/requests/${created.requestId}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The request could not be submitted. Your draft remains saved.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="pilot-buyer-stack">
      <button
        className="pilot-back"
        onClick={() => router.back()}
        type="button"
      >
        <ArrowLeft size={18} /> Back
      </button>
      <header>
        <span className="pilot-buyer-kicker">New supply request</span>
        <h1>What maize do you need?</h1>
        <p>
          Tell Kuapa Dwaso what you need. We will review supply and send a
          quotation for your approval.
        </p>
      </header>
      {restored ? (
        <div className="pilot-form-note">
          <Check size={18} /> Restored your saved draft from this device.
        </div>
      ) : null}
      {error === undefined ? null : (
        <div className="attention-card" role="alert">
          <AlertCircle size={20} />
          <div className="attention-body">
            <span className="attention-title">Request not submitted</span>
            <span className="attention-text">{error}</span>
          </div>
        </div>
      )}
      <form
        className="pilot-request-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        {previewAccessEnabled ? (
          <>
            <label className="form-group">
              <span className="form-label">Quantity (kg)</span>
              <input
                className="form-input"
                inputMode="numeric"
                min="1"
                required
                type="number"
                value={draft.kilograms}
                onChange={(event) =>
                  changeDraft({ kilograms: event.target.value })
                }
              />
              <small>
                We track exact kilograms through sourcing, inspection, and
                delivery.
              </small>
            </label>
            <label className="form-group">
              <span className="form-label">Delivery destination</span>
              <input
                className="form-input"
                placeholder="e.g. Accra processing site"
                required
                value={draft.destination}
                onChange={(event) =>
                  changeDraft({ destination: event.target.value })
                }
              />
            </label>
            <label className="form-group">
              <span className="form-label">Needed on</span>
              <input
                className="form-input"
                required
                type="date"
                value={draft.deliveryDate}
                onChange={(event) =>
                  changeDraft({ deliveryDate: event.target.value })
                }
              />
            </label>
            <details className="pilot-advanced-fields">
              <summary>
                Advanced details <span>Optional</span>
              </summary>
              <div className="pilot-form-grid">
                <label className="form-group">
                  <span className="form-label">Maize type</span>
                  <input
                    className="form-input"
                    value={draft.maizeType}
                    onChange={(event) =>
                      changeDraft({ maizeType: event.target.value })
                    }
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Maximum moisture (%)</span>
                  <input
                    className="form-input"
                    max="30"
                    min="1"
                    step="0.1"
                    type="number"
                    value={draft.moisturePercent}
                    onChange={(event) =>
                      changeDraft({ moisturePercent: event.target.value })
                    }
                  />
                </label>
              </div>
            </details>
          </>
        ) : (
          <>
            <label className="form-group">
              <span className="form-label">Maize type</span>
              <input
                className="form-input"
                required
                value={draft.maizeType}
                onChange={(event) =>
                  changeDraft({ maizeType: event.target.value })
                }
              />
            </label>
            <label className="form-group">
              <span className="form-label">Quantity (kg)</span>
              <input
                className="form-input"
                inputMode="numeric"
                min="1"
                required
                type="number"
                value={draft.kilograms}
                onChange={(event) =>
                  changeDraft({ kilograms: event.target.value })
                }
              />
              <small>
                We track exact kilograms through sourcing, inspection, and
                delivery.
              </small>
            </label>
            <label className="form-group">
              <span className="form-label">Delivery destination</span>
              <input
                className="form-input"
                placeholder="e.g. Accra processing site"
                required
                value={draft.destination}
                onChange={(event) =>
                  changeDraft({ destination: event.target.value })
                }
              />
            </label>
            <div className="pilot-form-grid">
              <label className="form-group">
                <span className="form-label">Needed on</span>
                <input
                  className="form-input"
                  required
                  type="date"
                  value={draft.deliveryDate}
                  onChange={(event) =>
                    changeDraft({ deliveryDate: event.target.value })
                  }
                />
              </label>
              <label className="form-group">
                <span className="form-label">Maximum moisture (%)</span>
                <input
                  className="form-input"
                  max="30"
                  min="1"
                  required
                  step="0.1"
                  type="number"
                  value={draft.moisturePercent}
                  onChange={(event) =>
                    changeDraft({ moisturePercent: event.target.value })
                  }
                />
              </label>
            </div>
          </>
        )}
        <div className="pilot-form-note">
          Kuapa Dwaso manages sourcing, quality checks, delivery, and
          settlement.
        </div>
        <div className="pilot-form-note">
          <CloudOff size={18} /> Draft changes stay on this device for seven
          days. Submission requires a connection.
        </div>
        <button
          className="btn btn-primary btn-full"
          disabled={isSubmitting || programmes === undefined}
          type="submit"
        >
          {isSubmitting ? "Submitting…" : "Send request"}
        </button>
      </form>
    </div>
  );
}
