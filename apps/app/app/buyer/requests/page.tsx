"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowRight, CirclePlus, PackageSearch, Warehouse } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { formatPilotQuantity, PilotStatus } from "@kuapa-dwaso/ui/pilot";

type Programme = {
  id: Id<"pilotProgrammes">;
  status: string;
};
type RequestItem = {
  requestId: Id<"pilotBuyerRequests">;
  programmeId: Id<"pilotProgrammes">;
  maizeType: string;
  requestedGrams: number;
  confirmedGrams?: number;
  destination: { label: string };
  status: string;
  version: number;
};

const statusTone = (status: string) => {
  if (["confirmed", "fulfilling", "delivered", "closed"].includes(status))
    return "success" as const;
  if (["submitted", "under_review", "quoted"].includes(status))
    return "info" as const;
  if (status === "draft") return "neutral" as const;
  return "warning" as const;
};

export default function BuyerRequestsPage() {
  const previewAccessEnabled =
    process.env.NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED === "true";
  const previewProgrammeId = process.env.NEXT_PUBLIC_PREVIEW_PROGRAMME_ID;
  const programmes = useQuery(api.pilotProgrammes.listAvailable, {
    limit: 20,
  }) as { page: Programme[] } | undefined;
  const programme = programmes?.page.find(
    (item) =>
      item.status === "active" &&
      (!previewAccessEnabled || item.id === previewProgrammeId),
  );
  const requests = useQuery(
    api.pilotRequests.listMine,
    programme === undefined ? "skip" : { programmeId: programme.id, limit: 50 },
  ) as { page: RequestItem[]; isDone: boolean } | undefined;

  return (
    <div className="pilot-buyer-stack">
      <header className="pilot-buyer-hero">
        <span className="pilot-buyer-kicker">Direct maize sourcing</span>
        <h1>Request maize before it moves</h1>
        <p>
          Tell Kuapa Dwaso the quantity, quality, destination, and timing. We
          will source against your request and send a quotation for approval.
        </p>
        <Link className="btn btn-primary" href="/buyer/requests/new">
          <CirclePlus size={19} /> Request maize supply
        </Link>
      </header>

      {programmes !== undefined && programme === undefined ? (
        <section className="pilot-buyer-empty">
          <PackageSearch size={32} />
          <h2>Maize requests are temporarily unavailable</h2>
          <p>
            Kuapa Dwaso will let you know when sourcing is ready for new
            requests.
          </p>
        </section>
      ) : null}

      <section
        aria-labelledby="pilot-requests-title"
        className="pilot-buyer-section"
      >
        <div className="section-title-row">
          <div>
            <span className="pilot-buyer-kicker">Your requests</span>
            <h2 id="pilot-requests-title" className="section-title">
              Maize supply requests
            </h2>
          </div>
          <span className="pilot-buyer-count">
            {requests?.page.length ?? 0}
          </span>
        </div>
        {programme !== undefined && requests === undefined ? (
          <div className="skeleton" style={{ height: 150, borderRadius: 16 }} />
        ) : null}
        {requests?.page.length === 0 ? (
          <div className="pilot-buyer-empty">
            <PackageSearch size={30} />
            <h3>No supply requests yet</h3>
            <p>
              Tell Kuapa Dwaso what you need. Sourcing progress will appear
              here.
            </p>
          </div>
        ) : null}
        <div className="pilot-request-list">
          {requests?.page.map((request) => (
            <Link
              className="pilot-request-row"
              href={`/buyer/requests/${request.requestId}`}
              key={request.requestId}
            >
              <div className="pilot-request-row-top">
                <strong>{request.maizeType}</strong>
                <PilotStatus
                  label={request.status.replaceAll("_", " ")}
                  tone={statusTone(request.status)}
                />
              </div>
              <div className="pilot-request-metrics">
                <span>
                  <b>{formatPilotQuantity(request.requestedGrams)}</b> requested
                </span>
                <span>
                  <b>{formatPilotQuantity(request.confirmedGrams ?? 0)}</b>{" "}
                  confirmed
                </span>
              </div>
              <div className="pilot-request-destination">
                <span>{request.destination.label}</span>
                <ArrowRight size={17} aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <aside className="pilot-stock-path">
        <Warehouse size={22} />
        <div>
          <strong>Need stock already available?</strong>
          <p>Browse produce that Kuapa Dwaso has already listed.</p>
        </div>
        <Link href="/buyer">Browse stock</Link>
      </aside>
    </div>
  );
}
