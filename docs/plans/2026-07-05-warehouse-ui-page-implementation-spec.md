# Warehouse UI Page Implementation Spec

Date: 2026-07-05

Scope: Lanes B and C planning only. This document maps frontend routes and page behavior for `apps/ops`, `apps/app`, and `apps/admin` after the warehouse backend lanes land. It does not change app code, package code, Convex code, API code, or schema.

## Source Context

- Product source of truth: `docs/decision.md`
- Repo boundary rules: `docs/conventions/repo-structure.md`
- UI package boundaries: `docs/conventions/ui-system.md`
- Backend conventions: `docs/conventions/backend-structure.md`
- Network rules: `docs/conventions/network-performance.md`
- App boundary ADR: `docs/decisions/ADR-0001-monorepo-and-app-boundaries.md`

Current frontend state:

- `apps/www` exists and has the public landing page.
- `apps/app` exists as a lightweight signed-in product app shell.
- `apps/admin` exists as a lightweight admin app shell and imports `packages/dashboard-ui`.
- `apps/ops` is documented as an approved app boundary, but the folder does not exist in the current checkout.

Current shared/domain state:

- Shared role and status types live in `packages/types/src/index.ts`.
- Shared permission helpers and status transition rules live in `packages/permissions/src/index.ts`.
- Convex currently has warehouse, farmer, warehouse agent, inventory intake, storage fee, buyer profile, dispute, audit, admin summary, notification, and warehouse intelligence functions.
- Buyer order and inventory reservation tables/types exist in schema/types. Lane A may still be landing the order and reservation workflow APIs.
- Sale record and dispatch tables/types exist in schema/types, but complete UI workflow APIs should be treated as later-slice assumptions unless present when Kevin builds.

## 1. App Domain Map

### `apps/www`

Purpose: public marketing, pilot education, and lightweight lead capture.

Responsibilities:

- Explain the warehouse-based storage, inventory, sales, and dispatch model.
- Route public audiences to farmer, buyer, warehouse, contact, and pilot interest pages.
- Stay low-bandwidth and public-safe.

Boundaries:

- May import `packages/ui`, `packages/design-tokens`, `packages/types`, and simple shared utilities.
- Must not import `packages/dashboard-ui`, admin-only code, provider SDK logic, or heavy dashboard dependencies.

### `apps/app`

Purpose: signed-in self-service app for farmers, buyers, and transporters.

Responsibilities:

- Farmer: receipts, produce status, storage fees, sale/payment status, warehouse contact, issue reporting.
- Buyer: onboarding/profile, inventory browsing, order creation, order/reservation status, later dispatch visibility.
- Transporter: assigned dispatch list and status placeholders for MVP.

Boundaries:

- Should stay mobile-first and light.
- May import `packages/ui`, shared domain types, validators, permissions, and low-weight utilities.
- Should avoid importing `packages/dashboard-ui` unless the team explicitly decides self-service dashboards need dense admin components. Current convention points heavier dashboards to ops/admin instead.
- Must not expose private farmer information to buyers.

### `apps/ops`

Purpose: warehouse-agent operations console. This app boundary is approved by documentation, but the folder is not present yet.

Responsibilities:

- Daily warehouse operation workflows: farmer lookup, agent-assisted registration, produce intake, receipt lookup, inventory management, condition/status updates, fee previews, dispatch preparation placeholders, and issue escalation.
- Enforce warehouse-agent assignment to warehouses in all data access.
- Optimize for slow networks and field use, including draft intake forms and retryable operations.

Likely initial files when the app is created:

- `apps/ops/app/page.tsx`
- `apps/ops/app/farmers/page.tsx`
- `apps/ops/app/farmers/new/page.tsx`
- `apps/ops/app/intake/new/page.tsx`
- `apps/ops/app/receipts/[receiptCode]/page.tsx`
- `apps/ops/app/inventory/page.tsx`
- `apps/ops/app/inventory/[batchId]/page.tsx`
- `apps/ops/app/inventory/[batchId]/status/page.tsx`
- `apps/ops/app/fees/page.tsx`
- `apps/ops/app/dispatch/page.tsx`
- `apps/ops/app/disputes/new/page.tsx`

Boundaries:

- May import `packages/dashboard-ui` for dense tables, filter bars, page shells, status timelines, and operational forms.
- May import `packages/ui` for primitives.
- Must not become a generic admin console. Warehouse configuration, agent approval, fee-rule management, audit-wide reporting, and platform oversight belong in `apps/admin`.

### `apps/admin`

Purpose: platform administration, configuration, oversight, and reporting.

Responsibilities:

- Warehouse setup and status.
- Warehouse-agent creation, approval, assignment, suspension.
- Farmer and buyer oversight.
- Fee rule configuration.
- Inventory, orders, reservations, sales, payments, dispatch, disputes, audit logs, and reporting views.

Boundaries:

- May import `packages/dashboard-ui`.
- Should remain separate from `apps/www` and `apps/app` to protect public and self-service bundle size.

### Shared UI Boundary

Use `packages/ui` for cross-app, low-weight components:

- Buttons, inputs, selects, text areas, field labels.
- Status badge primitives.
- Empty state.
- Mobile list item.
- Receipt panel that is also farmer-visible.
- Fee breakdown display.
- Quantity summary.
- Action confirmation dialog if it remains dependency-light.

Use `packages/dashboard-ui` for heavier ops/admin components:

- App shell/sidebar/top bar for dashboards.
- Dense data table.
- Filter bar.
- Data toolbar with export/lazy columns.
- Audit trail.
- Status timeline.
- Admin metrics grid.
- Bulk action panels.
- Complex drawer/modal layouts.

## 2. `apps/ops` Warehouse-Agent Page Plan

### Operations Home

Route: `/`  
Likely file: `apps/ops/app/page.tsx`

Purpose: daily command center for an assigned warehouse agent.

Primary users: warehouse agents.

Required data:

- Current user and warehouse-agent profile.
- Assigned warehouses.
- Today or recent intake count.
- Open inventory needing attention: `received`, `verified`, `expired`, `spoiled`, `disputed`.
- Recent receipts.
- Open disputes for assigned warehouse.
- Later: dispatches in `planned`, `loading`, `issue_reported`.

Likely data sources:

- `warehouseAgents.getByUser`
- `warehouses.list` or targeted warehouse lookup for assigned IDs
- `inventoryBatches.listWarehouseInventory`
- `disputes.list` currently admin-only, so ops needs either a scoped agent query later or an admin-only escalation list should stay out of ops.

Actions:

- Start produce intake.
- Search farmer by phone.
- Search receipt code.
- Open inventory list.
- Report issue.

States:

- Loading: compact skeleton summary cards and list rows.
- Empty: "No assigned warehouse" or "No intake yet today."
- Error: clear retry button and "contact admin if assignment is missing."

Low-bandwidth:

- Avoid charts on first version.
- Show text counts and recent rows.
- Lazy-load photo thumbnails only below the fold.

Shared components:

- `DashboardShell` from `packages/dashboard-ui`.
- `SummaryMetricGrid` from `packages/dashboard-ui`.
- `StatusBadge` from `packages/ui`.
- `MobileActionList` from `packages/ui`.

### Farmer Lookup

Route: `/farmers`  
Likely file: `apps/ops/app/farmers/page.tsx`

Purpose: find an existing farmer before intake or registration.

Primary users: warehouse agents.

Required data:

- Farmer by phone number.
- Farmer list by assigned warehouse for browse mode.
- Verification and status.
- Preferred warehouse.

Likely data sources:

- `farmers.getByPhoneNumber`
- `farmers.listByWarehouse`

Actions:

- Search by phone.
- Open farmer profile summary.
- Start intake for farmer.
- Register new farmer when no match is found.

States:

- Loading: spinner in search result area only.
- Empty: "No farmer found. Register farmer."
- Error: duplicate or unavailable search states should not clear entered phone.

Low-bandwidth:

- Phone search should be explicit submit, not network on every keystroke.
- Cache last successful lookup in page state.

Shared components:

- `SearchField`, `FarmerSummaryCard`, `StatusBadge`, `EmptyState`.

### Agent-Assisted Farmer Registration

Route: `/farmers/new`  
Likely file: `apps/ops/app/farmers/new/page.tsx`

Purpose: register a farmer who is bringing produce to the warehouse.

Primary users: warehouse agents.

Required data:

- Assigned warehouse list.
- Existing phone lookup result before submit.
- Farmer fields: full name, phone, community, region, household phone owner, preferred warehouse.

Likely data sources:

- `warehouseAgents.getByUser`
- `warehouses.list`
- `farmers.createProfile`

Actions:

- Validate phone uniqueness.
- Create farmer profile with `registrationSource: "agent_assisted"`.
- Continue to intake with created farmer ID.

States:

- Loading: submit button busy, form remains visible.
- Empty: no assigned warehouse should block submit.
- Error: duplicate phone should link to existing farmer.

Low-bandwidth:

- Keep form one page, no heavy wizard.
- Save local draft in browser storage where practical.

Shared components:

- `FormSection`, `PhoneField`, `WarehouseSelect`, `ActionConfirmationDialog`.

### Produce Intake

Route: `/intake/new`  
Likely file: `apps/ops/app/intake/new/page.tsx`

Purpose: create an inventory batch and produce storage receipt.

Primary users: warehouse agents.

Required data:

- Selected farmer.
- Assigned warehouse.
- Supported crops and storage rules where available.
- Fields: crop type, variety, quantity received, unit, grade, condition notes, photos, received date, expected shelf life, sell-by date, storage rate rule or manual rate, asking/minimum price.

Likely data sources:

- `farmers.getById` or farmer lookup handoff.
- `warehouses.list` or selected warehouse by assignment.
- `feeRules.listStorageRateRules`.
- `inventoryBatches.createIntake`.

Actions:

- Create intake.
- Generate receipt code through backend.
- Send farmer SMS notification through existing intake workflow.
- Continue to receipt confirmation.

States:

- Loading: initial farmer/warehouse resolution.
- Empty: missing farmer should route to lookup.
- Error: warehouse inactive, farmer inactive, no permission, invalid quantity, unavailable fee rule.

Low-bandwidth:

- Allow photos to be optional for MVP.
- Compress images before upload when photo upload is implemented.
- Save draft after key fields.
- Keep crop/unit/grade fields native select controls.

Shared components:

- `IntakeForm`, `QuantityUnitField`, `GradeSelect`, `FeeRatePreview`, `ReceiptPreviewPanel`.

### Intake Confirmation and Receipt

Route: `/receipts/[receiptCode]`  
Likely file: `apps/ops/app/receipts/[receiptCode]/page.tsx`

Purpose: confirm successful intake and show receipt details for agent/farmer review.

Primary users: warehouse agents, with farmer viewing the screen at the desk.

Required data:

- Inventory batch by receipt code.
- Farmer summary.
- Warehouse summary.
- Storage rate snapshot.
- Notifications sent where available.

Likely data sources:

- `inventoryBatches.getByReceiptCode`
- `farmers.getById` may not allow agent viewing by ID today, so the receipt detail query should later return enough farmer display data or add a scoped agent-safe farmer lookup.
- `warehouses.getByCode` is code-based only today; a by-ID detail query may be useful later.

Actions:

- Copy/share receipt code.
- Print or export receipt later.
- Start another intake.
- Report issue on receipt.

States:

- Loading: receipt panel skeleton.
- Empty: receipt code not found.
- Error: permission denied if agent is not assigned to the warehouse.

Low-bandwidth:

- Receipt should be text-first and printable.
- Do not load full photo gallery by default.

Shared components:

- `ReceiptPanel` in `packages/ui`.
- `FeeBreakdown` in `packages/ui`.
- `AuditTrailPreview` in `packages/dashboard-ui` if shown only in ops/admin.

### Inventory List

Route: `/inventory`  
Likely file: `apps/ops/app/inventory/page.tsx`

Purpose: view and filter inventory for assigned warehouse operations.

Primary users: warehouse agents.

Required data:

- Inventory batches by warehouse.
- Filters: warehouse, crop, grade, status, sell-by date, receipt code.
- Quantity received, available, reserved/sold if reservation/sale summaries are available.

Likely data sources:

- `inventoryBatches.listWarehouseInventory`
- Lane A reservation summaries when available.

Actions:

- Open batch detail.
- Update status.
- Update condition/quantity/price details.
- Start dispatch preparation placeholder.
- Report issue.

States:

- Loading: table/list skeleton.
- Empty: "No inventory matches these filters."
- Error: filter query retry.

Low-bandwidth:

- Mobile default should be list cards, not wide table.
- Use server query limit and simple filters.
- Lazy-load images and advanced columns.

Shared components:

- `DenseDataTable` in `packages/dashboard-ui` for desktop.
- `MobileListItem` in `packages/ui` for mobile.
- `FilterBar` in `packages/dashboard-ui`.
- `StatusBadge`, `InventoryQuantitySummary`.

### Inventory Batch Detail

Route: `/inventory/[batchId]`  
Likely file: `apps/ops/app/inventory/[batchId]/page.tsx`

Purpose: operational detail view for one batch.

Primary users: warehouse agents.

Required data:

- Batch details.
- Farmer and warehouse display summaries.
- Storage fee ledger.
- Reservation/order links when Lane A lands.
- Sale/dispatch links later.
- Audit trail for sensitive changes.

Likely data sources:

- `inventoryBatches.getById`
- `storageFees.listByBatch`
- `auditLogs.listByEntity`
- Lane A reservation/order detail queries.

Actions:

- Update condition notes/photos.
- Adjust available quantity with reason.
- Update grade, asking price, minimum price.
- Update status using allowed transitions.
- Open fee ledger.
- Escalate dispute.

States:

- Loading: stable detail skeleton.
- Empty: batch not found.
- Error: unauthorized warehouse assignment.

Low-bandwidth:

- Put photos behind a collapsed gallery.
- Keep audit trail collapsed by default.

Shared components:

- `InventoryHeader`, `StatusTimeline`, `FeeLedgerTable`, `AuditTrail`.

### Inventory Status and Condition Update

Route: `/inventory/[batchId]/status`  
Likely file: `apps/ops/app/inventory/[batchId]/status/page.tsx`

Purpose: focused workflow for condition/status changes that require reasons.

Primary users: warehouse agents.

Required data:

- Current batch status and allowed next statuses from `packages/permissions`.
- Current condition notes, quantity available, grade.

Likely data sources:

- `inventoryBatches.getById`
- `inventoryBatches.updateStatus`
- `inventoryBatches.updateDetails`

Actions:

- Change status.
- Add reason.
- Update condition notes.
- Attach or replace photos later.

States:

- Loading: current status skeleton.
- Empty: batch not found.
- Error: invalid transition, missing reason, permission denied.

Low-bandwidth:

- Avoid auto-uploading photos. Let agent choose explicit upload.
- Keep status choices short and grouped by common operation.

Shared components:

- `StatusTransitionPicker`, `ConditionUpdateForm`, `ActionConfirmationDialog`.

### Storage Fee Preview and Ledger View

Routes:

- `/fees`
- `/inventory/[batchId]/fees`

Likely files:

- `apps/ops/app/fees/page.tsx`
- `apps/ops/app/inventory/[batchId]/fees/page.tsx`

Purpose: help agents explain accrued fees and preview current fee exposure before sale or withdrawal.

Primary users: warehouse agents.

Required data:

- Batch storage rate snapshot.
- Current days stored.
- Ledger entries.
- Accrued amount.
- Fee rule label and currency.

Likely data sources:

- `storageFees.listByBatch`
- `inventoryBatches.getById`
- `calculateFeeAmountFromSnapshot` from `packages/utils` if exposed to frontend and safe to use.

Actions:

- View fee history.
- Preview current fee.
- Escalate disputed fee.

Do not include in ops MVP unless backend policy allows agents to mark fees paid or waived. Current `storageFees.updateLedgerStatus` is admin-only.

States:

- Loading: fee rows skeleton.
- Empty: no fees accrued yet.
- Error: fee ledger unavailable.

Low-bandwidth:

- Use text rows and totals.
- Avoid charts.

Shared components:

- `FeeBreakdown`, `FeeLedgerTable`, `StatusBadge`.

### Dispatch Preparation Placeholder

Route: `/dispatch`  
Likely file: `apps/ops/app/dispatch/page.tsx`

Purpose: reserve space for warehouse-to-buyer dispatch preparation after dispatch backend lands.

Primary users: warehouse agents.

Required data later:

- Buyer orders in `reserved`, `preparing`, `ready_for_dispatch`.
- Matched inventory/reservations.
- Planned dispatches by assigned warehouse.

Actions later:

- Group orders into dispatch.
- Mark batch/order as preparing.
- Capture driver and vehicle details.
- Update dispatch status.

MVP placeholder:

- Explain that dispatch preparation is coming after reservation/order APIs and dispatch workflow APIs are available.
- Link to inventory batches and buyer order oversight if permissions allow.

States:

- Empty-first placeholder.

Low-bandwidth:

- No map or live tracking.

Shared components:

- `EmptyState`, `StatusTimeline`.

### Issue and Dispute Escalation

Route: `/disputes/new`  
Likely file: `apps/ops/app/disputes/new/page.tsx`

Purpose: let warehouse agents escalate intake, inventory, farmer, order, fee, or dispatch issues to admin.

Primary users: warehouse agents.

Required data:

- Entity type and ID from query params where possible.
- Summary.
- Warehouse ID.
- Optional metadata: receipt code, batch ID, farmer code, photo references.

Likely data sources:

- `disputes.create`

Actions:

- Create dispute.
- Return to source entity detail.

States:

- Loading: submit busy.
- Empty: entity not selected should still allow manual issue with warehouse ID.
- Error: invalid entity or missing summary.

Low-bandwidth:

- Keep summary text-only.
- Defer attachments.

Shared components:

- `DisputeForm`, `EntityReferencePicker`, `ActionConfirmationDialog`.

## 3. `apps/app` Farmer Self-Service Page Plan

Farmer routes should be mobile-first and simple. Suggested base segment: `/farmer`.

### Farmer Home

Route: `/farmer`  
Likely file: `apps/app/app/farmer/page.tsx`

Purpose: quick summary of the farmer's produce, fees, sales, and warehouse contact.

Required data:

- Farmer profile by signed-in user.
- Recent receipts.
- Open fees.
- Recent sale/payment status when available.

Actions:

- View My Produce.
- View Receipts.
- Report issue.
- Contact warehouse.

States:

- Loading: compact list skeleton.
- Empty: no produce yet, show warehouse contact/setup prompt.
- Error: profile missing or suspended.

Mobile/low-bandwidth:

- No charts.
- Show latest 3 records and clear links.

### My Produce

Route: `/farmer/produce`  
Likely file: `apps/app/app/farmer/produce/page.tsx`

Purpose: show current produce batches by status.

Required data:

- Farmer profile.
- Inventory batches for farmer.
- Status, quantity available, warehouse, grade, days stored, storage fee accrued.

Likely data sources:

- `farmers.getById` after resolving farmer profile.
- `inventoryBatches.listFarmerReceipts`

Actions:

- Open receipt/detail.
- Report issue on batch.

States:

- Loading list.
- Empty: "No produce recorded yet."
- Error: retry with agent contact fallback.

Mobile/low-bandwidth:

- Use status-grouped cards.
- Do not show images by default.

### My Receipts

Route: `/farmer/receipts`  
Likely file: `apps/app/app/farmer/receipts/page.tsx`

Purpose: receipt history.

Required data:

- Receipt code, crop, quantity received, warehouse, date received, status.

Actions:

- Open receipt detail.
- Copy receipt code.

States:

- Loading, empty, error.

Mobile/low-bandwidth:

- Text-first list.
- Pagination or query limit.

### Receipt Detail

Route: `/farmer/receipts/[receiptCode]`  
Likely file: `apps/app/app/farmer/receipts/[receiptCode]/page.tsx`

Purpose: farmer-readable receipt and current batch state.

Required data:

- Batch by receipt code.
- Storage rate snapshot.
- Fee ledger.
- Sale/payment status when available.
- Warehouse contact.

Likely data sources:

- `inventoryBatches.getByReceiptCode`
- `storageFees.listByBatch`
- Later sale records by batch/farmer.

Actions:

- Report issue.
- Contact warehouse.

States:

- Loading receipt.
- Empty receipt not found.
- Error unauthorized or network.

Mobile/low-bandwidth:

- Keep receipt printable/shareable.
- Avoid full audit details.

### Storage Fees

Route: `/farmer/storage-fees`  
Likely file: `apps/app/app/farmer/storage-fees/page.tsx`

Purpose: transparent fee view across the farmer's batches.

Required data:

- Open/accrued fees by receipt.
- Deducted, paid, waived, disputed fees.
- Current fee rate and days stored.

Likely data sources:

- `inventoryBatches.listFarmerReceipts`
- `storageFees.listByBatch` per selected receipt, or later aggregate farmer fee query.

Actions:

- Open receipt.
- Report fee dispute.

States:

- Loading totals.
- Empty: no fees yet.
- Error: partial data should show available receipts and retry fee rows.

Mobile/low-bandwidth:

- Summary total plus collapsible receipt rows.

### Sales and Payment Status

Route: `/farmer/sales`  
Likely file: `apps/app/app/farmer/sales/page.tsx`

Purpose: show what has sold and payment status.

Required data:

- Sale records by farmer.
- Buyer order reference without buyer private data beyond permitted sales context.
- Quantity sold, gross amount, deductions, net due, payment status.

Likely data sources:

- Later sale record query by farmer/payment status.

Actions:

- View sale detail.
- Report payment issue.

States:

- Empty until sales backend lands or no sales.
- Error with clear retry.

Mobile/low-bandwidth:

- Status cards by payment state: `pending`, `part_paid`, `paid`, `withheld`, `disputed`.

### Warehouse Contact

Route: `/farmer/warehouse`  
Likely file: `apps/app/app/farmer/warehouse/page.tsx`

Purpose: show preferred warehouse and agent support contact.

Required data:

- Farmer preferred warehouse.
- Warehouse name, community, operating days, dispatch days.
- Agent contact if policy allows public farmer visibility.

Likely data sources:

- `farmers.getById`
- Warehouse detail by ID is not present today; add a safe warehouse-by-ID query or return warehouse summary from farmer profile workflow.

Actions:

- Call contact link.
- Report issue.

States:

- Empty: no preferred warehouse.
- Error: warehouse unavailable.

Mobile/low-bandwidth:

- Text and call links only.

### Report Issue

Route: `/farmer/issues/new`  
Likely file: `apps/app/app/farmer/issues/new/page.tsx`

Purpose: farmer can raise issue on receipt, fee, sale, payment, or warehouse support.

Required data:

- Farmer profile.
- Optional entity reference.

Likely data sources:

- `disputes.create`

Actions:

- Create dispute with role `farmer`.

States:

- Loading submit.
- Error missing summary.

Mobile/low-bandwidth:

- One text area, optional receipt selector.

## 4. `apps/app` Buyer Self-Service Page Plan

Buyer routes should use base segment `/buyer`. Buyers must never see private farmer info: no farmer full name, phone number, farmer code, household phone owner, private community detail beyond warehouse/community availability needed for stock, or farmer-specific net payout. Buyer inventory should be warehouse-stock oriented and aggregated where possible.

### Buyer Onboarding/Profile

Routes:

- `/buyer/onboarding`
- `/buyer/profile`

Likely files:

- `apps/app/app/buyer/onboarding/page.tsx`
- `apps/app/app/buyer/profile/page.tsx`

Purpose: collect buyer business details and destination market.

Required data:

- Buyer profile by signed-in user.
- Buyer type, organization name, phone, destination market.

Likely data sources:

- `buyers.getByUserId`
- `buyers.createOrUpdateProfile`

Actions:

- Create/update buyer profile.

States:

- Loading profile.
- Empty profile should show onboarding.
- Error duplicate phone or permission.

Mobile/low-bandwidth:

- Single form page with native selects.

### Browse Warehouse Inventory

Route: `/buyer/inventory`  
Likely file: `apps/app/app/buyer/inventory/page.tsx`

Purpose: let buyers find verified available warehouse stock.

Required data:

- Inventory grouped by warehouse, crop, grade, unit, available quantity, price range, sell-by date, destination markets.
- Filters: crop, warehouse/community, destination market, grade, minimum quantity, max price, delivery date.

Likely data sources:

- Lane A or new buyer-safe inventory search query. `inventoryBatches.listWarehouseInventory` is not buyer-accessible and exposes batch/farmer IDs, so do not use it directly for buyers.
- Types already define `BuyerWarehouseInventorySearchFilters`.

Actions:

- Search/filter.
- Open inventory result/detail summary.
- Start order.

States:

- Loading filter results.
- Empty: no matching stock.
- Error: retry and clear filters.

Mobile/low-bandwidth:

- Explicit search button.
- No maps initially.
- Show 20 or fewer results by default.

Privacy:

- Show warehouse and product facts only. Hide farmer identity and private ownership data.

### Inventory Result/Detail Summary

Route: `/buyer/inventory/[resultId]` or `/buyer/inventory/summary` with query params  
Likely file: `apps/app/app/buyer/inventory/[resultId]/page.tsx`

Purpose: show buyer-safe details before order.

Required data:

- Crop, grade, warehouse/community, quantity available, unit, asking price/range, estimated fees, sell-by date, dispatch day/destination support.
- Aggregated source batch count if useful, not farmer details.

Likely data sources:

- Buyer-safe inventory summary query from Lane A or follow-up.

Actions:

- Create buyer order from this stock.
- Adjust requested quantity.

States:

- Loading summary.
- Empty result expired or unavailable.
- Error result no longer available.

Mobile/low-bandwidth:

- Keep one-page summary.

Privacy:

- Do not show farmer IDs, names, phone numbers, farmer-specific batch notes, or farmer payout data.

### Create Buyer Order

Route: `/buyer/orders/new`  
Likely file: `apps/app/app/buyer/orders/new/page.tsx`

Purpose: submit an order request against available inventory.

Required data:

- Buyer profile.
- Selected crop, quantity, unit, preferred grade, destination market, requested delivery date, max price.
- Estimated subtotal/transport/service fees if available.

Likely data sources:

- Lane A buyer order creation mutation.
- Types define `BuyerOrderInput`.

Actions:

- Create order.
- Backend matches/reserves inventory where Lane A defines.

States:

- Loading estimate.
- Empty: missing buyer profile should route to onboarding.
- Error: insufficient inventory, invalid quantity, profile not verified, payment required.

Mobile/low-bandwidth:

- Avoid multi-step wizard for MVP. Use a single form with a clear review section.

Privacy:

- Order confirmation should show warehouse stock summary, not farmer details.

### Order Detail/Status

Route: `/buyer/orders/[orderId]`  
Likely file: `apps/app/app/buyer/orders/[orderId]/page.tsx`

Purpose: buyer-facing order lifecycle view.

Required data:

- Order status.
- Payment status.
- Requested quantity, matched/reserved quantity, destination, totals.
- Reservation status summary.
- Later dispatch status.

Likely data sources:

- Lane A buyer order detail query.
- Lane A reservation summary query.

Actions:

- Cancel when status allows, if backend supports it.
- Confirm payment/deposit placeholder until payment integration lands.
- Report issue.

States:

- Loading order.
- Empty not found.
- Error unauthorized or stale order.

Mobile/low-bandwidth:

- Use status timeline and key facts.

Privacy:

- No farmer private data. Matched inventory can show warehouse/crop/grade/quantity only.

### Reservation/Fulfillment Status

Route: `/buyer/orders/[orderId]/reservation`  
Likely file: `apps/app/app/buyer/orders/[orderId]/reservation/page.tsx`

Purpose: explain whether stock is reserved, partially released, fulfilled, expired, or cancelled.

Required data:

- Reservation statuses: `active`, `partially_released`, `fulfilled`, `released`, `expired`, `cancelled`.
- Quantity reserved/released/fulfilled.

Likely data sources:

- Lane A inventory reservation query by order.

Actions:

- Report issue.
- Return to order.

States:

- Empty if order not yet matched.
- Error if reservation query unavailable.

Privacy:

- Show warehouse and quantity only, not farmer.

### Dispatch Status Placeholder

Route: `/buyer/orders/[orderId]/dispatch`  
Likely file: `apps/app/app/buyer/orders/[orderId]/dispatch/page.tsx`

Purpose: future buyer dispatch tracking.

Required data later:

- Dispatch status, planned departure, arrival, driver contact if policy allows.

MVP:

- Placeholder until dispatch backend lands.
- Show pickup/delivery notes from order if available.

## 5. `apps/app` Transporter Page Plan

Keep transporter scope light until dispatch backend lands. Suggested base segment: `/transporter`.

### Assigned Dispatch List

Route: `/transporter/dispatches`  
Likely file: `apps/app/app/transporter/dispatches/page.tsx`

Purpose: show assigned dispatches to a transporter.

Required data later:

- Dispatches by transporter user ID/status.
- Warehouse, destination, planned departure, quantity, status.

Likely data sources:

- Later transporter-safe dispatch list query. Schema has `dispatches.by_transporter_status`.

Actions later:

- Open dispatch detail.

MVP:

- Placeholder explaining dispatch assignments are coming after dispatch workflow lands.

### Dispatch Detail/Status Update Placeholder

Route: `/transporter/dispatches/[dispatchId]`  
Likely file: `apps/app/app/transporter/dispatches/[dispatchId]/page.tsx`

Purpose: show dispatch details and allow limited status updates later.

Required data later:

- Dispatch status and allowed transitions from `packages/permissions`.
- Driver/vehicle details, buyer order refs, inventory refs.

Actions later:

- Update status: `departed`, `in_transit`, `arrived`, `delivered`, `issue_reported` depending on backend policy.
- Report issue.

Can wait:

- Live GPS.
- Complex route optimization.
- Multi-stop proof of delivery.

## 6. `apps/admin` Page Plan

Suggested base routes stay at root admin segments.

### Admin Home/Overview

Route: `/`  
Likely file: `apps/admin/app/page.tsx`

Purpose: platform-wide operational overview.

Required data:

- Counts: farmers, agents, warehouses, buyers, inventory, available inventory, buyer orders, sales, dispatches, disputes, open disputes.
- Recent activity.
- Warehouse intelligence summary.

Likely data sources:

- `admin.getPlatformSummaryCounts`
- `admin.listRecentActivity`
- `hotspots.listWarehouseInventoryIntelligence`

Actions:

- Navigate to warehouses, inventory, orders, disputes, audit logs.

Permission needs:

- Admin only, `auditLogs:view`.

Table/filter ideas:

- Recent activity list filtered by action/entity.

States:

- Loading metrics skeleton.
- Empty if no data.
- Error with retry and partial metric fallbacks.

### Warehouse Management

Routes:

- `/warehouses`
- `/warehouses/new`
- `/warehouses/[warehouseId]`

Likely files:

- `apps/admin/app/warehouses/page.tsx`
- `apps/admin/app/warehouses/new/page.tsx`
- `apps/admin/app/warehouses/[warehouseId]/page.tsx`

Purpose: create, update, and monitor warehouses.

Data:

- Code, name, community, district, region, served communities, supported crops, storage capacity, assigned agents, destination markets, operating days, dispatch days, status.

Likely data sources:

- `warehouses.list`
- `warehouses.create`
- `warehouses.update`
- `warehouses.updateStatus`
- `warehouseAgents.listByWarehouse`

Actions:

- Create warehouse.
- Edit warehouse.
- Change status.
- Assign agents through agent management.

Permission needs:

- `warehouses:create`, `warehouses:update`.

Table/filter ideas:

- Filter by status, community, district, region, supported crop.

States:

- Loading table.
- Empty no warehouses.
- Error duplicate code, invalid status, permission denied.

### Warehouse Agent Management/Assignment

Routes:

- `/agents`
- `/agents/new`
- `/agents/[agentId]`
- `/agents/[agentId]/assignments`

Purpose: create warehouse-agent profiles, approve/suspend them, assign warehouses.

Data:

- User ID, agent code, name, phone, assigned warehouses, status, approved by/at.

Likely data sources:

- `warehouseAgents.list`
- `warehouseAgents.create`
- `warehouseAgents.updateStatus`
- `warehouseAgents.assignWarehouses`
- `warehouseAgents.assignWarehouse`
- `warehouseAgents.unassignWarehouse`
- `users.upsertProfile` if admin creates users as part of flow.

Actions:

- Create profile from existing user.
- Approve, reject, suspend, deactivate.
- Assign/unassign warehouses.

Permission needs:

- `warehouseAgents:manage`.

Table/filter ideas:

- Status, warehouse assignment, phone, agent code.

States:

- Empty no agents.
- Error user missing, duplicate profile, assignment warehouse missing.

### Farmer Oversight

Routes:

- `/farmers`
- `/farmers/[farmerId]`

Purpose: platform oversight for farmer profiles and verification.

Data:

- Farmer code, name, phone, community, region, preferred warehouse, registration source, verification status, status.
- Receipts/inventory by farmer.
- Fee and sale status summaries.

Likely data sources:

- `farmers.list`
- `farmers.getById`
- `farmers.updateStatus`
- `farmers.updateVerificationStatus`
- `farmers.updatePreferredWarehouse`
- `inventoryBatches.listFarmerReceipts`

Actions:

- Verify/reject farmer.
- Suspend/deactivate farmer.
- Change preferred warehouse.
- Open related receipts and disputes.

Permission needs:

- `farmers:verify`, `users:updateStatus` where user status is involved.

Table/filter ideas:

- Verification status, profile status, warehouse, community, registration source.

States:

- Empty no farmers.
- Error unauthorized or profile missing.

### Fee Rule Configuration

Routes:

- `/fees/rules`
- `/fees/rules/new`
- `/fees/storage-rates`
- `/fees/storage-rates/new`

Purpose: configure storage rates and other fee rules.

Data:

- Fee rule code, label, scope, calculation type, payer, amount/percentage/rate, currency, status, effective dates, version.
- Storage rate rule fields: warehouse, crop, unit, grade, rate per unit per day, currency, status, effective dates, version.

Likely data sources:

- `feeRules.list`
- `feeRules.create`
- `feeRules.replace`
- `feeRules.updateStatus`
- `feeRules.listStorageRateRules`
- `feeRules.createStorageRateRule`
- `feeRules.updateStorageRateRuleStatus`

Actions:

- Create draft/active fee rule.
- Replace rule with new version.
- Activate/inactivate/archive.

Permission needs:

- `fees:configure`, `warehouses:configureFees`.

Table/filter ideas:

- Status, calculation type, payer, warehouse, crop, unit, grade, effective date.

States:

- Empty no fee rules.
- Error invalid scope, duplicate code/version, overlapping active rule if backend enforces later.

### Inventory Oversight

Routes:

- `/inventory`
- `/inventory/[batchId]`

Purpose: platform-wide visibility into inventory batches.

Data:

- All inventory batches by warehouse/status/crop/grade.
- Quantity received/available.
- Fee accrued.
- Condition/sell-by.
- Linked reservations/orders/sales/dispatches when available.

Likely data sources:

- Today there is no admin-wide inventory list except warehouse-scoped `inventoryBatches.listWarehouseInventory`; admin UI can query per selected warehouse initially.
- `inventoryBatches.getById`
- `storageFees.listByBatch`
- `auditLogs.listByEntity`

Actions:

- Update status/details when needed.
- Open audit trail.
- Open dispute.

Permission needs:

- `inventory:update`, `inventory:updateStatus`, `inventory:adjustQuantity`, `auditLogs:view`.

Table/filter ideas:

- Warehouse, status, crop, grade, sell-by date, fee accrued, receipt code.

States:

- Empty no inventory.
- Error missing warehouse filter if admin-wide query is not available.

### Buyer Orders/Reservations Oversight

Routes:

- `/orders`
- `/orders/[orderId]`
- `/reservations`

Purpose: oversee buyer order and reservation flow.

Data:

- Buyer order status, payment status, destination market, crop, quantity, grade, totals, matched inventory.
- Reservation status and quantities.

Likely data sources:

- Lane A buyer order/reservation admin queries.
- Schema tables: `buyerOrders`, `inventoryReservations`, `buyerOrderCharges`.

Actions:

- Update order status where backend permits.
- Reserve/release inventory where backend permits.
- Open dispute.

Permission needs:

- `orders:updateStatus`, `orders:reserveInventory`, `disputes:manage`.

Table/filter ideas:

- Status, payment status, destination market, crop, buyer, created date.

States:

- Empty no orders.
- Error if Lane A APIs not yet landed.

### Sales/Payment Status Placeholder

Routes:

- `/sales`
- `/sales/[saleId]`

Purpose: next slice for sale records and farmer payment statuses.

Data later:

- Sale record, deductions, net farmer amount, payment status.

Likely data sources later:

- Sale record list/detail/update payment status queries/mutations.
- Schema tables: `saleRecords`, `saleDeductions`.

Actions later:

- Update payment status.
- Open farmer/payment dispute.

Permission needs:

- `sales:create`, `sales:updatePaymentStatus`.

MVP:

- Placeholder or read-only only if sale query exists.

### Dispatch Oversight Placeholder

Routes:

- `/dispatches`
- `/dispatches/[dispatchId]`

Purpose: later admin oversight of warehouse-to-market movement.

Data later:

- Dispatch status, warehouse, destination, transporter, driver, vehicle, orders, batches, planned/departed/arrival timestamps, cost, payer.

Likely data sources later:

- Dispatch list/detail/status update APIs.

Actions later:

- Create dispatch.
- Assign transporter.
- Update dispatch status.
- Open dispatch dispute.

Permission needs:

- `dispatches:create`, `dispatches:updateStatus`.

MVP:

- Placeholder until dispatch workflow lands.

### Disputes

Routes:

- `/disputes`
- `/disputes/[disputeId]`

Purpose: manage all raised issues.

Data:

- Dispute entity type/ID, status, opened by role/user, warehouse, summary, resolution, timestamps.
- Related entity summary where possible.

Likely data sources:

- `disputes.list`
- `disputes.updateStatus`
- `auditLogs.listByEntity`

Actions:

- Mark under review.
- Resolve with required resolution.
- Cancel.
- Navigate to related entity.

Permission needs:

- `disputes:manage`.

Table/filter ideas:

- Status, entity type, warehouse, opened by role, date.

States:

- Empty no disputes.
- Error missing entity reference should still show dispute shell.

### Audit Logs

Routes:

- `/audit`
- `/audit/entity/[entityType]/[entityId]`

Purpose: inspect sensitive changes.

Data:

- Actor, role, action, entity type/id, before/after, metadata, timestamp.

Likely data sources:

- `auditLogs.list`
- `auditLogs.listByEntity`
- `auditLogs.listRecent`
- `admin.listRecentActivity`

Actions:

- Filter and inspect.
- Link to related entity pages.

Permission needs:

- `auditLogs:view`.

Table/filter ideas:

- Entity type, action, actor, date range.

States:

- Empty no audit logs.
- Error when filters are too broad should suggest narrowing.

Low-bandwidth:

- Lazy-load JSON diff viewer.

### Reporting/Intelligence

Routes:

- `/reports`
- `/reports/inventory`
- `/reports/warehouses`
- `/reports/routes`

Purpose: operational intelligence for supply, demand, warehouse utilization, fees, spoilage, route costs over time.

Data:

- Warehouse inventory intelligence by warehouse/crop/unit/grade.
- Counts and open issues.
- Later: average storage days, quantity sold, spoilage rate, route cost, repeat buyer/farmer metrics.

Likely data sources:

- `hotspots.listWarehouseInventoryIntelligence`
- `admin.getPlatformSummaryCounts`
- Later reporting queries for sales, dispatch, and route-cost intelligence.

Actions:

- Filter reports.
- Export later if needed.

Permission needs:

- Admin only.

Table/filter ideas:

- Warehouse, crop, unit, grade, destination market, status.

States:

- Loading report table.
- Empty no intelligence records.
- Error partial report unavailable.

Low-bandwidth:

- Tables first.
- Lazy-load charts.

## 7. Shared Component Inventory

Likely `packages/ui` components:

- `StatusBadge`: typed statuses for inventory, reservation, buyer order, payment, dispatch, dispute, farmer, buyer, warehouse, warehouse agent.
- `FeeBreakdown`: rate, days, accrued, deducted, paid/waived/disputed status.
- `ReceiptPanel`: farmer-visible receipt card with receipt code, crop, quantity, grade, warehouse, received date, rate, status.
- `InventoryQuantitySummary`: received, available, reserved, sold, unit.
- `MobileListItem`: reusable compact card for farmer/buyer/mobile views.
- `EmptyState`: icon/title/body/action.
- `ActionConfirmationDialog`: lightweight confirm/cancel with reason field option.
- `PhoneField`, `QuantityUnitField`, `GradeSelect`, `WarehouseSelect`.
- `ErrorBanner` and `RetryPanel`.

Likely `packages/dashboard-ui` components:

- `DashboardShell`: sidebar/topbar layout for ops/admin.
- `DashboardPageHeader`: title, description, primary actions.
- `SummaryMetricGrid`: compact admin/ops metrics.
- `DenseDataTable`: sortable/paginated table for admin/ops only.
- `FilterBar`: structured table filters.
- `StatusTimeline`: order/inventory/dispatch lifecycle.
- `AuditTrail`: recent actions and before/after metadata.
- `FeeLedgerTable`: storage fee ledger rows.
- `EntityReferencePicker`: choose entity type/ID for dispute creation.
- `AdminActionPanel`: status changes, assignment controls, dangerous action confirmation.
- `PhotoEvidenceGallery`: lazy dashboard-only gallery for intake/condition evidence.

## 8. Recommended UI Implementation Order

### Can Build With Mock Data Now

1. Shared `packages/ui` primitives: status badges, empty/error states, receipt panel, fee breakdown, quantity summary, mobile list item.
2. Shared `packages/dashboard-ui` shell primitives: page header, metric grid, filter bar, dense data table facade, audit trail facade.
3. `apps/app` farmer static route skeletons: `/farmer`, `/farmer/produce`, `/farmer/receipts`, `/farmer/storage-fees`, `/farmer/warehouse`, `/farmer/issues/new`.
4. `apps/app` buyer static route skeletons: `/buyer/onboarding`, `/buyer/profile`, `/buyer/inventory`, `/buyer/orders/new`, `/buyer/orders/[orderId]`.
5. `apps/admin` dashboard shell and route skeletons.
6. `apps/ops` scaffold only after explicit agreement to add the documented app folder, then route skeletons.

### Can Wire To Existing Backend Earlier

1. Admin overview: `admin.getPlatformSummaryCounts`, `admin.listRecentActivity`.
2. Admin warehouse management: `warehouses.*`.
3. Admin warehouse-agent management: `warehouseAgents.*`.
4. Admin farmer oversight: `farmers.list`, `farmers.getById`, farmer status/verification/preferred warehouse mutations.
5. Admin fee rules: `feeRules.*`.
6. Ops farmer lookup and registration: `farmers.getByPhoneNumber`, `farmers.listByWarehouse`, `farmers.createProfile`.
7. Ops produce intake and receipt confirmation: `inventoryBatches.createIntake`, `inventoryBatches.getByReceiptCode`.
8. Ops inventory list/detail/status/details: `inventoryBatches.listWarehouseInventory`, `inventoryBatches.getById`, `inventoryBatches.updateStatus`, `inventoryBatches.updateDetails`.
9. Farmer receipts and produce: `inventoryBatches.listFarmerReceipts`, `inventoryBatches.getByReceiptCode`.
10. Fee ledger views: `storageFees.listByBatch`.
11. Dispute creation: `disputes.create`.
12. Admin dispute management: `disputes.list`, `disputes.updateStatus`.
13. Admin audit logs: `auditLogs.*`.

### Should Wait For Lane A Or Later Backend Workflows

1. Buyer inventory browse should wait for a buyer-safe inventory search/summary query. Do not expose warehouse-agent/admin batch queries directly to buyers.
2. Buyer create order, order detail, reservation status, and admin order oversight should wait for Lane A buyer order and reservation APIs.
3. Farmer sales/payment status should wait for sale record list/detail/payment queries.
4. Admin sales/payment pages should wait for sale workflow APIs.
5. Ops dispatch preparation, buyer dispatch status, transporter dispatch pages, and admin dispatch oversight should wait for dispatch workflow APIs.
6. Any payment/deposit UI should wait for explicit payment workflow and Paystack test-mode integration boundaries.

## 9. Integration Checklist

### Ops Pages

- Operations home:
  - Existing: `warehouseAgents.getByUser`, `inventoryBatches.listWarehouseInventory`
  - Needed: assigned-warehouse summary query, scoped agent dispute list, later dispatch summary.
- Farmer lookup:
  - Existing: `farmers.getByPhoneNumber`, `farmers.listByWarehouse`
- Agent-assisted registration:
  - Existing: `farmers.createProfile`, `warehouseAgents.getByUser`, `warehouses.list`
- Produce intake:
  - Existing: `inventoryBatches.createIntake`, `feeRules.listStorageRateRules`
  - Assumption: photo upload/storage workflow lands separately.
- Receipt confirmation/detail:
  - Existing: `inventoryBatches.getByReceiptCode`
  - Needed: safe joined receipt detail with farmer/warehouse summary for assigned agents.
- Inventory list/detail/update:
  - Existing: `inventoryBatches.listWarehouseInventory`, `inventoryBatches.getById`, `inventoryBatches.updateStatus`, `inventoryBatches.updateDetails`, `storageFees.listByBatch`
  - Existing shared logic: `allowedInventoryBatchStatusTransitions`
- Fee ledger:
  - Existing: `storageFees.listByBatch`
  - Admin-only today: `storageFees.updateLedgerStatus`, `storageFees.accrueForBatch`
- Issue escalation:
  - Existing: `disputes.create`

### Farmer Pages

- Farmer profile resolution:
  - Existing: `farmers.getById` if app can resolve farmer ID from signed-in user.
  - Needed: farmer-by-user query for simpler self-service boot.
- My Produce/My Receipts:
  - Existing: `inventoryBatches.listFarmerReceipts`
- Receipt detail:
  - Existing: `inventoryBatches.getByReceiptCode`, `storageFees.listByBatch`
- Storage Fees:
  - Existing: `storageFees.listByBatch`
  - Needed: aggregate farmer fee query for efficient list page.
- Sales/payment:
  - Needed: sale records by farmer and sale/payment detail.
- Warehouse contact:
  - Needed: safe warehouse-by-ID or farmer profile with warehouse summary.
- Report issue:
  - Existing: `disputes.create`

### Buyer Pages

- Buyer onboarding/profile:
  - Existing: `buyers.getByUserId`, `buyers.createOrUpdateProfile`
- Browse inventory:
  - Needed: buyer-safe inventory search with `BuyerWarehouseInventorySearchFilters`.
  - Privacy rule: must aggregate or sanitize inventory so private farmer fields never reach the buyer client.
- Inventory detail summary:
  - Needed: buyer-safe inventory summary by result/selection.
- Create order:
  - Lane A assumption: buyer order creation mutation using `BuyerOrderInput`.
- Order detail/status:
  - Lane A assumption: buyer order by ID scoped to buyer.
- Reservation/fulfillment:
  - Lane A assumption: reservations by order, with only warehouse/crop/grade/quantity buyer-safe fields.
- Dispatch placeholder:
  - Later: dispatch by order, buyer-safe.

### Transporter Pages

- Assigned dispatch list:
  - Later: dispatch list by transporter user/status.
- Dispatch detail/status:
  - Later: dispatch detail and status mutation scoped to assigned transporter.
  - Existing shared logic: `allowedDispatchStatusTransitions`.

### Admin Pages

- Overview:
  - Existing: `admin.getPlatformSummaryCounts`, `admin.listRecentActivity`, `hotspots.listWarehouseInventoryIntelligence`
- Warehouses:
  - Existing: `warehouses.create`, `warehouses.update`, `warehouses.updateStatus`, `warehouses.list`, `warehouses.getByCode`
  - Needed: warehouse-by-ID detail or use list/code until added.
- Agents:
  - Existing: `warehouseAgents.create`, `warehouseAgents.updateStatus`, `warehouseAgents.assignWarehouses`, `warehouseAgents.assignWarehouse`, `warehouseAgents.unassignWarehouse`, `warehouseAgents.list`, `warehouseAgents.getById`, `warehouseAgents.listByWarehouse`
- Farmers:
  - Existing: `farmers.list`, `farmers.getById`, `farmers.updateStatus`, `farmers.updateVerificationStatus`, `farmers.updatePreferredWarehouse`
- Fee rules:
  - Existing: `feeRules.create`, `feeRules.replace`, `feeRules.updateStatus`, `feeRules.createStorageRateRule`, `feeRules.updateStorageRateRuleStatus`, `feeRules.list`, `feeRules.listStorageRateRules`
- Inventory:
  - Existing: warehouse-scoped `inventoryBatches.listWarehouseInventory`, `inventoryBatches.getById`, update mutations, `storageFees.listByBatch`
  - Needed: admin-wide inventory query for platform table.
- Orders/reservations:
  - Lane A assumption: admin order/reservation list/detail/status APIs.
- Sales/payments:
  - Later: sale record list/detail/payment APIs.
- Dispatches:
  - Later: dispatch list/detail/create/status APIs.
- Disputes:
  - Existing: `disputes.list`, `disputes.updateStatus`
- Audit:
  - Existing: `auditLogs.list`, `auditLogs.listByEntity`, `auditLogs.listRecent`
- Reporting/intelligence:
  - Existing: `hotspots.listWarehouseInventoryIntelligence`, `admin.getPlatformSummaryCounts`
  - Later: route-cost, sale velocity, spoilage, payment, and dispatch analytics queries.

## 10. Open Backend Assumptions To Recheck After Lane A Lands

- Exact buyer order creation mutation name, return value, idempotency/client request behavior, and reservation timing.
- Whether buyer inventory search returns aggregated warehouse stock, batch-level sanitized records, or both.
- Whether order status updates are admin-only, workflow-driven, buyer-driven, or mixed.
- Whether reservation expiry/release is automatic or manually triggered.
- How sale records are created from fulfilled orders and whether farmer payment status is admin-editable.
- Whether dispatches are created from orders, reservations, sale records, or a separate preparation workflow.
- Whether farmer self-service can resolve farmer profile by signed-in user without already knowing farmer ID.
- Whether warehouse agents get a safe joined receipt detail query with farmer/warehouse summaries.

