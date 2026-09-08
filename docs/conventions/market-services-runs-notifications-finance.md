# Market Services, Delivery Runs, Notifications, and Finance

This convention describes the implemented warehouse-run branch. The planned
demand-led maize pilot uses separate buyer requests, procurement lots,
fulfilment plans, payment transactions, and financial entries. It does not make
warehouse, inventory reservation, or recurring market-run fields optional. See
[ADR-0005](../decisions/ADR-0005-demand-led-maize-pilot-boundary.md) and the
[pilot contracts](../technical/maize-pilot-contracts.md).

## Schedule, run, and dispatch are separate

A `marketServiceSchedule` is a recurring service promise configured for one
origin warehouse and destination. It records local delivery weekday, cutoff
rule, arrival window, IANA timezone, instructions, optional compatible-unit
minimum/capacity, effective dates, status, and audit actors.

A `marketDeliveryRun` is one dated occurrence. Its cutoff, arrival window,
destination, origin, minimum, and capacity are snapshots so later schedule
edits do not rewrite buyer promises. Duplicate schedule/date generation is
rejected. Its lifecycle is:

```text
draft -> accepting_orders -> cutoff_reached -> ready -> confirmed
confirmed -> dispatched -> completed
draft/accepting_orders/cutoff_reached/ready/confirmed -> cancelled
```

Each run schedules its exact cutoff transition when it is created or rescheduled,
with an hourly recovery job for missed work. A run cannot be opened after its
published cutoff. Moving a run to `ready` requires every active order to remain
fully reserved and fully paid. Capacity, minimum-load, or unit-policy exceptions
require an explicit audited operational override.

Postponement cancels the original run with a reason and creates a linked dated
replacement. Active orders and reservations move to that replacement with its
new promise snapshots and deadline; terminal orders remain on the original run.
A run with a linked dispatch cannot be postponed. A physical `dispatch` is created only from compatible confirmed
run orders and links back to that run. Legacy orders and dispatches without a
run remain readable, but they are never mixed into a run dispatch.

## Buyer promise and aggregation

New buyer orders select an accepting run and snapshot destination, delivery
date, cutoff, arrival window, collection instructions, and payment deadline.
Server rules reject a closed/cancelled/completed run, incompatible inventory
origin, destination mismatch, or post-cutoff order. An authorized late-order
exception records both actor and reason.

Readiness totals are grouped by crop and unit. Quantities in bags, crates,
kilograms, or other incompatible bases are never added together. Minimum-load
and capacity percentages appear only when every included quantity and the
configured threshold share one unit; otherwise operations sees grouped totals
and an explicit requirement for operational confirmation.

## Actionable notifications

In-app notifications may contain an action URL, priority, due time,
acknowledgement, deduplication key, escalation level, expiry, and related run.
Only the recipient can mark one read, acknowledge it, or archive it. A required
action cannot be archived before acknowledgement unless it has expired.
Hourly idempotent reminders cover approaching run cutoffs and reservation
expiry. Unpaid reservations expire automatically at their deadline, while a
successful payment removes the reservation expiry. SMS remains concise and transactional; detailed instructions and the
durable action always remain in the application.

Eligible in-app notifications may fan out to active Web Push subscriptions.
Push is opt-in, uses generic lock-screen copy, and routes only to same-origin
relative actions. Push delivery state is separate from in-app read state. A
missing, revoked, or failed push subscription never suppresses SMS, email, or
the canonical in-app notification.

## Actual financial definitions

- **Gross produce value (actual):** value of recorded sales; never labelled as Kuapa Dwaso revenue.
- **Farmer-owned value (actual):** recorded net amount due to farmers after visible deductions.
- **Service-fee revenue (accrued):** service fees on actual buyer orders.
- **Storage/transport/insurance charges (accrued):** only charges represented by actual ledgers or orders. A zero insurance value means no recorded charge, not an estimate.
- **Buyer payments collected:** successful payment transactions only.
- **Unpaid buyer orders (outstanding):** actual order totals not fully paid.
- **Farmer net payouts (payable):** non-cancelled ledger amounts not yet paid.
- **Payouts paid:** ledger entries marked paid.
- **Failed, manual-review, and disputed amounts:** actual records in those states.

This implementation does not infer operating expenses, contribution margins, construction
costs, lending projections, or other values not supported by product records.

Reports that include the planned pilot must select the warehouse or pilot source
before aggregation. They return the two branches separately. A labelled combined
view may add only values with matching currency, unit, actual or estimate basis,
and economic definition. Pilot procurement lots never accrue warehouse storage
fees automatically.
