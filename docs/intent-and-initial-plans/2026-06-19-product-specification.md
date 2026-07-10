> **Historical planning document.** This document records the original marketplace concept from June 2026. The product is now warehouse-based. For the current public product description and scope, use the [product guide](../product/overview.md). Accepted ADRs and current implementation take precedence where this document differs.

# Farmer-to-Buyer Digital Marketplace Platform

## Product Specification Document

**Version:** 0.1
**Document Type:** Product Specification
**Project Focus:** Agent-assisted agricultural marketplace with bulk produce aggregation, SMS access, logistics coordination, and supply-demand intelligence.

---

## 1. Product Overview

The platform is a digital marketplace designed to connect farmers, buyers, agents, and transport providers in a more coordinated agricultural trade system.

The product is not just a simple listing website where farmers post produce and buyers browse. Instead, it uses local agents to help farmers join the platform, verify produce, group small farmer quantities into bulk supply lots, connect those bulk lots to buyers, and coordinate transport providers for delivery.

The platform will initially be built as a web application with low-bandwidth considerations. Farmers with smartphones will have access to a simplified farmer interface, while farmers without smartphones will interact with the platform through SMS using a long code.

---

## 2. Product Positioning

The platform should be positioned as:

> An agent-assisted, farmer-visible, bulk produce marketplace with logistics coordination and supply-demand intelligence.

The key value of the platform is that it connects agricultural supply, buyer demand, and transport coordination in one workflow.

The platform solves four major problems:

1. Small farmers often cannot individually attract large buyers.
2. Farmers may not have the digital access or literacy to manage online listings.
3. Buyers struggle to find trusted suppliers with enough quantity.
4. Transport coordination is often fragmented, expensive, and unreliable.

---

## 3. Target Users

### 3.1 Farmers

Farmers are the primary producers on the platform. Some farmers may have smartphones, while others may only have keypad phones.

Farmers should be able to:

* Register interest through SMS.
* Receive a Farmer ID.
* Be linked to an approved local agent.
* Receive SMS notifications when agents create or update important records.
* Approve or reject high-risk actions by replying to SMS.
* View their produce, deals, payments, and assigned agent if they use a smartphone.
* Report issues through SMS or the web app.

Farmers should not be expected to manage complex dashboards, upload images, negotiate all deals, or coordinate transport by themselves.

---

### 3.2 Field Agents

Field agents represent specific geographic areas and help bring offline or low-connectivity farmers into the digital system.

Agents should be able to:

* Apply to become platform agents.
* Be reviewed and approved by admins.
* Register farmers.
* Complete farmer profiles.
* Create produce listings.
* Upload produce images.
* Verify produce quantity and quality.
* Group produce into bulk lots.
* Support buyer negotiation.
* Request transport for agreed deals.
* Track farmer activity and deal progress.

Agents are important to the product, but their actions must be controlled through permissions, audit logs, SMS notifications, and farmer approval flows.

---

### 3.3 Buyers

Buyers include traders, retailers, restaurants, processors, exporters, and other bulk buyers.

Buyers should be able to:

* Register and create a buyer profile.
* Search available produce.
* Filter by crop, location, quantity, grade, price, and availability.
* View bulk lots instead of only individual farmer listings.
* Submit interest or make offers.
* Negotiate through the platform or through the assigned agent.
* Request platform-supported transport or arrange their own transport.
* Track deal and delivery status.
* View order history.

---

### 3.4 Transport Providers

Transport providers help move goods from farmers or aggregation points to buyers.

Transport providers should be able to:

* Register and create a transport profile.
* Add vehicle type, vehicle capacity, base location, and routes served.
* Receive transport requests.
* Accept or reject transport jobs.
* Update delivery status.
* Be rated by buyers, agents, or admins.

---

### 3.5 Admins

Admins manage the platform and monitor trust, verification, disputes, and system performance.

Admins should be able to:

* Approve or reject agent applications.
* Manage users.
* View platform activity.
* Monitor farmer, buyer, agent, and transporter actions.
* Review audit logs.
* Handle disputes.
* Suspend suspicious accounts.
* View supply and demand hotspot dashboards.
* Monitor transactions and logistics activity.

---

## 4. Access Channels

### 4.1 Web Application

The main platform will be a web application.

The web application will support:

* Public landing pages
* Buyer marketplace
* Agent dashboard
* Farmer smartphone view
* Transport provider dashboard
* Admin dashboard
* Agent application form

The application should be built with low-bandwidth discipline. Heavy maps, charts, and dashboards should only load when needed.

---

### 4.2 Farmer Smartphone View

Farmers with smartphones should have a very simple interface.

The farmer home screen should include:

* My Produce
* My Deals
* My Agent
* Payments
* Report Problem

The interface should use:

* Large buttons
* Simple language
* Minimal forms
* Low image usage
* Clear deal status
* SMS fallback for important actions

Farmers should not see the same complex dashboard used by agents or admins.

---

### 4.3 SMS Long Code Access

The platform will use an SMS long code instead of USSD or shortcode because USSD and shortcode rental costs can be expensive.

The SMS long code will allow keypad phone users to interact with the platform.

The SMS bot should support:

* Farmer pre-registration
* Status checks
* Agent contact retrieval
* Approval or rejection of important actions
* Issue reporting
* Help commands

Recommended SMS commands:

```text
JOIN     Start farmer registration
STATUS   Check produce or deal status
AGENT    Get assigned agent contact
YES      Approve latest pending action
NO       Reject latest pending action
ISSUE    Report a problem
HELP     Show available commands
```

The bot should also support simple numeric replies:

```text
1 = Approve
2 = Reject
3 = Status
4 = Agent
5 = Report issue
```

---

## 5. Farmer SMS Registration Flow

SMS registration should only collect basic details. It should not replace full agent verification.

Example flow:

```text
Farmer sends: JOIN

System replies:
Welcome. Reply with your full name.

Farmer replies:
Kwame Mensah

System replies:
Enter your community or nearest town.

Farmer replies:
Ejura

System replies:
What crop do you have?
1 Maize
2 Tomato
3 Pepper
4 Okra
5 Other

Farmer replies:
1

System replies:
Enter quantity. Example: 5 bags, 20 crates, 2 acres ready soon.

Farmer replies:
8 bags

System replies:
Registration received. Your Farmer ID is FM-EJU-2041.
An agent will contact you to complete verification.
```

The result of this flow should be a pending farmer lead that an agent must complete and verify.

---

## 6. Farmer Approval and Accountability

The platform should protect farmers from agent misuse by using SMS notifications, rejection options, approval flows, and audit logs.

Not every action should require approval. The approval system should be based on risk.

---

### 6.1 Notify Only

Used for low-risk actions.

Examples:

* Agent created farmer profile.
* Agent uploaded produce image.
* Agent updated general notes.
* Buyer viewed produce.
* Listing was added to a bulk lot.

The farmer receives SMS, but no reply is required.

---

### 6.2 Notify With Rejection Option

Used for medium-risk actions.

Examples:

* Agent updated produce quantity.
* Agent updated harvest date.
* Agent updated asking price.
* Agent updated produce grade.

Example SMS:

```text
Agent AG-EJU-003 updated your maize quantity to 8 bags.
If this is wrong, reply NO within 2 hours.
```

If the farmer does nothing, the update remains active. If the farmer replies NO, the change becomes disputed.

---

### 6.3 Approval Required

Used for high-risk actions.

Examples:

* Accepting a buyer’s offer.
* Marking goods as picked up.
* Marking payment as received.
* Changing final agreed price.
* Changing farmer phone number.
* Changing payment recipient details.
* Removing a farmer from a confirmed bulk lot.

Example SMS:

```text
APPROVAL NEEDED
Agent AG-EJU-003 wants to accept this deal:
Crop: Maize
Qty: 8 bags
Price: GHS 420/bag

Reply 1 to APPROVE.
Reply 2 to REJECT.
Code: A72K
```

High-risk actions should remain pending until the farmer approves.

---

## 7. Produce Listings

A produce listing represents produce from one farmer or one verified source.

Each produce listing should include:

* Farmer ID
* Agent ID
* Crop type
* Quantity
* Unit
* Grade
* Asking price
* Negotiable status
* Location/community
* Approximate pickup area
* Available from date
* Available until date
* Images
* Verification status
* Last verified time
* Listing status

Suggested listing statuses:

```text
draft
pending_verification
active
in_bulk_lot
reserved
sold
expired
disputed
cancelled
```

Perishable produce listings should expire quickly to avoid stale information.

Suggested expiry periods:

```text
Leafy greens: 24–48 hours
Tomatoes, pepper, okra: 48–72 hours
Non-perishable crops: longer expiry depending on storage
```

---

## 8. Bulk Lots / Produce Clusters

Bulk lots are the main buyer-facing supply units on the platform.

A bulk lot groups produce from multiple farmers in the same area or nearby communities.

Example:

```text
Ejura Maize Cluster
Crop: Maize
Total quantity: 70 bags
Farmers: 11
Verified by: AG-EJU-003
Pickup window: Friday–Saturday
Grade: Mixed Grade A/B
Location: Ejura area
```

Bulk lots help buyers access meaningful quantities and reduce transport inefficiency.

Bulk lots should include:

* Crop type
* Total quantity
* Unit
* Number of farmers
* Location area
* Pickup window
* Quality grade
* Price range or asking price
* Assigned agent
* Farmer contributions
* Status
* Transport readiness

Suggested bulk lot statuses:

```text
forming
active
buyer_interest
negotiation
reserved
transport_pending
in_transit
completed
cancelled
disputed
```

---

## 9. Buyer Marketplace Workflow

The buyer workflow should be:

1. Buyer registers or signs in.
2. Buyer searches for produce.
3. Buyer filters by crop, location, quantity, grade, price, and availability.
4. Buyer views bulk lot details.
5. Buyer submits interest or makes an offer.
6. Agent receives buyer interest.
7. Agent confirms availability.
8. Farmers receive SMS notifications or approval requests where needed.
9. Deal is created.
10. Transport request is created if needed.
11. Delivery status is tracked.
12. Deal is completed and recorded.

---

## 10. Pricing and Negotiation

The platform should support negotiation instead of forcing fixed checkout pricing only.

Each listing or bulk lot should support:

* Asking price
* Unit price
* Negotiable status
* Buyer offer
* Counteroffer
* Final agreed price

Suggested negotiation statuses:

```text
open
offer_received
countered
accepted_pending_farmer_approval
accepted
rejected
expired
cancelled
```

---

## 11. Payment Model

The platform will use Paystack for payment integration.

For the MVP, payments can support:

* Buyer commitment or deposit
* Full payment
* Payment status tracking
* Payment on delivery status
* Admin confirmation
* Farmer SMS notification

Full escrow and automated farmer payouts should not be required for the MVP unless there is enough time.

Suggested payment statuses:

```text
not_required
pending
deposit_paid
fully_paid
payment_on_delivery
released
failed
refunded
disputed
```

---

## 12. Transport Coordination

Transport coordination is a core product feature.

Transport providers should register with:

* Name
* Phone number
* Vehicle type
* Vehicle capacity
* Base location
* Routes served
* Availability
* Price estimate method
* Verification status
* Rating

Transport requests should include:

* Deal ID
* Crop
* Quantity
* Pickup location
* Destination
* Preferred pickup date
* Vehicle requirement
* Transport payer
* Status

Transport payer options:

```text
buyer_pays
seller_pays
shared
included_in_price
```

Transport statuses:

```text
requested
matched
accepted
at_pickup
picked_up
in_transit
delivered
cancelled
issue_reported
```

Live GPS tracking is not required for the MVP. Status-based delivery tracking is enough.

---

## 13. Supply and Demand Hotspots

The platform should include a dashboard that identifies supply and demand hotspots.

Supply hotspots are areas with high available produce.

Demand hotspots are areas where buyers are searching for or requesting produce.

The MVP can use simple scoring:

```text
Supply score = total available quantity of crop in an area
Demand score = buyer searches + requested quantity + active orders
Opportunity score = demand score - nearby supply score
```

The dashboard should show:

* Crop
* Region/community
* Available quantity
* Buyer demand
* Active orders
* Transport requests
* Opportunity areas

The hotspot feature should be explainable and easy to demo. Advanced AI is not required for the first version.

---

## 14. Notifications

The platform should use SMS and in-app notifications.

SMS should be used for:

* Farmer registration confirmation
* Farmer ID creation
* Agent assignment
* Listing creation
* Listing change alerts
* Buyer offer alerts
* Approval requests
* Pickup confirmation
* Payment confirmation
* Issue alerts

In-app notifications should be used for:

* Agents
* Buyers
* Transporters
* Admins
* Smartphone farmers

Africa’s Talking will be used for two-way conversational SMS and notification SMS through a long code.

---

## 15. MVP Scope

The MVP should focus on proving the full product workflow.

Must-have MVP features:

1. Farmer SMS pre-registration using a long code.
2. Agent application and admin approval.
3. Agent dashboard for farmer onboarding.
4. Farmer profile creation.
5. Produce listing creation.
6. Bulk lot creation.
7. Buyer search and offer flow.
8. Farmer SMS notification and approval for important actions.
9. Transport provider registration.
10. Transport request creation and status tracking.
11. Admin dashboard.
12. Basic supply and demand hotspot view.

Bonus MVP features:

1. Offline draft saving for agent forms.
2. Image compression before upload.
3. Transport cost estimate.
4. Rating and review system.
5. Map-based hotspot visualization.
6. Farmer smartphone view.
7. In-app notifications.

---

## 16. Demo Workflow

The final demo should show one complete journey:

```text
1. Farmer sends JOIN by SMS.
2. SMS bot creates a pending farmer lead.
3. Agent sees the pending farmer lead.
4. Agent completes farmer profile.
5. Agent creates produce listing.
6. Farmer receives SMS notification.
7. System groups produce into a bulk lot.
8. Buyer searches for produce.
9. Buyer submits an offer.
10. Agent reviews offer.
11. Farmer receives approval SMS.
12. Farmer replies 1 to approve.
13. Deal is accepted.
14. Transport request is created.
15. Transporter accepts delivery.
16. Delivery status is updated.
17. Admin dashboard shows supply/demand hotspot activity.
```

---

## 17. Open Product Questions

### Which region should the MVP focus on?

Suggested answer: Choose one strong supply region where the team can understand the farming and trading pattern.

Reason: A focused region makes the demo clearer and avoids trying to solve the entire country too early.

---

### Which crops should the MVP support first?

Suggested answer: Start with 2–3 crops, preferably tomatoes, pepper, and okra, or another crop group based on the selected region.

Reason: Too many crops will complicate pricing, units, quality grading, and hotspot analysis.

---

### Should payments be real or simulated for the demo?

Suggested answer: Use Paystack test mode for the prototype and show payment status tracking.

Reason: It proves the workflow without creating unnecessary financial risk during the MVP stage.

---

### Should farmer approval be required for every deal?

Suggested answer: Yes, for final deal acceptance, pickup confirmation, and payment confirmation.

Reason: These are high-risk actions where farmer protection matters most.

---

### Should buyers see individual farmer details?

Suggested answer: Not at first. Buyers should mainly see bulk lots and assigned agents.

Reason: This reduces complexity and helps prevent platform bypass.

---

### Should transport be mandatory for every deal?

Suggested answer: No. Transport should be optional but strongly supported.

Reason: Some buyers may already have transport, while others will need help finding transport providers.

---

## 18. Success Metrics

The MVP should be evaluated using these metrics:

* Number of farmers registered through SMS.
* Number of farmer profiles completed by agents.
* Number of active produce listings.
* Number of bulk lots created.
* Number of buyer searches.
* Number of buyer offers.
* Number of deals accepted.
* Number of transport requests created.
* Number of SMS approvals completed.
* Number of disputes raised.
* Average time from listing to buyer interest.
* Average time from deal acceptance to transport assignment.

---

## 19. Product Summary

The platform is designed to solve agricultural market access and logistics problems through a practical hybrid model.

The main strength of the product is that it respects the real-world conditions of farmers, buyers, agents, and transporters.

The MVP should prove that:

* Farmers can join without smartphones.
* Agents can help farmers get properly onboarded.
* Farmers remain informed and protected through SMS.
* Buyers can find bulk supply instead of scattered small listings.
* Transport can be coordinated after a deal.
* The platform can identify supply and demand hotspots.
* The system can scale from one region to other agricultural supply areas.

The recommended MVP story is:

> A farmer joins by SMS, an agent verifies and lists produce, the platform groups supply into a bulk lot, a buyer makes an offer, the farmer approves by SMS, and transport is coordinated to complete the deal.
