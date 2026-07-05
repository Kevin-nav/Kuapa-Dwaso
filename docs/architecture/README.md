# Architecture

This folder is for high-level system architecture notes that are more stable than implementation plans but less formal than architecture decisions.

## App Responsibility Map

- `apps/www`: public marketing and lightweight public education pages.
- `apps/app`: farmer, buyer, and transporter self-service flows.
- `apps/ops`: warehouse-agent operations for produce intake, receipts,
  inventory updates, and dispatch preparation.
- `apps/admin`: platform administration, fee configuration, warehouse-agent approval,
  disputes, audit, reporting, and warehouse network oversight.
- `apps/api`: provider SDKs, webhooks, and integration adapters for one-way SMS,
  uploads, payments, and other external services.

## Product State

Convex is the system of record for product state. Warehouse inventory,
reservations, storage fees, buyer orders, sales, dispatches, notifications,
audit logs, disputes, and app settings belong in Convex. The NestJS API should
call providers and webhooks but should not become a second workflow database.

## Current Domain Vocabulary

Use warehouse-domain language in new foundation work:

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

Do not build foundation features around retired marketplace objects.
