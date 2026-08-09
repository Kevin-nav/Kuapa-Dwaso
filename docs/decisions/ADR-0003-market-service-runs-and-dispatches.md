# ADR-0003: Separate recurring market services, dated runs, and dispatches

- Status: Accepted
- Date: 2026-08-01

## Context

A weekly service promise, a buyer-order deadline for one date, and the eventual
physical vehicle movement change for different reasons and at different times.
Treating them as one record would rewrite buyer promises when schedules change,
make postponement ambiguous, and allow incompatible orders to be grouped.

## Decision

Model three linked records in Convex: a recurring `marketServiceSchedule`, a
dated `marketDeliveryRun` that snapshots the published promise, and one or more
actual `dispatch` records linked after run confirmation. Buyer orders reference
the dated run. Compatibility and cutoff checks are server-side. Existing orders
without a run remain readable as legacy records.

Warehouse managers remain warehouse-scoped administrators in `apps/admin`.
This decision introduces no new application or provider boundary.

## Consequences

- Schedule edits do not silently alter existing run/order promises.
- A postponed occurrence retains its history and points to a replacement.
- Dispatch grouping can enforce run, origin, destination, and unit compatibility.
- Operations can compare requested, reserved, paid, and unpaid quantities by
  crop/unit without implying a false combined capacity percentage.
- More linked records and explicit transitions are required, but each record has
  one auditable responsibility.
