# Kuapa Dwaso product guide

## A better path from harvest to buyer

Kuapa Dwaso is a smartphone-first, warehouse-based produce aggregation platform. It helps farmers bring produce to a nearby warehouse, gives warehouse teams a reliable way to receive and manage it, and helps buyers purchase from verified stock rather than uncertain supply.

The warehouse is the product's trust point. Each batch has a farmer owner, a warehouse location, a recorded quantity and quality, a changing availability status, and a clear financial record. This gives every participant a shared view of what is happening to the produce.

## The problem

Farmers can face high transport costs, uncertain demand, pressure to accept poor terms, delayed payment, and the risk of bringing perishable produce to market without a buyer. Buyers, meanwhile, need a dependable view of stock, grade, and fulfillment readiness.

Kuapa Dwaso changes the flow from individual, speculative trips to market into an organized warehouse process:

1. A farmer deposits produce at a community warehouse.
2. A warehouse agent receives, weighs, grades, photographs, and records it.
3. The platform creates an inventory batch and storage receipt.
4. An admin publishes a dated run from a recurring service to a selected market destination.
5. Buyers order verified inventory before the run cutoff and pay by the stated deadline.
6. Compatible orders are aggregated, reserved, prepared, sold, and linked to a physical dispatch.
7. The farmer can see fees, sale progress, and payment or payout updates.

## What users can do

### Farmers

The farmer experience is deliberately simple and mobile-first. Farmers can:

- create and manage a profile;
- view produce currently held at a warehouse;
- open digital storage receipts;
- see quantity, grade, status, storage duration, and storage-fee accruals;
- follow sales and the expected amount due after recorded deductions;
- receive important one-way SMS and in-app updates; and
- contact the warehouse or report an issue.

Farmers retain ownership of their produce while it is in storage. The platform records custody and transactions; it does not treat stored produce as anonymous warehouse stock.

### Warehouse agents

The operations console supports the daily work of a warehouse. Agents can:

- search for an existing farmer or register one with their permission;
- receive produce and select the warehouse, crop, variety, grade, quantity, storage rate, and sell-by information;
- attach photo evidence and condition notes;
- create an inventory batch and receipt;
- review fee accruals and update permitted inventory conditions or statuses;
- find and review inventory and receipts; and
- escalate operational issues and help prepare goods for dispatch.

The product records sensitive operational changes so that quantity, condition, and status changes are traceable.

### Buyers

Buyers work with aggregated, warehouse-held stock—not private farmer records. The buyer flow supports:

- organization profile and verification steps;
- choosing a selected market destination and an upcoming delivery run;
- seeing the published delivery date, cutoff, arrival window, collection instructions, and payment deadline;
- browsing inventory eligible for that run and creating and tracking an order;
- payment initiation and order-payment status; and
- delivery or pickup fulfillment tracking.

Enhanced buyer verification is used before sensitive commercial actions are enabled. A buyer does not need access to a farmer's private information to source produce responsibly.

### Transporters

Transporters can maintain a transport profile, see dispatch assignments, view fulfillment details relevant to the delivery, and update the progress of assigned work.

### Platform administrators

The administration console provides network-wide oversight. Authorized teams can manage:

- warehouses, warehouse agents, farmers, buyers, and transporters;
- inventory, fee rules, orders, sales, payments, payouts, and dispatches;
- recurring market-service schedules, dated delivery runs, and compatible-unit readiness;
- notifications, disputes, evidence, reports, and audit logs; and
- scoped access, roles, invitations, groups, and multi-factor authentication requirements.

## Key product features

| Capability                             | Why it matters                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Warehouse intake and receipts          | Turns a physical handover into a consistent, traceable digital record.                           |
| Inventory batches and reservations     | Separates received, available, reserved, sold, and dispatched quantities to prevent overselling. |
| Storage-fee ledger                     | Makes daily storage charges and later deductions visible and historically stable.                |
| Buyer order workflow                   | Connects verified stock to an accountable order from submission through completion.              |
| Scheduled market delivery              | Publishes destinations, cutoffs, dated runs, and arrival windows without conflating a run with a dispatch. |
| Sales, deductions, and payout tracking | Shows the financial outcome for the batch and the farmer amount due.                             |
| Dispatch tracking                      | Links the warehouse, order, transporter, destination, cost, and fulfillment status.              |
| Notifications                          | Delivers important updates through in-app notifications and one-way SMS.                         |
| Disputes and audit logs                | Gives teams a formal path for exceptions and a record of sensitive activity.                     |

## The important rules behind the product

- **Ownership stays clear.** The farmer owns stored produce. Warehouse handling, sale, and payouts are recorded against that ownership.
- **Availability is calculated, not guessed.** Active reservations and fulfilled sales reduce what can be sold next.
- **Fees do not rewrite history.** Applied fee information is stored with the relevant ledger, order charge, or sale deduction.
- **Financial and fulfillment states are separate.** A buyer's payment, a farmer's sale payment, and an order's delivery progress can each be at different stages.
- **Private information is protected.** Buyers see warehouse inventory, not farmer-private details.
- **Exceptions have a route.** Spoilage, withdrawal, cancellation, payment problems, and operational issues can be disputed and reviewed.
- **Gross value is not revenue.** Reports distinguish farmer-owned produce value, platform service fees, cash collected, outstanding orders, and payable/paid payouts using actual records only.

## Status language at a glance

An inventory batch progresses through clear states such as **received**, **verified**, **available**, **reserved**, **partially sold**, **sold**, **prepared for dispatch**, and **dispatched**. It can also be **withdrawn**, **expired**, **spoiled**, or **disputed** when circumstances require it.

Buyer orders move separately from draft and submission through payment, matching, reservation, preparation, dispatch, delivery, and completion. This separation is intentional: an item can be paid for without being delivered, or dispatched before the farmer's payout is marked paid.

## Current scope and boundaries

The current product focuses on warehouse intake, traceable inventory, buyer orders, sales, dispatch, notifications, and administrative oversight. It is designed for smartphone-first use, with agent-assisted support where needed and a low-bandwidth bias in public and farmer-facing screens.

The following are not product promises in the current scope:

- loans, credit scoring, cash advances, or other lending products;
- two-way SMS registration or approval commands—SMS is a one-way notification channel;
- autonomous farmer payouts—payout state is tracked, while provider automation remains a separate decision; and
- live GPS fleet tracking.

For how these workflows are implemented, see the [technical overview](../technical/architecture.md).
