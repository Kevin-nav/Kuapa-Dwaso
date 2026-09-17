"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  CalendarClock,
  CircleGauge,
  Leaf,
  Plus,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { usePilotOperations } from "../context/PilotOperationsContext";

type RequestRow = {
  requestId: string;
  maizeType: string;
  requestedGrams: number;
  confirmedGrams?: number;
  commercialMode: "coordination" | "kuapa_purchase";
  status: string;
  destination: { label: string };
  deliveryWindowEndAt: number;
  createdAt: number;
  updatedAt: number;
};

function kg(grams: number): string {
  return `${(grams / 1_000).toLocaleString()} kg`;
}

export default function PilotDemandQueuePage() {
  const { activeProgramme, activeProgrammeId, isLoading } =
    usePilotOperations();
  const requests = useQuery(
    api.pilotRequests.listAssigned,
    activeProgrammeId === undefined
      ? "skip"
      : { programmeId: activeProgrammeId, limit: 50 },
  ) as { page: RequestRow[] } | undefined;
  const rows = requests?.page ?? [];
  const active = rows.filter(
    (row) => !["closed", "cancelled"].includes(row.status),
  );
  const purchaseCount = active.filter(
    (row) => row.commercialMode === "kuapa_purchase",
  ).length;

  return (
    <div className="ops-page-stack">
      <header className="ops-page-header">
        <div>
          <p className="ops-eyebrow">{activeProgramme?.code ?? "Maize"}</p>
          <h1>Demand queue</h1>
          <p>
            Review buyer demand, secure farmer commitments, inspect lots and
            make exact quantities collection-ready.
          </p>
        </div>
        <Link href="/pilot/supply" className="btn btn-primary">
          <Plus size={18} /> Record assisted supply
        </Link>
      </header>

      {activeProgrammeId === undefined ? (
        <div className="ops-empty-state">
          <Leaf size={28} />
          <h2>No assigned programme</h2>
          <p>A programme grant is required; a warehouse grant is not.</p>
        </div>
      ) : requests === undefined || isLoading ? (
        <div className="ops-empty-state">
          <p>Loading assigned demand…</p>
        </div>
      ) : (
        <>
          <section className="ops-metric-grid" aria-label="Demand summary">
            <article>
              <CircleGauge size={20} />
              <span>Active requests</span>
              <strong>{active.length}</strong>
            </article>
            <article>
              <Leaf size={20} />
              <span>Requested</span>
              <strong>
                {kg(active.reduce((sum, row) => sum + row.requestedGrams, 0))}
              </strong>
            </article>
            <article>
              <CalendarClock size={20} />
              <span>Purchase mode</span>
              <strong>{purchaseCount}</strong>
            </article>
          </section>
          <section className="section-card ops-table-card">
            <div className="section-title">
              <span>Assigned programme requests</span>
              <small>{activeProgramme?.name}</small>
            </div>
            {active.length === 0 ? (
              <div className="ops-empty-state">
                <h2>No active demand</h2>
                <p>Submitted buyer requests will appear here.</p>
              </div>
            ) : (
              <div className="ops-demand-list">
                {active.map((request) => (
                  <Link
                    key={request.requestId}
                    href={`/pilot/requests/${request.requestId}`}
                    className="ops-demand-row"
                  >
                    <div className="ops-demand-quantity">
                      <strong>
                        {kg(request.confirmedGrams ?? request.requestedGrams)}
                      </strong>
                      <span>{request.maizeType}</span>
                    </div>
                    <div>
                      <strong>{request.destination.label}</strong>
                      <span>
                        Created{" "}
                        {new Date(request.createdAt).toLocaleString("en-GH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      <span>
                        Due{" "}
                        {new Date(request.deliveryWindowEndAt).toLocaleString(
                          "en-GH",
                          { dateStyle: "medium", timeStyle: "short" },
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="badge badge-info">
                        {request.status.replaceAll("_", " ")}
                      </span>
                      <span>
                        {request.commercialMode === "kuapa_purchase"
                          ? "Kuapa Dwaso purchase"
                          : "Coordination"}
                      </span>
                    </div>
                    <ArrowRight size={19} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
