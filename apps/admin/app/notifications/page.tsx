"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { DataTable, StatusBadge, gray, palette } from "@kuapa-dwaso/dashboard-ui";
import { OperationalAccessGate } from "../operational/OperationalAccessGate";
import { useOperationalAdminData } from "../operational/useOperationalAdminData";

export default function NotificationsPage() {
  const { access, notifications } = useOperationalAdminData();
  const markRead = useMutation(api.notifications.markRead);
  const acknowledge = useMutation(api.notifications.acknowledge);

  return (
    <OperationalAccessGate
      firebaseUser={access.firebaseUser}
      principal={access.principal}
      isAuthLoading={access.isAuthLoading}
      isDataLoading={access.isDataLoading}
      isAllowed={access.canReadNotifications}
      limitedMessage="Notification lookup requires notifications:read."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>Notifications</h1>
          <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
            Admin-safe lookup of platform notification records and delivery state.
          </p>
        </div>

        <DataTable
          data={notifications}
          columns={[
            { key: "createdAt", header: "Created", render: (row) => new Date(Number(row.createdAt)).toLocaleString() },
            { key: "recipientRole", header: "Recipient Role", type: "text" as const },
            { key: "channel", header: "Channel", type: "text" as const },
            { key: "title", header: "Title", type: "text" as const },
            { key: "priority", header: "Priority", render: (row) => <StatusBadge status={String(row.priority ?? "normal")} /> },
            { key: "actionRequired", header: "Action", render: (row) => row.actionRequired === true ? (row.acknowledgedAt === undefined ? "Required" : "Acknowledged") : "Information" },
            { key: "dueAt", header: "Due", render: (row) => row.dueAt === undefined ? "None" : new Date(Number(row.dueAt)).toLocaleString() },
            { key: "relatedEntityType", header: "Related", render: (row) => row.relatedEntityType === undefined ? "None" : `${String(row.relatedEntityType)} (${String(row.relatedEntityId ?? "")})` },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={String(row.status)} /> },
          ]}
          rowIdKey="id"
          searchKey="title"
          searchPlaceholder="Search title..."
          filters={[
            { key: "status", label: "Filter Status", options: ["pending", "sent", "read", "failed", "archived"].map((value) => ({ value, label: value })) },
            { key: "channel", label: "Filter Channel", options: ["sms", "in_app", "email"].map((value) => ({ value, label: value })) },
            { key: "recipientRole", label: "Filter Recipient", options: ["farmer", "warehouse_agent", "buyer", "transporter", "admin"].map((value) => ({ value, label: value.replace(/_/g, " ") })) },
          ]}
          drawerTitle={(row) => String(row.title ?? "Notification")}
          drawerContent={(row) => (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <section style={{ border: `1px solid ${gray[100]}`, borderRadius: "8px", background: gray[25], padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Recipient role" value={String(row.recipientRole)} />
                <Field label="Recipient id" value={String(row.recipientId ?? row.recipientUserId ?? "Not set")} />
                <Field label="Channel" value={String(row.channel)} />
                <Field label="Status" value={String(row.status)} />
                <Field label="Created" value={new Date(Number(row.createdAt)).toLocaleString()} />
                <Field label="Sent" value={row.sentAt === undefined ? "Not sent" : new Date(Number(row.sentAt)).toLocaleString()} />
                <Field label="Priority" value={String(row.priority ?? "normal")} />
                <Field label="Action required" value={row.actionRequired === true ? "Yes" : "No"} />
                <Field label="Due" value={row.dueAt === undefined ? "No deadline" : new Date(Number(row.dueAt)).toLocaleString()} />
                <Field label="Acknowledged" value={row.acknowledgedAt === undefined ? "Not acknowledged" : new Date(Number(row.acknowledgedAt)).toLocaleString()} />
              </section>

              <section style={{ border: `1px solid ${gray[100]}`, borderRadius: "8px", padding: "16px" }}>
                <span style={{ color: gray[500], fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase" }}>Message</span>
                <p style={{ color: gray[800], fontSize: "0.875rem", lineHeight: 1.5, margin: "8px 0 0" }}>{String(row.message ?? row.body ?? "")}</p>
              </section>

              {row.relatedEntityType !== undefined && (
                <section style={{ border: `1px solid ${palette.line}`, borderRadius: "8px", background: palette.surface, padding: "16px" }}>
                  <span style={{ color: palette.field, fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase" }}>Related entity</span>
                  <p style={{ color: gray[800], fontSize: "0.875rem", fontWeight: 700, margin: "8px 0 0" }}>
                    {String(row.relatedEntityType)} ({String(row.relatedEntityId ?? "")})
                  </p>
                </section>
              )}
              {row.actionUrl !== undefined && (
                <a href={String(row.actionUrl)} style={{ color: palette.field, fontSize: "0.875rem", fontWeight: 800 }}>Open action destination</a>
              )}
              {access.actorUserId !== undefined && row.recipientUserId === access.actorUserId && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {row.status !== "read" && <button type="button" onClick={() => void markRead({ actorUserId: access.actorUserId as Id<"users">, notificationId: String(row.id) as Id<"notifications"> })}>Mark read</button>}
                  {row.actionRequired === true && row.acknowledgedAt === undefined && <button type="button" onClick={() => void acknowledge({ actorUserId: access.actorUserId as Id<"users">, notificationId: String(row.id) as Id<"notifications"> })}>Acknowledge</button>}
                </div>
              )}
            </div>
          )}
        />
      </div>
    </OperationalAccessGate>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: gray[500], fontSize: "0.75rem", fontWeight: 700 }}>{label}</span>
      <p style={{ color: gray[800], fontSize: "0.875rem", fontWeight: 700, margin: "2px 0 0" }}>{value}</p>
    </div>
  );
}
