"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowRight, Inbox, PlusCircle } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { formatPilotMoney, formatPilotQuantity, PilotStatus, SampleDataBanner } from "@kuapa-dwaso/ui/pilot";

type OfferProjection = {
  offerId: Id<"pilotFarmerOffers">;
  status: string;
  expiresAt: number;
  commercialMode: "coordination" | "kuapa_purchase";
  terms: null | { revision: number; offeredGrams: number; expectedNetPesewas: number };
  finalAmounts: null | { expectedNetPesewas: number };
};
type SupplyPage = {
  declaration: { declarationId: string; maizeType: string; availableGrams: number; unallocatedGrams: number; status: string };
  offers: OfferProjection[];
};

export default function FarmerOffersPage() {
  const programmes = useQuery(api.pilotProgrammes.listAvailable, { limit: 20 }) as
    | { page: Array<{ id: Id<"pilotProgrammes">; name: string; status: string; datasetProvenance: "live" | "sample_only"; demoContext: { datasetId?: string } }> }
    | undefined;
  const programme = programmes?.page.find((item) => item.status === "active");
  const supply = useQuery(api.pilotSupply.listMine, programme === undefined ? "skip" : { programmeId: programme.id, limit: 50 }) as
    | { page: SupplyPage[] }
    | undefined;
  const offers = supply?.page.flatMap((item) => item.offers.map((offer) => ({ ...offer, declaration: item.declaration }))) ?? [];

  return (
    <div className="pilot-farmer-stack">
      {programme?.datasetProvenance === "sample_only" ? <SampleDataBanner programmes={[{ programmeId: programme.id, programmeName: programme.name, ...(programme.demoContext.datasetId === undefined ? {} : { datasetId: programme.demoContext.datasetId }) }]} /> : null}
      <header className="pilot-farmer-heading"><span className="pilot-buyer-kicker">Your maize</span><h1>Offers and supply</h1><p>Next actions come first. An offer is not accepted until the server confirms your decision.</p><Link className="btn btn-primary" href="/farmer/supply"><PlusCircle size={18} /> Declare maize supply</Link></header>
      <section className="pilot-buyer-section"><div className="section-title-row"><h2 className="section-title">Offer inbox</h2><span className="pilot-buyer-count">{offers.length}</span></div>
        {programme !== undefined && supply === undefined ? <div className="skeleton" style={{ height: 140, borderRadius: 12 }} /> : null}
        {supply !== undefined && offers.length === 0 ? <div className="pilot-buyer-empty"><Inbox size={30} /><h3>No offer yet</h3><p>Your declarations stay under your control. We will show the full terms here when supply is matched.</p></div> : null}
        <div className="pilot-request-list">{offers.map((offer) => <Link className="pilot-request-row" href={`/farmer/offers/${offer.offerId}`} key={offer.offerId}><div className="pilot-request-row-top"><strong>{offer.declaration.maizeType}</strong><PilotStatus label={offer.status} tone={offer.status === "accepted" ? "success" : offer.status === "sent" ? "warning" : "neutral"} /></div><div className="pilot-request-metrics"><span><b>{formatPilotQuantity(offer.terms?.offeredGrams ?? 0)}</b> offered</span><span><b>{formatPilotMoney(offer.finalAmounts?.expectedNetPesewas ?? offer.terms?.expectedNetPesewas ?? 0)}</b> {offer.finalAmounts === null ? "expected net" : "final net"}</span></div><div className="pilot-request-destination"><span>{offer.commercialMode === "kuapa_purchase" ? "Kuapa Dwaso will owe payment" : "Coordinated farmer sale"}</span><ArrowRight size={17} /></div></Link>)}</div>
      </section>
      <section className="pilot-buyer-section"><div className="section-title-row"><h2 className="section-title">Supply declarations</h2></div><div className="pilot-request-list">{supply?.page.map(({ declaration }) => <article className="pilot-request-row" key={declaration.declarationId}><div className="pilot-request-row-top"><strong>{declaration.maizeType}</strong><PilotStatus label={declaration.status} tone="info" /></div><div className="pilot-request-metrics"><span><b>{formatPilotQuantity(declaration.availableGrams)}</b> declared</span><span><b>{formatPilotQuantity(declaration.unallocatedGrams)}</b> not committed</span></div></article>)}</div></section>
    </div>
  );
}
