// apps/admin/app/audit-logs/page.tsx
"use client";

import { useAdminData, DataTable, gray, palette, status } from "@kuapa-dwaso/dashboard-ui";

export default function AuditLogsPage() {
  const { auditLogs } = useAdminData();

  const columns = [
    {
      key: "createdAt",
      header: "Timestamp",
      render: (row: any) => new Date(row.createdAt).toLocaleString()
    },
    { key: "actorName", header: "Actor", type: "text" as const },
    { key: "actorRole", header: "Role", type: "text" as const },
    {
      key: "action",
      header: "Action Logged",
      type: "text" as const,
      render: (row: any) => (
        <span style={{ fontFamily: "monospace", color: palette.sky, fontWeight: 600 }}>
          {row.action}
        </span>
      )
    },
    {
      key: "entityType",
      header: "Target Entity",
      type: "text" as const,
      render: (row: any) => (
        <span style={{ textTransform: "capitalize", fontSize: "0.8125rem" }}>
          {row.entityType.replace(/_/g, " ")} ({row.entityId})
        </span>
      )
    }
  ];

  // Helper to format values for display
  const formatVal = (val: any) => {
    if (typeof val === "object" && val !== null) return JSON.stringify(val);
    return String(val);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>
          Platform Audit Trail Logs
        </h1>
        <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
          Immutable logging of actions, configuration alterations and administrative state updates.
        </p>
      </div>

      {/* Grid */}
      <DataTable
        data={auditLogs}
        columns={columns}
        rowIdKey="id"
        searchKey="action"
        searchPlaceholder="Search logged action..."
        filters={[
          {
            key: "actorRole",
            label: "Filter Role",
            options: [
              { value: "admin", label: "Admin" },
              { value: "warehouse_agent", label: "Warehouse Agent" }
            ]
          },
          {
            key: "entityType",
            label: "Filter Entity",
            options: [
              { value: "fee_rule", label: "Fee Rule" },
              { value: "warehouse_agent", label: "Warehouse Agent" },
              { value: "farmer", label: "Farmer" },
              { value: "warehouse", label: "Warehouse" },
              { value: "dispute", label: "Dispute" }
            ]
          }
        ]}
        drawerTitle={(row) => `Action: ${row.action}`}
        drawerContent={(row, _onClose) => {
          // Compute keys that changed
          const keys = Array.from(new Set([
            ...Object.keys(row.before || {}),
            ...Object.keys(row.after || {})
          ]));

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Event details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px", borderRadius: "8px", border: `1px solid ${gray[100]}`, backgroundColor: gray[25] }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: gray[900] }}>Metadata Summary</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.8125rem", marginTop: "8px" }}>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 600 }}>Performed By</span>
                    <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[700] }}>{row.actorName} ({row.actorRole})</p>
                  </div>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 600 }}>Log ID</span>
                    <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[700], fontFamily: "monospace" }}>{row.id}</p>
                  </div>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 600 }}>Event Timestamp</span>
                    <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[700] }}>{new Date(row.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 600 }}>Target Entity</span>
                    <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[700], textTransform: "capitalize" }}>
                      {row.entityType.replace(/_/g, " ")} ({row.entityId})
                    </p>
                  </div>
                </div>
              </div>

              {/* State Diffs */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 700, textTransform: "uppercase" }}>State Changes Diff</span>
                
                {keys.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.875rem", color: gray[500], fontStyle: "italic", padding: "10px 0" }}>
                    No state changes logged for this event (read-only query).
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {keys.map((key) => {
                      const beforeVal = row.before?.[key];
                      const afterVal = row.after?.[key];
                      return (
                        <div
                          key={key}
                          style={{
                            border: `1px solid ${gray[100]}`,
                            borderRadius: "6px",
                            overflow: "hidden"
                          }}
                        >
                          {/* Property key */}
                          <div style={{ backgroundColor: gray[25], padding: "8px 12px", borderBottom: `1px solid ${gray[100]}`, fontSize: "0.75rem", fontWeight: 700, color: gray[700], fontFamily: "monospace" }}>
                            {key}
                          </div>
                          
                          {/* Before & After rows */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", fontSize: "0.8125rem" }}>
                            <div style={{ padding: "10px 12px", backgroundColor: beforeVal !== undefined ? status.dangerBg : gray[25], color: beforeVal !== undefined ? status.danger : gray[400], borderRight: `1px solid ${gray[100]}`, overflowX: "auto" }}>
                              <span style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", color: gray[500], marginBottom: "4px" }}>Before</span>
                              {beforeVal !== undefined ? formatVal(beforeVal) : "undefined"}
                            </div>
                            <div style={{ padding: "10px 12px", backgroundColor: afterVal !== undefined ? status.successBg : gray[25], color: afterVal !== undefined ? status.success : gray[400], overflowX: "auto" }}>
                              <span style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", color: gray[500], marginBottom: "4px" }}>After</span>
                              {afterVal !== undefined ? formatVal(afterVal) : "undefined"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          );
        }}
      />
    </div>
  );
}
