"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, MapPin, Sprout } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useToast } from "@kuapa-dwaso/ui/toast";

export default function FarmerSupplyPage() {
  const previewAccessEnabled =
    process.env.NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED === "true";
  const previewProgrammeId = process.env.NEXT_PUBLIC_PREVIEW_PROGRAMME_ID;
  const router = useRouter();
  const { showToast } = useToast();
  const programmes = useQuery(api.pilotProgrammes.listAvailable, {
    limit: 20,
  }) as
    | {
        page: Array<{
          id: Id<"pilotProgrammes">;
          name: string;
          status: string;
        }>;
      }
    | undefined;
  const createDeclaration = useMutation(api.pilotSupply.createDeclaration);
  const [maizeType, setMaizeType] = useState("Yellow maize");
  const [kilograms, setKilograms] = useState("");
  const [location, setLocation] = useState("");
  const [readyDate, setReadyDate] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const programme = programmes?.page.find(
    (item) =>
      item.status === "active" &&
      (!previewAccessEnabled || item.id === previewProgrammeId),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!navigator.onLine) {
      setError(
        "You are offline. Nothing has been offered or accepted. Reconnect and submit again.",
      );
      return;
    }
    if (programme === undefined) {
      setError("No active maize programme is available for your profile.");
      return;
    }
    const grams = Math.round(Number(kilograms) * 1000);
    const start = new Date(`${readyDate}T06:00:00+00:00`).getTime();
    if (!Number.isSafeInteger(grams) || grams <= 0 || !Number.isFinite(start)) {
      setError("Enter a valid quantity and readiness date.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await createDeclaration({
        programmeId: programme.id,
        maizeType,
        availableGrams: grams,
        readinessWindowStartAt: start,
        readinessWindowEndAt: start + 3 * 24 * 60 * 60 * 1000,
        collectionLocation: { label: location },
        idempotencyKey: crypto.randomUUID(),
      });
      showToast("Maize supply added. It is now at the top of your list.");
      router.push("/farmer/offers");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Supply was not submitted.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pilot-farmer-stack">
      <button
        className="pilot-back"
        onClick={() => router.back()}
        type="button"
      >
        <ArrowLeft size={18} /> Back
      </button>
      <header className="pilot-farmer-heading">
        <span className="pilot-buyer-kicker">Maize</span>
        <h1>Tell us what maize you have</h1>
        <p>
          This is a supply declaration, not a sale. You choose whether to accept
          any offer later.
        </p>
      </header>
      {error === undefined ? null : (
        <div className="attention-card" role="alert">
          <AlertCircle size={20} />
          <div className="attention-body">
            <span className="attention-title">Nothing was submitted</span>
            <span className="attention-text">{error}</span>
          </div>
        </div>
      )}
      <form
        className="pilot-request-form"
        onSubmit={(event) => void submit(event)}
      >
        <label className="form-group">
          <span className="form-label">Maize type</span>
          <input
            className="form-input"
            required
            value={maizeType}
            onChange={(event) => setMaizeType(event.target.value)}
          />
        </label>
        <label className="form-group">
          <span className="form-label">Available quantity (kg)</span>
          <input
            className="form-input"
            inputMode="numeric"
            min="1"
            required
            type="number"
            value={kilograms}
            onChange={(event) => setKilograms(event.target.value)}
          />
          <small>Use the quantity you can make available for collection.</small>
        </label>
        <label className="form-group">
          <span className="form-label">Collection location</span>
          <span className="pilot-input-icon">
            <MapPin size={18} />
            <input
              className="form-input"
              placeholder="Village, landmark, or farm gate"
              required
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </span>
        </label>
        <label className="form-group">
          <span className="form-label">Ready from</span>
          <input
            className="form-input"
            required
            type="date"
            value={readyDate}
            onChange={(event) => setReadyDate(event.target.value)}
          />
        </label>
        <div className="pilot-form-note">
          <Sprout size={18} /> No warehouse selection is required. Inspection,
          price, charges, purchaser, and payment timing must be shown before you
          accept.
        </div>
        <button
          className="btn btn-primary btn-full"
          disabled={busy || programmes === undefined}
          type="submit"
        >
          {busy ? "Submitting…" : "Declare maize supply"}
        </button>
      </form>
    </div>
  );
}
