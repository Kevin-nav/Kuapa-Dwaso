"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { AlertTriangle, ArrowRight, Leaf, Package, Sprout, Warehouse } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { usePilotOperations } from "./context/PilotOperationsContext";
import { useWarehouse } from "./context/WarehouseContext";

type RequestRow = {
  requestId: string;
  maizeType: string;
  requestedGrams: number;
  status: string;
  deliveryWindowEndAt: number;
};

export default function OpsHomePage() {
  const { activeProgramme, activeProgrammeId, programmes, isLoading: pilotLoading } =
    usePilotOperations();
  const { activeAgent, activeWarehouse, assignedWarehouses, inventory, disputes } =
    useWarehouse();
  const requests = useQuery(
    api.pilotRequests.listAssigned,
    activeProgrammeId === undefined
      ? "skip"
      : { programmeId: activeProgrammeId, limit: 20 },
  ) as { page: RequestRow[] } | undefined;
  const liveRequests = requests?.page.filter(
    (request) => !["closed", "cancelled"].includes(request.status),
  ) ?? [];

  return (
    <div className="ops-page-stack">
      <section className="ops-hero">
        <div>
          <p className="ops-eyebrow">Operations control</p>
          <h1>Good day, {activeAgent.fullName.split(" ")[0]}</h1>
          <p>Move a buyer request from demand to inspected, funded and collection-ready supply.</p>
        </div>
        <div className="ops-hero-mark" aria-hidden="true"><Sprout size={34} /></div>
      </section>

      <section className="ops-workspace-card ops-workspace-card-primary">
        <div className="ops-workspace-copy">
          <span className="ops-icon-tile"><Leaf size={22} /></span>
          <div>
            <p className="ops-eyebrow">Demand-led maize pilot</p>
            <h2>{activeProgramme?.name ?? "No programme assigned"}</h2>
            <p>
              {pilotLoading
                ? "Loading your programme assignments…"
                : programmes.length === 0
                  ? "Ask an administrator for a programme assignment. A warehouse assignment is not required."
                  : `${liveRequests.length} active request${liveRequests.length === 1 ? "" : "s"} in ${activeProgramme?.region ?? "your assigned area"}.`}
            </p>
          </div>
        </div>
        {activeProgramme === undefined ? null : (
          <Link href="/pilot" className="ops-arrow-link">Open demand queue <ArrowRight size={17} /></Link>
        )}
      </section>

      {liveRequests.length > 0 ? (
        <section className="section-card">
          <div className="section-title"><span>Requests needing operations</span><Link href="/pilot">View all</Link></div>
          <div className="ops-request-list">
            {liveRequests.slice(0, 4).map((request) => (
              <Link key={request.requestId} href={`/pilot/requests/${request.requestId}`} className="ops-request-row">
                <span><strong>{(request.requestedGrams / 1_000).toLocaleString()} kg</strong><small>{request.maizeType}</small></span>
                <span><span className="badge badge-info">{request.status.replaceAll("_", " ")}</span><ArrowRight size={17} /></span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="ops-workspace-card">
        <div className="ops-workspace-copy">
          <span className="ops-icon-tile ops-icon-tile-muted"><Warehouse size={22} /></span>
          <div>
            <p className="ops-eyebrow">Warehouse workspace</p>
            <h2>{assignedWarehouses.length > 0 ? activeWarehouse.name : "No warehouse assigned"}</h2>
            <p>
              {assignedWarehouses.length > 0
                ? `${inventory.length} inventory batch${inventory.length === 1 ? "" : "es"}; ${disputes.length} recorded issue${disputes.length === 1 ? "" : "s"}.`
                : "Warehouse intake stays separate. You can run assigned pilot work without one."}
            </p>
          </div>
        </div>
        {assignedWarehouses.length > 0 ? (
          <Link href="/inventory" className="ops-arrow-link">Open inventory <ArrowRight size={17} /></Link>
        ) : (
          <span className="ops-muted-action"><Package size={16} /> Not needed for pilot work</span>
        )}
      </section>

      {programmes.length === 0 && !pilotLoading ? (
        <div className="ops-callout" role="status"><AlertTriangle size={20} /><span>No pilot programme is assigned to this identity. Existing warehouse tools remain available when assigned.</span></div>
      ) : null}
    </div>
  );
}
