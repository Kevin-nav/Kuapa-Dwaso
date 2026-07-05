# Convex

Convex owns core application data, realtime workflows, queries, and mutations.

Keep persistent application state here rather than creating a separate conflicting data model inside the API.

The current foundation domain is warehouse based. Convex is the system of
record for warehouses, warehouse agents, farmers, buyers, inventory batches,
inventory reservations, storage fee ledger entries, configurable/snapshotted fee
rules, buyer orders, buyer order charges, sale records, sale deductions,
dispatches, notifications, audit logs, disputes, and app settings.

This checkout is intended to link to the existing Convex project named `KuapaDwaso`.
Run `corepack pnpm convex:dev` and choose that existing project when prompted.
