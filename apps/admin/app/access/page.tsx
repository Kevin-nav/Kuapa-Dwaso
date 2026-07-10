"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { getIdToken } from "firebase/auth";
import type { User } from "firebase/auth";
import type {
  AdminRoleKey,
  AdminScopeType,
  InvitationChannel,
  MfaRequirement,
  PlatformInvitationType,
} from "@kuapa-dwaso/types";
import { adminPermissionKeys, type AdminPermissionKey } from "@kuapa-dwaso/permissions";
import {
  AdminAccessState,
  DataTable,
  StatusBadge,
  gray,
  palette,
  status,
} from "@kuapa-dwaso/dashboard-ui";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAdminAuth } from "../auth/AdminAuthProvider";

const roleKeys: AdminRoleKey[] = [
  "platform_owner",
  "operations_manager",
  "warehouse_manager",
  "finance_manager",
  "support_officer",
  "auditor",
  "analyst",
  "admin_viewer",
];

const scopeTypes: AdminScopeType[] = ["global", "region", "district", "warehouse", "destination_market"];
const inviteTypes: PlatformInvitationType[] = [
  "admin_invite",
  "warehouse_manager_invite",
  "warehouse_agent_invite",
  "transporter_invite",
];
const mfaRequirements: MfaRequirement[] = ["not_required", "sms_required", "totp_required", "required"];
const tabs = ["Invites", "Admin Users", "Groups", "Permission Preview"] as const;

type TabKey = (typeof tabs)[number];
type AdminUserRow = {
  userId: Id<"users">;
  name: string;
  email?: string;
  status: string;
  mfaRequirement: string;
  mfaStatus: string;
  onboardingState: string;
  updatedAt: number;
};
type Message = { tone: "success" | "warning" | "danger"; text: string };

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatDate(value: number | undefined) {
  return value === undefined ? "Never" : new Date(value).toLocaleString();
}

function scopeText(input: { scopeType: string; scopeId?: string; scopeValue?: string }) {
  if (input.scopeType === "global") {
    return "global";
  }
  return `${formatLabel(input.scopeType)}: ${input.scopeValue ?? input.scopeId ?? "unscoped"}`;
}

function messageStyle(tone: Message["tone"]) {
  if (tone === "success") {
    return {
      background: "#ecfdf5",
      border: "1px solid #10b981",
      color: "#065f46",
    };
  }
  if (tone === "warning") {
    return {
      background: "#fffbeb",
      border: "1px solid #f59e0b",
      color: "#92400e",
    };
  }
  return {
    background: "#fef2f2",
    border: "1px solid #ef4444",
    color: "#991b1b",
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.8125rem", fontWeight: 700, color: gray[700] }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle = {
  border: `1px solid ${gray[300]}`,
  borderRadius: "6px",
  color: gray[800],
  font: "inherit",
  minHeight: "38px",
  padding: "8px 10px",
  width: "100%",
};

const buttonStyle = {
  alignItems: "center",
  background: palette.field,
  border: 0,
  borderRadius: "6px",
  color: "white",
  cursor: "pointer",
  display: "inline-flex",
  fontWeight: 800,
  justifyContent: "center",
  minHeight: "38px",
  padding: "8px 14px",
};

export default function AccessManagementPage() {
  const { firebaseUser, principal, isLoading } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("Invites");
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<Id<"users"> | undefined>();
  const [selectedGroupId, setSelectedGroupId] = useState<Id<"adminAccessGroups"> | undefined>();
  const [message, setMessage] = useState<Message | undefined>();

  const actorUserId = principal?.role === "admin" && principal.status === "active"
    ? (principal.userId as Id<"users">)
    : undefined;

  const invitations = useQuery(
    api.invitations.list,
    actorUserId === undefined ? "skip" : { actorUserId, limit: 100 },
  ) as unknown[] | undefined;
  const adminUsers = useQuery(
    api.users.listAdmins,
    actorUserId === undefined ? "skip" : { actorUserId, limit: 100 },
  ) as AdminUserRow[] | undefined;
  const groups = useQuery(
    api.adminAccess.listGroups,
    actorUserId === undefined ? "skip" : { actorUserId, limit: 100 },
  ) as unknown[] | undefined;
  const warehouses = useQuery(
    api.warehouses.list,
    actorUserId === undefined ? "skip" : { actorUserId, limit: 100 },
  ) as { _id: Id<"warehouses">; code: string; name: string; region?: string; district?: string }[] | undefined;

  const selectedUserId = selectedAdminUserId ?? adminUsers?.[0]?.userId;
  const directAssignments = useQuery(
    api.adminAccess.listDirectAssignmentsByUser,
    actorUserId === undefined || selectedUserId === undefined ? "skip" : { actorUserId, adminUserId: selectedUserId },
  ) as unknown[] | undefined;
  const groupMemberships = useQuery(
    api.adminAccess.listGroupMembershipsByUser,
    actorUserId === undefined || selectedUserId === undefined ? "skip" : { actorUserId, adminUserId: selectedUserId },
  ) as unknown[] | undefined;
  const effectiveAccess = useQuery(
    api.adminAccess.getEffectiveAccess,
    actorUserId === undefined || selectedUserId === undefined ? "skip" : { actorUserId, adminUserId: selectedUserId },
  ) as { roles: unknown[]; permissions: string[]; isPlatformOwner: boolean; generatedAt: number } | undefined;
  const groupDetails = useQuery(
    api.adminAccess.getGroupDetails,
    actorUserId === undefined || selectedGroupId === undefined ? "skip" : { actorUserId, groupId: selectedGroupId },
  ) as { group: Record<string, unknown>; members: unknown[]; roleAssignments: unknown[] } | null | undefined;

  const revokeInvite = useMutation(api.invitations.revoke);
  const expireInvites = useMutation(api.invitations.expirePending);
  const assignDirectRole = useMutation(api.adminAccess.assignDirectRole);
  const revokeDirectRole = useMutation(api.adminAccess.deactivateDirectRole);
  const createGroup = useMutation(api.adminAccess.createGroup);
  const updateGroup = useMutation(api.adminAccess.updateGroup);
  const addGroupMember = useMutation(api.adminAccess.addGroupMember);
  const removeGroupMember = useMutation(api.adminAccess.deactivateGroupMember);
  const assignGroupRole = useMutation(api.adminAccess.assignGroupRole);
  const revokeGroupRole = useMutation(api.adminAccess.deactivateGroupRole);

  const selectedUser = useMemo(
    () => adminUsers?.find((user) => user.userId === selectedUserId) ?? adminUsers?.[0],
    [adminUsers, selectedUserId],
  );

  if (isLoading) {
    return (
      <AdminAccessState
        variant="loading"
        title="Loading admin access"
        message="Checking your Firebase identity and Convex admin principal before opening access management."
      />
    );
  }

  if (firebaseUser === null) {
    return (
      <AdminAccessState
        variant="denied"
        title="Admin sign-in required"
        message="Access management requires a Google or email/password Firebase admin or warehouse-manager identity."
        detail="Use the Admin sign in page. Phone auth remains reserved for farmer, buyer, transporter, and warehouse-agent self-service flows outside this slice."
      />
    );
  }

  if (principal == null || principal.role !== "admin" || principal.status !== "active" || actorUserId === undefined) {
    return (
      <AdminAccessState
        variant="denied"
        title="No active admin principal"
        message="Your Firebase identity is signed in, but it is not linked to an active Convex admin user."
        detail="Accept an admin or warehouse-manager invite, verify email, and satisfy the configured Firebase MFA requirement before managing access."
      />
    );
  }

  const activePrincipal = principal;

  const getErrorMessage = (err: unknown): string => {
    let rawMessage = "Action failed.";
    if (err instanceof Error) {
      rawMessage = err.message;
    } else if (typeof err === "string") {
      rawMessage = err;
    } else if (err && typeof err === "object" && "message" in err) {
      rawMessage = String((err as { message: unknown }).message);
    }

    if (rawMessage.startsWith("{") && rawMessage.endsWith("}")) {
      try {
        const parsed = JSON.parse(rawMessage);
        if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.message)) {
            return parsed.message.join(", ");
          }
          if (typeof parsed.message === "string") {
            return parsed.message;
          }
        }
      } catch {
        // Ignore and use rawMessage
      }
    }

    const match = rawMessage.match(/(?:Uncaught Error|ConvexError):\s*([^\n]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }

    return rawMessage;
  };

  const setSuccess = (text: string) => setMessage({ tone: "success", text });
  const setFailure = (err: unknown) => setMessage({ tone: "danger", text: getErrorMessage(err) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ color: gray[900], fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>Admin Access</h1>
          <p style={{ color: gray[500], fontSize: "0.875rem", margin: "4px 0 0" }}>
            Invitations, scoped roles, access groups, and effective permission preview.
          </p>
        </div>
        <div style={{ background: gray[0], border: `1px solid ${gray[100]}`, borderRadius: "8px", padding: "10px 12px", minWidth: "240px" }}>
          <div style={{ color: gray[500], fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase" }}>Current principal</div>
          <div style={{ color: gray[900], fontSize: "0.875rem", fontWeight: 800 }}>{activePrincipal.name}</div>
          <div style={{ color: gray[600], fontSize: "0.75rem" }}>{activePrincipal.email ?? activePrincipal.userId}</div>
        </div>
      </div>

      {activePrincipal.mfaRequirement !== "not_required" && activePrincipal.mfaStatus !== "verified" && (
        <AdminAccessState
          variant="limited"
          title="MFA still pending"
          message="This admin principal has an MFA requirement that Convex has not recorded as verified."
          detail="Firebase must be configured with the second factor. After completing the Firebase challenge, the API invite acceptance path records the verified MFA state."
        />
      )}

      {message !== undefined && (
        <div style={{ borderRadius: "8px", fontWeight: 700, padding: "12px 14px", fontSize: "0.875rem", ...messageStyle(message.tone) }}>
          {message.text}
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", borderBottom: `1px solid ${gray[100]}` }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "transparent",
              border: 0,
              borderBottom: activeTab === tab ? `3px solid ${palette.field}` : "3px solid transparent",
              color: activeTab === tab ? palette.field : gray[600],
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 800,
              padding: "10px 12px",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Invites" && (
        <InvitesPanel
          firebaseUser={firebaseUser}
          invitations={invitations ?? []}
          warehouses={warehouses ?? []}
          onCreateSuccess={setSuccess}
          onFailure={setFailure}
          onRevoke={(invitationId) => {
            void revokeInvite({ actorUserId, invitationId, reason: "Revoked from admin access UI" }).then(() => {
              setSuccess("Invitation revoked.");
            }).catch(setFailure);
          }}
          onExpire={() => {
            void expireInvites({}).then((count) => {
              setSuccess(`Expired ${count} pending invitation${count === 1 ? "" : "s"}.`);
            }).catch(setFailure);
          }}
        />
      )}

      {activeTab === "Admin Users" && (
        <UsersPanel
          actorUserId={actorUserId}
          adminUsers={adminUsers ?? []}
          selectedUser={selectedUser}
          setSelectedAdminUserId={setSelectedAdminUserId}
          directAssignments={directAssignments ?? []}
          groupMemberships={groupMemberships ?? []}
          effectiveAccess={effectiveAccess}
          warehouses={warehouses ?? []}
          onAssign={(input) => assignDirectRole({ actorUserId, ...input }).then(() => setSuccess("Direct role assigned.")).catch(setFailure)}
          onRevoke={(assignmentId) => revokeDirectRole({ actorUserId, assignmentId, reason: "Revoked from admin access UI" }).then(() => setSuccess("Direct role revoked.")).catch(setFailure)}
        />
      )}

      {activeTab === "Groups" && (
        <GroupsPanel
          actorUserId={actorUserId}
          groups={groups ?? []}
          adminUsers={adminUsers ?? []}
          selectedGroupId={selectedGroupId}
          setSelectedGroupId={setSelectedGroupId}
          groupDetails={groupDetails}
          warehouses={warehouses ?? []}
          onCreate={(input) => createGroup({ actorUserId, ...input }).then((groupId) => {
            setSelectedGroupId(groupId);
            setSuccess("Access group created.");
          }).catch(setFailure)}
          onUpdate={(input) => updateGroup({ actorUserId, ...input }).then(() => setSuccess("Access group updated.")).catch(setFailure)}
          onAddMember={(input) => addGroupMember({ actorUserId, ...input }).then(() => setSuccess("Group member added.")).catch(setFailure)}
          onRemoveMember={(memberId) => removeGroupMember({ actorUserId, memberId, reason: "Removed from admin access UI" }).then(() => setSuccess("Group member removed.")).catch(setFailure)}
          onAssignRole={(input) => assignGroupRole({ actorUserId, ...input }).then(() => setSuccess("Group role assigned.")).catch(setFailure)}
          onRevokeRole={(assignmentId) => revokeGroupRole({ actorUserId, assignmentId, reason: "Revoked from admin access UI" }).then(() => setSuccess("Group role revoked.")).catch(setFailure)}
        />
      )}

      {activeTab === "Permission Preview" && (
        <PermissionPreviewPanel
          actorUserId={actorUserId}
          adminUsers={adminUsers ?? []}
          warehouses={warehouses ?? []}
          onFailure={setFailure}
        />
      )}
    </div>
  );
}

function InvitesPanel({
  firebaseUser,
  invitations,
  warehouses,
  onCreateSuccess,
  onFailure,
  onRevoke,
  onExpire,
}: {
  firebaseUser: User;
  invitations: unknown[];
  warehouses: { _id: Id<"warehouses">; code: string; name: string }[];
  onCreateSuccess: (message: string) => void;
  onFailure: (err: unknown) => void;
  onRevoke: (invitationId: Id<"platformInvitations">) => void;
  onExpire: () => void;
}) {
  const [type, setType] = useState<PlatformInvitationType>("admin_invite");
  const [channel, setChannel] = useState<InvitationChannel>("email");
  const [target, setTarget] = useState("");
  const [roleKey, setRoleKey] = useState<AdminRoleKey>("admin_viewer");
  const [scopeType, setScopeType] = useState<AdminScopeType>("global");
  const [scopeValue, setScopeValue] = useState("");
  const [mfaRequirement, setMfaRequirement] = useState<MfaRequirement>("totp_required");
  const [isWorking, setIsWorking] = useState(false);

  const allowedChannels = useMemo<InvitationChannel[]>(() => {
    if (type === "admin_invite" || type === "warehouse_manager_invite") {
      return ["email"];
    }
    return ["email", "sms"];
  }, [type]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsWorking(true);
    try {
      if (apiBaseUrl === undefined || apiBaseUrl.trim().length === 0) {
        throw new Error("NEXT_PUBLIC_API_URL is required to send invitations through the API delivery path.");
      }
      const idToken = await getIdToken(firebaseUser);
      const body: Record<string, unknown> = {
        type,
        channel,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        mfaRequirement,
      };
      if (channel === "email") {
        body.targetEmail = target.trim();
      } else {
        body.targetPhoneNumber = target.trim();
      }
      if (type === "admin_invite" || type === "warehouse_manager_invite") {
        body.pendingAdminRoleAssignment = {
          roleKey,
          scopeType,
          ...(scopeType === "warehouse" ? { scopeId: scopeValue.trim() } : {}),
          ...(scopeType !== "global" && scopeType !== "warehouse" ? { scopeValue: scopeValue.trim() } : {}),
        };
      }
      const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/invitations`, {
        body: JSON.stringify(body),
        headers: {
          authorization: `Bearer ${idToken}`,
          "content-type": "application/json",
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      await response.json();
      setTarget("");
      onCreateSuccess(`Invitation successfully sent to ${target.trim()} via ${channel === "email" ? "email" : "SMS"}.`);
    } catch (err) {
      onFailure(err);
    } finally {
      setIsWorking(false);
    }
  }

  const rows = invitations.map((item) => item as Record<string, unknown>);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)", gap: "20px", alignItems: "start" }}>
      <form onSubmit={(event) => void submit(event)} style={{ background: gray[0], border: `1px solid ${gray[100]}`, borderRadius: "8px", display: "flex", flexDirection: "column", gap: "14px", padding: "18px" }}>
        <h2 style={{ color: gray[900], fontSize: "1rem", fontWeight: 800, margin: 0 }}>Create invitation</h2>
        <Field label="Invite type">
          <select
            value={type}
            onChange={(event) => {
              const val = event.target.value as PlatformInvitationType;
              setType(val);
              if (val === "admin_invite" || val === "warehouse_manager_invite") {
                setChannel("email");
              }
            }}
            style={inputStyle}
          >
            {inviteTypes.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
          </select>
        </Field>
        <Field label="Delivery channel">
          <select value={channel} onChange={(event) => setChannel(event.target.value as InvitationChannel)} style={inputStyle}>
            {allowedChannels.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <Field label={channel === "email" ? "Target email" : "Target phone number"}>
          <input value={target} onChange={(event) => setTarget(event.target.value)} required style={inputStyle} />
        </Field>
        {(type === "admin_invite" || type === "warehouse_manager_invite") && (
          <>
            <Field label="Initial role">
              <select value={roleKey} onChange={(event) => setRoleKey(event.target.value as AdminRoleKey)} style={inputStyle}>
                {roleKeys.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
              </select>
            </Field>
            <ScopeFields warehouses={warehouses} scopeType={scopeType} scopeValue={scopeValue} setScopeType={setScopeType} setScopeValue={setScopeValue} />
          </>
        )}
        <Field label="MFA requirement">
          <select value={mfaRequirement} onChange={(event) => setMfaRequirement(event.target.value as MfaRequirement)} style={inputStyle}>
            {mfaRequirements.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
          </select>
        </Field>
        <p style={{ color: gray[500], fontSize: "0.8125rem", lineHeight: 1.45, margin: 0 }}>
          Email invites use the API Resend provider boundary. SMS invites use the mock SMS provider until a real provider is selected.
        </p>
        <button disabled={isWorking} type="submit" style={{ ...buttonStyle, opacity: isWorking ? 0.65 : 1 }}>
          {isWorking ? "Sending..." : "Send invitation"}
        </button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onExpire} style={{ ...buttonStyle, background: gray[700] }}>Expire overdue invites</button>
        </div>
        <DataTable
          data={rows}
          columns={[
            { key: "type", header: "Type", render: (row) => formatLabel(String(row.type)) },
            { key: "target", header: "Target", render: (row) => String(row.targetEmail ?? row.targetPhoneNumber ?? "No target") },
            { key: "channel", header: "Channel" },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={String(row.status)} /> },
            { key: "expiresAt", header: "Expiry", render: (row) => formatDate(Number(row.expiresAt)) },
          ]}
          rowIdKey="_id"
          searchKey="targetEmail"
          drawerTitle={(row) => `Invite ${String(row._id)}`}
          drawerContent={(row) => (
            <RecordDetails
              row={row}
              actions={row.status === "pending" ? (
                <button onClick={() => onRevoke(row._id as Id<"platformInvitations">)} style={{ ...buttonStyle, background: status.danger }}>Revoke invite</button>
              ) : undefined}
            />
          )}
        />
      </div>
    </div>
  );
}

function UsersPanel({
  actorUserId: _actorUserId,
  adminUsers,
  selectedUser,
  setSelectedAdminUserId,
  directAssignments,
  groupMemberships,
  effectiveAccess,
  warehouses,
  onAssign,
  onRevoke,
}: {
  actorUserId: Id<"users">;
  adminUsers: AdminUserRow[];
  selectedUser: AdminUserRow | undefined;
  setSelectedAdminUserId: (id: Id<"users">) => void;
  directAssignments: unknown[];
  groupMemberships: unknown[];
  effectiveAccess: { roles: unknown[]; permissions: string[]; isPlatformOwner: boolean; generatedAt: number } | undefined;
  warehouses: { _id: Id<"warehouses">; code: string; name: string }[];
  onAssign: (input: { adminUserId: Id<"users">; roleKey: AdminRoleKey; scopeType: AdminScopeType; scopeId?: string; scopeValue?: string }) => Promise<unknown>;
  onRevoke: (assignmentId: Id<"adminRoleAssignments">) => Promise<unknown>;
}) {
  const [roleKey, setRoleKey] = useState<AdminRoleKey>("admin_viewer");
  const [scopeType, setScopeType] = useState<AdminScopeType>("global");
  const [scopeValue, setScopeValue] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (selectedUser === undefined) return;
    void onAssign({
      adminUserId: selectedUser.userId,
      roleKey,
      scopeType,
      ...(scopeType === "warehouse" ? { scopeId: scopeValue.trim() } : {}),
      ...(scopeType !== "global" && scopeType !== "warehouse" ? { scopeValue: scopeValue.trim() } : {}),
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)", gap: "20px", alignItems: "start" }}>
      <DataTable
        data={adminUsers as unknown as Record<string, unknown>[]}
        columns={[
          { key: "name", header: "Name" },
          { key: "email", header: "Email" },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={String(row.status)} /> },
          { key: "mfaStatus", header: "MFA", render: (row) => <StatusBadge status={String(row.mfaStatus)} /> },
        ]}
        rowIdKey="userId"
        searchKey="name"
        drawerTitle={(row) => String(row.name)}
        drawerContent={(row, onClose) => (
          <button
            onClick={() => {
              setSelectedAdminUserId(row.userId as Id<"users">);
              onClose();
            }}
            style={buttonStyle}
          >
            View effective access
          </button>
        )}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
        {selectedUser === undefined ? (
          <AdminAccessState variant="limited" title="No admin user selected" message="Create or accept an admin invite before assigning scoped access." />
        ) : (
          <>
            <section style={{ background: gray[0], border: `1px solid ${gray[100]}`, borderRadius: "8px", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <h2 style={{ color: gray[900], fontSize: "1rem", fontWeight: 800, margin: 0 }}>{selectedUser.name}</h2>
                <p style={{ color: gray[500], fontSize: "0.8125rem", margin: "2px 0 0" }}>{selectedUser.email ?? selectedUser.userId}</p>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <StatusBadge status={selectedUser.status} />
                <StatusBadge status={`mfa ${selectedUser.mfaStatus}`} />
                {effectiveAccess?.isPlatformOwner === true && <StatusBadge status="platform owner" />}
              </div>
              <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <Field label="Direct role">
                  <select value={roleKey} onChange={(event) => setRoleKey(event.target.value as AdminRoleKey)} style={inputStyle}>
                    {roleKeys.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
                  </select>
                </Field>
                <ScopeFields warehouses={warehouses} scopeType={scopeType} scopeValue={scopeValue} setScopeType={setScopeType} setScopeValue={setScopeValue} />
                <button type="submit" style={{ ...buttonStyle, alignSelf: "end" }}>Assign direct role</button>
              </form>
            </section>

            <RecordList title="Direct assignments" rows={directAssignments} empty="No direct assignments.">
              {(row) => (
                <AccessRow
                  row={row as Record<string, unknown>}
                  action={String((row as Record<string, unknown>).status) === "active" ? (
                    <button onClick={() => void onRevoke((row as Record<string, unknown>)._id as Id<"adminRoleAssignments">)} style={{ ...buttonStyle, background: status.danger, minHeight: "32px", padding: "6px 10px" }}>Revoke</button>
                  ) : undefined}
                />
              )}
            </RecordList>

            <RecordList title="Group memberships" rows={groupMemberships} empty="No group memberships.">
              {(row) => {
                const record = row as { group?: { name?: string }; status?: string };
                return <AccessRow row={{ group: record.group?.name ?? "Unknown group", status: record.status ?? "" }} />;
              }}
            </RecordList>

            <section style={{ background: gray[0], border: `1px solid ${gray[100]}`, borderRadius: "8px", padding: "18px" }}>
              <h3 style={{ color: gray[900], fontSize: "0.95rem", fontWeight: 800, margin: "0 0 10px" }}>Effective permissions</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {(effectiveAccess?.permissions ?? []).map((permission) => (
                  <span key={permission} style={{ background: palette.surface, border: `1px solid ${palette.line}`, borderRadius: "4px", color: palette.field, fontSize: "0.75rem", fontWeight: 700, padding: "4px 7px" }}>
                    {permission}
                  </span>
                ))}
                {(effectiveAccess?.permissions ?? []).length === 0 && <p style={{ color: gray[500], margin: 0 }}>No effective permissions.</p>}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function GroupsPanel({
  groups,
  adminUsers,
  selectedGroupId,
  setSelectedGroupId,
  groupDetails,
  warehouses,
  onCreate,
  onUpdate,
  onAddMember,
  onRemoveMember,
  onAssignRole,
  onRevokeRole,
}: {
  actorUserId: Id<"users">;
  groups: unknown[];
  adminUsers: AdminUserRow[];
  selectedGroupId: Id<"adminAccessGroups"> | undefined;
  setSelectedGroupId: (id: Id<"adminAccessGroups">) => void;
  groupDetails: { group: Record<string, unknown>; members: unknown[]; roleAssignments: unknown[] } | null | undefined;
  warehouses: { _id: Id<"warehouses">; code: string; name: string }[];
  onCreate: (input: { name: string; description?: string }) => Promise<unknown>;
  onUpdate: (input: { groupId: Id<"adminAccessGroups">; name?: string; description?: string; status?: "active" | "inactive" | "deactivated" }) => Promise<unknown>;
  onAddMember: (input: { groupId: Id<"adminAccessGroups">; adminUserId: Id<"users"> }) => Promise<unknown>;
  onRemoveMember: (memberId: Id<"adminAccessGroupMembers">) => Promise<unknown>;
  onAssignRole: (input: { groupId: Id<"adminAccessGroups">; roleKey: AdminRoleKey; scopeType: AdminScopeType; scopeId?: string; scopeValue?: string }) => Promise<unknown>;
  onRevokeRole: (assignmentId: Id<"adminAccessGroupRoleAssignments">) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [roleKey, setRoleKey] = useState<AdminRoleKey>("admin_viewer");
  const [scopeType, setScopeType] = useState<AdminScopeType>("global");
  const [scopeValue, setScopeValue] = useState("");
  const activeGroupId = selectedGroupId ?? (groups[0] as { _id?: Id<"adminAccessGroups"> } | undefined)?._id;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)", gap: "20px", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const trimmedDescription = description.trim();
            void onCreate({
              name,
              ...(trimmedDescription.length > 0 ? { description: trimmedDescription } : {}),
            }).then(() => {
              setName("");
              setDescription("");
            });
          }}
          style={{ background: gray[0], border: `1px solid ${gray[100]}`, borderRadius: "8px", display: "flex", flexDirection: "column", gap: "12px", padding: "18px" }}
        >
          <h2 style={{ color: gray[900], fontSize: "1rem", fontWeight: 800, margin: 0 }}>Create group</h2>
          <Field label="Group name"><input value={name} onChange={(event) => setName(event.target.value)} required style={inputStyle} /></Field>
          <Field label="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} style={{ ...inputStyle, minHeight: "72px" }} /></Field>
          <button type="submit" style={buttonStyle}>Create group</button>
        </form>
        <DataTable
          data={groups as Record<string, unknown>[]}
          columns={[
            { key: "name", header: "Group" },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={String(row.status)} /> },
            { key: "activeMemberCount", header: "Members", type: "numeric" },
          ]}
          rowIdKey="_id"
          searchKey="name"
          drawerTitle={(row) => String(row.name)}
          drawerContent={(row, onClose) => (
            <button
              onClick={() => {
                setSelectedGroupId(row._id as Id<"adminAccessGroups">);
                onClose();
              }}
              style={buttonStyle}
            >
              Manage group
            </button>
          )}
        />
      </div>

      {activeGroupId === undefined || groupDetails === null ? (
        <AdminAccessState variant="limited" title="No access group selected" message="Create or select a group to manage members and scoped role assignments." />
      ) : (
        <section style={{ background: gray[0], border: `1px solid ${gray[100]}`, borderRadius: "8px", display: "flex", flexDirection: "column", gap: "16px", padding: "18px", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ color: gray[900], fontSize: "1rem", fontWeight: 800, margin: 0 }}>{String(groupDetails?.group.name ?? "Selected group")}</h2>
              <p style={{ color: gray[500], fontSize: "0.8125rem", margin: "2px 0 0" }}>{String(groupDetails?.group.description ?? "No description")}</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {(["active", "inactive", "deactivated"] as const).map((nextStatus) => (
                <button key={nextStatus} onClick={() => void onUpdate({ groupId: activeGroupId, status: nextStatus })} style={{ ...buttonStyle, background: nextStatus === "deactivated" ? status.danger : gray[700], minHeight: "32px", padding: "6px 10px" }}>
                  {formatLabel(nextStatus)}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={(event) => {
            event.preventDefault();
            void onAddMember({ groupId: activeGroupId, adminUserId: memberUserId as Id<"users"> });
          }} style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) auto", gap: "10px", alignItems: "end" }}>
            <Field label="Add member">
              <select value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)} required style={inputStyle}>
                <option value="">Select admin user</option>
                {adminUsers.map((user) => <option key={user.userId} value={user.userId}>{user.name} ({user.email ?? user.userId})</option>)}
              </select>
            </Field>
            <button type="submit" style={buttonStyle}>Add member</button>
          </form>

          <RecordList title="Members" rows={groupDetails?.members ?? []} empty="No members.">
            {(row) => {
              const record = row as { _id: Id<"adminAccessGroupMembers">; status?: string; adminUser?: { name?: string; email?: string } };
              return <AccessRow row={{ member: record.adminUser?.name ?? "Unknown admin", email: record.adminUser?.email ?? "", status: record.status ?? "" }} action={<button onClick={() => void onRemoveMember(record._id)} style={{ ...buttonStyle, background: status.danger, minHeight: "32px", padding: "6px 10px" }}>Remove</button>} />;
            }}
          </RecordList>

          <form onSubmit={(event) => {
            event.preventDefault();
            void onAssignRole({
              groupId: activeGroupId,
              roleKey,
              scopeType,
              ...(scopeType === "warehouse" ? { scopeId: scopeValue.trim() } : {}),
              ...(scopeType !== "global" && scopeType !== "warehouse" ? { scopeValue: scopeValue.trim() } : {}),
            });
          }} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", alignItems: "end" }}>
            <Field label="Group role">
              <select value={roleKey} onChange={(event) => setRoleKey(event.target.value as AdminRoleKey)} style={inputStyle}>
                {roleKeys.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
              </select>
            </Field>
            <ScopeFields warehouses={warehouses} scopeType={scopeType} scopeValue={scopeValue} setScopeType={setScopeType} setScopeValue={setScopeValue} />
            <button type="submit" style={buttonStyle}>Assign group role</button>
          </form>

          <RecordList title="Group role assignments" rows={groupDetails?.roleAssignments ?? []} empty="No group role assignments.">
            {(row) => {
              const record = row as Record<string, unknown>;
              return <AccessRow row={record} action={record.status === "active" ? <button onClick={() => void onRevokeRole(record._id as Id<"adminAccessGroupRoleAssignments">)} style={{ ...buttonStyle, background: status.danger, minHeight: "32px", padding: "6px 10px" }}>Revoke</button> : undefined} />;
            }}
          </RecordList>
        </section>
      )}
    </div>
  );
}

function PermissionPreviewPanel({
  actorUserId,
  adminUsers,
  warehouses,
  onFailure,
}: {
  actorUserId: Id<"users">;
  adminUsers: AdminUserRow[];
  warehouses: { _id: Id<"warehouses">; code: string; name: string }[];
  onFailure: (err: unknown) => void;
}) {
  const [adminUserId, setAdminUserId] = useState("");
  const [permission, setPermission] = useState<AdminPermissionKey>("warehouses:read");
  const [scopeType, setScopeType] = useState<AdminScopeType>("global");
  const [scopeValue, setScopeValue] = useState("");
  const [previewArgs, setPreviewArgs] = useState<{
    adminUserId: Id<"users">;
    permission: AdminPermissionKey;
    scopeType: AdminScopeType;
    scopeId?: string;
    scopeValue?: string;
  } | undefined>();
  const result = useQuery(
    api.adminAccess.previewPermission,
    previewArgs === undefined
      ? "skip"
      : {
          actorUserId,
          ...previewArgs,
        },
  ) as { allowed: boolean; matchedGrantCount: number } | undefined;

  return (
    <section style={{ background: gray[0], border: `1px solid ${gray[100]}`, borderRadius: "8px", display: "flex", flexDirection: "column", gap: "16px", maxWidth: "860px", padding: "18px" }}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            setPreviewArgs({
              adminUserId: adminUserId as Id<"users">,
              permission,
              scopeType,
              ...(scopeType === "warehouse" ? { scopeId: scopeValue.trim() } : {}),
              ...(scopeType !== "global" && scopeType !== "warehouse" ? { scopeValue: scopeValue.trim() } : {}),
            });
          } catch (err) {
            onFailure(err);
          }
        }}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px", alignItems: "end" }}
      >
        <Field label="Admin user">
          <select value={adminUserId} onChange={(event) => setAdminUserId(event.target.value)} required style={inputStyle}>
            <option value="">Select admin user</option>
            {adminUsers.map((user) => <option key={user.userId} value={user.userId}>{user.name} ({user.email ?? user.userId})</option>)}
          </select>
        </Field>
        <Field label="Permission">
          <select value={permission} onChange={(event) => setPermission(event.target.value as AdminPermissionKey)} style={inputStyle}>
            {adminPermissionKeys.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <ScopeFields warehouses={warehouses} scopeType={scopeType} scopeValue={scopeValue} setScopeType={setScopeType} setScopeValue={setScopeValue} />
        <button type="submit" style={buttonStyle}>Preview access</button>
      </form>
      {result !== undefined && (
        <AdminAccessState
          variant={result.allowed ? "ready" : "denied"}
          title={result.allowed ? "Permission allowed" : "Permission denied"}
          message={`${result.matchedGrantCount} role grant${result.matchedGrantCount === 1 ? "" : "s"} include this permission before scope matching.`}
          detail="Preview uses the same effective direct and group assignments that Convex RBAC enforcement uses."
        />
      )}
    </section>
  );
}

function ScopeFields({
  warehouses,
  scopeType,
  scopeValue,
  setScopeType,
  setScopeValue,
}: {
  warehouses: { _id: Id<"warehouses">; code: string; name: string }[];
  scopeType: AdminScopeType;
  scopeValue: string;
  setScopeType: (scopeType: AdminScopeType) => void;
  setScopeValue: (value: string) => void;
}) {
  return (
    <>
      <Field label="Scope type">
        <select value={scopeType} onChange={(event) => {
          setScopeType(event.target.value as AdminScopeType);
          setScopeValue("");
        }} style={inputStyle}>
          {scopeTypes.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
        </select>
      </Field>
      {scopeType !== "global" && (
        <Field label={scopeType === "warehouse" ? "Warehouse scope" : "Scope value"}>
          {scopeType === "warehouse" && warehouses.length > 0 ? (
            <select value={scopeValue} onChange={(event) => setScopeValue(event.target.value)} required style={inputStyle}>
              <option value="">Select warehouse</option>
              {warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name} ({warehouse.code})</option>)}
            </select>
          ) : (
            <input value={scopeValue} onChange={(event) => setScopeValue(event.target.value)} required style={inputStyle} placeholder={scopeType === "warehouse" ? "Warehouse Convex ID" : `Enter ${formatLabel(scopeType)}`} />
          )}
        </Field>
      )}
    </>
  );
}

function AccessRow({ row, action }: { row: Record<string, unknown>; action?: ReactNode }) {
  return (
    <div style={{ border: `1px solid ${gray[100]}`, borderRadius: "6px", display: "flex", gap: "12px", justifyContent: "space-between", padding: "10px 12px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
        <strong style={{ color: gray[900], fontSize: "0.875rem" }}>{String(row.roleKey ?? row.group ?? row.member ?? "Record")}</strong>
        <span style={{ color: gray[500], fontSize: "0.75rem" }}>
          {row.scopeType === undefined ? Object.entries(row).filter(([key]) => key !== "_id").map(([key, value]) => `${key}: ${String(value)}`).join(" | ") : scopeText(row as { scopeType: string; scopeId?: string; scopeValue?: string })}
        </span>
      </div>
      <div style={{ alignItems: "center", display: "flex", gap: "8px", flexShrink: 0 }}>
        {row.status !== undefined && <StatusBadge status={String(row.status)} />}
        {action}
      </div>
    </div>
  );
}

function RecordList({
  title,
  rows,
  empty,
  children,
}: {
  title: string;
  rows: unknown[];
  empty: string;
  children: (row: unknown) => ReactNode;
}) {
  return (
    <section style={{ background: gray[0], border: `1px solid ${gray[100]}`, borderRadius: "8px", display: "flex", flexDirection: "column", gap: "10px", padding: "18px" }}>
      <h3 style={{ color: gray[900], fontSize: "0.95rem", fontWeight: 800, margin: 0 }}>{title}</h3>
      {rows.length === 0 ? <p style={{ color: gray[500], fontSize: "0.875rem", margin: 0 }}>{empty}</p> : rows.map((row, index) => <div key={index}>{children(row)}</div>)}
    </section>
  );
}

function RecordDetails({ row, actions }: { row: Record<string, unknown>; actions?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {Object.entries(row).map(([key, value]) => (
        <div key={key} style={{ borderBottom: `1px solid ${gray[100]}`, paddingBottom: "8px" }}>
          <div style={{ color: gray[500], fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase" }}>{formatLabel(key)}</div>
          <div style={{ color: gray[800], fontSize: "0.875rem", overflowWrap: "anywhere" }}>{typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "")}</div>
        </div>
      ))}
      {actions}
    </div>
  );
}
