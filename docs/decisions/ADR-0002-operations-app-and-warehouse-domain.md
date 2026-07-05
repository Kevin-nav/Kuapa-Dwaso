# ADR-0002: Operations App And Warehouse Domain Reset

## Status

Accepted

## Decision

The product is pivoting from an SMS-first farmer marketplace to a
smartphone-first warehouse-based produce aggregation platform. The core product
language is now:

```text
warehouse_agent
warehouse
inventory_batch
storage_receipt
storage_fee_ledger
buyer_order
sale_record
dispatch
```

`apps/ops/` is an accepted app boundary for warehouse-agent operations. It owns
local warehouse workflows such as farmer assistance, produce intake, storage
receipt lookup, inventory status updates, spoilage/withdrawal support, and
dispatch preparation.

`apps/admin/` owns platform configuration and oversight: warehouses, warehouse
agents, configurable fee and storage-rate rules, disputes, audit logs, reporting,
and operational intelligence.

`apps/app/` owns farmer, buyer, and transporter self-service. `apps/www/`
remains public and lightweight. `apps/api/` remains the external provider and
webhook boundary for one-way SMS, uploads, payments, and other SDK-backed
integrations.

Convex is the product system of record for warehouse inventory, buyer orders,
sales, dispatches, fees, disputes, notifications, audit logs, and workflow
state. The NestJS API must not duplicate product workflow state.

Two-way SMS registration, command parsing, and SMS approval replies are out of
MVP scope. One-way SMS remains as a notification channel.

## Business Rules

Farmers own produce while it is stored. The platform stores, verifies, markets,
sells, deducts agreed fees, dispatches, and records payout state on the farmer's
behalf.

Storage fees start when an inventory batch is received unless a future
warehouse-specific rule says otherwise. If produce is sold, accrued storage fees
are deducted from sale proceeds. If a farmer withdraws unsold produce, the farmer
must settle outstanding storage fees before withdrawal unless an admin records an
approved waiver or adjustment.

Spoilage caused by farmer delay, natural shelf life, or agreed storage limits can
leave fees payable according to the warehouse agreement. Spoilage caused by
warehouse negligence must open or link to a dispute before fees or deductions are
finalized.

Buyer cancellation releases active reservations when the order has not yet been
fulfilled. Any cancellation after preparation, dispatch, or delivery requires an
admin or dispute workflow because stock condition, transport cost, and farmer
payout may already be affected.

Partial sales are first-class. A batch can move from available to reserved,
partially_sold, sold, prepared_for_dispatch, and dispatched while preserving the
remaining quantity and the farmer's net amount due.

Inventory reservations are explicit records. Available quantity is calculated
from quantity received minus fulfilled sale quantity and active reservation
quantity. Reservations prevent overselling and may expire or be released.

Buyer order payment status is separate from buyer order fulfillment status. Sale
payment status is separate again and tracks what is owed or paid to the farmer.

Dispatch responsibility is explicit on each dispatch through transporter,
driver, cost, payer, route, and status fields. The MVP focuses on warehouse to
buyer or destination-market dispatch, not farmer to warehouse transport.

Platform, storage, handling, commission, transport, and service fees must be
configurable by admin in later workflows. Every applied fee must be snapshotted
on the storage fee ledger, buyer order charge, or sale deduction record so
historical receipts and sales do not silently change when an admin edits a rule.

## Consequences

The old primary concepts are no longer the foundation model:

```text
generic agent
produce listing
bulk lot
deal
transport request
two-way SMS approval
```

Legacy code may remain only as short-lived scaffolding during migration. New
foundation contracts and schemas should use warehouse-domain vocabulary.
