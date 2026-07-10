> **Historical planning document.** This document predates the warehouse-domain reset and contains retired marketplace and two-way-SMS concepts. For the current architecture, use the [technical overview](../technical/architecture.md) and accepted ADRs.

# Farmer-to-Buyer Digital Marketplace Platform

## Technical Specification Document

**Version:** 0.1
**Document Type:** Technical Specification
**System Type:** Web-based agricultural marketplace with custom API backend, Convex database layer, Firebase Auth, Paystack payments, and Africa’s Talking SMS integration.

---

## 1. Technical Overview

The platform will be built as a typed, modular web application supported by a custom API backend, Convex database layer, Firebase authentication, Paystack payments, and Africa’s Talking SMS services.

The system must support:

* Farmer SMS pre-registration.
* Agent-assisted farmer onboarding.
* Produce listing creation.
* Bulk produce lot creation.
* Buyer search and offer flow.
* Farmer SMS approval for sensitive actions.
* Transport request and delivery tracking.
* Supply and demand hotspot dashboard.
* Admin monitoring and dispute management.

The technical architecture should prioritize:

* Type safety
* Low-bandwidth access
* Clear separation of concerns
* Auditability
* Role-based permissions
* Extensibility
* Integration reliability

---

## 2. High-Level Architecture

```text
Farmer Keypad Phone
        |
        | SMS: JOIN / STATUS / YES / NO / ISSUE
        v
Africa’s Talking Long Code
        |
        v
Custom API Backend
        |
        | SMS bot logic
        | Paystack webhooks
        | Firebase token verification
        | Approval processing
        | Matching jobs
        v
Convex Database / Realtime Layer
        ^
        |
Next.js PWA Frontend
        |
        | Buyer Marketplace
        | Agent Dashboard
        | Farmer Smartphone View
        | Transport Dashboard
        | Admin Dashboard
```

---

## 3. Core Technology Stack

### Frontend

Recommended stack:

```text
Next.js
TypeScript
PWA support
Reusable component system
Low-bandwidth-first page design
```

The frontend should avoid unnecessary client-side JavaScript. Server-rendered or statically rendered pages should be used where possible.

Heavy components such as maps, charts, and analytics should only load inside relevant dashboards.

---

### Database and Realtime Layer

Recommended:

```text
Convex
```

Convex will store core application data and support real-time workflows.

Core data stored in Convex:

* Users
* Farmers
* Agents
* Buyers
* Transporters
* Produce listings
* Bulk lots
* Deals
* Transport requests
* SMS conversations
* Approval requests
* Notifications
* Audit logs
* Disputes

---

### Custom API Backend

The custom API backend will handle integrations and sensitive workflows.

The API backend should handle:

* Africa’s Talking inbound SMS webhooks
* Africa’s Talking outbound SMS sending
* SMS bot state machine processing
* Paystack payment initialization and webhooks
* Firebase token verification
* Sensitive approval processing
* Scheduled jobs
* External integrations
* Matching and hotspot jobs where needed

---

### Authentication

Recommended:

```text
Firebase Auth
```

Firebase should be treated as the identity provider only.

The platform’s internal roles and permissions should live in the application database.

Suggested authentication model:

```text
Farmers without smartphones:
SMS registration + Farmer ID + agent-assisted profile

Farmers with smartphones:
Firebase phone number login

Agents:
Google sign-in + application form + admin approval

Buyers:
Phone login, Google login, or email login

Transporters:
Phone login + profile verification

Admins:
Google sign-in only, restricted by allowlist
```

---

### Payments

Recommended:

```text
Paystack
```

Paystack will be used for:

* Buyer deposits
* Full payments
* Payment verification
* Payment status tracking
* Payment webhook events

The platform should not trust frontend payment success alone. Payment verification should happen through the backend.

---

### SMS Provider

Recommended:

```text
Africa’s Talking
```

Africa’s Talking will be used for:

* Long-code SMS bot
* Two-way farmer communication
* Transactional notifications
* Approval request messages
* Delivery reports where available

---

## 4. Monorepo Structure

The project should be organized as a fully typed monorepo.

Suggested structure:

```text
apps/
  web/
  api/

packages/
  ui/
  types/
  validators/
  permissions/
  sms-flows/
  sms-parser/
  sms-templates/
  config/
  utils/

convex/
  schema.ts
  users.ts
  farmers.ts
  agents.ts
  buyers.ts
  transporters.ts
  listings.ts
  bulkLots.ts
  deals.ts
  transport.ts
  approvals.ts
  smsConversations.ts
  notifications.ts
  auditLogs.ts
  disputes.ts
```

---

## 5. Shared Packages

### packages/ui

Contains reusable UI components used across the frontend.

Examples:

* Button
* Input
* Modal
* Card
* StatusBadge
* DataTable
* Form components
* Dashboard layout components

---

### packages/types

Contains shared TypeScript types used by the web app, API backend, and Convex functions.

Examples:

* UserRole
* FarmerStatus
* ListingStatus
* DealStatus
* TransportStatus
* ApprovalStatus

---

### packages/validators

Contains shared validation schemas.

Recommended tool:

```text
Zod
```

Schemas should be created for:

* Farmer registration
* Agent application
* Produce listing
* Bulk lot
* Buyer offer
* Deal creation
* Transport request
* SMS webhook payload
* Paystack webhook payload
* Approval request

The same validation rules should be reused across frontend forms, backend endpoints, and Convex functions where possible.

---

### packages/permissions

Contains role-based permission logic.

Examples:

```text
canCreateFarmerProfile
canUpdateProduceListing
canAcceptDeal
canMarkPaymentReceived
canApproveAgent
canViewAuditLogs
canAssignTransporter
```

The goal is to avoid scattering permission logic across multiple parts of the codebase.

---

### packages/sms-flows

Contains SMS bot state machines.

SMS flows should include:

* Farmer registration flow
* Farmer status flow
* Agent contact flow
* Approval response flow
* Issue reporting flow
* Help flow

SMS should be treated as asynchronous. A farmer may reply after minutes, hours, or the next day, so flow state must be stored.

---

### packages/sms-parser

Contains message normalization and command parsing.

The parser should handle:

* Uppercase and lowercase messages
* Extra spaces
* Numeric commands
* Text commands
* Simple spelling variations where possible

Supported commands:

```text
JOIN
STATUS
AGENT
YES
NO
ISSUE
HELP
1
2
3
4
5
```

---

### packages/sms-templates

Contains standardized SMS message templates.

Templates should include:

* Farmer registration confirmation
* Farmer ID creation
* Agent assignment
* Listing created
* Listing updated
* Deal offer received
* Approval required
* Pickup marked
* Payment confirmation
* Issue received
* Help response

SMS messages should be short, clear, and action-focused.

---

### packages/config

Contains shared constants.

Examples:

* Supported crops
* Regions and communities
* Produce units
* Quality grades
* Listing expiry rules
* Approval expiry rules
* Deal statuses
* Transport statuses

---

### packages/utils

Contains shared helper functions.

Examples:

* Generate Farmer ID
* Generate Agent ID
* Generate approval code
* Format phone number
* Format currency
* Calculate listing expiry
* Calculate hotspot scores

---

## 6. Core Data Models

### 6.1 User

```ts
type User = {
  id: string
  authProviderId?: string
  phoneNumber?: string
  email?: string
  name: string
  role: "farmer" | "agent" | "buyer" | "transporter" | "admin"
  status: "pending" | "active" | "suspended" | "rejected" | "deactivated"
  createdAt: number
  updatedAt: number
}
```

---

### 6.2 Farmer

```ts
type Farmer = {
  id: string
  userId?: string
  farmerCode: string
  fullName: string
  phoneNumber: string
  community: string
  region?: string
  assignedAgentId?: string
  registrationSource: "sms" | "agent" | "web"
  verificationStatus: "pending" | "verified" | "rejected"
  createdAt: number
  updatedAt: number
}
```

---

### 6.3 Agent

```ts
type Agent = {
  id: string
  userId: string
  agentCode: string
  fullName: string
  phoneNumber: string
  operatingAreas: string[]
  status: "pending" | "approved" | "rejected" | "suspended"
  approvedBy?: string
  approvedAt?: number
  createdAt: number
  updatedAt: number
}
```

---

### 6.4 Produce Listing

```ts
type ProduceListing = {
  id: string
  farmerId: string
  agentId: string
  cropType: string
  quantity: number
  unit: string
  grade: "A" | "B" | "C" | "mixed"
  askingPrice?: number
  negotiable: boolean
  locationArea: string
  availableFrom: number
  availableUntil: number
  images: string[]
  status:
    | "draft"
    | "pending_verification"
    | "active"
    | "in_bulk_lot"
    | "reserved"
    | "sold"
    | "expired"
    | "disputed"
    | "cancelled"
  lastVerifiedAt?: number
  createdAt: number
  updatedAt: number
}
```

---

### 6.5 Bulk Lot

```ts
type BulkLot = {
  id: string
  cropType: string
  locationArea: string
  totalQuantity: number
  unit: string
  farmerCount: number
  listingIds: string[]
  agentId: string
  grade: "A" | "B" | "C" | "mixed"
  priceRange?: {
    min: number
    max: number
  }
  pickupWindowStart: number
  pickupWindowEnd: number
  status:
    | "forming"
    | "active"
    | "buyer_interest"
    | "negotiation"
    | "reserved"
    | "transport_pending"
    | "in_transit"
    | "completed"
    | "cancelled"
    | "disputed"
  createdAt: number
  updatedAt: number
}
```

---

### 6.6 Deal

```ts
type Deal = {
  id: string
  buyerId: string
  bulkLotId: string
  agentId: string
  cropType: string
  quantity: number
  unit: string
  finalPricePerUnit?: number
  totalAmount?: number
  status:
    | "offer_received"
    | "countered"
    | "accepted_pending_farmer_approval"
    | "accepted"
    | "transport_pending"
    | "in_transit"
    | "delivered"
    | "completed"
    | "cancelled"
    | "disputed"
  paymentStatus:
    | "not_required"
    | "pending"
    | "deposit_paid"
    | "fully_paid"
    | "payment_on_delivery"
    | "released"
    | "failed"
    | "refunded"
    | "disputed"
  createdAt: number
  updatedAt: number
}
```

---

### 6.7 Transport Provider

```ts
type TransportProvider = {
  id: string
  userId: string
  fullName: string
  phoneNumber: string
  vehicleType: string
  vehicleCapacity: number
  capacityUnit: string
  baseLocation: string
  routesServed: string[]
  verificationStatus: "pending" | "verified" | "rejected"
  rating?: number
  createdAt: number
  updatedAt: number
}
```

---

### 6.8 Transport Request

```ts
type TransportRequest = {
  id: string
  dealId: string
  pickupLocation: string
  destination: string
  requiredCapacity: number
  unit: string
  preferredPickupDate: number
  transportPayer: "buyer_pays" | "seller_pays" | "shared" | "included_in_price"
  assignedTransporterId?: string
  status:
    | "requested"
    | "matched"
    | "accepted"
    | "at_pickup"
    | "picked_up"
    | "in_transit"
    | "delivered"
    | "cancelled"
    | "issue_reported"
  createdAt: number
  updatedAt: number
}
```

---

### 6.9 Approval Request

```ts
type ApprovalRequest = {
  id: string
  code: string
  farmerId: string
  requestedByAgentId: string
  actionType:
    | "ACCEPT_DEAL"
    | "MARK_PICKED_UP"
    | "CONFIRM_PAYMENT"
    | "CHANGE_PRICE"
    | "CHANGE_PHONE"
    | "REMOVE_FROM_BULK_LOT"
  status: "pending" | "approved" | "rejected" | "expired"
  summary: string
  payload: Record<string, unknown>
  expiresAt: number
  createdAt: number
  respondedAt?: number
}
```

---

### 6.10 SMS Conversation

```ts
type SmsConversation = {
  id: string
  phoneNumber: string
  farmerId?: string
  currentFlow:
    | "none"
    | "farmer_registration"
    | "status_check"
    | "approval_response"
    | "issue_report"
  currentStep?: string
  temporaryAnswers?: Record<string, unknown>
  lastMessageAt: number
  createdAt: number
  updatedAt: number
}
```

---

### 6.11 Audit Log

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

---

## 7. SMS Bot Technical Flow

### 7.1 Inbound SMS Flow

```text
1. Farmer sends SMS to long code.
2. Africa’s Talking sends webhook to API backend.
3. Backend validates webhook payload.
4. Backend normalizes phone number and message.
5. Backend checks existing SMS conversation state.
6. Backend routes message to the correct SMS flow.
7. Flow updates temporary answers or creates records.
8. Backend stores updates in Convex.
9. Backend sends reply SMS through Africa’s Talking.
10. Audit log is created where needed.
```

---

### 7.2 SMS State Machine

SMS registration states:

```text
START
ASK_NAME
ASK_COMMUNITY
ASK_CROP
ASK_QUANTITY
CONFIRM_DETAILS
COMPLETED
CANCELLED
```

The state machine should support:

* Restarting a flow
* Cancelling a flow
* Resuming incomplete registration
* Handling unknown replies
* Expiring stale sessions
* Escalating issues to agents/admins

---

### 7.3 Approval Response Flow

```text
1. Agent performs sensitive action.
2. Backend creates ApprovalRequest.
3. SMS is sent to farmer with approval code.
4. Farmer replies 1, 2, YES, or NO.
5. Backend identifies pending approval.
6. Backend verifies farmer phone number.
7. Backend updates approval status.
8. If approved, backend applies locked action payload.
9. If rejected, backend marks action as rejected or disputed.
10. Agent dashboard and audit logs update.
```

---

## 8. Permission Model

Platform roles:

```text
farmer
agent
buyer
transporter
admin
```

Permissions should be centralized in the shared permissions package.

Agents can:

* Create farmer profiles.
* Complete farmer profile details.
* Create produce listings.
* Upload produce images.
* Update availability.
* Add farmers to bulk lots.
* Help negotiate buyer offers.
* Create transport requests.
* View assigned farmers and listings.

Agents should not freely:

* Change farmer phone number.
* Delete farmer history.
* Mark payment completed.
* Accept high-risk deals without approval.
* Change payment recipient details.
* Transfer farmer ownership to another agent.
* Suspend farmers.
* Delete audit logs.

Admins should have the highest permission level, but sensitive admin actions should still be logged.

---

## 9. Audit Logging

Every important platform action should create an audit log.

Actions to log include:

* Farmer created
* Farmer updated
* Agent approved
* Listing created
* Listing updated
* Bulk lot created
* Buyer offer submitted
* Deal accepted
* Approval request created
* Approval approved
* Approval rejected
* Transport request created
* Delivery status changed
* Payment status changed
* Dispute created
* User suspended

Audit logs should store:

* Actor
* Actor role
* Action
* Entity type
* Entity ID
* Before state
* After state
* Timestamp

Audit logs should not be editable by normal users.

---

## 10. Payment Technical Flow

### 10.1 Payment Initialization

```text
1. Buyer chooses deposit or full payment.
2. Frontend requests payment initialization from API backend.
3. Backend validates buyer, deal, and amount.
4. Backend initializes payment with Paystack.
5. Backend returns payment authorization URL or reference.
6. Buyer completes payment.
```

---

### 10.2 Payment Verification

```text
1. Paystack sends webhook to API backend.
2. Backend verifies webhook authenticity.
3. Backend checks transaction reference.
4. Backend updates payment status.
5. Convex records are updated.
6. Farmer, agent, buyer, and admin receive notifications where needed.
7. Audit log is created.
```

The system should not rely only on frontend redirect success.

---

## 11. Transport Matching Logic

Transport matching can start simple.

Recommended matching factors:

* Pickup location
* Destination
* Vehicle capacity
* Routes served
* Transporter availability
* Transporter verification status
* Rating

MVP matching can use rule-based filtering:

```text
1. Transporter is verified.
2. Transporter serves pickup or destination area.
3. Vehicle capacity is enough for the load.
4. Transporter is available for pickup date.
5. Transporter is ranked by proximity and rating.
```

Live GPS tracking is not required for the MVP.

---

## 12. Hotspot Scoring

The platform should include basic supply and demand scoring.

Supply score:

```text
Total available quantity of a crop in an area
```

Demand score:

```text
Buyer searches + requested quantity + active orders
```

Opportunity score:

```text
Demand score - nearby supply score
```

The hotspot system should be explainable, not overly complex.

Hotspot dashboard should show:

* Crop
* Area
* Supply score
* Demand score
* Opportunity score
* Active listings
* Active buyer requests
* Active transport requests

---

## 13. Low-Bandwidth and Offline Considerations

The frontend should be designed for low-bandwidth usage.

Recommended practices:

* Avoid unnecessary client-side JavaScript.
* Compress images before upload.
* Use simple list views before maps.
* Lazy-load maps and charts.
* Keep farmer smartphone pages simple.
* Cache key pages with PWA support.
* Allow agents to save form drafts offline.
* Sync saved drafts when network returns.

Offline support should focus first on agent forms:

* Farmer profile draft
* Produce listing draft
* Produce image draft
* Verification notes

Full offline marketplace functionality is not required for the MVP.

---

## 14. Security Considerations

The system should include:

* Firebase token verification on protected API requests.
* Role-based access checks.
* Admin allowlist for admin access.
* SMS webhook validation.
* Paystack webhook verification.
* Rate limiting on SMS endpoints.
* Rate limiting on public forms.
* Audit logs for sensitive actions.
* Farmer approval for high-risk agent actions.
* Restricted access to exact farmer location.
* Secure handling of payment references.

Exact farmer/farm locations should not be public. Buyers should initially see approximate areas or communities.

---

## 15. Notification System

Notification channels:

```text
SMS
In-app notifications
Email, optional later
WhatsApp, optional later
```

SMS should be used for farmers and critical events.

In-app notifications should be used for agents, buyers, transporters, admins, and smartphone farmers.

Notification events:

* Farmer registration received
* Farmer profile completed
* Agent assigned
* Listing created
* Listing updated
* Buyer offer received
* Approval required
* Approval approved
* Approval rejected
* Transport request created
* Transport accepted
* Goods picked up
* Goods delivered
* Payment received
* Issue reported

---

## 16. Suggested API Responsibilities

The custom API backend should expose or handle:

```text
POST /webhooks/sms/africas-talking
POST /webhooks/paystack
POST /payments/initialize
POST /payments/verify
POST /approvals/respond
POST /sms/send
POST /jobs/hotspots/recalculate
POST /jobs/listings/expire
```

The exact route structure can change based on the backend framework, but responsibilities should remain clear.

---

## 17. Convex Function Responsibilities

Convex functions should manage core application data.

Suggested function groups:

```text
users.ts
  createUserProfile
  updateUserStatus
  getCurrentUserProfile

farmers.ts
  createFarmerLead
  completeFarmerProfile
  assignAgent
  verifyFarmer

agents.ts
  submitAgentApplication
  approveAgent
  rejectAgent

listings.ts
  createListing
  updateListing
  expireListing
  addListingToBulkLot

bulkLots.ts
  createBulkLot
  addListingToBulkLot
  updateBulkLotStatus

deals.ts
  createOffer
  counterOffer
  acceptDealPendingApproval
  updateDealStatus

transport.ts
  createTransportRequest
  assignTransporter
  updateTransportStatus

approvals.ts
  createApprovalRequest
  approveRequest
  rejectRequest
  expireRequest

auditLogs.ts
  createAuditLog
  listAuditLogs
```

---

## 18. MVP Technical Scope

Must-have MVP technical features:

1. Next.js web application.
2. Firebase authentication.
3. Convex schema and core functions.
4. Custom API backend.
5. Africa’s Talking SMS webhook integration.
6. SMS farmer registration state machine.
7. Agent dashboard.
8. Produce listing creation.
9. Bulk lot creation.
10. Buyer search and offer flow.
11. Approval request flow through SMS.
12. Transport request status flow.
13. Paystack test payment flow.
14. Admin dashboard.
15. Basic hotspot scoring.
16. Audit logging.

Bonus technical features:

1. Offline draft saving for agents.
2. Image compression before upload.
3. Map visualization.
4. Transport cost estimation.
5. Rating and review system.
6. Farmer smartphone dashboard.
7. Advanced notification center.

---

## 19. MVP Demo Technical Flow

```text
1. SMS arrives at Africa’s Talking long code.
2. API backend receives SMS webhook.
3. SMS state machine creates pending farmer lead.
4. Convex stores farmer lead.
5. Agent logs in with Firebase Auth.
6. Agent completes farmer profile.
7. Agent creates produce listing.
8. Convex stores listing.
9. System creates or updates bulk lot.
10. Buyer logs in and searches produce.
11. Buyer submits offer.
12. Agent triggers farmer approval.
13. Approval SMS is sent.
14. Farmer replies 1 to approve.
15. API backend processes approval.
16. Convex updates deal status.
17. Transport request is created.
18. Transporter accepts request.
19. Delivery status changes.
20. Admin dashboard displays activity and hotspot data.
```

---

## 20. Implementation Priorities

### Phase 1: Foundation

* Set up monorepo.
* Set up Next.js app.
* Set up API backend.
* Set up Convex.
* Set up Firebase Auth.
* Define shared types and validators.
* Create user roles and permissions.

---

### Phase 2: Farmer and Agent Flow

* Build SMS webhook.
* Build SMS registration flow.
* Build farmer lead creation.
* Build agent application.
* Build admin agent approval.
* Build agent dashboard.
* Build farmer profile completion.

---

### Phase 3: Marketplace Flow

* Build produce listing creation.
* Build bulk lot creation.
* Build buyer search.
* Build buyer offer flow.
* Build negotiation statuses.
* Build SMS approval requests.

---

### Phase 4: Logistics and Payments

* Build transport provider registration.
* Build transport request creation.
* Build delivery status updates.
* Integrate Paystack test payments.
* Add payment verification/webhooks.

---

### Phase 5: Dashboard and Demo Readiness

* Build admin dashboard.
* Add basic hotspot scoring.
* Add audit log view.
* Add demo data.
* Test full workflow.
* Optimize low-bandwidth pages.
* Prepare final demo script.

---

## 21. Technical Summary

The technical system should be built around a clean separation of responsibilities:

```text
Firebase = identity provider
Convex = core application data and realtime workflows
Custom API backend = integrations, webhooks, SMS bot, payments, sensitive workflows
Africa’s Talking = SMS communication
Paystack = payment processing
Next.js PWA = user-facing web application
```

The most important technical principle is to keep the system typed, auditable, and role-aware.

The platform should make it easy to prove the complete workflow:

> SMS farmer registration, agent verification, produce listing, bulk lot creation, buyer offer, farmer SMS approval, transport coordination, payment tracking, and hotspot dashboard.
