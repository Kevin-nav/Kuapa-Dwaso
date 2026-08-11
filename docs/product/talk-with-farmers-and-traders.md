# Market and Farmer Visit Learnings

## How Field Insights Shaped the Product Decisions

**Project:** Warehouse-Based Agricultural Produce Aggregation Platform
**Document Type:** Field Research Summary and Product Decision Rationale
**Status:** Reflects decisions already adopted in the current product direction

---

## 1. Purpose of This Document

This document summarizes the key insights gathered from the market and farmer visits and explains how those insights influenced the product decisions we made.

The goal is to show that the product direction is based on real problems observed from farmers, traders, and the produce movement chain, not just assumptions made during planning.

---

## 2. Key Learnings From the Market and Farmer Visits

### 2.1 Farmers Were Carrying Too Much Risk Alone

One of the strongest lessons was that farmers were taking on too much risk when moving produce to the city.

In the existing market pattern, farmers often harvest their produce, arrange transport, move the produce to the city or market area, and only then begin looking for buyers or negotiating with traders.

This creates several risks for farmers:

```text
High transport cost
Wasted time
Spoilage risk
Uncertain demand
Pressure to sell quickly
Weak bargaining power
Delayed payment from traders
Possibility of being forced to give out produce on credit
```

This showed us that the product should not simply help farmers “find buyers.” It should reduce the need for farmers to carry produce blindly to the city in the first place.

### Product Decision Influenced

We implemented a warehouse-based model where farmers bring produce to a nearby community warehouse instead of transporting it directly to the city.

The warehouse becomes the point where produce is received, verified, stored, tracked, and later sold or dispatched based on buyer demand.

---

## 3. Transport Was a Major Source of Cost and Frustration

The visits showed that transport was one of the biggest problems in the produce chain.

Because of poor roads and difficult farm access, produce may pass through multiple movement stages before reaching the city.

A typical chain may look like this:

```text
Farm or village
→ loading boys carry produce
→ tricycle moves produce to a reachable point
→ truck carries produce to the city or market
→ traders buy or resell
```

Each stage adds cost. By the time the produce reaches the city, transport and handling may have already increased the final price.

This affects both farmers and traders. Farmers spend more before selling, while traders may also receive goods at higher prices and pass those costs on to customers.

### Product Decision Influenced

We made transport reduction and bulk movement a core part of the product.

Instead of many farmers moving produce individually to the city, the platform now supports aggregation at warehouses and bulk dispatch from the warehouse to buyers or destination markets.

This helps reduce duplicated transport costs and makes movement more coordinated.

---

## 4. Farmers Needed a Safer Alternative to City Selling

From the discussions, we learned that some farmers face difficult situations when they bring produce to the city. Traders may sometimes say they do not have money immediately or pressure farmers to leave produce with them and receive payment later.

This creates an informal credit situation where the farmer has already spent money transporting produce, but still does not have guaranteed payment.

The problem was not only that traders and farmers needed to meet. The deeper issue was that farmers needed a safer way to store, track, and sell their produce without being forced into weak payment situations.

### Product Decision Influenced

We decided not to build a loan or credit system at this stage.

Instead, we implemented a produce storage and inventory model where the farmer’s goods are recorded at the warehouse, tracked digitally, and sold through the platform.

This gives farmers better records and reduces the pressure to hand over produce informally without proper tracking.

---

## 5. Warehouses Became the Physical Trust Point

The visits made it clear that the product needed a physical point of control.

A purely digital marketplace would not be enough because the real problems involve physical produce, physical movement, verification, storage, and trust.

The warehouse solves this by acting as the platform’s physical trust point.

At the warehouse:

```text
Produce is received
Quantity is checked
Quality or grade is recorded
Photos can be taken
Farmer ownership is recorded
Storage duration is tracked
Buyer orders can be matched against real inventory
Dispatch can be organized from one controlled point
```

### Product Decision Influenced

We made the warehouse the center of the platform.

The product now revolves around warehouse intake, inventory batches, storage receipts, daily storage fees, buyer orders, sale records, and dispatch tracking.

---

## 6. Farmers Needed Clear Records of Their Produce

The farmer discussions showed that record keeping is important.

If a farmer brings produce into a system, they need to know:

```text
What quantity was received
Where it was stored
Who received it
What grade or condition was recorded
How long it has been stored
What storage fee has accrued
Whether any part has been reserved
Whether any part has been sold
How much they are expected to receive
```

Without clear records, disputes can easily happen between farmers, agents, buyers, and the platform.

### Product Decision Influenced

We implemented produce storage receipts and inventory batch records.

When produce is received, the system creates a receipt showing the farmer, warehouse, crop, quantity, grade, date received, storage rate, and current status.

This gives the farmer a clear digital record of what was deposited.

---

## 7. Daily Storage Fees Were Needed to Protect the Warehouse Model

The team recognized that if farmers can store produce for free indefinitely, the warehouse could be abused and become financially unsustainable.

At the same time, the storage fee must be transparent and fair so farmers understand exactly what they are paying for.

### Product Decision Influenced

We implemented a daily storage fee model.

The platform tracks:

```text
Storage rate
Quantity stored
Number of days stored
Current storage fee
Whether the fee has been paid, deducted, waived, or disputed
```

The fee can be deducted from the sale proceeds when produce is sold, or paid before withdrawal if the farmer decides to take back unsold produce.

This makes the warehouse sustainable while preventing free use without accountability.

---

## 8. Produce Ownership Needed to Be Clear

The visits helped us clarify that the platform should not buy all produce from farmers upfront.

Buying produce upfront would require significant capital and would expose the platform to spoilage and unsold inventory risk.

A better model is that farmers continue to own their produce while the platform stores and sells it on their behalf.

### Product Decision Influenced

We adopted a consignment-style ownership model.

The farmer owns the produce while it is stored. The platform provides storage, verification, buyer access, sale coordination, dispatch coordination, and record keeping.

When produce is sold, the platform can deduct agreed fees such as:

```text
Storage fee
Handling fee
Commission or markup
Transport cost, depending on the agreement
```

The farmer then receives the net amount due.

---

## 9. Most Farmers Had Smartphone Access

The initial plan placed a lot of emphasis on two-way SMS registration because we assumed many farmers might not have smartphones.

However, the farmer survey showed that most farmers either have smartphones themselves or have someone in their household who can access a smartphone.

At the same time, getting a reliable two-way SMS provider was becoming difficult and could slow down development.

### Product Decision Influenced

We removed two-way SMS from the MVP and made the product smartphone-first.

Farmers can register through the web app or through agent-assisted registration at the warehouse.

SMS is still used, but only as one-way notifications for important updates.

---

## 10. SMS Still Matters, But as a Notification Channel

Even though the product no longer depends on two-way SMS, SMS remains useful because it gives farmers quick updates without requiring them to constantly open the app.

Farmers need to receive important updates such as:

```text
Produce received
Receipt generated
Produce made available for sale
Produce reserved
Produce sold
Produce dispatched
Payment recorded
Storage fee reminder
Quality status changed
Issue raised
```

### Product Decision Influenced

We implemented one-way SMS notifications.

Instead of asking farmers to send commands such as JOIN, STATUS, YES, or NO, the system sends them important updates.

Where needed, the SMS can include a short link to open the related receipt or produce record in the app.

---

## 11. Buyers Needed Access to Verified Stock, Not Scattered Listings

The visits showed that buyers and traders need reliable access to produce, but the supply side must be organized first.

A simple marketplace with scattered farmer listings could still leave buyers uncertain about whether produce is real, available, properly graded, or ready for dispatch.

### Product Decision Influenced

We made buyers order from warehouse inventory instead of individual farmer listings.

The buyer sees grouped available stock, such as:

```text
Crop
Warehouse
Total quantity available
Grade breakdown
Price range
Delivery or pickup options
```

This gives buyers more confidence because the produce has already been received and recorded at the warehouse.

---

## 12. The Agent Role Became More Operational

The original agent role was mainly about helping farmers register and create produce listings.

The visits showed that agents need to be tied to the physical warehouse operation because that is where trust, verification, and records are created.

### Product Decision Influenced

We changed the agent role into a warehouse agent role.

Warehouse agents now handle:

```text
Farmer registration
Produce receiving
Weighing
Grading
Photo capture
Inventory batch creation
Receipt generation
Storage status updates
Sale and dispatch preparation
Dispute escalation
```

This makes the role more practical and easier to supervise.

---

## 13. The Product Needed Better Inventory and Fee Tracking

The warehouse model introduced new operational needs that were not fully covered by a normal listing marketplace.

The platform needed to track:

```text
Physical produce received
Quantity available
Quantity reserved
Quantity sold
Quantity withdrawn
Quantity spoiled
Storage duration
Storage fees
Sale deductions
Net farmer payout
Dispatch status
```

### Product Decision Influenced

We implemented inventory batches, storage fee ledgers, buyer orders, sale records, dispatch records, notifications, and audit logs.

This gives the platform a stronger operational backbone.

---

## 14. Audit Logs Became Necessary for Trust

Because warehouse agents handle physical goods and can update sensitive records, the system needs strong accountability.

Important actions must be traceable.

### Product Decision Influenced

We added audit logs for sensitive actions such as:

```text
Farmer registration
Produce intake
Quantity changes
Grade changes
Price changes
Storage fee calculation
Batch reservation
Sale completion
Spoilage marking
Withdrawal marking
Payment status changes
Dispatch status changes
Dispute creation
```

This protects farmers, buyers, agents, and the platform.

---

## 15. The MVP Became More Focused

The visits helped us reduce unnecessary complexity.

We decided not to build:

```text
Trader or farmer loans
Input credit
Two-way SMS registration
SMS approval replies
Complex credit scoring
Formal warehouse receipt financing
Full escrow
Native mobile app
Live GPS tracking
Advanced AI forecasting
Too many crop categories
```

Instead, the MVP focuses on the flow that directly solves the observed problems:

```text
Farmer registration
Warehouse setup
Warehouse agent dashboard
Produce intake
Inventory batch creation
Storage receipt generation
Daily storage fee calculation
Buyer order placement
Inventory reservation
Sale record creation
Dispatch tracking
One-way SMS notifications
Admin dashboard
Audit logs
```

---

## 16. Final Summary

The field visits taught us that the main problem is not just lack of digital connection between farmers and buyers.

The real problem is that farmers were carrying too much risk in the produce chain:

```text
They transported goods before demand was confirmed.
They paid high movement costs.
They faced poor road access.
They reached markets with weak bargaining power.
They could be pressured into delayed payment or informal produce credit.
They lacked clear records after handing over produce.
```

These learnings shaped the product decisions we implemented.

The platform now focuses on:

```text
Local warehouse storage
Verified produce inventory
Daily storage fee tracking
Digital produce receipts
Buyer orders from warehouse stock
Bulk dispatch from warehouse to destination
One-way SMS updates
Smartphone-first farmer access
Warehouse-agent operations
Audit-backed record keeping
```

The result is a product that does not only connect farmers and buyers. It gives structure, records, storage, and control to the produce trade process.
