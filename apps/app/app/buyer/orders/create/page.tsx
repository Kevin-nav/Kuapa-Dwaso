"use client";

import { Suspense, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, MapPin, ShoppingCart } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ProduceGrade } from "@kuapa-dwaso/types";
import { useAuth } from "@/app/auth/AuthProvider";

type BuyerProfile = { destinationMarket?: string };
type MarketRun = {
  _id: Id<"marketDeliveryRuns">;
  originWarehouseId: Id<"warehouses">;
  destinationName: string;
  destinationInstructions: string;
  timezone: string;
  deliveryDateAt: number;
  orderCutoffAt: number;
  expectedArrivalStartAt: number;
  expectedArrivalEndAt: number;
  status: string;
};
type Inventory = {
  inventoryBatchId: Id<"inventoryBatches">;
  cropType: string;
  unit: string;
  grade: ProduceGrade;
  availableQuantity: number;
  askingPricePerUnit?: number;
  warehouseName: string;
};

function CreateOrderContent() {
  const { principal } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const createOrder = useMutation(api.buyerOrders.create);
  const buyerProfile = principal?.profiles?.find((profile) => profile.profileType === "buyer");
  const buyerId = buyerProfile?.profileId as Id<"buyers"> | undefined;
  const actorUserId = principal?.userId as Id<"users"> | undefined;
  const buyer = useQuery(api.buyers.getById, actorUserId !== undefined && buyerId !== undefined ? { actorUserId, buyerId } : "skip") as BuyerProfile | null | undefined;
  const runs = useQuery(api.marketDeliveryRuns.listUpcomingForBuyer, actorUserId === undefined ? "skip" : { actorUserId, ...(buyer?.destinationMarket ? { destinationName: buyer.destinationMarket } : {}), limit: 20 }) as MarketRun[] | undefined;
  const [runId, setRunId] = useState(searchParams.get("run") ?? "");
  const selectedRun = runs?.find((run) => run._id === runId) ?? (runId === "" ? runs?.[0] : undefined);
  const effectiveRunId = selectedRun?._id ?? "";
  const inventory = useQuery(api.buyerOrders.listAvailableInventory, selectedRun === undefined ? "skip" : { warehouseId: selectedRun.originWarehouseId, destinationMarket: selectedRun.destinationName, limit: 200 }) as Inventory[] | undefined;
  const initialOffering = [searchParams.get("cropType"), searchParams.get("unit"), searchParams.get("grade")].filter(Boolean).join("|");
  const [offering, setOffering] = useState(initialOffering);
  const [quantity, setQuantity] = useState("");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const offerings = useMemo(() => {
    const unique = new Map<string, Inventory>();
    for (const item of inventory ?? []) unique.set(`${item.cropType}|${item.unit}|${item.grade}`, item);
    return [...unique.entries()];
  }, [inventory]);
  const effectiveOffering = offering || offerings[0]?.[0] || "";
  const [cropType = "", unit = "", grade = "mixed"] = effectiveOffering.split("|");
  const compatibleInventory = (inventory ?? []).filter((item) => item.cropType === cropType && item.unit === unit && item.grade === grade);
  const availableQuantity = compatibleInventory.reduce((total, item) => total + item.availableQuantity, 0);
  const requestedQuantity = Number(quantity);
  const estimatedUnitPrice = Number(maxPrice) || compatibleInventory.find((item) => item.askingPricePerUnit !== undefined)?.askingPricePerUnit || 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (actorUserId === undefined || buyerId === undefined || selectedRun === undefined) return setError("Choose an available delivery run and sign in again if needed.");
    if (!cropType || !unit || requestedQuantity <= 0) return setError("Choose produce and enter a valid quantity.");
    setIsSubmitting(true);
    setError(undefined);
    try {
      const orderId = await createOrder({
        actorUserId,
        buyerId,
        marketDeliveryRunId: selectedRun._id,
        warehouseId: selectedRun.originWarehouseId,
        destinationMarket: selectedRun.destinationName,
        cropType,
        requestedQuantity,
        unit,
        preferredGrade: grade as ProduceGrade,
        reservationExpiresAt: selectedRun.orderCutoffAt,
        ...(estimatedUnitPrice > 0 ? { maxPricePerUnit: estimatedUnitPrice } : {}),
      });
      router.push(`/buyer/orders/${orderId}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Your order could not be placed. Your selections are still here; check your connection and try again.");
    } finally { setIsSubmitting(false); }
  }

  return <div style={{ display: "grid", gap: 18 }}>
    <button type="button" onClick={() => router.back()} className="btn btn-secondary" style={{ justifySelf: "start" }}><ArrowLeft size={18} /> Back</button>
    <header><p className="eyebrow">Scheduled market delivery</p><h1>Place an order for a published run</h1><p>Your produce is reserved from the run&apos;s origin warehouse. Pay before the shown deadline so operations can prepare the load.</p></header>
    {error && <div className="attention-card" role="alert"><div className="attention-body"><strong className="attention-title">Please check this order</strong><span className="attention-text">{error}</span></div></div>}
    {runs !== undefined && runs.length === 0 && <div className="attention-card"><div className="attention-body"><strong className="attention-title">No run is accepting orders for {buyer?.destinationMarket ?? "your destination"}</strong><span className="attention-text">A new published delivery day will appear here when operations opens one.</span></div></div>}
    {(runs ?? []).length > 0 && <form onSubmit={(event) => void submit(event)} className="auth-card" style={{ width: "100%", gap: 16 }}>
      <div className="field-stack"><label htmlFor="run">Delivery destination and day</label><select id="run" className="form-select" value={effectiveRunId} onChange={(event) => setRunId(event.target.value)} required>{(runs ?? []).map((run) => <option key={run._id} value={run._id}>{run.destinationName} · {date(run.deliveryDateAt, run.timezone)}</option>)}</select></div>
      {selectedRun && <section style={promiseStyle} aria-label="Published delivery promise"><PromiseRow icon={<MapPin size={17} />} label="Deliver to" value={selectedRun.destinationName} /><PromiseRow icon={<CalendarDays size={17} />} label="Expected arrival" value={`${date(selectedRun.deliveryDateAt, selectedRun.timezone)}, ${time(selectedRun.expectedArrivalStartAt, selectedRun.timezone)}–${time(selectedRun.expectedArrivalEndAt, selectedRun.timezone)}`} /><PromiseRow icon={<Clock3 size={17} />} label="Orders and payment close" value={dateTime(selectedRun.orderCutoffAt, selectedRun.timezone)} /><p style={{ margin: 0, fontSize: 13 }}><strong>Collection:</strong> {selectedRun.destinationInstructions}</p></section>}
      <div className="field-stack"><label htmlFor="produce">Eligible warehouse inventory</label><select id="produce" className="form-select" value={effectiveOffering} onChange={(event) => setOffering(event.target.value)} required><option value="">Choose produce</option>{offerings.map(([key, item]) => <option key={key} value={key}>{item.cropType} · grade {item.grade} · {item.unit}</option>)}</select><span className="field-help">{inventory === undefined ? "Checking reservable stock…" : `${availableQuantity.toLocaleString()} ${unit || "units"} currently reservable for this run.`}</span></div>
      <div className="field-stack"><label htmlFor="quantity">Quantity ({unit || "unit"})</label><input id="quantity" type="number" min="0.01" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="form-input" required /></div>
      <div className="field-stack"><label htmlFor="price">Maximum price per {unit || "unit"} (GHS, optional)</label><input id="price" type="number" min="0.01" step="any" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} className="form-input" /></div>
      {requestedQuantity > 0 && <section style={reviewStyle}><strong>Order check</strong><span>{requestedQuantity} {unit} of {cropType}, grade {grade}</span><span>Estimated produce value: {estimatedUnitPrice > 0 ? `GHS ${(requestedQuantity * estimatedUnitPrice).toLocaleString()}` : "confirmed after matching"}</span><span>Reservation/payment deadline: {selectedRun ? dateTime(selectedRun.orderCutoffAt, selectedRun.timezone) : "choose a run"}</span></section>}
      <button className="btn btn-primary btn-full" disabled={isSubmitting || requestedQuantity <= 0 || requestedQuantity > availableQuantity}><ShoppingCart size={18} />{isSubmitting ? "Reserving…" : "Reserve for this delivery run"}</button>
      {requestedQuantity > availableQuantity && requestedQuantity > 0 && <span style={{ color: "var(--color-danger)", fontSize: 13 }}>Reduce the quantity to the stock currently available for this run.</span>}
    </form>}
  </div>;
}

function PromiseRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 7, alignItems: "start" }}>{icon}<span style={{ fontSize: 13 }}><strong>{label}:</strong> {value}</span></div>; }
function date(value: number, timezone: string) { return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: timezone }).format(value); }
function time(value: number, timezone: string) { return new Intl.DateTimeFormat("en-GH", { timeStyle: "short", timeZone: timezone }).format(value); }
function dateTime(value: number, timezone: string) { return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(value); }
const promiseStyle = { display: "grid", gap: 10, padding: 14, borderRadius: 10, background: "var(--color-info-bg)", border: "1px solid var(--color-info-border)" } as const;
const reviewStyle = { display: "grid", gap: 6, padding: 14, borderRadius: 10, background: "var(--color-bg)", border: "1px solid var(--color-line)", fontSize: 13 } as const;

export default function CreateOrderPage() { return <Suspense fallback={<div className="skeleton" style={{ height: 320, borderRadius: 16 }} />}><CreateOrderContent /></Suspense>; }
