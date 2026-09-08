# ADR-0005: Demand-led maize pilot boundary

## Status

Accepted for implementation. The software described here remains planned until its tickets are complete and verified.

## Context

The current product starts with warehouse intake and sells reserved warehouse inventory through dated market delivery runs. The maize pilot starts with a buyer requirement, then coordinates farmer supply, inspection, collection, delivery, acceptance, and settlement. A pilot request must work without a warehouse, inventory batch, storage receipt, or market delivery run.

Making warehouse identifiers optional on existing records would weaken rules that protect the current workflow. Giving every warehouse agent access to every pilot would also break the existing scoped-access model.

## Decision

Add a separate, typed pilot domain in Convex. `pilotBuyerRequests`, `pilotProcurementLots`, `pilotFulfilmentPlans`, and the other tables frozen in [the maize pilot contracts](../technical/maize-pilot-contracts.md) do not replace warehouse tables. Existing `buyerOrders`, `inventoryBatches`, `inventoryReservations`, `saleRecords`, `dispatches`, and their financial records keep their present warehouse invariants.

`apps/ops` also handles assigned pilot sourcing, inspection, collection, and custody work. This is a narrow extension of the existing operations app. It does not grant access from a role label or warehouse assignment. An active `pilotAssignments` row with the required capability and programme is mandatory for each pilot operation.

`apps/admin` owns programme configuration, pilot assignments, commercial review, purchasing budgets, finance, disputes, and oversight. Admin permission checks include the `pilot_programme` scope. `apps/app` remains the self-service app for buyers, farmers, and transporters. `apps/www` remains lightweight and contains only public explanation.

Convex remains the product system of record. The NestJS API verifies Firebase tokens when it handles provider work and owns provider SDK calls for uploads, messages, and payments. Direct Convex pilot calls authenticate through `ctx.auth.getUserIdentity()` and resolve the matching active `users` row. A caller-supplied user ID is never authority.

Pilot lots separate title, custody, and location. Optional storage refers to an assessed `pilotFacilities` record, which may link to a real warehouse when that is accurate. No facility or warehouse is required. Procurement lots never accrue the legacy storage fee automatically.

## Compatibility rules

- Warehouse records keep their existing required fields and status guards.
- A shared order reference is a discriminated envelope containing either a legacy `buyerOrderId` or a `pilotRequestId`. A pilot request is not copied into `buyerOrders`.
- Pilot payment provider state uses `pilotPaymentTransactions`; existing `paymentTransactions` keeps its required legacy `buyerOrderId`.
- Pilot financial postings use `pilotFinancialEntries`. A report must select one source branch before aggregation and label warehouse and pilot totals separately when both appear.
- Missing pilot fields on legacy rows mean legacy warehouse data. No backfill invents a programme, facility, kilograms, price basis, or commercial mode.
- Disabling pilot entry points stops new pilot work without changing warehouse routes or deleting pilot history.

## Consequences

The operations app has two explicit scopes: assigned warehouse work and assigned pilot work. Code may share presentation and utility packages, but access checks and persistence stay separate.

The pilot adds records and indexes rather than relaxing old tables. Downstream work must use the names and transaction boundaries in the contract document. Material commercial facts live in immutable revisions, financial corrections use compensating entries, and custody history is append-only.

The pilot can demonstrate a complete no-warehouse route. Optional partner storage and future warehouse use remain possible through assessed facility references, without asserting that Kuapa Dwaso owns or has contracted a facility.
