# Warehouse-Based Agricultural Produce Aggregation Platform

## Unified Product Direction and MVP Specification

**Version:** 0.4
**Document Type:** Consolidated Product Direction / MVP Product Specification
**Status:** Unified direction after market trader survey, farmer survey, and internal team discussion
**Previous Direction:** Farmer-to-buyer digital marketplace with SMS onboarding, produce listings, bulk lots, buyer offers, and transport coordination
**Current Direction:** Smartphone-first warehouse-based produce storage, inventory, sales, and distribution platform

---

## 1. Executive Summary

The platform is a smartphone-first agricultural produce aggregation system built around community warehouses.

Farmers bring produce to nearby community warehouses instead of transporting goods blindly to the city. Warehouse agents receive, weigh, grade, photograph, and record the produce into the platform. The produce is stored in the warehouse, storage fees are calculated per day, and buyers place orders from available warehouse inventory. When produce is sold or dispatched, farmers receive updates through the app and one-way SMS notifications.

The platform’s goal is to reduce unnecessary transport costs, reduce farmer exposure to unfair trader pressure, improve produce visibility, and give buyers access to verified warehouse stock.

The product is no longer only a farmer-to-buyer marketplace. It is a warehouse-based produce storage, inventory, sales, and distribution system.

---

## 2. Background and Market Findings

The original product idea was an agent-assisted agricultural marketplace connecting farmers, buyers, agents, and transport providers. It included farmer SMS onboarding, agent-assisted produce listings, bulk lots, buyer search, buyer offers, farmer SMS approvals, transport coordination, and supply-demand dashboards.

After speaking with market traders and farmers, the team discovered that the deeper problem is not only buyer access. The larger problem is the way produce moves from farms and villages to the city.

The market and farmer discussions revealed that:

```text
1. Many traders do not buy directly from farmers.
2. Traders often buy from second-chain buyers or intermediaries.
3. Farmers sometimes carry produce to the city without confirmed demand.
4. When farmers reach the city, traders may delay payment or pressure them to give produce on credit.
5. Farmers absorb transport cost, time loss, and unsold-produce risk.
6. Poor roads increase the cost of moving produce from farms to accessible loading points.
7. Produce may move through several transport stages before reaching the market.
8. Transport cost can increase the final selling price significantly.
9. Most farmers surveyed have smartphones or household access to smartphones.
10. Two-way SMS is therefore less necessary for MVP and may slow development.
```

A common transport chain observed from the first survey was:

```text
Farm / village
→ loading boys carry produce
→ tricycle moves produce to accessible loading point
→ truck moves produce to Tarkwa or another city market
→ trader buys or resells in market
```

The revised product direction uses warehouses to simplify this chain.

Instead of each farmer transporting produce to the city individually, farmers bring produce to a local warehouse. Trucks then move bulk quantities from the warehouse to buyers or destination markets based on actual orders.

---

## 3. Revised Product Positioning

The platform should be positioned as:

> A smartphone-first warehouse-based produce aggregation platform where farmers store produce at community warehouses, receive digital inventory records and SMS updates, and buyers purchase verified produce from available warehouse stock.

Simpler statement:

> We help farmers store and sell produce through local warehouses, while helping buyers access verified produce without forcing farmers to carry goods blindly to the city.

The product should help users answer:

```text
What produce is available?
Where is it stored?
Who owns it?
Who verified it?
How long has it been stored?
What storage fees have accrued?
What quantity is available for sale?
What has been reserved or sold?
How will it be dispatched?
What will the farmer receive after deductions?
```

---

## 4. Core Problem Being Solved

### 4.1 Old Market Flow

```text
Farmer harvests produce
→ Farmer pays to transport produce to the city
→ Farmer reaches market without guaranteed buyer
→ Trader negotiates aggressively or delays payment
→ Farmer may be forced to lend produce out
→ Farmer absorbs transport cost, payment risk, and spoilage risk
```

### 4.2 New Platform Flow

```text
Farmer harvests produce
→ Farmer brings produce to a local warehouse
→ Warehouse agent records and verifies produce
→ Produce is stored and made available for sale
→ Buyers place orders through the platform
→ Platform reserves matching warehouse inventory
→ Produce is dispatched to buyer or destination market
→ Farmer receives sale and payment update
```

This improves the system by giving farmers a local place to store produce, reducing unnecessary city transport, and creating better records around quantity, grade, storage duration, sale, fees, and payment.

---

## 5. Major Product Decisions

### 5.1 Warehouse-Based Storage Is the Core Model

The warehouse is now the center of the business model.

Farmers deposit produce into the warehouse. The warehouse stores the produce, and the platform tracks ownership, quantity, quality, storage duration, storage fees, sale status, and dispatch status.

Warehouses may serve one community or a group of nearby communities depending on supply volume, buyer demand, and transport routes.

---

### 5.2 No Credit or Loan System in the MVP

The platform will not provide loans or credit in the MVP.

The MVP will not include:

```text
Farmer loans
Trader loans
Input credit
Cash advances
Automatic credit scoring
Borrow-now-pay-later produce systems
```

Instead, the MVP will focus on:

```text
Produce storage
Inventory records
Warehouse receipts
Buyer orders
Sales records
Dispatch tracking
Storage fee calculation
Payment status tracking
Farmer notifications
```

Credit-like features can be considered later only after the platform has strong transaction history, operational trust, and possible licensed financial partners.

---

### 5.3 Smartphone-First Access Replaces Two-Way SMS Registration

The original product depended heavily on two-way SMS registration and SMS commands. The farmer survey showed that most farmers either own smartphones or have household access to one.

Because two-way SMS providers are difficult to secure and may slow development, the MVP will not depend on two-way SMS.

The new access model is:

```text
Farmers register through a smartphone web app or agent-assisted registration.
Warehouse agents use a web dashboard to record produce.
Farmers receive one-way SMS updates.
Farmers can open app links from SMS to view details.
Critical actions happen in-app or through the warehouse agent, not through SMS replies.
```

One-way SMS remains important, but only for notifications and updates.

---

### 5.4 Produce Is Sold From Warehouse Inventory

Buyers should not need to negotiate with every individual farmer. Buyers should browse or request produce from verified warehouse inventory.

The buyer sees grouped warehouse stock such as:

```text
Tomatoes available at Wassa Hub
Total available: 120 crates
Grade A: 50 crates
Grade B: 70 crates
Delivery to Tarkwa available on Friday
Price range: GHS ___ to GHS ___
```

The buyer does not need to see private farmer information.

---

## 6. Operating Model

The core operating model is:

```text
1. Farmer brings produce to the warehouse.
2. Warehouse agent receives the produce.
3. Agent weighs, grades, photographs, and records the produce.
4. System creates an inventory batch and storage receipt.
5. Farmer receives app/SMS confirmation.
6. Produce becomes available for sale.
7. Storage fee starts counting per day.
8. Buyer places order on the platform.
9. Platform reserves matching warehouse inventory.
10. Buyer confirms order or makes payment/deposit.
11. Warehouse agent prepares produce for dispatch.
12. Truck/transporter moves produce to buyer or destination market.
13. Farmer receives sale and payment update.
14. Admin monitors inventory, sales, storage fees, dispatches, and demand.
```

This gives the platform more operational control than a normal listing marketplace.

---

## 7. Warehouse Model

A warehouse is a physical storage and aggregation point where farmers deposit produce.

Each warehouse should have:

```text
Warehouse name
Warehouse code
Community or area served
Nearby communities served
Assigned warehouse agents
Storage capacity
Supported produce categories
Storage rate rules
Operating days
Dispatch days
Destination markets served
Inventory status
```

The warehouse should support:

```text
Produce intake
Produce weighing
Produce grading
Photo evidence
Storage fee calculation
Inventory lookup
Buyer order matching
Dispatch preparation
Unsold produce handling
Spoilage tracking
Farmer notifications
Admin reporting
```

The warehouse is not only a storage room. It is the platform’s physical trust point.

---

## 8. Warehouse Agent Role

The previous field-agent role should be replaced or refocused into:

> Warehouse Agent

Warehouse agents are responsible for the physical and digital handling of produce at the warehouse.

Warehouse agents should be able to:

```text
Register farmers
Verify farmer identity and phone number
Receive produce
Weigh produce
Grade produce
Take photos
Create inventory batches
Generate storage receipts
Set storage rate where allowed
Update produce condition
Mark produce as available, reserved, sold, dispatched, spoiled, or withdrawn
Assist farmers who do not use the app directly
Handle farmer questions
Escalate disputes to admin
```

Warehouse agents should not be able to secretly alter important records without audit logs.

Sensitive actions should be logged, including:

```text
Quantity changes
Grade changes
Price changes
Spoilage marks
Withdrawal marks
Sale completion
Payment status updates
Storage fee adjustments
```

---

## 9. Produce Ownership Model

The recommended MVP assumption is:

> The farmer owns the produce while it is stored in the warehouse. The platform stores and sells the produce on the farmer’s behalf.

This is closer to a consignment model.

The platform should not automatically buy all produce from farmers upfront. Buying all produce upfront would require much more capital and create higher risk.

The platform provides:

```text
Storage
Verification
Inventory visibility
Buyer access
Sales coordination
Dispatch coordination
Record keeping
Farmer updates
```

When produce is sold, the platform may deduct:

```text
Daily storage fee
Handling fee
Sales commission or markup
Transport cost, depending on agreement
Other agreed service charges
```

The commercial model must be explained clearly before farmers deposit produce.

---

## 10. Storage Fee Model

Farmers pay a daily storage fee for keeping produce in the warehouse. This prevents people from using the warehouse for free and helps pay for warehouse operations.

The fee can be calculated by:

```text
Crop type
Quantity
Unit
Storage duration
Storage type
Warehouse location
Special handling needs
```

Example:

```text
Crop: Tomatoes
Quantity: 10 crates
Storage rate: GHS 1.50 per crate per day
Days stored: 3
Current storage fee: GHS 45
```

Recommended fee handling:

```text
If produce is sold:
Storage fee is deducted from the farmer’s sale proceeds.

If farmer withdraws unsold produce:
Farmer pays outstanding storage fee before withdrawal.

If produce spoils due to farmer delay or natural shelf-life:
Storage fee and spoilage rules apply based on the warehouse agreement.

If produce spoils due to warehouse negligence:
Dispute process is triggered.
```

The farmer should always be able to see:

```text
Date received
Quantity received
Storage rate
Days stored
Current storage fee
Sale status
Net expected payout
```

This makes the fee transparent.

---

## 11. Inventory Batch

A produce listing should no longer be the main supply object. The main supply object should now be:

> Inventory Batch

An inventory batch represents produce physically received into a warehouse from a farmer.

Each inventory batch should include:

```text
Batch ID
Warehouse ID
Farmer ID
Crop type
Variety, if applicable
Quantity received
Quantity available
Unit
Grade
Photos
Date received
Received by agent
Storage rate
Storage fee accrued
Asking price or target price
Minimum acceptable price, if allowed
Expected shelf life
Sell-by date
Current condition
Status
```

Suggested inventory statuses:

```text
received
verified
available
partially_reserved
reserved
partially_sold
sold
prepared_for_dispatch
dispatched
withdrawn
expired
spoiled
disputed
```

This inventory batch model is more accurate than the previous produce listing model because it records produce that physically exists in the warehouse.

---

## 12. Produce Storage Receipt

When a farmer deposits produce, the platform should generate a produce storage receipt.

This receipt should be visible in the farmer’s app and sent by SMS as a summary.

Example receipt:

```text
Receipt ID: WH-TKW-000423
Farmer: Kojo Mensah
Warehouse: Wassa Hub 01
Crop: Tomatoes
Quantity: 10 crates
Grade: B
Date received: 4 July 2026
Storage rate: GHS 1.50 per crate/day
Status: Available for sale
```

The receipt should not initially be presented as a formal financial warehouse receipt. It should be treated as an internal produce storage and inventory receipt.

Recommended names:

```text
Produce Storage Receipt
Warehouse Intake Receipt
Inventory Receipt
```

---

## 13. Buyer Model

Buyer types may include:

```text
Market traders
Retailers
Restaurants
Hotels
Schools
Food processors
Exporters
Bulk buyers
Institutional buyers
```

Buyers should be able to:

```text
Create buyer account
Browse warehouse inventory
Search by crop, grade, location, quantity, and delivery day
Place an order
Request delivery
Pay deposit or full amount
Track order status
View dispatch updates
View order history
```

The buyer experience should focus on available stock and reliable fulfillment.

---

## 14. Buyer Order Flow

The buyer order flow should be:

```text
1. Buyer logs in.
2. Buyer searches available produce.
3. Buyer selects crop, quantity, grade, and delivery destination.
4. System checks available warehouse inventory.
5. System estimates price, fees, and transport options.
6. Buyer submits order.
7. Platform reserves matching inventory.
8. Buyer pays deposit, pays fully, or confirms payment arrangement.
9. Warehouse agent prepares produce.
10. Transport is assigned.
11. Order is dispatched.
12. Buyer receives produce.
13. Sale is completed.
14. Farmer receives sale update.
```

Suggested buyer order statuses:

```text
draft
submitted
awaiting_payment
confirmed
matched_to_inventory
reserved
preparing
ready_for_dispatch
in_transit
delivered
completed
cancelled
unfulfilled
disputed
```

---

## 15. Transport and Dispatch Model

The earlier survey showed that transport can involve multiple stages: loading boys, tricycles, and trucks. The warehouse model reduces much of this complexity by making the warehouse the main collection and dispatch point.

For MVP, the transport model should focus on:

```text
Farmer/community → warehouse
Warehouse → buyer or city destination
```

The warehouse-to-city leg should be the main dispatch flow.

A dispatch represents a planned movement of goods from a warehouse to one or more buyers.

Each dispatch should include:

```text
Dispatch ID
Warehouse ID
Destination
Transport provider
Vehicle type
Driver contact
Linked buyer orders
Linked inventory batches
Total quantity
Departure time
Expected arrival time
Transport cost
Transport payer
Status
```

Suggested dispatch statuses:

```text
planned
loading
departed
in_transit
arrived
delivered
closed
cancelled
issue_reported
```

Transport can still be optional if the buyer wants to pick up directly. However, the platform should strongly support warehouse-to-city dispatch because this is one of the main ways to reduce transport inefficiency.

---

## 16. Landed-Cost and Transport-Cost Intelligence

The platform should still keep the market-survey insight around landed cost.

Even though the warehouse model is now the main direction, buyers and admins should still understand the cost of getting produce from warehouse to destination.

Basic landed-cost formula:

```text
Landed Cost =
Produce Cost
+ Storage Fee
+ Handling Fee
+ Transport Cost
+ Service Fee / Markup
+ Loss or Spoilage Buffer, if applicable
```

For buyers, this can be shown simply as:

```text
Estimated cost per crate delivered to Tarkwa: GHS ___
Estimated transport share per crate: GHS ___
Estimated total order cost: GHS ___
```

For admin, the platform should build route-cost intelligence over time:

```text
Warehouse
Destination market
Crop type
Average transport cost
Average dispatch quantity
Average time to delivery
Spoilage or loss rate
Route reliability
```

This helps the platform decide where to open warehouses and which destination markets to serve.

---

## 17. Smartphone-First Farmer Experience

Farmers should not need a complex dashboard.

The farmer app should be simple and mobile-first.

Main farmer screens:

```text
My Produce
My Receipts
Storage Fees
Sales
Payments
Warehouse Contact
Report Issue
```

Each produce batch page should show:

```text
Crop
Quantity
Grade
Warehouse
Date received
Current status
Days stored
Storage fee
Amount sold
Amount remaining
Expected payout
Agent contact
```

The farmer should be able to understand the status of their produce without needing to call the agent every time.

---

## 18. One-Way SMS Notification Model

The MVP will use one-way SMS only.

SMS should be used for important updates such as:

```text
Produce received
Receipt generated
Produce made available for sale
Produce reserved
Produce sold
Produce dispatched
Payment recorded
Storage fee reminder
Produce nearing expiry
Quality status changed
Issue raised
```

Example SMS messages:

```text
Your 10 crates of tomatoes have been received at Wassa Hub.
Receipt: WH-0012. Status: Available for sale.
```

```text
5 crates from Receipt WH-0012 have been reserved by a buyer.
Open the app or contact your warehouse agent for details.
```

```text
Your produce has been stored for 4 days.
Current storage fee: GHS 60.
Receipt: WH-0012.
```

```text
Your tomatoes from Receipt WH-0012 have been sold.
Gross: GHS 1,800. Fees: GHS 90. Net: GHS 1,710.
```

Where possible, SMS messages can include short app links.

Example:

```text
View details: app.link/r/WH0012
```

The system should not depend on the farmer replying to SMS.

---

## 19. What Happens to Two-Way SMS?

Two-way SMS should be removed from the MVP scope.

The MVP should not build:

```text
SMS JOIN flow
SMS STATUS command
SMS AGENT command
SMS YES/NO approval replies
SMS state machine
SMS command parser
Two-way SMS approval workflow
```

These can be revisited later only if the team finds a reliable provider and strong user need.

For now, the replacement is:

```text
Smartphone registration
Agent-assisted registration
One-way SMS notifications
Simple farmer app links
Warehouse-agent support
```

This reduces technical complexity and keeps development realistic.

---

## 20. Admin Dashboard

The admin dashboard should monitor the full warehouse network.

Admin should see:

```text
Total farmers
Total warehouses
Total agents
Inventory by warehouse
Inventory by crop
Available stock
Reserved stock
Sold stock
Spoiled stock
Withdrawn stock
Storage fees accrued
Buyer orders
Dispatches
Revenue
Disputes
```

Admin should also see demand and supply intelligence:

```text
Which crops are most requested
Which warehouses have excess stock
Which crops are nearing spoilage
Which routes have regular dispatches
Which buyers order most frequently
Which farmers supply most frequently
Which produce types sell fastest
Which warehouses are underused
Which destination markets generate most demand
```

The previous hotspot dashboard should evolve from only supply-demand hotspots to warehouse and inventory intelligence.

---

## 21. Core MVP Modules

The MVP should include:

```text
1. Farmer registration
2. Warehouse setup
3. Warehouse agent dashboard
4. Produce intake
5. Inventory batch creation
6. Produce storage receipt generation
7. Daily storage fee calculation
8. Buyer marketplace
9. Buyer order placement
10. Inventory reservation
11. Sale record creation
12. Dispatch tracking
13. One-way SMS notifications
14. Admin dashboard
15. Audit logs
```

The MVP should not include:

```text
1. Trader or farmer loan system
2. Input credit
3. Two-way SMS registration
4. SMS approval replies
5. Complex credit scoring
6. Formal warehouse receipt financing
7. Full escrow
8. Native mobile app
9. Live GPS tracking
10. Multi-region expansion
11. Advanced AI forecasting
12. Too many crop categories
```

---

## 22. Updated User Roles

The platform should support these roles:

```text
farmer
warehouse_agent
buyer
transporter
admin
```

Future roles may include:

```text
input_supplier
industrial_buyer
verified_aggregator
warehouse_manager
finance_partner
```

These future roles should not distract from the MVP.

---

## 23. Updated Data Models

### 23.1 Warehouse

```ts
type Warehouse = {
  id: string
  code: string
  name: string
  community: string
  district?: string
  region?: string
  servedCommunities: string[]
  supportedCrops: string[]
  storageCapacity?: number
  capacityUnit?: string
  assignedAgentIds: string[]
  destinationMarketsServed: string[]
  operatingDays: string[]
  dispatchDays?: string[]
  status: "active" | "inactive" | "maintenance" | "closed"
  createdAt: number
  updatedAt: number
}
```

### 23.2 Farmer

```ts
type Farmer = {
  id: string
  fullName: string
  phoneNumber: string
  community: string
  householdPhoneOwnerName?: string
  preferredWarehouseId?: string
  registrationSource: "self_app" | "agent_assisted" | "admin"
  verificationStatus: "pending" | "verified" | "rejected"
  status: "active" | "suspended" | "deactivated"
  createdAt: number
  updatedAt: number
}
```

### 23.3 Warehouse Agent

```ts
type WarehouseAgent = {
  id: string
  userId: string
  fullName: string
  phoneNumber: string
  assignedWarehouseIds: string[]
  status: "pending" | "approved" | "suspended" | "deactivated"
  createdAt: number
  updatedAt: number
}
```

### 23.4 Inventory Batch

```ts
type InventoryBatch = {
  id: string
  receiptCode: string
  farmerId: string
  warehouseId: string
  receivedByAgentId: string

  cropType: string
  variety?: string
  quantityReceived: number
  quantityAvailable: number
  unit: string
  grade: "A" | "B" | "C" | "mixed" | "ungraded"

  photos: string[]
  conditionNotes?: string

  receivedAt: number
  expectedShelfLifeDays?: number
  sellByDate?: number

  storageRatePerUnitPerDay: number
  storageFeeAccrued: number
  lastFeeCalculatedAt: number

  askingPricePerUnit?: number
  minimumPricePerUnit?: number

  status:
    | "received"
    | "verified"
    | "available"
    | "partially_reserved"
    | "reserved"
    | "partially_sold"
    | "sold"
    | "prepared_for_dispatch"
    | "dispatched"
    | "withdrawn"
    | "expired"
    | "spoiled"
    | "disputed"

  createdAt: number
  updatedAt: number
}
```

### 23.5 Storage Fee Ledger

```ts
type StorageFeeLedger = {
  id: string
  inventoryBatchId: string
  farmerId: string
  warehouseId: string
  feeDate: number
  quantityCharged: number
  unit: string
  ratePerUnitPerDay: number
  amount: number
  status: "accrued" | "deducted_from_sale" | "paid" | "waived" | "disputed"
  createdAt: number
}
```

### 23.6 Buyer

```ts
type Buyer = {
  id: string
  fullName: string
  phoneNumber: string
  buyerType:
    | "market_trader"
    | "retailer"
    | "restaurant"
    | "hotel"
    | "school"
    | "processor"
    | "exporter"
    | "institution"
    | "other"
  destinationMarket?: string
  verificationStatus: "pending" | "verified" | "rejected"
  status: "active" | "suspended" | "deactivated"
  createdAt: number
  updatedAt: number
}
```

### 23.7 Buyer Order

```ts
type BuyerOrder = {
  id: string
  buyerId: string
  destinationMarket: string

  cropType: string
  requestedQuantity: number
  unit: string
  preferredGrade?: "A" | "B" | "C" | "mixed"

  requestedDeliveryDate?: number
  maxPricePerUnit?: number

  matchedInventoryBatchIds: string[]

  subtotalAmount?: number
  transportFee?: number
  serviceFee?: number
  totalAmount?: number

  paymentStatus:
    | "not_required"
    | "awaiting_payment"
    | "deposit_paid"
    | "fully_paid"
    | "payment_on_delivery"
    | "failed"
    | "refunded"
    | "disputed"

  status:
    | "draft"
    | "submitted"
    | "awaiting_payment"
    | "confirmed"
    | "matched_to_inventory"
    | "reserved"
    | "preparing"
    | "ready_for_dispatch"
    | "in_transit"
    | "delivered"
    | "completed"
    | "cancelled"
    | "unfulfilled"
    | "disputed"

  createdAt: number
  updatedAt: number
}
```

### 23.8 Sale Record

```ts
type SaleRecord = {
  id: string
  buyerOrderId: string
  inventoryBatchId: string
  farmerId: string
  warehouseId: string

  quantitySold: number
  unit: string
  pricePerUnit: number
  grossAmount: number

  storageFeeDeducted: number
  handlingFeeDeducted?: number
  commissionDeducted?: number
  transportFeeDeducted?: number

  netAmountDueToFarmer: number

  paymentStatus:
    | "pending"
    | "part_paid"
    | "paid"
    | "withheld"
    | "disputed"

  createdAt: number
  updatedAt: number
}
```

### 23.9 Dispatch

```ts
type Dispatch = {
  id: string
  warehouseId: string
  destination: string

  transporterId?: string
  driverName?: string
  driverPhoneNumber?: string
  vehicleType?: string
  vehicleCapacity?: number

  buyerOrderIds: string[]
  inventoryBatchIds: string[]

  totalQuantity: number
  unit: string

  plannedDepartureAt?: number
  departedAt?: number
  expectedArrivalAt?: number
  arrivedAt?: number

  transportCost?: number
  transportPayer: "buyer" | "farmer" | "platform" | "shared" | "included_in_price"

  status:
    | "planned"
    | "loading"
    | "departed"
    | "in_transit"
    | "arrived"
    | "delivered"
    | "closed"
    | "cancelled"
    | "issue_reported"

  createdAt: number
  updatedAt: number
}
```

### 23.10 Notification

```ts
type Notification = {
  id: string
  recipientId: string
  recipientRole: "farmer" | "buyer" | "warehouse_agent" | "admin" | "transporter"
  channel: "sms" | "in_app" | "email"
  title: string
  message: string
  relatedEntityType?: string
  relatedEntityId?: string
  status: "pending" | "sent" | "failed"
  createdAt: number
  sentAt?: number
}
```

### 23.11 Audit Log

```ts
type AuditLog = {
  id: string
  actorId: string
  actorRole: string
  action: string
  entityType: string
  entityId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  createdAt: number
}
```

Audit logs should be created for every important action.

Examples:

```text
Farmer registered
Warehouse created
Inventory batch received
Quantity updated
Grade updated
Price updated
Storage fee calculated
Batch reserved
Batch sold
Batch dispatched
Batch spoiled
Batch withdrawn
Buyer order created
Payment status changed
Dispatch status changed
Dispute created
```

---

## 24. Updated MVP Demo Story

The new demo should show this complete flow:

```text
1. A farmer brings 10 crates of tomatoes to the warehouse.
2. The warehouse agent logs into the dashboard.
3. The agent records the farmer, crop, quantity, grade, and photos.
4. The system creates an inventory batch.
5. The system generates a produce storage receipt.
6. The farmer receives a one-way SMS confirmation.
7. The storage fee starts counting per day.
8. A buyer searches for tomatoes on the platform.
9. The buyer places an order for 5 crates.
10. The platform reserves 5 crates from the warehouse inventory.
11. The buyer confirms payment or deposit.
12. The warehouse agent prepares the produce for dispatch.
13. A dispatch record is created.
14. The truck/transporter moves the produce to the buyer or destination market.
15. The farmer receives an SMS that part of the produce has been sold.
16. The system calculates gross sale, storage fee, deductions, and net amount due.
17. Admin dashboard shows inventory, sale, storage fees, and dispatch activity.
```

This demo is easier to explain than the old SMS JOIN flow and better reflects the actual market and farmer research.

---

## 25. Implementation Priorities

### Phase 1: Foundation

```text
Set up monorepo
Set up web app
Set up backend
Set up database
Set up authentication
Create roles and permissions
Create base dashboards
```

Roles:

```text
farmer
warehouse_agent
buyer
transporter
admin
```

---

### Phase 2: Warehouse and Farmer Setup

```text
Create warehouse model
Create warehouse dashboard
Create farmer registration
Create agent-assisted farmer onboarding
Create basic farmer smartphone view
```

---

### Phase 3: Produce Intake and Inventory

```text
Create produce intake form
Create inventory batch model
Create receipt generation
Add photo upload
Add grade and quantity fields
Add inventory statuses
Send one-way SMS receipt confirmation
```

---

### Phase 4: Storage Fee System

```text
Create storage rate rules
Calculate daily storage fee
Show accrued storage fee
Support fee deduction after sale
Support fee payment before withdrawal
Add storage fee ledger
```

---

### Phase 5: Buyer Marketplace and Orders

```text
Create buyer registration
Create buyer marketplace
Show warehouse inventory
Allow buyer to place order
Match order to inventory
Reserve inventory
Track buyer order status
```

---

### Phase 6: Sales, Payment Status, and Farmer Updates

```text
Create sale records
Calculate gross amount
Deduct storage fees
Calculate net farmer amount
Track payment status
Send SMS sale update to farmer
```

---

### Phase 7: Dispatch and Transport

```text
Create dispatch records
Assign transporter
Track dispatch status
Notify buyer/farmer/admin
Show dispatch status in dashboard
```

---

### Phase 8: Admin Dashboard and Reporting

```text
Show warehouse inventory
Show stock by crop
Show buyer orders
Show storage fees
Show sales
Show dispatches
Show disputes
Show basic supply-demand and route-cost intelligence
```

---

## 26. Updated Success Metrics

The MVP should be evaluated using:

```text
Number of farmers registered
Number of warehouses created
Number of produce batches received
Total quantity stored
Average storage duration
Storage fees accrued
Number of buyer orders
Quantity sold
Quantity unsold
Quantity spoiled
Number of dispatches completed
Average time from intake to sale
Average time from order to dispatch
Number of SMS notifications sent
Number of farmer disputes
Number of buyer disputes
Net value returned to farmers
Storage fee revenue
Dispatch revenue
Repeat buyer orders
Repeat farmer deposits
```

The most important validation question is:

> Can the platform help farmers store produce locally and sell through a controlled warehouse system instead of carrying produce blindly to the city?

---

## 27. Key Risks and Rules to Define

Before real operations, the team must define rules for:

```text
Who owns produce while stored
Who can set or change price
Who pays storage fee
When storage fee starts
How storage fee is deducted
What happens when produce is unsold
What happens when produce spoils
What happens when farmer withdraws produce
What happens when buyer cancels order
What happens when buyer delays payment
Who is responsible for quality loss
How disputes are handled
How warehouse agents are supervised
How storage conditions are monitored
How photos and evidence are captured
How sale deductions are explained
```

These rules should be written in simple farmer-friendly language.

---

## 28. Future Expansion

The MVP should stay focused on warehouse intake, storage, sales, and dispatch. However, the platform can later expand into:

```text
Input supplier partnerships
Bulk fertilizer and seed purchases
Industrial buyer contracts
Formal warehouse receipt financing
Partner-lender credit products
Crop insurance partnerships
Advanced demand forecasting
Route optimization
Cold storage management
Multi-warehouse network planning
```

These should not be built too early. They become stronger after the platform has real inventory, sales, storage, and dispatch data.

---

## 29. Product Summary

The revised product direction is:

> A smartphone-first warehouse-based produce aggregation platform where farmers deposit produce into community warehouses, receive digital storage receipts and one-way SMS updates, pay transparent daily storage fees, and sell to buyers through a controlled inventory and dispatch system.

This model is stronger than the original SMS-first marketplace because it gives the platform direct control over the physical produce chain.

The product now solves five major problems:

```text
1. Farmers no longer need to transport produce blindly to the city.
2. Produce is stored, verified, and tracked at a local warehouse.
3. Buyers can order from available warehouse inventory.
4. Farmers receive records and updates about their produce.
5. The platform earns through storage, handling, sales, and dispatch coordination.
```

The MVP should focus on proving the warehouse flow, not building every possible agricultural feature.

The main proof should be:

> A farmer deposits produce, the warehouse records it, a buyer orders it, the platform sells and dispatches it, and the farmer receives a clear update showing quantity sold, fees deducted, and net amount due.
