# Warehouse Pivot Domain Reset Implementation Plan

> **For Claude / executing agent:** REQUIRED SUB-SKILL: Use executing-plans, or the closest available task-by-task implementation mode, to implement this plan task-by-task.

**Goal:** Reorient the platform from the old SMS-first farmer marketplace into a smartphone-first warehouse produce aggregation system with separate public, product, operations, admin, API, and Convex boundaries.

**Architecture:** Convex remains the system of record for product state, realtime queries, mutations, and workflow rules. The NestJS API remains the external provider and webhook boundary for SMS, uploads, payments, and other SDK-backed integrations. Frontend apps are split by audience: public site, farmer/buyer/transporter app, warehouse operations console, and admin console.

**Tech Stack:** pnpm, Turborepo, TypeScript, Next.js, Convex, NestJS with Fastify, shared packages for types, validators, permissions, UI, dashboard UI, config, utilities, and SMS templates.

---

## Execution Constraints

- Work directly on `master`; do not create a new branch or worktree unless the orchestrator explicitly changes that instruction.
- Start by reading `AGENTS.md`, `docs/decision.md`, every file listed in `AGENTS.md`, and this plan.
- The product is still very early in development. Do not preserve backward compatibility for old marketplace concepts.
- Preserve the top-level folder contract: `apps/`, `packages/`, `convex/`, `docs/`.
- Add `apps/ops/` only after documenting the architecture decision.
- Keep provider SDK logic out of frontend apps.
- Keep `apps/www` lightweight and isolated from dashboard-only packages.
- Keep farmer-facing screens low-bandwidth friendly.
- Use shared packages for reusable contracts, validators, permissions, UI, SMS templates, and domain utilities.
- Do not keep layering warehouse behavior onto old marketplace objects. The product center is now warehouse inventory, not listings and bulk lots. Prefer replacing old domain concepts cleanly over maintaining compatibility shims.
- Before finishing repo-wide setup changes, run:

```bash
corepack pnpm list --depth -1
git status --short
```

## Accepted Wave 0 Decisions

- `apps/ops` is a new warehouse operations application domain, intended for a subdomain such as `ops.<domain>`.
- `apps/admin` is for platform administration, configuration, oversight, audit, disputes, and reporting.
- `apps/app` is for farmer, buyer, and transporter self-service flows.
- `apps/www` remains public and lightweight.
- `apps/api` owns provider SDKs, webhooks, and external service adapters.
- Convex owns product state, queries, mutations, workflow rules, and audit-producing domain operations.
- The MVP uses the consignment model from `docs/decision.md`: farmers own produce while stored; the platform stores, verifies, sells, deducts configured fees, and records payout state.
- Replace the old generic `agent` domain language with `warehouse_agent`.
- Replace `produceListing` with `inventoryBatch`.
- Replace `bulkLot` as a core MVP concept with warehouse stock aggregation and explicit reservations.
- Replace `deal` with `buyerOrder` plus `saleRecord`.
- Replace `transportRequest` with `dispatch`.
- Remove two-way SMS from MVP scope. Keep one-way SMS notifications through templates and provider boundaries.
- Fees must be configurable in admin and snapshotted when applied so historical receipts and sale calculations do not silently change after rule edits.

## Target Domain Model

Implement the new core domain around these concepts:

- `User`
- `Farmer`
- `WarehouseAgent`
- `Warehouse`
- `StorageRateRule`
- `FeeRule`
- `InventoryBatch`
- `InventoryReservation`
- `StorageFeeLedger`
- `Buyer`
- `BuyerOrder`
- `BuyerOrderCharge`
- `SaleRecord`
- `SaleDeduction`
- `Dispatch`
- `Notification`
- `AuditLog`
- `Dispute`

The repo is early enough that old marketplace tables/functions should be removed from the foundation rather than kept as compatibility scaffolding.

## Dependency Gates

### Gate A: Documentation And Boundary Contract

Complete before code agents start large feature work:

- Update repo structure conventions to include `apps/ops`.
- Add an ADR for the operations app boundary and warehouse pivot.
- Document the new app responsibility map.
- Document the new domain vocabulary and fee model.

### Gate B: Shared Contracts

Complete before frontend and backend agents work independently:

- Shared role names.
- Shared statuses.
- Shared entity shapes.
- Shared validation schemas.
- Shared permission keys.
- Fee rule and fee application contracts.

### Gate C: Data And Workflow Foundation

Complete before real UI integration:

- Convex schema for warehouses, agents, inventory, fees, orders, sales, dispatches, notifications, audit logs, and disputes.
- Workflow helpers for verified actor loading, permissions, audit logs, fee snapshots, status transitions, and reservation safety.

### Gate D: Integration

Complete flow-by-flow:

- Ops intake creates inventory and receipt.
- Farmer app reads produce, receipt, storage fee, sale, and payment status.
- Buyer app browses available warehouse inventory and places orders.
- Reservations prevent overselling.
- Sales calculate gross, deductions, and net farmer amount.
- Dispatch records move orders through fulfillment.
- Admin can configure fees and supervise the system.

---

## Task 1: Architecture Documentation And Repo Boundary

**Files:**
- Modify: `docs/conventions/repo-structure.md`
- Modify: `docs/decisions/ADR-0001-monorepo-and-app-boundaries.md`
- Create: `docs/decisions/ADR-0002-operations-app-and-warehouse-domain.md`
- Create or modify: `docs/architecture/README.md`

**Steps:**

1. Add `apps/ops/` to the approved app folders.
2. Document that `apps/ops` owns warehouse-agent and local operations workflows.
3. Document that `apps/admin` owns platform configuration, oversight, disputes, reporting, and audit.
4. Document that `apps/app` owns farmer, buyer, and transporter self-service.
5. Record the warehouse pivot and domain reset in ADR-0002.
6. State that Convex is the product system of record and NestJS API is the provider/webhook boundary.
7. State that one-way SMS remains in MVP and two-way SMS is out of MVP scope.

**Acceptance Criteria:**

- A new engineer can read the docs and understand why `apps/ops` exists.
- The app boundary decision no longer conflicts with the repo structure convention.
- The old marketplace direction is clearly superseded by `docs/decision.md`.

**Verification:**

```bash
git diff -- docs/conventions/repo-structure.md docs/decisions docs/architecture/README.md
```

---

## Task 2: Shared Domain Types

**Files:**
- Modify: `packages/types/src/index.ts`
- Modify: `packages/types/README.md`
- Test or verify: `packages/types/tsconfig.json`

**Steps:**

1. Replace primary role contracts with:

```ts
export const marketplaceRoles = [
  "farmer",
  "warehouse_agent",
  "buyer",
  "transporter",
  "admin",
] as const;
```

2. Add new status arrays and types for:
   - warehouse status
   - warehouse agent status
   - farmer verification/status
   - inventory batch status
   - inventory reservation status
   - storage fee ledger status
   - buyer verification/status
   - buyer order status
   - buyer order payment status
   - sale payment status
   - dispatch status
   - fee rule status
   - fee calculation type
   - fee payer
   - notification status
   - dispute status

3. Add shared shapes for:
   - `Warehouse`
   - `WarehouseAgent`
   - `Farmer`
   - `StorageRateRule`
   - `FeeRule`
   - `FeeRuleSnapshot`
   - `InventoryBatch`
   - `InventoryReservation`
   - `StorageFeeLedger`
   - `Buyer`
   - `BuyerOrder`
   - `BuyerOrderCharge`
   - `SaleRecord`
   - `SaleDeduction`
   - `Dispatch`
   - `Notification`
   - `AuditLogInput`

4. Do not keep compatibility exports for old listing, bulk-lot, or deal contracts.
5. Update summary/count types from listing/bulk/deal language to warehouse/inventory/order/sale/dispatch language.

**Acceptance Criteria:**

- Shared types express the new warehouse domain without requiring old listing/bulk/deal concepts.
- Fee configuration and fee application snapshots are represented.
- Type exports are stable enough for Convex, API, and frontends to build against.

**Verification:**

```bash
corepack pnpm --filter @kuapa-dwaso/types typecheck
```

---

## Task 3: Shared Validators

**Files:**
- Modify: `packages/validators/src/index.ts`
- Modify: `packages/validators/README.md`

**Steps:**

1. Add validators for warehouse creation/update input.
2. Add validators for warehouse agent creation/assignment/status updates.
3. Add validators for farmer registration and agent-assisted onboarding.
4. Add validators for produce intake and inventory batch updates.
5. Add validators for fee rules, storage rate rules, fee adjustments, and waivers.
6. Add validators for buyer profile, buyer order, reservation, sale record, and dispatch input.
7. Prefer shared enums from `@kuapa-dwaso/types` where package boundaries allow it.
8. Keep validation strict and user-facing errors clear.

**Acceptance Criteria:**

- Every mutation/API workflow planned below has a shared validator or a clearly local Convex validator.
- Fee rules cannot be configured with ambiguous payer/calculation combinations.
- Quantity, price, and fee inputs reject invalid negative or zero values where appropriate.

**Verification:**

```bash
corepack pnpm --filter @kuapa-dwaso/validators typecheck
```

---

## Task 4: Permissions And Status Transitions

**Files:**
- Modify: `packages/permissions/src/index.ts`
- Modify or create tests: `packages/permissions/src/*.test.ts`
- Modify: `packages/permissions/README.md`

**Steps:**

1. Replace old permission keys around listings, bulk lots, offers, and deals with warehouse-domain keys:

```ts
"warehouses:create"
"warehouses:update"
"warehouses:configureFees"
"warehouseAgents:manage"
"farmers:create"
"farmers:verify"
"inventory:create"
"inventory:update"
"inventory:updateStatus"
"inventory:adjustQuantity"
"fees:configure"
"fees:applyAdjustment"
"orders:create"
"orders:reserveInventory"
"orders:updateStatus"
"sales:create"
"sales:updatePaymentStatus"
"dispatches:create"
"dispatches:updateStatus"
"notifications:send"
"auditLogs:view"
"disputes:create"
"disputes:manage"
"users:updateStatus"
```

2. Define role permissions:
   - farmer: view own inventory, receipts, fees, sales, payments, dispatch status, create disputes.
   - warehouse_agent: create farmers, create intake records, update assigned warehouse inventory, prepare dispatches, escalate disputes.
   - buyer: manage buyer profile, create orders, view own orders/dispatches, create disputes.
   - transporter: view and update assigned dispatches where applicable.
   - admin: all platform configuration and oversight permissions.

3. Add allowed transition maps for:
   - inventory batch statuses
   - inventory reservation statuses
   - buyer order statuses
   - sale payment statuses
   - dispatch statuses

4. Add utility functions for:
   - `canCreateInventoryBatch`
   - `canUpdateInventoryBatchStatus`
   - `canConfigureFees`
   - `canReserveInventory`
   - `canCreateSaleRecord`
   - `canCreateDispatch`
   - `canTransitionInventoryBatchStatus`
   - `canTransitionBuyerOrderStatus`
   - `canTransitionDispatchStatus`

**Acceptance Criteria:**

- Old generic `agent` permission logic is replaced by `warehouse_agent`.
- Sensitive actions require admin or appropriate warehouse assignment.
- Tests pin allowed and rejected transitions.

**Verification:**

```bash
corepack pnpm --filter @kuapa-dwaso/permissions typecheck
corepack pnpm --filter @kuapa-dwaso/permissions test
```

---

## Task 5: Create The Operations App

**Files:**
- Create: `apps/ops/package.json`
- Create: `apps/ops/README.md`
- Create: `apps/ops/tsconfig.json`
- Create: `apps/ops/eslint.config.mjs`
- Create: `apps/ops/next.config.ts`
- Create: `apps/ops/next-env.d.ts`
- Create: `apps/ops/.env.example`
- Create: `apps/ops/app/layout.tsx`
- Create: `apps/ops/app/page.tsx`
- Create: `apps/ops/app/globals.css`
- Create: `apps/ops/app/ConvexClientProvider.tsx`
- Modify if needed: `turbo.json`
- Modify if needed: root `package.json`

**Steps:**

1. Model `apps/ops` after `apps/admin` and `apps/app`.
2. Use `@kuapa-dwaso/dashboard-ui` for operational surfaces.
3. Use `@kuapa-dwaso/ui` for shared lightweight primitives.
4. Add README explaining that this app is for warehouse-agent operations and intended for `ops.<domain>`.
5. Do not implement full UI flows yet unless shared contracts are complete.

**Acceptance Criteria:**

- `apps/ops` typechecks and lints as part of the workspace.
- It can connect to Convex the same way `apps/app` and `apps/admin` do.
- It does not import admin-only route code.

**Verification:**

```bash
corepack pnpm --filter @kuapa-dwaso/ops typecheck
corepack pnpm --filter @kuapa-dwaso/ops lint
```

---

## Task 6: Convex Schema Reset

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/README.md`

**Steps:**

1. Add or replace schema tables for:
   - `users`
   - `farmers`
   - `warehouseAgents`
   - `warehouses`
   - `storageRateRules`
   - `feeRules`
   - `inventoryBatches`
   - `inventoryReservations`
   - `storageFeeLedger`
   - `buyers`
   - `buyerOrders`
   - `buyerOrderCharges`
   - `saleRecords`
   - `saleDeductions`
   - `dispatches`
   - `notifications`
   - `auditLogs`
   - `disputes`
   - `appSettings`

2. Add indexes for expected query paths:
   - user lookup by auth provider, phone, email, role/status
   - farmer by phone, warehouse, verification status
   - warehouse agent by user, warehouse, status
   - warehouse by code, status, community/district/region
   - inventory by warehouse/status/crop/grade/farmer/receipt/sell-by date
   - reservations by order, batch, status, expiry
   - fee rules by active scope and effective date
   - storage fee ledger by batch/farmer/warehouse/status/date
   - buyer orders by buyer/status/payment status/destination
   - sales by order/batch/farmer/warehouse/payment status
   - dispatches by warehouse/status/destination/transporter
   - audit logs by actor/entity/action/createdAt

3. Use role/status values consistent with `packages/types`.
4. Remove old listing, bulk-lot, deal, transport-request, and approval-request tables from the foundation.

**Acceptance Criteria:**

- Convex schema represents warehouse inventory as the primary product model.
- Tables and indexes support the planned workflows without ad hoc scans for common views.
- The generated Convex model updates successfully.

**Verification:**

```bash
corepack pnpm convex:dev:once
```

---

## Task 7: Convex Shared Workflow Helpers

**Files:**
- Modify: `convex/workflowHelpers.ts`
- Modify or create: `convex/auditLogs.ts`
- Modify or create: `convex/observabilityAccess.ts`

**Steps:**

1. Add helper to resolve and verify actor from `actorUserId`.
2. Add helper to require role and permission.
3. Add helper to ensure a warehouse agent is assigned to a warehouse before allowing operational mutations.
4. Add helper to insert audit logs for every sensitive action.
5. Add helper to snapshot applied fee rules.
6. Add helper to reject invalid status transitions.
7. Add helper to calculate available inventory quantity from batch quantity minus active reservations and sold quantity.

**Acceptance Criteria:**

- Domain modules do not duplicate actor, permission, and audit logic.
- Warehouse assignment checks are centralized.
- Fee snapshots are created consistently.

**Verification:**

```bash
corepack pnpm convex:dev:once
```

---

## Task 8: Warehouse, Agent, And Farmer Workflows

**Files:**
- Create or modify: `convex/warehouses.ts`
- Create or modify: `convex/warehouseAgents.ts`
- Modify: `convex/farmers.ts`
- Modify: `convex/users.ts`

**Steps:**

1. Implement admin warehouse create/update/status functions.
2. Implement warehouse agent create/approve/suspend/assign functions.
3. Update farmer registration to support:
   - `self_app`
   - `agent_assisted`
   - `admin`
   - preferred warehouse
   - household phone owner name
4. Implement queries for:
   - warehouses by status/location/crop support
   - agents by warehouse/status
   - farmers by warehouse/phone/verification status
5. Audit all sensitive changes.

**Acceptance Criteria:**

- Admin can configure warehouses and assign warehouse agents.
- Warehouse agents can register farmers only within their allowed scope.
- Farmer model matches `docs/decision.md`.

**Verification:**

```bash
corepack pnpm convex:dev:once
```

---

## Task 9: Fee Configuration And Storage Fee Ledger

**Files:**
- Create: `convex/feeRules.ts`
- Create: `convex/storageFees.ts`
- Modify: `packages/utils/src/index.ts`
- Create or modify tests: `packages/utils/test/*.test.mjs`

**Steps:**

1. Implement admin-managed `FeeRule` creation, versioning, activation, deactivation, and listing.
2. Support fee rule scopes:
   - warehouse
   - crop type
   - unit
   - grade
   - destination market where relevant
3. Support calculation types:
   - fixed amount
   - per unit
   - per unit per day
   - percentage of gross sale
   - percentage of transport cost
4. Support payers:
   - farmer
   - buyer
   - platform
   - shared
   - included in price
5. Implement storage fee accrual into `StorageFeeLedger`.
6. Implement fee adjustments and waivers with audit logs.
7. Implement utility functions for fee calculations and rounding.
8. Snapshot applied fee rule details into ledger/charge/deduction records.

**Acceptance Criteria:**

- Admin can configure fees without changing code.
- Historical applied fees do not change when an admin changes a rule.
- Farmer-facing storage fee and sale deduction breakdowns are explainable.
- Buyer-facing order charges are separate from farmer deductions.

**Verification:**

```bash
corepack pnpm --filter @kuapa-dwaso/utils typecheck
corepack pnpm --filter @kuapa-dwaso/utils test
corepack pnpm convex:dev:once
```

---

## Task 10: Inventory Intake And Receipts

**Files:**
- Create: `convex/inventoryBatches.ts`
- Create if useful: `convex/storageReceipts.ts`
- Modify: `convex/notifications.ts`
- Modify: `packages/sms-templates/README.md`

**Steps:**

1. Implement produce intake mutation for assigned warehouse agents.
2. Intake input should include:
   - farmer
   - warehouse
   - crop type
   - variety
   - quantity received
   - unit
   - grade
   - photos or photo metadata
   - storage rate or applied storage rule
   - asking or target price
   - minimum acceptable price where allowed
   - expected shelf life/sell-by date
   - condition notes
3. Generate stable `receiptCode`.
4. Create receipt data from the inventory batch. Use a separate receipt table only if the receipt needs independent lifecycle; otherwise derive it from `InventoryBatch`.
5. Create notification records for receipt confirmation.
6. Add queries for farmer receipts, warehouse inventory, and batch details.
7. Audit intake, quantity changes, grade changes, price changes, condition updates, spoilage, withdrawal, and disputes.

**Acceptance Criteria:**

- Warehouse agent can receive produce and create a trusted inventory batch.
- Farmer can later see the receipt and all key details.
- Receipt code is stable and human-readable.
- Sensitive changes are auditable.

**Verification:**

```bash
corepack pnpm convex:dev:once
```

---

## Task 11: Buyer Orders And Inventory Reservations

**Files:**
- Create: `convex/buyerOrders.ts`
- Create: `convex/inventoryReservations.ts`
- Modify: `convex/buyers.ts`

**Steps:**

1. Implement buyer profile create/update with the new buyer shape.
2. Implement query for buyer-visible available warehouse inventory grouped by crop, warehouse, grade, and unit.
3. Implement buyer order creation.
4. Implement reservation creation as an explicit record linked to buyer order and inventory batch.
5. Support partial reservation across one or more batches where appropriate.
6. Prevent overselling by calculating available quantity from batch quantity, sold quantity, and active reservations.
7. Implement reservation expiry/cancellation paths.
8. Add buyer order charge calculation using fee rule snapshots.
9. Audit order and reservation changes.

**Acceptance Criteria:**

- Buyer orders reserve real warehouse stock.
- Reservation records make partial fulfillment and cancellation clear.
- Available inventory cannot go below zero under normal mutation flow.
- Buyer charges are separated from farmer deductions.

**Verification:**

```bash
corepack pnpm convex:dev:once
```

---

## Task 12: Sales, Deductions, And Payment Status

**Files:**
- Create: `convex/saleRecords.ts`
- Modify: `convex/buyerOrders.ts`
- Modify: `convex/storageFees.ts`
- Modify: `convex/notifications.ts`

**Steps:**

1. Implement sale record creation from confirmed/reserved buyer orders.
2. Calculate:
   - gross amount
   - storage fee deducted
   - handling fee deducted
   - commission deducted
   - transport fee deducted if applicable
   - adjustments/waivers
   - net amount due to farmer
3. Create `SaleDeduction` records with fee snapshots.
4. Update inventory batch quantity/status after sale.
5. Update storage fee ledger entries as deducted from sale where applicable.
6. Track sale payment status separately from order status.
7. Create farmer notification records for sold produce and net amount.
8. Audit sale creation, deduction changes, and payment status changes.

**Acceptance Criteria:**

- Farmer payout calculation is transparent and reproducible.
- Sale and payment state are separate.
- Partial sales update batch availability correctly.

**Verification:**

```bash
corepack pnpm convex:dev:once
```

---

## Task 13: Dispatch And Transport

**Files:**
- Create: `convex/dispatches.ts`
- Modify or create: `convex/transporters.ts`
- Modify: `convex/notifications.ts`

**Steps:**

1. Implement warehouse-to-destination dispatch records.
2. Link dispatches to buyer orders and inventory batches.
3. Support optional transporter assignment.
4. Track driver name, phone, vehicle type, capacity, departure, arrival, transport cost, payer, and status.
5. Implement allowed dispatch status transitions.
6. Create notification records for relevant dispatch changes.
7. Keep farmer-to-warehouse transport out of MVP system flow except optional notes.

**Acceptance Criteria:**

- Dispatch models warehouse-to-buyer/destination movement.
- Warehouse agents can prepare dispatches for assigned warehouses.
- Admin can supervise dispatches.
- Transporters can see/update only assigned dispatches if transporter UI is implemented.

**Verification:**

```bash
corepack pnpm convex:dev:once
```

---

## Task 14: API Provider Boundaries

**Files:**
- Modify or create under: `apps/api/src/modules/`
- Modify or create under: `apps/api/src/workflows/`
- Modify or create under: `apps/api/src/providers/`
- Modify or create under: `apps/api/src/config/`
- Modify: `apps/api/README.md`
- Modify: `.env.example`

**Steps:**

1. Keep product state in Convex; do not duplicate workflow state in API-local models.
2. Add provider interfaces and mock providers for:
   - one-way SMS sending
   - photo/upload signing or metadata validation
   - Paystack test-mode payments where needed
   - webhooks
3. Add thin controllers that call workflow/provider services.
4. Ensure provider SDKs never enter frontend apps or shared browser-heavy packages.
5. Add recoverable error states and local mockability.
6. Document required environment variables.

**Acceptance Criteria:**

- Frontends do not import provider SDKs.
- SMS, uploads, and payments can be mocked locally.
- API responsibilities align with `docs/conventions/backend-structure.md`.

**Verification:**

```bash
corepack pnpm --filter @kuapa-dwaso/api typecheck
corepack pnpm --filter @kuapa-dwaso/api test
```

---

## Task 15: Shared UI And Dashboard UI Foundation

**Files:**
- Modify: `packages/ui/src/index.tsx`
- Modify: `packages/dashboard-ui/src/index.tsx`
- Modify README files in both packages

**Steps:**

1. Add lightweight shared UI primitives only when reused across apps.
2. Add operational dashboard components for:
   - status badges
   - metric summaries
   - dense tables
   - form sections
   - receipt panels
   - fee breakdowns
   - audit activity rows
3. Keep dashboard-only components out of `apps/www`.
4. Keep mobile and low-bandwidth behavior in mind for farmer-facing UI.

**Acceptance Criteria:**

- Frontend apps do not create long-lived duplicate buttons, badges, tables, or fee breakdown components.
- `apps/www` remains free of dashboard UI imports.

**Verification:**

```bash
corepack pnpm --filter @kuapa-dwaso/ui typecheck
corepack pnpm --filter @kuapa-dwaso/dashboard-ui typecheck
```

---

## Task 16: Operations App Workflows

**Files:**
- Modify or create under: `apps/ops/app/`

**Steps:**

1. Build warehouse-agent home/dashboard.
2. Build farmer lookup and agent-assisted farmer registration.
3. Build produce intake form with draft-friendly structure.
4. Build inventory batch detail page.
5. Build receipt view/share/print-friendly page.
6. Build inventory update/status flows for assigned warehouses.
7. Build dispatch preparation view.
8. Show recoverable loading/error states.
9. Integrate with Convex after backend workflows are available.

**Acceptance Criteria:**

- Warehouse agents can perform the physical/digital core workflow from intake through dispatch prep.
- Agents cannot operate on unassigned warehouses.
- UI is operationally dense, mobile-tolerant, and low-bandwidth aware.

**Verification:**

```bash
corepack pnpm --filter @kuapa-dwaso/ops typecheck
corepack pnpm --filter @kuapa-dwaso/ops lint
```

---

## Task 17: Farmer, Buyer, And Transporter App Workflows

**Files:**
- Modify or create under: `apps/app/app/`

**Steps:**

1. Farmer screens:
   - My Produce
   - My Receipts
   - Storage Fees
   - Sales
   - Payments
   - Warehouse Contact
   - Report Issue
2. Buyer screens:
   - buyer registration/profile
   - warehouse inventory browsing
   - order placement
   - order status
   - dispatch status
3. Transporter screens where needed:
   - assigned dispatches
   - dispatch status updates
4. Keep farmer screens simple, mobile-first, and low-image.
5. Use shared types and Convex queries/mutations.

**Acceptance Criteria:**

- Farmers can understand produce status, fees, sale deductions, and net amount due.
- Buyers can order from verified warehouse inventory.
- Transporters can participate without admin access where applicable.

**Verification:**

```bash
corepack pnpm --filter @kuapa-dwaso/app typecheck
corepack pnpm --filter @kuapa-dwaso/app lint
```

---

## Task 18: Admin Configuration And Reporting

**Files:**
- Modify or create under: `apps/admin/app/`
- Modify or create: `convex/admin.ts`
- Modify or create: `convex/hotspots.ts`

**Steps:**

1. Build warehouse setup/configuration screens.
2. Build warehouse agent approval/assignment screens.
3. Build fee rule configuration screens.
4. Build inventory, order, sale, dispatch, storage fee, dispute, and audit views.
5. Build dashboard summaries:
   - total farmers
   - warehouses
   - agents
   - inventory by warehouse/crop/status
   - fees accrued
   - sales
   - dispatches
   - disputes
6. Update old hotspot intelligence to warehouse and route-cost intelligence.

**Acceptance Criteria:**

- Admin can configure operational rules without code changes.
- Admin can supervise the full warehouse network.
- Old listing/bulk/deal dashboard language is gone from primary UI.

**Verification:**

```bash
corepack pnpm --filter @kuapa-dwaso/admin typecheck
corepack pnpm --filter @kuapa-dwaso/admin lint
```

---

## Task 19: Notifications And One-Way SMS

**Files:**
- Modify or create: `convex/notifications.ts`
- Modify: `packages/sms-templates/README.md`
- Modify or create under: `apps/api/src/modules/notifications/`
- Modify or create under: `apps/api/src/providers/`

**Steps:**

1. Define notification events for:
   - produce received
   - receipt generated
   - produce available
   - produce reserved
   - produce sold
   - produce dispatched
   - payment recorded
   - storage fee reminder
   - nearing expiry
   - quality status changed
   - issue raised
2. Keep SMS one-way only.
3. Use app links where practical.
4. Store notification records in Convex.
5. Send via API provider boundary.
6. Make SMS mockable locally.

**Acceptance Criteria:**

- No two-way SMS parser or approval flow is required for MVP.
- Important farmer updates can be recorded and sent.
- Failure to send SMS does not corrupt product workflow state.

**Verification:**

```bash
corepack pnpm --filter @kuapa-dwaso/api typecheck
corepack pnpm convex:dev:once
```

---

## Task 20: End-To-End Smoke Flow

**Files:**
- Create or modify smoke/test files where the repo pattern supports them.
- Update: `docs/plans/2026-07-05-warehouse-pivot-domain-reset.md` if implementation notes are needed.

**Steps:**

1. Seed or create:
   - admin
   - warehouse
   - warehouse agent
   - farmer
   - buyer
   - fee rules
2. Run the core story:
   - farmer is registered
   - warehouse agent receives 10 crates of tomatoes
   - receipt is generated
   - storage fee accrues
   - buyer orders 5 crates
   - inventory is reserved
   - sale is created
   - deductions are calculated
   - dispatch is created
   - farmer notification is recorded
   - admin summary shows the activity
3. Verify inventory math:
   - 10 received
   - 5 reserved/sold
   - 5 available or remaining depending on sale status
4. Verify fee math:
   - gross amount
   - storage fee
   - commission
   - handling/transport where configured
   - net farmer amount

**Acceptance Criteria:**

- The product proves the new MVP story from `docs/decision.md`.
- Fee and inventory math are reproducible.
- Audit logs exist for sensitive actions.

**Verification:**

```bash
corepack pnpm convex:dev:once
corepack pnpm typecheck
corepack pnpm lint
```

---

## Task 21: Final Cleanup And Verification

**Files:**
- Update docs and README files touched by the implementation.
- Remove old marketplace docs/code from active foundation surfaces.

**Steps:**

1. Search for stale terms:

```bash
rg "bulkLot|bulk lot|produceListing|produce listing|deal|agent" docs apps packages convex
```

2. Keep `agent` only where it is part of `warehouse_agent`, explanatory migration notes, or unrelated tooling language.
3. Update README product summary away from the old farmer-to-buyer SMS marketplace.
4. Run the final verification set.

**Final Verification:**

```bash
corepack pnpm list --depth -1
corepack pnpm --filter @kuapa-dwaso/types typecheck
corepack pnpm --filter @kuapa-dwaso/validators typecheck
corepack pnpm --filter @kuapa-dwaso/permissions typecheck
corepack pnpm --filter @kuapa-dwaso/permissions test
corepack pnpm --filter @kuapa-dwaso/utils typecheck
corepack pnpm --filter @kuapa-dwaso/utils test
corepack pnpm --filter @kuapa-dwaso/api typecheck
corepack pnpm convex:dev:once
corepack pnpm typecheck
corepack pnpm lint
git status --short
```

**Acceptance Criteria:**

- The repo is aligned with the warehouse-based product direction.
- `apps/ops` is documented and functional.
- Shared contracts, Convex workflows, API boundaries, and frontend apps agree on the same domain.
- Configurable fees are admin-managed, snapshotted when applied, and visible to farmers/buyers in the correct form.
- The implementation can demonstrate the full farmer deposit to buyer order to sale to dispatch to farmer update flow.
