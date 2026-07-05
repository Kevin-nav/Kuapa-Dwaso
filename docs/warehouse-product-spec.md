# Warehouse UI Requirements Summary

## 1. Main UI Areas Needed

The warehouse part needs UI for five main users:

1. Farmer
2. Warehouse Agent
3. Buyer
4. Admin
5. Transporter

The most important UI is for the warehouse agent because they handle produce intake, inventory updates, receipts, and dispatch preparation.

---

# 2. Warehouse Agent UI

The warehouse agent needs screens or flows for:

## Farmer Lookup / Registration

The agent should be able to:

* Search for an existing farmer
* Register a new farmer
* Confirm farmer name and phone number
* Select farmer’s community
* Link farmer to a preferred warehouse

## Produce Intake

The agent should be able to record produce brought to the warehouse.

The intake form should collect:

* Farmer
* Warehouse
* Crop type
* Variety, if needed
* Quantity
* Unit
* Grade
* Photos
* Condition notes
* Storage rate
* Asking price or target price, if used
* Expected shelf life or sell-by date

After intake, the system should create:

* Inventory batch
* Storage receipt
* SMS/app confirmation for the farmer

## Inventory Management

The agent should see warehouse inventory with:

* Crop
* Quantity received
* Quantity available
* Grade
* Farmer
* Date received
* Days stored
* Storage fee
* Current status

Inventory status options should include:

* Received
* Available
* Partially reserved
* Reserved
* Partially sold
* Sold
* Prepared for dispatch
* Dispatched
* Withdrawn
* Expired
* Spoiled
* Disputed

## Batch Details

Each inventory batch page should show:

* Batch ID / receipt code
* Farmer details
* Crop details
* Quantity received
* Quantity available
* Grade
* Photos
* Storage rate
* Current storage fee
* Current condition
* Status history
* Sale/reservation history
* Dispatch history, if any

The agent should be able to update:

* Condition
* Status
* Photos
* Notes

Sensitive changes such as quantity, grade, price, spoilage, withdrawal, or payment status should be logged.

## Dispatch Preparation

The agent should be able to:

* See orders ready for dispatch
* Select inventory batches for dispatch
* Mark goods as preparing
* Mark goods as ready for dispatch
* Link batches to a dispatch record
* Update dispatch status

---

# 3. Farmer UI

The farmer UI should be simple and mobile-first.

Main sections:

* My Produce
* My Receipts
* Storage Fees
* Sales
* Payments
* Warehouse Contact
* Report Issue

Each produce batch should show:

* Crop
* Quantity
* Grade
* Warehouse
* Date received
* Current status
* Days stored
* Storage fee
* Amount sold
* Amount remaining
* Expected payout
* Agent contact

The farmer should clearly understand:

* What produce they have stored
* Where it is stored
* How much storage fee has accrued
* Whether it has been sold or reserved
* What they are expected to receive after deductions

---

# 4. Buyer UI

The buyer UI should focus on available warehouse stock, not individual farmers.

Buyers should be able to:

* Browse available produce
* Search by crop
* Filter by grade
* Filter by warehouse/location
* Filter by quantity
* Filter by delivery or dispatch day
* Place an order
* Request delivery or pickup
* Track order status

Available stock cards/listings should show:

* Crop type
* Warehouse/location
* Total available quantity
* Grade
* Price or price range
* Delivery/dispatch availability

Buyer order statuses should include:

* Submitted
* Awaiting payment
* Confirmed
* Reserved
* Preparing
* Ready for dispatch
* In transit
* Delivered
* Completed
* Cancelled
* Disputed

The buyer should not see private farmer information.

---

# 5. Admin UI

The admin needs an overview of warehouse operations.

Admin dashboard should show:

* Total warehouses
* Total farmers
* Total agents
* Inventory by warehouse
* Inventory by crop
* Available stock
* Reserved stock
* Sold stock
* Spoiled stock
* Withdrawn stock
* Storage fees accrued
* Buyer orders
* Dispatches
* Disputes

Admin should also be able to manage:

* Warehouses
* Agents
* Farmer accounts
* Inventory records
* Buyer orders
* Dispatch records
* Disputes
* Storage fee rules

---

# 6. Transport / Dispatch UI

The dispatch UI should show:

* Dispatch ID
* Warehouse
* Destination
* Driver/contact
* Vehicle type
* Linked buyer orders
* Linked inventory batches
* Total quantity
* Departure time
* Expected arrival time
* Transport cost
* Transport payer
* Status

Dispatch statuses:

* Planned
* Loading
* Departed
* In transit
* Arrived
* Delivered
* Closed
* Cancelled
* Issue reported

---

# 7. Notifications Needed

The UI should support in-app notifications and one-way SMS for important updates.

Notification events:

* Produce received
* Receipt generated
* Produce available for sale
* Produce reserved
* Produce sold
* Produce dispatched
* Payment recorded
* Storage fee reminder
* Produce nearing expiry
* Quality status changed
* Issue raised

SMS should only inform the farmer. The system should not depend on SMS replies.

---

# 8. Key Records the UI Must Display

The UI needs to display and manage these records:

## Warehouse

* Name
* Code
* Community
* Served communities
* Assigned agents
* Supported crops
* Storage rates
* Operating days
* Dispatch days
* Status

## Farmer

* Name
* Phone number
* Community
* Preferred warehouse
* Verification status

## Inventory Batch

* Receipt code
* Farmer
* Warehouse
* Crop
* Quantity received
* Quantity available
* Unit
* Grade
* Photos
* Storage rate
* Storage fee
* Date received
* Condition
* Status

## Buyer Order

* Buyer
* Crop
* Quantity
* Grade
* Destination
* Matched inventory
* Payment status
* Order status

## Sale Record

* Inventory batch
* Quantity sold
* Gross amount
* Fees deducted
* Net amount due to farmer
* Payment status

## Dispatch

* Warehouse
* Destination
* Linked orders
* Linked batches
* Transport details
* Dispatch status

---

# 9. UI Rules to Keep in Mind

The UI should make these things clear:

* Produce belongs to the farmer while stored.
* Storage fee counts daily.
* Available quantity and received quantity are different.
* A batch can be partially sold or partially reserved.
* Buyers see warehouse stock, not farmer-private details.
* Farmers should always see fees, sale status, and expected payout.
* Agents need fast intake and inventory update flows.
* Admin needs full visibility across warehouses.
* Sensitive edits must be traceable through audit logs.
* Spoilage, withdrawal, payment issues, and disputes need clear status handling.

---

# 10. Core UI Flow to Build First

The first version of the warehouse UI should support this flow:

1. Agent registers or selects farmer.
2. Agent records produce intake.
3. System creates inventory batch.
4. System generates receipt.
5. Farmer sees receipt and produce status.
6. Buyer views available warehouse inventory.
7. Buyer places order.
8. System reserves inventory.
9. Agent prepares produce for dispatch.
10. Sale record is created.
11. Farmer sees quantity sold, fees deducted, and net payout.
12. Admin sees the whole activity in the dashboard.
