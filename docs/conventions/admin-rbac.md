# Admin RBAC and Scoped Access

Admin access is layered under the top-level `admin` marketplace role.

The `users.role = "admin"` value identifies the admin app audience. It does not
grant product access by itself. Admin users receive effective permissions from
direct role assignments and active access-group memberships.

## Role Keys

Supported admin roles are:

- `platform_owner`
- `operations_manager`
- `warehouse_manager`
- `finance_manager`
- `support_officer`
- `auditor`
- `analyst`
- `admin_viewer`

Role-to-permission mappings are centralized in `packages/permissions`.

## Scopes

Admin role assignments may be scoped to:

- `global`
- `region`
- `district`
- `warehouse`
- `destination_market`
- `pilot_programme`

Backend checks must evaluate both permission and scope. If a query or mutation
cannot safely evaluate a scope, it must fail closed or require a global grant.

## Assignment Sources

Effective admin access combines:

- Active direct assignments from `adminRoleAssignments`
- Active group role assignments through active `adminAccessGroupMembers`

Expired or revoked assignments are ignored. Inactive or deactivated groups do
not contribute permissions.

## Enforcement

Convex is the product system of record for admin RBAC. Admin-facing mutations
and queries must use the reusable admin access helpers in `convex/workflowHelpers.ts`.

Warehouse-agent operational checks remain separate from admin RBAC. A warehouse
agent can still operate only assigned warehouses through the existing warehouse
agent checks.

Pilot operations access is also separate from both admin RBAC and warehouse
assignment. A non-admin operations user needs an active `pilotAssignments` row
for the programme and the capability required by the action. Admin pilot access
requires the named permission and a matching global or `pilot_programme` scope.
An existing marketplace role or warehouse grant never implies pilot access.

The pilot permissions are `pilotProgrammes:read`, `pilotProgrammes:manage`,
`pilotAssignments:read`, `pilotAssignments:manage`, `pilotRequests:read`,
`pilotRequests:manage`, `pilotSupply:read`, `pilotSupply:manage`,
`pilotQuality:read`, `pilotQuality:manage`, `pilotFulfilment:read`,
`pilotFulfilment:manage`, `pilotFinance:read`, `pilotFinance:manage`,
`pilotIssues:read`, and `pilotIssues:manage`. Role mappings remain centralized
in `packages/permissions`.

`warehouse_manager` remains an administrative role, not a marketplace role. It
uses `apps/admin` for warehouse-scoped oversight of agents, inventory, buyer
orders, market schedules, dated runs, dispatches, reports, notifications, and
auditable actions. `apps/ops` remains the focused warehouse-agent execution
surface; whole interfaces are not duplicated there for managers. Every manager
query filters inaccessible records and every mutation evaluates the assigned
warehouse target. A warehouse grant never matches another warehouse or an
unrelated global record.

Admin access changes are audited through `auditLogs`.

## Bootstrap

Development and smoke environments can create the first platform owner through
the guarded `adminAccess.bootstrapFirstPlatformOwner` mutation. It only works
when no active global platform owner exists and writes an audit log. After that,
platform owners must manage access through the normal admin access mutations.
