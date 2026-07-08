"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, PauseCircle, RefreshCw } from "lucide-react";
import { DataTable, StatusBadge, gray, palette } from "@kuapa-dwaso/dashboard-ui";
import { OperationalAccessGate } from "../operational/OperationalAccessGate";
import { useOperationalAdminData } from "../operational/useOperationalAdminData";

type Row = Record<string, unknown> & { id: string };

const paymentStatuses = ["initialized", "pending", "processing", "successful", "failed", "abandoned", "reversed", "refunded", "manual_review"];
const payoutStatuses = ["pending", "approved", "processing", "paid", "failed", "cancelled", "manual_review"];
const salePaymentStatuses = ["pending", "part_paid", "paid", "withheld", "disputed"];
const orderPaymentStatuses = ["awaiting_payment", "deposit_paid", "fully_paid", "payment_on_delivery", "failed", "refunded", "disputed"];
const webhookStatuses = ["received", "processed", "ignored", "failed"];

export default function FinancePage() {
  const {
    access,
    payments,
    paymentWebhookEvents,
    payoutLedger,
    orders,
    sales,
    buyers,
    farmers,
    actions,
  } = useOperationalAdminData();
  const [activeTab, setActiveTab] = useState<"payments" | "webhooks" | "orders" | "sales" | "payouts">("payments");

  const paymentRows = useMemo<Row[]>(
    () =>
      (payments as unknown as Row[]).map((payment) => {
        const order = payment.order as Row | undefined;
        const buyer = payment.buyer as Row | undefined;
        return {
          ...payment,
          buyerName: String(buyer?.fullName ?? "Unknown"),
          orderCrop: String(order?.cropType ?? ""),
          orderPaymentStatus: String(order?.paymentStatus ?? ""),
          amountLabel: money(payment.amount, payment.currency),
        } as Row;
      }),
    [payments],
  );

  const payoutRows = useMemo<Row[]>(
    () =>
      (payoutLedger as unknown as Row[]).map((entry) => {
        const farmer = entry.farmer as Row | undefined;
        const sale = entry.sale as Row | undefined;
        const order = entry.order as Row | undefined;
        return {
          ...entry,
          farmerName: String(farmer?.fullName ?? "Unknown"),
          salePaymentStatus: String(sale?.paymentStatus ?? ""),
          orderCrop: String(order?.cropType ?? ""),
          amountLabel: money(entry.amount, entry.currency),
        } as Row;
      }),
    [payoutLedger],
  );

  const orderRows = useMemo<Row[]>(
    () =>
      (orders as unknown as Row[]).map((order) => ({
        ...order,
        buyerName: String(buyers.find((buyer) => buyer.id === order.buyerId)?.fullName ?? "Unknown"),
        amountLabel: order.totalAmount === undefined ? "Unpriced" : money(order.totalAmount, "GHS"),
      }) as Row),
    [buyers, orders],
  );

  const saleRows = useMemo<Row[]>(
    () =>
      (sales as unknown as Row[]).map((sale) => ({
        ...sale,
        farmerName: String(farmers.find((farmer) => farmer.id === sale.farmerId)?.fullName ?? "Unknown"),
        grossLabel: money(sale.grossAmount, "GHS"),
        netLabel: money(sale.netAmountDueToFarmer, "GHS"),
      }) as Row),
    [farmers, sales],
  );

  return (
    <OperationalAccessGate
      firebaseUser={access.firebaseUser}
      principal={access.principal}
      isAuthLoading={access.isAuthLoading}
      isDataLoading={access.isDataLoading}
      isAllowed={access.canReadPayments || access.canReadPayouts || access.canReadOrders || access.canReadSales}
      limitedMessage="Finance operations require payments, payouts, orders, or sales read access for your assigned scope."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>
              Finance Reconciliation
            </h1>
            <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
              Payment transactions, webhook events, sale reconciliation, and manual farmer payout operations.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Metric label="Payments" value={paymentRows.length} />
            <Metric label="Payouts" value={payoutRows.length} />
            <Metric label="Review" value={paymentRows.filter((row) => row.status === "manual_review").length + payoutRows.filter((row) => row.status === "manual_review").length} />
          </div>
        </header>

        <nav style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[
            ["payments", "Payments"],
            ["webhooks", "Webhooks"],
            ["orders", "Order Payments"],
            ["sales", "Sale Reconciliation"],
            ["payouts", "Payout Ledger"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              style={{
                border: `1px solid ${activeTab === key ? palette.field : gray[300]}`,
                background: activeTab === key ? palette.field : "white",
                color: activeTab === key ? "white" : gray[700],
                borderRadius: "6px",
                padding: "8px 12px",
                fontSize: "0.8125rem",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {activeTab === "payments" && (
          <DataTable
            data={paymentRows}
            columns={[
              { key: "providerReference", header: "Reference" },
              { key: "buyerName", header: "Buyer" },
              { key: "orderCrop", header: "Order" },
              { key: "provider", header: "Provider" },
              { key: "amountLabel", header: "Amount", type: "numeric" as const },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={String(row.status)} /> },
              { key: "webhookEventCount", header: "Hooks", type: "numeric" as const },
            ]}
            rowIdKey="id"
            searchKey="providerReference"
            searchPlaceholder="Search reference..."
            filters={[
              { key: "status", label: "Payment Status", options: options(paymentStatuses) },
              { key: "provider", label: "Provider", options: options(["mock", "paystack"]) },
            ]}
            drawerTitle={(row) => `Payment ${String(row.providerReference)}`}
            drawerContent={(row) => (
              <PaymentDrawer
                row={row}
                canManage={access.canManagePayments}
                onReconcile={actions.reconcilePayment}
                onManualReview={actions.markPaymentManualReview}
              />
            )}
          />
        )}

        {activeTab === "webhooks" && (
          <DataTable
            data={paymentWebhookEvents as unknown as Row[]}
            columns={[
              { key: "providerEventId", header: "Event ID" },
              { key: "eventType", header: "Type" },
              { key: "provider", header: "Provider" },
              { key: "providerReference", header: "Reference" },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={String(row.status)} /> },
              { key: "createdAt", header: "Received", render: (row) => formatDate(row.createdAt) },
            ]}
            rowIdKey="id"
            searchKey="providerReference"
            searchPlaceholder="Search reference..."
            filters={[
              { key: "status", label: "Webhook Status", options: options(webhookStatuses) },
              { key: "provider", label: "Provider", options: options(["mock", "paystack"]) },
            ]}
            drawerTitle={(row) => `Webhook ${String(row.providerEventId)}`}
            drawerContent={(row) => <JsonDrawer row={row} />}
          />
        )}

        {activeTab === "orders" && (
          <DataTable
            data={orderRows}
            columns={[
              { key: "buyerName", header: "Buyer" },
              { key: "cropType", header: "Crop" },
              { key: "destinationMarket", header: "Destination" },
              { key: "amountLabel", header: "Total", type: "numeric" as const },
              { key: "paymentStatus", header: "Payment", render: (row) => <StatusBadge status={String(row.paymentStatus)} /> },
              { key: "status", header: "Order", render: (row) => <StatusBadge status={String(row.status)} /> },
            ]}
            rowIdKey="id"
            searchKey="buyerName"
            searchPlaceholder="Search buyer..."
            filters={[{ key: "paymentStatus", label: "Payment Status", options: options(orderPaymentStatuses) }]}
            drawerTitle={(row) => `${String(row.cropType)} order`}
            drawerContent={(row) => <OrderDrawer row={row} />}
          />
        )}

        {activeTab === "sales" && (
          <DataTable
            data={saleRows}
            columns={[
              { key: "farmerName", header: "Farmer" },
              { key: "buyerOrderId", header: "Order" },
              { key: "grossLabel", header: "Gross", type: "numeric" as const },
              { key: "netLabel", header: "Farmer Net", type: "numeric" as const },
              { key: "paymentStatus", header: "Payment", render: (row) => <StatusBadge status={String(row.paymentStatus)} /> },
            ]}
            rowIdKey="id"
            searchKey="farmerName"
            searchPlaceholder="Search farmer..."
            filters={[{ key: "paymentStatus", label: "Sale Payment", options: options(salePaymentStatuses) }]}
            drawerTitle={(row) => `Sale ${String(row.id).slice(-8)}`}
            drawerContent={(row) => <SaleDrawer row={row} />}
          />
        )}

        {activeTab === "payouts" && (
          <DataTable
            data={payoutRows}
            columns={[
              { key: "farmerName", header: "Farmer" },
              { key: "orderCrop", header: "Order" },
              { key: "amountLabel", header: "Amount", type: "numeric" as const },
              { key: "status", header: "Payout", render: (row) => <StatusBadge status={String(row.status)} /> },
              { key: "salePaymentStatus", header: "Sale Payment", render: (row) => <StatusBadge status={String(row.salePaymentStatus)} /> },
            ]}
            rowIdKey="id"
            searchKey="farmerName"
            searchPlaceholder="Search farmer..."
            filters={[{ key: "status", label: "Payout Status", options: options(payoutStatuses) }]}
            drawerTitle={(row) => `Payout ${String(row.id).slice(-8)}`}
            drawerContent={(row) => (
              <PayoutDrawer
                row={row}
                canManage={access.canManagePayouts}
                onUpdate={actions.updatePayoutStatus}
              />
            )}
          />
        )}
      </div>
    </OperationalAccessGate>
  );
}

function PaymentDrawer({
  row,
  canManage,
  onReconcile,
  onManualReview,
}: {
  row: Row;
  canManage: boolean;
  onReconcile: (paymentTransactionId: string, status: "initialized" | "pending" | "processing" | "successful" | "failed" | "abandoned" | "reversed" | "refunded" | "manual_review", reason: string) => Promise<unknown>;
  onManualReview: (paymentTransactionId: string, reason: string) => Promise<unknown>;
}) {
  const [status, setStatus] = useState("successful");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  const run = async (action: "reconcile" | "review") => {
    setMessage("Saving...");
    try {
      if (action === "review") {
        await onManualReview(row.id, reason);
      } else {
        await onReconcile(row.id, status as Parameters<typeof onReconcile>[1], reason);
      }
      setMessage("Saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    }
  };

  return (
    <DrawerStack>
      <FieldGrid>
        <Field label="Amount" value={money(row.amount, row.currency)} />
        <Field label="Provider" value={String(row.provider)} />
        <Field label="Reference" value={String(row.providerReference)} />
        <Field label="Status" value={String(row.status)} />
        <Field label="Provider status" value={String(row.providerStatus ?? "None")} />
        <Field label="Verified" value={formatDate(row.verifiedAt)} />
      </FieldGrid>
      {canManage && (
        <ActionPanel>
          <select value={status} onChange={(event) => setStatus(event.target.value)} style={selectStyle}>
            {paymentStatuses.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
          </select>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason or reconciliation note" style={textareaStyle} />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <ActionButton icon={<CheckCircle2 size={16} />} label="Reconcile" onClick={() => void run("reconcile")} />
            <ActionButton icon={<PauseCircle size={16} />} label="Manual Review" onClick={() => void run("review")} secondary />
          </div>
          {message && <p style={actionMessageStyle}>{message}</p>}
        </ActionPanel>
      )}
    </DrawerStack>
  );
}

function PayoutDrawer({
  row,
  canManage,
  onUpdate,
}: {
  row: Row;
  canManage: boolean;
  onUpdate: (payoutLedgerId: string, status: "pending" | "approved" | "processing" | "paid" | "failed" | "cancelled" | "manual_review", reason: string, providerReference?: string) => Promise<unknown>;
}) {
  const [status, setStatus] = useState(String(row.status));
  const [reason, setReason] = useState("");
  const [providerReference, setProviderReference] = useState(String(row.providerReference ?? ""));
  const [message, setMessage] = useState("");

  const run = async () => {
    setMessage("Saving...");
    try {
      await onUpdate(row.id, status as Parameters<typeof onUpdate>[1], reason, providerReference);
      setMessage("Saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    }
  };

  return (
    <DrawerStack>
      <FieldGrid>
        <Field label="Amount" value={money(row.amount, row.currency)} />
        <Field label="Farmer" value={String(row.farmerName)} />
        <Field label="Payout status" value={String(row.status)} />
        <Field label="Sale payment" value={String(row.salePaymentStatus)} />
        <Field label="Provider reference" value={String(row.providerReference ?? "Manual ledger")} />
        <Field label="Updated" value={formatDate(row.updatedAt)} />
      </FieldGrid>
      {canManage && (
        <ActionPanel>
          <select value={status} onChange={(event) => setStatus(event.target.value)} style={selectStyle}>
            {payoutStatuses.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
          </select>
          <input value={providerReference} onChange={(event) => setProviderReference(event.target.value)} placeholder="Manual payout reference" style={inputStyle} />
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason or payout note" style={textareaStyle} />
          <ActionButton icon={<RefreshCw size={16} />} label="Update Payout" onClick={() => void run()} />
          {message && <p style={actionMessageStyle}>{message}</p>}
        </ActionPanel>
      )}
    </DrawerStack>
  );
}

function OrderDrawer({ row }: { row: Row }) {
  return (
    <FieldGrid>
      <Field label="Buyer" value={String(row.buyerName)} />
      <Field label="Crop" value={String(row.cropType)} />
      <Field label="Destination" value={String(row.destinationMarket)} />
      <Field label="Quantity" value={`${String(row.requestedQuantity)} ${String(row.unit)}`} />
      <Field label="Payment" value={String(row.paymentStatus)} />
      <Field label="Total" value={String(row.amountLabel)} />
    </FieldGrid>
  );
}

function SaleDrawer({ row }: { row: Row }) {
  return (
    <FieldGrid>
      <Field label="Farmer" value={String(row.farmerName)} />
      <Field label="Quantity" value={`${String(row.quantitySold)} ${String(row.unit)}`} />
      <Field label="Gross" value={String(row.grossLabel)} />
      <Field label="Farmer net" value={String(row.netLabel)} />
      <Field label="Payment" value={String(row.paymentStatus)} />
      <Field label="Updated" value={formatDate(row.updatedAt)} />
    </FieldGrid>
  );
}

function JsonDrawer({ row }: { row: Row }) {
  return (
    <DrawerStack>
      <FieldGrid>
        <Field label="Status" value={String(row.status)} />
        <Field label="Provider" value={String(row.provider)} />
        <Field label="Reference" value={String(row.providerReference ?? "None")} />
        <Field label="Processed" value={formatDate(row.processedAt)} />
      </FieldGrid>
      <pre style={{ whiteSpace: "pre-wrap", background: gray[25], border: `1px solid ${gray[100]}`, borderRadius: "6px", padding: "12px", fontSize: "0.75rem", color: gray[700], overflowX: "auto" }}>
        {JSON.stringify(row.rawPayload ?? row, null, 2)}
      </pre>
    </DrawerStack>
  );
}

function DrawerStack({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>{children}</div>;
}

function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <section style={{ border: `1px solid ${gray[100]}`, borderRadius: "8px", background: gray[25], padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: gray[500], fontSize: "0.75rem", fontWeight: 700 }}>{label}</span>
      <p style={{ color: gray[800], fontSize: "0.875rem", fontWeight: 700, margin: "2px 0 0", overflowWrap: "anywhere" }}>{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: `1px solid ${gray[100]}`, borderRadius: "8px", background: "white", padding: "8px 12px", minWidth: "92px" }}>
      <span style={{ color: gray[500], fontSize: "0.6875rem", fontWeight: 800, textTransform: "uppercase" }}>{label}</span>
      <p style={{ color: gray[900], fontSize: "1.125rem", fontWeight: 900, margin: "2px 0 0" }}>{value}</p>
    </div>
  );
}

function ActionPanel({ children }: { children: ReactNode }) {
  return <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{children}</section>;
}

function ActionButton({ icon, label, onClick, secondary = false }: { icon: ReactNode; label: string; onClick: () => void; secondary?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        border: `1px solid ${secondary ? gray[300] : palette.field}`,
        borderRadius: "6px",
        background: secondary ? "white" : palette.field,
        color: secondary ? gray[700] : "white",
        padding: "8px 10px",
        fontSize: "0.8125rem",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

const inputStyle = {
  border: `1px solid ${gray[300]}`,
  borderRadius: "6px",
  padding: "8px 10px",
  fontSize: "0.875rem",
} as const;

const selectStyle = {
  ...inputStyle,
  background: "white",
};

const textareaStyle = {
  ...inputStyle,
  minHeight: "74px",
  resize: "vertical",
} as const;

const actionMessageStyle = {
  color: gray[600],
  fontSize: "0.8125rem",
  fontWeight: 700,
  margin: 0,
} as const;

function options(values: string[]) {
  return values.map((value) => ({ value, label: labelize(value) }));
}

function labelize(value: string) {
  return value.replace(/_/g, " ");
}

function money(amount: unknown, currency: unknown) {
  const value = typeof amount === "number" ? amount : Number(amount ?? 0);
  return `${String(currency ?? "GHS")} ${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`;
}

function formatDate(value: unknown) {
  return typeof value === "number" ? new Date(value).toLocaleString() : "Not recorded";
}
