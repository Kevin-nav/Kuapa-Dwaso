"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { gray, palette, StatusBadge } from "@kuapa-dwaso/dashboard-ui";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAdminAuth } from "../auth/AdminAuthProvider";

type Warehouse = { _id: Id<"warehouses">; name: string; code: string };
type Schedule = {
  _id: Id<"marketServiceSchedules">;
  originWarehouseId: Id<"warehouses">;
  warehouseName: string;
  destinationName: string;
  destinationInstructions: string;
  timezone: string;
  deliveryWeekday: number;
  cutoffDaysBefore: number;
  cutoffLocalTime: string;
  arrivalStartLocalTime: string;
  arrivalEndLocalTime: string;
  minimumLoadQuantity?: number;
  minimumLoadUnit?: string;
  capacityQuantity?: number;
  capacityUnit?: string;
  status: "draft" | "active" | "paused" | "retired";
  effectiveDate: string;
  endDate?: string;
};
type Run = {
  _id: Id<"marketDeliveryRuns">;
  scheduleId: Id<"marketServiceSchedules">;
  originWarehouseId: Id<"warehouses">;
  destinationName: string;
  destinationInstructions: string;
  timezone: string;
  deliveryDate: string;
  deliveryDateAt: number;
  orderCutoffAt: number;
  expectedArrivalStartAt: number;
  expectedArrivalEndAt: number;
  status: string;
  buyerOrderIds: Id<"buyerOrders">[];
};
type Readiness = Run & {
  aggregation: {
    orderCount: number;
    buyersAwaitingPayment: number;
    nextReservationExpiry?: number;
    groupedTotals: Array<{ cropType: string; unit: string; requestedQuantity: number; reservedQuantity: number; paidQuantity: number; unpaidQuantity: number }>;
    capacity: { compatible: boolean; configuredQuantity?: number; configuredUnit?: string; reservedQuantity?: number; remainingQuantity?: number; percentage?: number };
    minimumLoad: { compatible: boolean; configuredQuantity?: number; configuredUnit?: string; reservedQuantity?: number; percentage?: number };
  };
  blockers: Array<{ buyerOrderId: Id<"buyerOrders">; buyerName: string; paymentStatus: string; paymentDeadline?: number; reservationExpiry?: number }>;
  reservationShortfalls: Array<{ buyerOrderId: Id<"buyerOrders">; requestedQuantity: number; reservedQuantity: number; unit: string }>;
  operationalIssues: string[];
  linkedDispatches: Array<{ _id: Id<"dispatches">; status: string }>;
  operationalConfirmationRequired: boolean;
};

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const today = new Date().toISOString().slice(0, 10);

const emptyForm = {
  originWarehouseId: "",
  destinationName: "",
  destinationInstructions: "",
  timezone: "Africa/Accra",
  deliveryWeekday: 5,
  cutoffDaysBefore: 2,
  cutoffLocalTime: "17:00",
  arrivalStartLocalTime: "06:00",
  arrivalEndLocalTime: "08:00",
  minimumLoadQuantity: "",
  minimumLoadUnit: "",
  capacityQuantity: "",
  capacityUnit: "",
  effectiveDate: today,
  endDate: "",
};

export default function MarketServicesPage() {
  const { principal, isLoading } = useAdminAuth();
  const actorUserId = principal?.role === "admin" && principal.status === "active" ? principal.userId as Id<"users"> : undefined;
  const warehouses = useQuery(api.warehouses.list, actorUserId === undefined ? "skip" : { actorUserId, limit: 100 }) as Warehouse[] | undefined;
  const schedules = useQuery(api.marketServiceSchedules.list, actorUserId === undefined ? "skip" : { actorUserId, limit: 100 }) as Schedule[] | undefined;
  const runs = useQuery(api.marketDeliveryRuns.listForOperations, actorUserId === undefined ? "skip" : { actorUserId, limit: 100 }) as Run[] | undefined;
  const [selectedRunId, setSelectedRunId] = useState<Id<"marketDeliveryRuns">>();
  const readiness = useQuery(api.marketDeliveryRuns.getReadiness, actorUserId === undefined || selectedRunId === undefined ? "skip" : { actorUserId, runId: selectedRunId }) as Readiness | null | undefined;
  const createSchedule = useMutation(api.marketServiceSchedules.create);
  const updateSchedule = useMutation(api.marketServiceSchedules.update);
  const updateScheduleStatus = useMutation(api.marketServiceSchedules.updateStatus);
  const createRun = useMutation(api.marketDeliveryRuns.createFromSchedule);
  const updateRunStatus = useMutation(api.marketDeliveryRuns.updateStatus);
  const postponeRun = useMutation(api.marketDeliveryRuns.postpone);
  const editRun = useMutation(api.marketDeliveryRuns.editUnstarted);
  const [form, setForm] = useState(emptyForm);
  const [editingScheduleId, setEditingScheduleId] = useState<Id<"marketServiceSchedules">>();
  const [runScheduleId, setRunScheduleId] = useState<Id<"marketServiceSchedules">>();
  const [runDate, setRunDate] = useState("");
  const [reason, setReason] = useState("");
  const [readinessOverrideReason, setReadinessOverrideReason] = useState("");
  const [postponedDate, setPostponedDate] = useState("");
  const [draftRunDate, setDraftRunDate] = useState("");
  const [message, setMessage] = useState("");

  const activeSchedules = useMemo(() => (schedules ?? []).filter((schedule) => schedule.status === "active"), [schedules]);
  const selectedRun = (runs ?? []).find((run) => run._id === selectedRunId);

  const scheduleArgs = () => ({
    originWarehouseId: form.originWarehouseId as Id<"warehouses">,
    destinationName: form.destinationName,
    destinationInstructions: form.destinationInstructions,
    timezone: form.timezone,
    deliveryWeekday: form.deliveryWeekday,
    cutoffDaysBefore: form.cutoffDaysBefore,
    cutoffLocalTime: form.cutoffLocalTime,
    arrivalStartLocalTime: form.arrivalStartLocalTime,
    arrivalEndLocalTime: form.arrivalEndLocalTime,
    ...(form.minimumLoadQuantity === "" ? {} : { minimumLoadQuantity: Number(form.minimumLoadQuantity), minimumLoadUnit: form.minimumLoadUnit }),
    ...(form.capacityQuantity === "" ? {} : { capacityQuantity: Number(form.capacityQuantity), capacityUnit: form.capacityUnit }),
    effectiveDate: form.effectiveDate,
    ...(form.endDate === "" ? {} : { endDate: form.endDate }),
  });

  async function saveSchedule(event: FormEvent) {
    event.preventDefault();
    if (actorUserId === undefined) return;
    setMessage("Saving schedule…");
    try {
      if (editingScheduleId === undefined) await createSchedule({ actorUserId, ...scheduleArgs() });
      else await updateSchedule({ actorUserId, scheduleId: editingScheduleId, ...scheduleArgs() });
      setForm(emptyForm);
      setEditingScheduleId(undefined);
      setMessage("Schedule saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Schedule could not be saved."); }
  }

  function editSchedule(schedule: Schedule) {
    setEditingScheduleId(schedule._id);
    setForm({
      originWarehouseId: schedule.originWarehouseId,
      destinationName: schedule.destinationName,
      destinationInstructions: schedule.destinationInstructions,
      timezone: schedule.timezone,
      deliveryWeekday: schedule.deliveryWeekday,
      cutoffDaysBefore: schedule.cutoffDaysBefore,
      cutoffLocalTime: schedule.cutoffLocalTime,
      arrivalStartLocalTime: schedule.arrivalStartLocalTime,
      arrivalEndLocalTime: schedule.arrivalEndLocalTime,
      minimumLoadQuantity: schedule.minimumLoadQuantity?.toString() ?? "",
      minimumLoadUnit: schedule.minimumLoadUnit ?? "",
      capacityQuantity: schedule.capacityQuantity?.toString() ?? "",
      capacityUnit: schedule.capacityUnit ?? "",
      effectiveDate: schedule.effectiveDate,
      endDate: schedule.endDate ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function changeScheduleStatus(schedule: Schedule, status: Schedule["status"]) {
    if (actorUserId === undefined) return;
    try { await updateScheduleStatus({ actorUserId, scheduleId: schedule._id, status }); setMessage(`Schedule ${status}.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Status could not be changed."); }
  }

  function selectRun(runId: Id<"marketDeliveryRuns">) {
    setSelectedRunId(runId);
    setReadinessOverrideReason("");
  }

  if (isLoading || (actorUserId !== undefined && (warehouses === undefined || schedules === undefined || runs === undefined))) return <p style={{ padding: 24 }}>Loading market services…</p>;
  if (actorUserId === undefined) return <p style={{ padding: 24 }}>Sign in with an active administrator or warehouse-manager account.</p>;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header><h1 style={titleStyle}>Scheduled market delivery</h1><p style={subtitleStyle}>Publish recurring service promises, create dated runs, and verify paid and reserved load readiness without mixing units.</p></header>
      {message && <div role="status" style={messageStyle}>{message}</div>}

      {selectedRun?.status === "draft" && selectedRun.buyerOrderIds.length === 0 && (
        <section style={panelStyle}>
          <h2 style={sectionTitle}>Edit selected draft run</h2>
          <div style={actionsStyle}>
            <input aria-label="Draft delivery date" type="date" value={draftRunDate || selectedRun.deliveryDate} onChange={(event) => setDraftRunDate(event.target.value)} style={inputStyle} />
            <button style={secondaryButton} onClick={() => void editRun({ actorUserId, runId: selectedRun._id, deliveryDate: draftRunDate || selectedRun.deliveryDate }).then(() => setMessage("Draft run date updated.")).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Draft run could not be edited."))}>Save draft date</button>
          </div>
        </section>
      )}

      <section style={panelStyle}>
        <h2 style={sectionTitle}>{editingScheduleId === undefined ? "Create recurring service" : "Edit recurring service"}</h2>
        <form onSubmit={(event) => void saveSchedule(event)} style={formGridStyle}>
          <Label text="Origin warehouse"><select required value={form.originWarehouseId} onChange={(e) => setForm({ ...form, originWarehouseId: e.target.value })} style={inputStyle}><option value="">Select warehouse</option>{(warehouses ?? []).map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name}</option>)}</select></Label>
          <Label text="Destination market or collection point"><input required value={form.destinationName} onChange={(e) => setForm({ ...form, destinationName: e.target.value })} style={inputStyle} /></Label>
          <Label text="Collection instructions" wide><textarea required value={form.destinationInstructions} onChange={(e) => setForm({ ...form, destinationInstructions: e.target.value })} style={{ ...inputStyle, minHeight: 72 }} /></Label>
          <Label text="Service timezone"><input required value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} style={inputStyle} /></Label>
          <Label text="Delivery day"><select value={form.deliveryWeekday} onChange={(e) => setForm({ ...form, deliveryWeekday: Number(e.target.value) })} style={inputStyle}>{weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></Label>
          <Label text="Orders close (days before)"><input type="number" min={0} max={14} value={form.cutoffDaysBefore} onChange={(e) => setForm({ ...form, cutoffDaysBefore: Number(e.target.value) })} style={inputStyle} /></Label>
          <Label text="Cutoff local time"><input type="time" value={form.cutoffLocalTime} onChange={(e) => setForm({ ...form, cutoffLocalTime: e.target.value })} style={inputStyle} /></Label>
          <Label text="Arrival window starts"><input type="time" value={form.arrivalStartLocalTime} onChange={(e) => setForm({ ...form, arrivalStartLocalTime: e.target.value })} style={inputStyle} /></Label>
          <Label text="Arrival window ends"><input type="time" value={form.arrivalEndLocalTime} onChange={(e) => setForm({ ...form, arrivalEndLocalTime: e.target.value })} style={inputStyle} /></Label>
          <Label text="Minimum load (optional)"><div style={pairStyle}><input type="number" min="0" step="any" value={form.minimumLoadQuantity} onChange={(e) => setForm({ ...form, minimumLoadQuantity: e.target.value })} style={inputStyle} placeholder="Quantity" /><input value={form.minimumLoadUnit} onChange={(e) => setForm({ ...form, minimumLoadUnit: e.target.value })} style={inputStyle} placeholder="Unit" /></div></Label>
          <Label text="Capacity (optional)"><div style={pairStyle}><input type="number" min="0" step="any" value={form.capacityQuantity} onChange={(e) => setForm({ ...form, capacityQuantity: e.target.value })} style={inputStyle} placeholder="Quantity" /><input value={form.capacityUnit} onChange={(e) => setForm({ ...form, capacityUnit: e.target.value })} style={inputStyle} placeholder="Unit" /></div></Label>
          <Label text="Effective date"><input type="date" required value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} style={inputStyle} /></Label>
          <Label text="End date (optional)"><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} style={inputStyle} /></Label>
          <div style={{ display: "flex", gap: 8, alignItems: "end" }}><button type="submit" style={primaryButton}>{editingScheduleId === undefined ? "Create draft schedule" : "Save changes"}</button>{editingScheduleId !== undefined && <button type="button" style={secondaryButton} onClick={() => { setEditingScheduleId(undefined); setForm(emptyForm); }}>Cancel edit</button>}</div>
        </form>
      </section>

      <section style={panelStyle}><h2 style={sectionTitle}>Recurring services</h2><div style={cardsGridStyle}>{(schedules ?? []).map((schedule) => <article key={schedule._id} style={cardStyle}><div style={rowStyle}><strong>{schedule.warehouseName} → {schedule.destinationName}</strong><StatusBadge status={schedule.status} /></div><p style={smallText}>{weekdays[schedule.deliveryWeekday]} delivery · orders close {schedule.cutoffDaysBefore} day(s) before at {schedule.cutoffLocalTime} · arrival {schedule.arrivalStartLocalTime}–{schedule.arrivalEndLocalTime} ({schedule.timezone})</p><p style={smallText}>{schedule.destinationInstructions}</p><div style={actionsStyle}><button style={secondaryButton} onClick={() => editSchedule(schedule)}>Edit</button>{schedule.status === "draft" && <button style={primaryButton} onClick={() => void changeScheduleStatus(schedule, "active")}>Activate</button>}{schedule.status === "active" && <button style={secondaryButton} onClick={() => void changeScheduleStatus(schedule, "paused")}>Pause</button>}{schedule.status === "paused" && <button style={primaryButton} onClick={() => void changeScheduleStatus(schedule, "active")}>Resume</button>}{schedule.status !== "retired" && <button style={dangerButton} onClick={() => void changeScheduleStatus(schedule, "retired")}>Retire</button>}</div></article>)}</div></section>

      <section style={panelStyle}><h2 style={sectionTitle}>Create dated delivery run</h2><form onSubmit={(event) => { event.preventDefault(); if (runScheduleId !== undefined && runDate && actorUserId) void createRun({ actorUserId, scheduleId: runScheduleId, deliveryDate: runDate }).then((id) => { selectRun(id); setMessage("Draft run created."); }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Run could not be created.")); }} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><select required value={runScheduleId ?? ""} onChange={(e) => setRunScheduleId(e.target.value as Id<"marketServiceSchedules">)} style={inputStyle}><option value="">Choose active service</option>{activeSchedules.map((schedule) => <option key={schedule._id} value={schedule._id}>{schedule.warehouseName} → {schedule.destinationName}</option>)}</select><input required type="date" value={runDate} onChange={(e) => setRunDate(e.target.value)} style={inputStyle} /><button style={primaryButton}>Create run safely</button></form></section>

      <section style={panelStyle}><h2 style={sectionTitle}>Upcoming delivery runs</h2><div style={cardsGridStyle}>{[...(runs ?? [])].sort((a, b) => a.deliveryDateAt - b.deliveryDateAt).map((run) => <button key={run._id} onClick={() => selectRun(run._id)} style={{ ...cardStyle, textAlign: "left", cursor: "pointer", borderColor: selectedRunId === run._id ? palette.field : gray[100] }}><div style={rowStyle}><strong>{run.destinationName} · {formatDate(run.deliveryDateAt, run.timezone)}</strong><StatusBadge status={run.status} /></div><p style={smallText}>Orders close {formatDateTime(run.orderCutoffAt, run.timezone)} · expected {formatTime(run.expectedArrivalStartAt, run.timezone)}–{formatTime(run.expectedArrivalEndAt, run.timezone)}</p><span style={{ ...smallText, fontWeight: 800 }}>{run.buyerOrderIds.length} buyer order(s) · open readiness view</span></button>)}</div></section>

      {readiness && (
        <section style={panelStyle}>
          <div style={rowStyle}><div><h2 style={sectionTitle}>Run readiness: {readiness.destinationName}</h2><p style={smallText}>Cutoff {formatDateTime(readiness.orderCutoffAt, readiness.timezone)} · arrival {formatDateTime(readiness.expectedArrivalStartAt, readiness.timezone)}–{formatTime(readiness.expectedArrivalEndAt, readiness.timezone)}</p></div><StatusBadge status={readiness.status} /></div>
          <div style={metricsGridStyle}><Metric label="Buyer orders" value={readiness.aggregation.orderCount} /><Metric label="Awaiting full payment" value={readiness.aggregation.buyersAwaitingPayment} /><Metric label="Linked dispatches" value={readiness.linkedDispatches.length} /><Metric label="Next reservation expiry" value={readiness.aggregation.nextReservationExpiry ? formatDateTime(readiness.aggregation.nextReservationExpiry, readiness.timezone) : "None"} /></div>
          <h3 style={subheadingStyle}>Compatible totals</h3>
          {readiness.aggregation.groupedTotals.map((group) => <div key={`${group.cropType}-${group.unit}`} style={summaryRowStyle}><strong>{group.cropType} · {group.unit}</strong><span>requested {group.requestedQuantity} · reserved {group.reservedQuantity} · paid {group.paidQuantity} · unpaid {group.unpaidQuantity}</span></div>)}
          <LoadMetric label="Minimum load" value={readiness.aggregation.minimumLoad} />
          <LoadMetric label="Capacity" value={readiness.aggregation.capacity} />
          {readiness.operationalIssues.map((issue) => <p key={issue} style={warningStyle}>{issue}</p>)}
          <h3 style={subheadingStyle}>Blocking orders</h3>
          {readiness.blockers.length === 0 ? <p style={smallText}>No buyer payment blockers.</p> : readiness.blockers.map((blocker) => <div key={blocker.buyerOrderId} style={summaryRowStyle}><strong>{blocker.buyerName}</strong><span>{blocker.paymentStatus.replaceAll("_", " ")} · pay by {blocker.paymentDeadline ? formatDateTime(blocker.paymentDeadline, readiness.timezone) : "not set"}</span></div>)}
          {readiness.reservationShortfalls.map((shortfall) => <p key={shortfall.buyerOrderId} style={warningStyle}>Order {shortfall.buyerOrderId} has {shortfall.reservedQuantity} of {shortfall.requestedQuantity} {shortfall.unit} reserved.</p>)}
          {readiness.status === "cutoff_reached" && readiness.operationalConfirmationRequired && <Label text="Operational readiness override reason"><input value={readinessOverrideReason} onChange={(event) => setReadinessOverrideReason(event.target.value)} style={inputStyle} /></Label>}
          <div style={{ ...actionsStyle, marginTop: 16 }}>
            {readiness.status === "draft" && <button style={primaryButton} onClick={() => void updateRunStatus({ actorUserId, runId: readiness._id, status: "accepting_orders" }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Orders could not be opened."))}>Open orders</button>}
            {readiness.status === "cutoff_reached" && <button disabled={readiness.blockers.length > 0 || readiness.reservationShortfalls.length > 0 || (readiness.operationalConfirmationRequired && readinessOverrideReason.trim() === "")} style={primaryButton} onClick={() => void updateRunStatus({ actorUserId, runId: readiness._id, status: "ready", ...(readinessOverrideReason.trim() === "" ? {} : { reason: readinessOverrideReason }) }).then(() => setMessage("Run marked ready.")).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Run could not be marked ready."))}>{readiness.operationalConfirmationRequired ? "Mark ready with override" : "Mark ready"}</button>}
            {readiness.status === "ready" && <button style={primaryButton} onClick={() => void updateRunStatus({ actorUserId, runId: readiness._id, status: "confirmed" }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Run could not be confirmed."))}>Confirm run</button>}
          </div>
          {!["cancelled", "dispatched", "completed"].includes(readiness.status) && <div style={{ ...formGridStyle, marginTop: 18 }}><Label text="Cancellation or postponement reason"><input value={reason} onChange={(event) => setReason(event.target.value)} style={inputStyle} /></Label><Label text="New date for postponement"><input type="date" value={postponedDate} onChange={(event) => setPostponedDate(event.target.value)} style={inputStyle} /></Label><div style={actionsStyle}><button style={dangerButton} onClick={() => void updateRunStatus({ actorUserId, runId: readiness._id, status: "cancelled", reason }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Run could not be cancelled."))}>Cancel run</button><button style={secondaryButton} onClick={() => void postponeRun({ actorUserId, runId: readiness._id, newDeliveryDate: postponedDate, reason }).then(selectRun).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Run could not be postponed."))}>Postpone to new date</button></div></div>}
        </section>
      )}
    </div>
  );
}

function Label({ text, children, wide = false }: { text: string; children: ReactNode; wide?: boolean }) { return <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: gray[600], ...(wide ? { gridColumn: "1 / -1" } : {}) }}>{text}{children}</label>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <div style={metricStyle}><span style={smallText}>{label}</span><strong style={{ fontSize: 18 }}>{value}</strong></div>; }
function LoadMetric({ label, value }: { label: string; value: { compatible: boolean; configuredQuantity?: number; configuredUnit?: string; reservedQuantity?: number; remainingQuantity?: number; percentage?: number } }) { return <div style={summaryRowStyle}><strong>{label}</strong><span>{value.configuredQuantity === undefined ? "Not configured" : value.compatible ? `${value.reservedQuantity ?? 0} / ${value.configuredQuantity} ${value.configuredUnit} (${value.percentage ?? 0}%)${value.remainingQuantity === undefined ? "" : ` · ${value.remainingQuantity} remaining`}` : `${value.configuredQuantity} ${value.configuredUnit} configured · incompatible order units, no percentage shown`}</span></div>; }
function formatDate(value: number, timezone: string) { return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: timezone }).format(value); }
function formatTime(value: number, timezone: string) { return new Intl.DateTimeFormat("en-GH", { timeStyle: "short", timeZone: timezone }).format(value); }
function formatDateTime(value: number, timezone: string) { return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(value); }

const titleStyle = { margin: 0, color: gray[900], fontSize: "1.75rem", fontWeight: 900 } as const;
const subtitleStyle = { margin: "6px 0 0", color: gray[500], fontSize: 14 } as const;
const panelStyle = { background: "white", border: `1px solid ${gray[100]}`, borderRadius: 10, padding: 20 } as const;
const sectionTitle = { margin: "0 0 14px", color: gray[900], fontSize: 18 } as const;
const subheadingStyle = { margin: "18px 0 8px", fontSize: 14, color: gray[800] } as const;
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 } as const;
const cardsGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 } as const;
const metricsGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, margin: "14px 0" } as const;
const inputStyle = { border: `1px solid ${gray[300]}`, borderRadius: 6, padding: "9px 10px", background: "white", color: gray[900], minWidth: 0 } as const;
const pairStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } as const;
const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 } as const;
const actionsStyle = { display: "flex", flexWrap: "wrap", gap: 8 } as const;
const cardStyle = { display: "grid", gap: 9, padding: 14, border: `1px solid ${gray[100]}`, borderRadius: 8, background: gray[25], color: gray[800] } as const;
const metricStyle = { display: "grid", gap: 3, padding: 12, border: `1px solid ${gray[100]}`, borderRadius: 8 } as const;
const summaryRowStyle = { display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", borderBottom: `1px solid ${gray[50]}`, padding: "9px 0", color: gray[700], fontSize: 13 } as const;
const smallText = { margin: 0, color: gray[500], fontSize: 12, lineHeight: 1.5 } as const;
const messageStyle = { background: "#eef7f1", color: palette.field, borderRadius: 8, padding: 12, fontWeight: 700 } as const;
const warningStyle = { background: "#fff8e6", color: "#7a5200", borderRadius: 8, padding: 12, fontSize: 13 } as const;
const primaryButton = { border: 0, borderRadius: 6, padding: "9px 12px", background: palette.field, color: "white", fontWeight: 800, cursor: "pointer" } as const;
const secondaryButton = { ...primaryButton, border: `1px solid ${gray[300]}`, background: "white", color: gray[700] } as const;
const dangerButton = { ...primaryButton, background: "#a83232" } as const;
