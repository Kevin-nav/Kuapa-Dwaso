# Implementation Plan and Milestones

## Farmer-to-Buyer Digital Marketplace Platform

**Version:** 0.1
**Goal:** Build a working MVP that demonstrates SMS farmer onboarding, agent-assisted produce listing, bulk lot creation, buyer offer flow, farmer SMS approval, transport coordination, and supply-demand hotspot dashboard.

---

## Timeline Strategy

The project should be implemented in phases. Each phase should produce a usable milestone, not just unfinished code.

The recommended approach is:

1. Build the core foundation.
2. Build the farmer-agent workflow.
3. Build the marketplace workflow.
4. Build logistics and approval flows.
5. Build dashboard and polish the demo.

The MVP should focus on showing the complete workflow clearly, even if some parts use test data or simplified logic.

---

# Phase 1: Foundation and Architecture Setup

**Target Duration:** 1–2 days
**Milestone:** The project structure, core services, and development workflow are ready.

## Tasks

* Set up monorepo.
* Set up Next.js web app.
* Set up custom API backend.
* Set up Convex.
* Set up Firebase Auth.
* Set up shared packages:

  * types
  * validators
  * permissions
  * sms-templates
  * config
  * utils
* Define core roles:

  * farmer
  * agent
  * buyer
  * transporter
  * admin
* Create base layouts:

  * public layout
  * agent dashboard layout
  * buyer layout
  * admin layout
* Define initial Convex schema.

## Output

* Working monorepo.
* Web app running.
* API backend running.
* Convex connected.
* Firebase Auth connected.
* Shared types and validators started.

## Success Criteria

* A developer can run the app locally.
* Users can sign in.
* Basic role-based routing works.
* Convex can store and fetch test data.

---

# Phase 2: Farmer SMS and Agent Onboarding

**Target Duration:** 2–3 days
**Milestone:** A farmer can register by SMS, and an agent can complete the farmer profile.

## Tasks

* Integrate Africa’s Talking long-code SMS webhook.
* Build SMS message parser.
* Build farmer SMS registration state machine.
* Support SMS commands:

  * JOIN
  * STATUS
  * AGENT
  * HELP
  * YES/NO or 1/2
* Create pending farmer lead from SMS.
* Generate Farmer ID.
* Build agent application form.
* Build admin approval for agents.
* Build agent dashboard.
* Allow agent to view pending farmer leads.
* Allow agent to complete farmer profile.
* Send SMS after agent completes profile.

## Output

* Farmer can send `JOIN`.
* System collects basic details by SMS.
* Farmer lead appears in agent/admin dashboard.
* Agent completes farmer profile.
* Farmer receives SMS confirmation.

## Success Criteria

* SMS registration works end-to-end.
* Farmer lead is saved in Convex.
* Agent can complete a farmer profile.
* Farmer receives a notification after completion.

---

# Phase 3: Produce Listings and Bulk Lots

**Target Duration:** 2–3 days
**Milestone:** Agents can create produce listings and group them into buyer-facing bulk lots.

## Tasks

* Build produce listing form.
* Add crop type, quantity, unit, grade, price, location, and availability.
* Add image upload or image placeholder for MVP.
* Add image compression if time allows.
* Build listing statuses:

  * draft
  * active
  * in_bulk_lot
  * expired
  * disputed
* Build bulk lot creation.
* Allow agent/admin to group listings by crop and area.
* Calculate total bulk lot quantity.
* Show number of farmers in a bulk lot.
* Send SMS notification when farmer produce is listed or added to a bulk lot.

## Output

* Agent can create produce listing.
* Agent/admin can create bulk lot.
* Buyer-facing bulk lot page exists.
* Farmer receives SMS notification.

## Success Criteria

* At least one bulk lot can be created from multiple farmer listings.
* Bulk lot shows total quantity, crop, grade, location, and pickup window.
* Farmer notification works.

---

# Phase 4: Buyer Marketplace and Offer Flow

**Target Duration:** 2–3 days
**Milestone:** Buyers can search bulk lots and submit offers.

## Tasks

* Build buyer registration/login flow.
* Build buyer marketplace page.
* Add filters:

  * crop
  * location
  * quantity
  * price
  * grade
* Build bulk lot detail page.
* Allow buyer to submit offer.
* Notify agent when buyer submits offer.
* Build offer statuses:

  * offer_received
  * countered
  * accepted_pending_farmer_approval
  * accepted
  * rejected
* Build simple negotiation/counteroffer flow if time allows.

## Output

* Buyer can search available produce.
* Buyer can view bulk lot.
* Buyer can submit offer.
* Agent sees buyer offer.

## Success Criteria

* Buyer can complete the search-to-offer flow.
* Agent can review buyer offer.
* Offer is stored and visible in dashboards.

---

# Phase 5: Farmer Approval System

**Target Duration:** 1–2 days
**Milestone:** High-risk agent actions require farmer SMS approval.

## Tasks

* Build approval request model.
* Generate approval code.
* Send SMS approval request to farmer.
* Support farmer reply:

  * 1 / YES = approve
  * 2 / NO = reject
* Lock action details after approval request is created.
* Apply action only after approval.
* Expire approval requests after set time.
* Store approval actions in audit logs.

## Output

* Agent can request farmer approval for deal acceptance.
* Farmer receives SMS.
* Farmer replies to approve or reject.
* Deal status updates based on farmer response.

## Success Criteria

* Deal cannot be accepted without required farmer approval.
* Approval and rejection both work.
* Audit log records the approval action.

---

# Phase 6: Transport Coordination

**Target Duration:** 2 days
**Milestone:** A deal can create a transport request and track delivery status.

## Tasks

* Build transporter registration.
* Add vehicle type, capacity, base location, and routes served.
* Build transport request creation from accepted deal.
* Add transport payer options:

  * buyer pays
  * seller pays
  * shared
  * included in price
* Build simple transporter matching.
* Build delivery statuses:

  * requested
  * accepted
  * at pickup
  * picked up
  * in transit
  * delivered
  * issue reported
* Notify relevant users when delivery status changes.

## Output

* Transport provider can register.
* Deal can create transport request.
* Transporter can accept request.
* Delivery status can be updated.

## Success Criteria

* Full deal-to-transport flow works.
* Delivery statuses are visible to buyer, agent, and admin.
* Farmer receives important SMS updates.

---

# Phase 7: Payments and Paystack Test Mode

**Target Duration:** 1–2 days
**Milestone:** Buyer can make a test payment or deposit, and the system tracks payment status.

## Tasks

* Integrate Paystack test payment initialization.
* Build backend endpoint for payment initialization.
* Build Paystack webhook handler.
* Verify payment on backend.
* Update deal payment status.
* Notify agent/admin/farmer after payment status changes.
* Add payment statuses:

  * pending
  * deposit_paid
  * fully_paid
  * payment_on_delivery
  * failed
  * disputed

## Output

* Buyer can initiate test payment.
* Backend verifies payment.
* Deal payment status updates.

## Success Criteria

* Payment flow works in test mode.
* Payment status is not updated by frontend alone.
* Payment event is logged.

---

# Phase 8: Admin Dashboard and Hotspot Intelligence

**Target Duration:** 2 days
**Milestone:** Admin can monitor platform activity and view supply-demand hotspots.

## Tasks

* Build admin dashboard overview.
* Show counts:

  * farmers
  * agents
  * listings
  * bulk lots
  * buyer offers
  * deals
  * transport requests
* Build audit log view.
* Build dispute view.
* Build basic hotspot scoring:

  * supply score
  * demand score
  * opportunity score
* Show hotspot table by crop and area.
* Add map visualization if time allows.

## Output

* Admin dashboard works.
* Hotspot dashboard works.
* Audit logs are visible.

## Success Criteria

* Admin can understand what is happening on the platform.
* Hotspot feature can be explained and demoed.
* Platform activity is visible in one place.

---

# Phase 9: Low-Bandwidth, Offline, and Demo Polish

**Target Duration:** 2–3 days
**Milestone:** The MVP is stable, presentable, and ready for demo.

## Tasks

* Simplify farmer smartphone pages.
* Compress images before upload.
* Lazy-load maps and charts.
* Add loading states.
* Add empty states.
* Add error states.
* Add sample demo data.
* Add offline draft saving for agent forms if time allows.
* Test on mobile screen sizes.
* Test SMS flow repeatedly.
* Prepare final demo script.
* Prepare presentation screenshots.

## Output

* Polished MVP.
* Demo data loaded.
* Complete demo workflow ready.
* Known issues documented.

## Success Criteria

* Team can complete the demo without manual database editing.
* SMS flow works reliably.
* Main user journeys are understandable.
* UI is clean enough for judging.

---

# Suggested Overall Timeline

## Fast Competition Timeline: 10–12 Days

| Phase                           | Target Duration |
| ------------------------------- | --------------: |
| Phase 1: Foundation             |        1–2 days |
| Phase 2: SMS + Agent Onboarding |        2–3 days |
| Phase 3: Listings + Bulk Lots   |        2–3 days |
| Phase 4: Buyer Marketplace      |        2–3 days |
| Phase 5: Farmer Approval        |        1–2 days |
| Phase 6: Transport              |          2 days |
| Phase 7: Payments               |        1–2 days |
| Phase 8: Dashboard + Hotspots   |          2 days |
| Phase 9: Polish                 |        2–3 days |

Some phases should run in parallel.

---

# Parallel Workstreams

## Team A: Frontend

Responsible for:

* Public pages
* Agent dashboard
* Buyer marketplace
* Transport dashboard
* Admin dashboard
* Farmer smartphone view
* UI components

## Team B: Backend and Integrations

Responsible for:

* Custom API backend
* Africa’s Talking SMS webhooks
* SMS state machine
* Paystack webhooks
* Firebase token verification
* Approval processing

## Team C: Convex and Data Models

Responsible for:

* Convex schema
* Core functions
* Queries/mutations
* Audit logs
* Permissions
* Hotspot calculations

## Team D: Product, Demo, and Testing

Responsible for:

* Demo script
* Test data
* User flow testing
* SMS message wording
* Presentation screenshots
* Edge case documentation

---

# Recommended Build Order

The most important build order is:

```text id="r27icq"
1. Auth + roles
2. SMS farmer registration
3. Agent completes farmer profile
4. Agent creates listing
5. Bulk lot is created
6. Buyer searches and makes offer
7. Farmer approves offer by SMS
8. Transport request is created
9. Delivery status is updated
10. Admin dashboard shows activity and hotspots
```

This order protects the demo story.

---

# Major Milestones

## Milestone 1: Platform Foundation Complete

The team can sign in, access role-based pages, and store data in Convex.

## Milestone 2: Farmer-Agent Flow Complete

A farmer can register by SMS, and an agent can complete their profile.

## Milestone 3: Supply Creation Complete

Agents can create produce listings and group them into bulk lots.

## Milestone 4: Buyer Flow Complete

Buyers can search bulk lots and submit offers.

## Milestone 5: Farmer Approval Complete

Farmers can approve or reject sensitive actions by SMS.

## Milestone 6: Logistics Flow Complete

Transport providers can receive and update delivery requests.

## Milestone 7: Payment Tracking Complete

Paystack test payment flow works and updates payment status.

## Milestone 8: Admin Intelligence Complete

Admin can view activity, audit logs, and supply-demand hotspots.

## Milestone 9: Demo Ready

The full workflow works smoothly with demo data and prepared presentation flow.

---

# Scope Control

The team should avoid building these too early:

* Full native mobile app
* Live GPS tracking
* Full escrow and automated farmer payout
* Complex AI prediction
* Full WhatsApp integration
* Multi-region expansion
* Advanced crop grading system
* Too many crop categories
* Too many user settings

These can be future features.

For the MVP, the priority is to prove the main workflow clearly.

---

# Final MVP Demo Story

The final demo should show:

```text id="d41eyn"
A farmer sends JOIN by SMS.
The SMS bot creates a farmer lead.
An agent completes the farmer profile.
The agent creates a produce listing.
The system groups listings into a bulk lot.
A buyer searches and submits an offer.
The farmer approves the offer by SMS.
A transport request is created.
A transporter accepts and updates delivery status.
The admin dashboard shows supply, demand, transport, and hotspot activity.
```

This demo shows the platform’s strongest value: accessibility, trust, aggregation, logistics, and market intelligence.
