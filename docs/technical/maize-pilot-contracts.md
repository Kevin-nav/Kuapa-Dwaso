# Maize pilot implementation contracts

Status: frozen by KD-01 for downstream implementation. These contracts describe planned software. They do not claim that the pilot has run or that commercial terms have been approved.

## Purpose and authority

This document maps the demand-led maize pilot to exact persistence, API, access, event, and compatibility contracts. It implements the domain decisions in [the maize pilot backlog](../product/maize-pilot-software-tickets.md) and [ADR-0005](../decisions/ADR-0005-demand-led-maize-pilot-boundary.md). When an older operating document conflicts with these pilot contracts, use this document for the pilot and keep the older document as history.

The pilot crop is maize. Canonical weight is integer grams, money is integer pesewas, country is Ghana, currency is `GHS`, and display timezone is `Africa/Accra`. Rates are non-negative integers paired with an explicit scale. All persisted timestamps are UTC milliseconds.

## Boundaries that must remain separate

The warehouse and pilot branches remain separate at persistence boundaries.

```ts
type OrderRef =
  | { source: "warehouse_run"; buyerOrderId: Id<"buyerOrders"> }
  | { source: "pilot_request"; pilotRequestId: Id<"pilotBuyerRequests"> };

type FacilityRef =
  | { kind: "none" }
  | { kind: "pilot_facility"; pilotFacilityId: Id<"pilotFacilities"> };
```

`buyerOrders`, `inventoryBatches`, `inventoryReservations`, `saleRecords`, `dispatches`, `paymentTransactions`, and `payoutLedger` remain warehouse records. Their required warehouse, run, inventory, sale, and order links do not become optional for the pilot. Shared list and navigation code consumes `OrderRef`; it does not infer a branch from missing fields.

A pilot request lives only in `pilotBuyerRequests`. A pilot lot lives only in `pilotProcurementLots`. A pilot provider transaction lives only in `pilotPaymentTransactions`. Pilot financial truth lives in `pilotFinancialEntries`. Reports select a source branch before summing and return `warehouseTotals` and `pilotTotals` as separate objects. A UI may show a labelled combined view only by adding values with the same currency, canonical unit, actual or estimate basis, and economic definition.

No pilot flow requires a warehouse, market schedule, market run, inventory reservation, warehouse intake, storage receipt, sale record, or legacy dispatch.

## Authentication and authorization seam

Every public pilot query and mutation calls `requirePilotPrincipal(ctx)`. The helper calls `ctx.auth.getUserIdentity()`, rejects a missing identity, reads `identity.subject`, and resolves exactly one active `users` row through `users.by_auth_provider_id`. The Convex auth configuration must trust Firebase JWTs through the Firebase project issuer, audience, and RS256 JWKS configuration. The frontend Firebase session must supply its ID token to the Convex client. KD-03 owns that configuration and token bridge.

`actorUserId`, `requestingUserId`, role query parameters, demo query parameters, and route names are not authority. Public pilot APIs omit actor IDs. A caller may include a target user or profile ID only when the operation needs one; the resolved principal still controls authorization and audit attribution.

Provider routes in `apps/api` verify the Firebase ID token with Firebase Admin, resolve the same `users.authProviderId`, then invoke an internal Convex action through the existing trusted API connection. The internal action accepts a verified principal reference plus a service authentication assertion that browsers cannot obtain. It rechecks product scope in Convex. Provider credentials and private object keys stay in `apps/api`.

The repository's current `getActor(ctx, actorUserId)` pattern performs only a database lookup. Pilot modules must not copy it as an authentication check. Existing non-pilot remediation is outside KD-01, but no new pilot endpoint may add to that gap.

## Shared types and values

Downstream tickets add these names to `packages/types`, validators to `packages/validators`, and policies to `packages/permissions`.

```ts
type DatasetProvenance = "live" | "sample_only";
type PilotProgrammeStatus = "draft" | "active" | "suspended" | "closed";
type PilotCommercialMode = "coordination" | "kuapa_purchase";
type PilotAssignmentStatus = "active" | "revoked" | "expired";
type PilotCapability =
  | "pilot:read"
  | "requests:review"
  | "supply:manage"
  | "offers:manage"
  | "quality:record"
  | "fulfilment:manage"
  | "custody:record"
  | "issues:manage";

type PilotRequestStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "quoted"
  | "confirmed"
  | "fulfilling"
  | "delivered"
  | "closed"
  | "cancelled"
  | "disputed";
type CancellationState = "none" | "requested" | "resolving" | "resolved";
type OfferStatus = "draft" | "sent" | "accepted" | "declined" | "expired" | "withdrawn";
type AllocationStatus = "provisional" | "committed" | "quality_cleared" | "released" | "expired" | "cancelled";
type QualityStatus = "pending" | "passed" | "partial" | "failed" | "superseded";
type FulfilmentStatus = "planning" | "ready" | "assigned" | "collecting" | "in_transit" | "delivered" | "cancelled";
type ObligationStatus = "due" | "partly_paid" | "paid" | "overdue" | "disputed";
type FinancialBasis = "estimate" | "actual";
type PartyKind = "buyer" | "farmer" | "kuapa_dwaso" | "transporter" | "facility" | "external_provider";
type TitleOwnerKind = "farmer" | "buyer" | "kuapa_dwaso";
type CustodianKind = "farmer" | "kuapa_dwaso" | "transporter" | "buyer" | "facility";
```

The code uses these reusable typed objects. It does not use `any` or free-form JSON for commercial or financial facts.

```ts
type PilotLocation = {
  label: string;
  region?: string;
  district?: string;
  address?: string;
  latitudeE6?: number;
  longitudeE6?: number;
};
type Rate = { numerator: number; scale: number; unit: "per_kg" | "percent" | "fixed" };
type ChargeTerm = {
  code: string;
  label: string;
  payer: "buyer" | "farmer" | "kuapa_dwaso";
  calculation: "fixed" | "per_kg" | "percent_of_produce";
  rate: Rate;
};
type PaymentTerm = {
  trigger: "buyer_acceptance" | "cleared_buyer_funds" | "purchase_collection_acceptance" | "fixed_date";
  offsetCalendarDays: number;
  fixedDueAt?: number;
  timezone: "Africa/Accra";
};
type MaizeSpecification = {
  maizeType: string;
  moistureMaximumPermille?: number;
  contaminationCheckRequired: boolean;
  additionalCriteria: Array<{ code: string; label: string; required: boolean }>;
  policyProvenance: DatasetProvenance;
};
type PartyRef = { kind: PartyKind; id?: string; displayNameSnapshot: string };
```

`latitudeE6` and `longitudeE6` are optional signed integers. Exact farm coordinates are private. Percentage rates use `numerator / scale`, such as `5 / 100`. Calculations round half-up to one pesewa per agreed line. Aggregate reconciliation assigns remaining pesewas in ascending stable line ID order.

## Persistence map

All tables include `createdAt`. Mutable head records also include `updatedAt` and integer `version`. Every update requires `expectedVersion`. Revision and event tables are insert-only except for the narrow acknowledgement and lifecycle fields stated below.

### Programme, assignment, and facility tables

`pilotProgrammes`

- Fields: `code`, `name`, `countryCode`, `currency`, `timezone`, `region`, optional `district`, `status`, `datasetProvenance`, optional `datasetId`, `commercialConfigurationStatus`, optional typed `currentCommercialConfiguration`, `version`, `createdByUserId`, `createdAt`, `updatedAt`.
- `currentCommercialConfiguration` contains optional current quality policy, charge terms, payment terms, purchase limit, tax terms, and their approval references. `sample_only` configuration cannot authorize a live commitment.
- Indexes: `by_code`, `by_status`, `by_dataset`, `by_provenance_status`.

`pilotAssignments`

- Fields: `programmeId`, `userId`, `identityKind` of `warehouse_agent` or `admin`, optional `warehouseAgentId`, `capabilities`, `status`, optional `invitationId`, `grantedByUserId`, `grantedAt`, optional `expiresAt`, optional `revokedByUserId`, `revokedAt`, `revocationReason`, `version`, `createdAt`, `updatedAt`.
- A warehouse-agent assignment requires an approved active `warehouseAgents` profile linked to the same user. An admin assignment requires an active admin identity with satisfied privileged MFA. Neither an existing warehouse assignment nor the top-level role creates pilot access.
- Indexes: `by_programme_status`, `by_user_status`, `by_programme_user`, `by_expiry_status`.

`pilotFacilities`

- Fields: `programmeId`, `name`, `facilityType` of `collection_point`, `partner_facility`, or `warehouse`, optional `warehouseId`, `location`, `storageAssessed`, optional `assessedAt`, `assessedByUserId`, `assessmentEvidenceUploadAssetIds`, `status`, `datasetProvenance`, `version`, `createdAt`, `updatedAt`.
- `warehouseId` is required only for `facilityType: "warehouse"`. `storageAssessed: true` and evidence are required before a plan may mark a facility as storage. No record establishes a commercial partnership by itself.
- Indexes: `by_programme_status`, `by_warehouse`, `by_programme_type_status`.

### Demand and commercial revisions

`pilotBuyerRequests`

- Fields: `programmeId`, `buyerId`, `cropCode: "maize"`, `maizeType`, `requestedGrams`, optional `confirmedGrams`, `destination`, `deliveryWindowStartAt`, `deliveryWindowEndAt`, `requestedSpecification`, `paymentExpectation`, `commercialMode`, `status`, `cancellationState`, optional `currentAgreementRevisionId`, `version`, `createdByUserId`, `submittedAt`, `confirmedAt`, `deliveredAt`, `closedAt`, `cancelledAt`, `createdAt`, `updatedAt`.
- `commercialMode` is fixed after the first farmer offer is sent. Every linked offer and lot must match it.
- Indexes: `by_buyer_status`, `by_programme_status`, `by_programme_delivery_window`, `by_status_updated_at`.

`pilotBuyerAgreementRevisions`

- Insert-only commercial fields: `requestId`, `programmeId`, `revision`, optional `supersedesRevisionId`, `quantityGrams`, `commercialMode`, `specification`, `producePriceRate`, `chargeTerms`, `acceptanceRules`, `deliveryWindowStartAt`, `deliveryWindowEndAt`, `paymentTerms`, `cancellationTerms`, `expiresAt`, `createdByUserId`, `createdAt`.
- Lifecycle fields may move once: `state` from `proposed` to `acknowledged`, `superseded`, `expired`, or `withdrawn`; optional `buyerAcknowledgedByUserId` and `buyerAcknowledgedAt`. No commercial field is patched.
- Indexes: `by_request_revision`, `by_request_state`, `by_expiry_state`, `by_programme_created_at`.

### Supply, offers, and allocation

`pilotSupplyDeclarations`

- Fields: `programmeId`, `farmerId`, `cropCode: "maize"`, `maizeType`, `availableGrams`, `readinessWindowStartAt`, `readinessWindowEndAt`, `collectionLocation`, `verificationStatus` of `self_reported`, `reviewed`, or `rejected`, `status` of `active`, `exhausted`, `withdrawn`, or `expired`, `version`, `createdAt`, `updatedAt`.
- Indexes: `by_farmer_status`, `by_farmer_programme_status`, `by_programme_status`, `by_programme_maize_type_status`, `by_readiness_status`.

`pilotFarmerOffers`

- Mutable lifecycle head fields: `programmeId`, `requestId`, `declarationId`, `farmerId`, `commercialMode`, `status`, optional `currentRevisionId` during the atomic first-revision insert, optional `acceptedRevisionId`, `decisionAt`, `expiresAt`, `version`, `createdAt`, `updatedAt`. Public projections reject a missing head revision.
- Indexes: `by_farmer_status`, `by_request_status`, `by_declaration_status`, `by_expiry_status`.

`pilotFarmerOfferRevisions`

- Insert-only fields: `offerId`, `programmeId`, `requestId`, `declarationId`, `buyerAgreementRevisionId`, `revision`, optional `supersedesRevisionId`, `commercialMode`, `offeredGrams`, `priceBasis`, `priceRate`, `chargeTerms`, `expectedGrossPesewas`, `expectedChargesPesewas`, `expectedNetPesewas`, `inspectionTerms`, `paymentTerms`, `titleTransferTerms`, `custodyTransferTerms`, `cancellationTerms`, `expiresAt`, `createdByUserId`, `createdAt`.
- Indexes: `by_offer_revision`, `by_request_created_at`, `by_expiry`.

`pilotAllocations`

- Fields: `programmeId`, `requestId`, `declarationId`, `offerId`, `offerRevisionId`, `farmerId`, `commercialMode`, `allocatedGrams`, `clearedGrams`, `releasedGrams`, `status`, optional `holdExpiresAt`, `releaseReason`, `version`, `createdAt`, `updatedAt`.
- `allocatedGrams - releasedGrams` is the active commitment. `clearedGrams` cannot exceed it. Allocation mutations sum active commitments for the declaration in one transaction and reject over-allocation.
- Indexes: `by_request_status`, `by_declaration_status`, `by_offer`, `by_hold_expiry_status`, `by_farmer_status`.

### Quality, lots, fulfilment, and acceptance

`pilotProcurementLots`

- Fields: `programmeId`, `requestId`, `allocationId`, `offerRevisionId`, `farmerId`, `commercialMode`, `lotCode`, optional `parentLotId`, `sourceGrams`, `qualityStatus`, `clearedGrams`, `rejectedGrams`, `titleOwnerKind`, optional `titleOwnerFarmerId`, `currentCustodianKind`, optional `currentCustodianId`, `currentLocation`, optional `facilityId`, `dispositionStatus` of `available_for_plan`, `allocated_to_plan`, `held`, `delivered`, `returned`, `disposed`, or `closed`, `version`, `createdAt`, `updatedAt`.
- Sublots use `parentLotId`. Inspection and acceptance never split an undifferentiated failed sample by arithmetic. Every child quantity reconciles to its parent.
- Indexes: `by_lot_code`, `by_request_disposition`, `by_farmer`, `by_allocation`, `by_parent`, `by_owner_disposition`, `by_programme_quality`.

`pilotInspections`

- Insert-only fields: `programmeId`, `requestId`, `lotId`, `allocationId`, `buyerAgreementRevisionId`, optional `supersedesInspectionId`, `samplingMethod`, `testMethod`, `sampleCount`, optional `moisturePermille`, `contaminationResult` of `passed`, `failed`, or `not_recorded`, `additionalReadings`, `measuredGrams`, `acceptedGrams`, `rejectedGrams`, `qualityStatus`, `reasonCode`, `notes`, `evidenceUploadAssetIds`, `inspectedByUserId`, `inspectedAt`, `createdAt`.
- A correction inserts a new row and marks the earlier row's sole mutable lifecycle field `qualityStatus: "superseded"`. Missing required tests produce `pending`.
- Indexes: `by_lot_created_at`, `by_lot_quality`, `by_request_quality`, `by_inspector_created_at`.

`pilotFulfilmentPlans`

- Fields: `programmeId`, `requestId`, `buyerAgreementRevisionId`, `status`, `plannedGrams`, optional `transporterId`, optional `driverUserId`, optional `vehicleRegistration`, optional `vehicleCapacityGrams`, `collectionWindowStartAt`, `collectionWindowEndAt`, `deliveryWindowStartAt`, `deliveryWindowEndAt`, `destination`, `readinessBlockers`, `cancellationState`, `version`, `createdAt`, `updatedAt`.
- Indexes: `by_request`, `by_programme_status`, `by_driver_status`, `by_delivery_window_status`.

`pilotFulfilmentStops`

- Fields: `programmeId`, `planId`, `sequence`, `stopType` of `collection`, `facility`, or `destination`, `location`, optional `facilityId`, `lotIds`, `plannedGrams`, `collectedGrams`, `windowStartAt`, `windowEndAt`, `status` of `planned`, `arrived`, `completed`, `skipped`, or `cancelled`, `version`, `createdAt`, `updatedAt`.
- Indexes: `by_plan_sequence`, `by_plan_status`, `by_facility`, `by_window_status`.

`pilotCustodyEvents`

- Insert-only fields: `programmeId`, `requestId`, `lotId`, optional `planId`, optional `stopId`, `eventType` of `collected`, `loaded`, `handed_over`, `delivered`, `held`, `returned`, `released`, or `corrected`, `grams`, `fromCustodian`, `toCustodian`, `location`, `evidenceUploadAssetIds`, optional `supersedesEventId`, `reasonCode`, `recordedByUserId`, `occurredAt`, `createdAt`.
- A correction adds an event and updates the lot projection in the same transaction. It never edits custody history.
- Indexes: `by_lot_occurred_at`, `by_plan_occurred_at`, `by_request_occurred_at`, `by_recorder_created_at`.

`pilotBuyerAcceptances`

- Insert-only commercial fields: `programmeId`, `requestId`, `planId`, `buyerAgreementRevisionId`, `revision`, optional `supersedesAcceptanceId`, `lines`, `acknowledgedByBuyerUserId`, `acknowledgedAt`, `createdAt`.
- Each bounded `lines` item contains `lotId`, optional `sublotId`, `deliveredGrams`, `acceptedGrams`, `rejectedGrams`, `reasonCode`, `evidenceUploadAssetIds`, optional `issueId`, and `discrepancyState` of `none`, `open`, or `resolved`. Line quantities must reconcile. A changed line requires a new acceptance revision.
- Indexes: `by_request_revision`, `by_plan_revision`, `by_programme_created_at`.

### Purchasing capacity and financial records

`pilotPurchasingBudgets`

- Fields: `programmeId`, `fundingSourceLabel`, `fundingSourceReference`, `fundingEvidenceUploadAssetIds`, `datasetProvenance`, `currency: "GHS"`, `approvedCapacityPesewas`, `reservedPesewas`, `committedPesewas`, `spentPesewas`, `status` of `draft`, `active`, `suspended`, or `closed`, `approvedByUserId`, `approvedAt`, `version`, `createdAt`, `updatedAt`.
- Available capacity is `approvedCapacityPesewas - reservedPesewas - committedPesewas - spentPesewas`. Payment moves committed capacity to spent and never increases available capacity.
- Indexes: `by_programme_status`, `by_provenance_status`, `by_funding_reference`.

`pilotFundingReservations`

- Fields: `programmeId`, `budgetId`, `requestId`, `buyerAgreementRevisionId`, `farmerOfferRevisionId`, `produceAmountPesewas`, `knownCostAmountPesewas`, `status` of `active`, `partly_consumed`, `consumed`, `released`, `expired`, or `reversed`, `consumedPesewas`, `releasedPesewas`, `expiresAt`, `approvedByUserId`, `version`, `createdAt`, `updatedAt`.
- Indexes: `by_budget_status`, `by_request_status`, `by_offer_revision`, `by_expiry_status`.

`pilotBudgetEvents`

- Insert-only fields: `programmeId`, `budgetId`, optional `reservationId`, optional `financialEntryId`, `eventType` of `capacity_added`, `reserved`, `released`, `committed`, `spent`, or `reversed`, non-negative `amountPesewas`, `postingKey`, `reasonCode`, `recordedByUserId`, `createdAt`.
- Indexes: `by_budget_created_at`, `by_reservation_created_at`, `by_posting_key`.

`pilotFinancialEntries`

- Insert-only fields: `programmeId`, optional `requestId`, optional `lotId`, optional `offerRevisionId`, optional `acceptanceId`, optional `fundingReservationId`, `postingKind` of `obligation`, `receipt`, `payment`, `cost`, `revenue`, `reimbursement`, `refund`, `adjustment`, or `reversal`, `purpose` of `buyer_produce`, `buyer_transport`, `farmer_proceeds`, `coordination_fee`, `purchase_inventory`, `transport_cost`, `handling_cost`, `other_agreed_cost`, or `correction`, `basis`, `payer`, `payee`, `amountPesewas`, `currency: "GHS"`, optional `dueAt`, optional `settlesEntryId`, optional `reversesEntryId`, `postingKey`, `evidenceUploadAssetIds`, `provenance`, `reasonCode`, `recordedByUserId`, `createdAt`.
- Indexes: `by_posting_key`, `by_request_created_at`, `by_lot_created_at`, `by_payer_created_at`, `by_payee_created_at`, `by_due_at`, `by_settles_entry`, `by_reverses_entry`.
- Obligation state is derived from the immutable obligation plus payment, adjustment, dispute, and reversal entries. Server time marks an unpaid balance overdue only when `now > dueAt`.

`pilotPaymentTransactions`

- Fields: `programmeId`, `requestId`, `buyerId`, `provider`, `providerReference`, optional `providerAccessCode`, optional `authorizationUrl`, `amountPesewas`, `currency: "GHS"`, `status` of `pending`, `initialized`, `succeeded`, `failed`, or `reversed`, `idempotencyKey`, optional `correlationId`, `initializedByUserId`, optional `verifiedAt`, `paidAt`, `failedAt`, `reversedAt`, optional `providerStatus`, `providerMessage`, `createdAt`, `updatedAt`.
- Raw provider payloads remain in the existing restricted provider-event mechanism or a redacted typed snapshot. A successful transaction posts one `buyer_produce` or `buyer_transport` receipt through a unique `postingKey`. Retry and webhook order cannot post twice.
- Indexes: `by_request_status`, `by_provider_reference`, `by_idempotency_key`, `by_buyer_created_at`.

### Durable activity, issues, and retries

`pilotActivityEvents`

- Insert-only fields: `programmeId`, optional `requestId`, `entityType`, `entityId`, optional `entityRevision`, `eventName`, `actorUserId`, `reasonCode`, `recipientViews`, `createdAt`.
- Each `recipientViews` item has `audience` of `buyer`, `farmer`, `transporter`, `pilot_ops`, `finance`, `admin`, or `audit`; optional target user/profile ID; a safe title; and safe detail. Private values are omitted rather than hidden by the frontend.
- Indexes: `by_request_created_at`, `by_entity_created_at`, `by_programme_created_at`, `by_actor_created_at`.

`pilotIssues`

- Fields: `programmeId`, `requestId`, optional `lotId`, optional `planId`, optional `acceptanceId`, `issueType` of `quality_shortfall`, `custody_discrepancy`, `buyer_rejection`, `cancellation_disposition`, `payment_dispute`, or `correction`, `status` of `open`, `investigating`, `awaiting_party`, `resolved`, or `closed`, `summary`, `responsibleCustodian`, optional `deadlineAt`, `evidenceUploadAssetIds`, optional `resolution`, `resolvedByUserId`, `resolvedAt`, `version`, `createdByUserId`, `createdAt`, `updatedAt`.
- Indexes: `by_request_status`, `by_lot_status`, `by_programme_status`, `by_deadline_status`.

`pilotIdempotencyKeys`

- Fields: `programmeId`, `actorUserId`, `operationName`, `idempotencyKey`, `requestHash`, `status` of `started` or `completed`, `resultRefs`, `createdAt`, `completedAt`.
- Each `resultRefs` item has a closed `entityType` and string ID. The same actor, operation, and key returns the completed result only when the request hash matches. A different hash is rejected.
- Indexes: `by_actor_operation_key`, `by_programme_created_at`.

## Upload changes

`uploadAssets` gains optional `pilotProgrammeId`. Its purpose union gains `pilot_inspection_evidence`, `pilot_collection_evidence`, `pilot_custody_evidence`, `pilot_acceptance_evidence`, `pilot_financial_evidence`, `pilot_issue_evidence`, and `pilot_facility_assessment`. Its related-entity union gains the corresponding pilot table names.

All pilot evidence uses `accessLevel: "private"`. Attachment verifies the principal can access the programme and related entity, that the purpose matches the entity, and that the upload owner may perform the action. Every signed read repeats the related-entity check. A stale assignment, copied object key, or known upload ID grants nothing. Financial evidence requires the owner party or `pilotFinance:read`; exact farm coordinates are limited to the farmer, assigned fulfilment staff while needed, and authorized admin or support staff.

## Permission and assignment contract

The existing marketplace role keys stay unchanged. Add admin scope `pilot_programme` and these admin permissions:

```text
pilotProgrammes:read       pilotProgrammes:manage
pilotAssignments:read      pilotAssignments:manage
pilotRequests:read         pilotRequests:manage
pilotSupply:read           pilotSupply:manage
pilotQuality:read          pilotQuality:manage
pilotFulfilment:read       pilotFulfilment:manage
pilotFinance:read          pilotFinance:manage
pilotIssues:read           pilotIssues:manage
```

An admin mutation requires both its permission and a matching global or `pilot_programme` grant. A non-admin operations mutation requires an active, unexpired `pilotAssignments` row for the same programme and the named `PilotCapability`. Assignment grant and revocation require `pilotAssignments:manage`. Revocation takes effect on the next server call and cancels no recorded facts. Work must be reassigned before readiness can pass.

Pilot operations invitations extend the invitation type union with `pilot_operations_invite`. They use email or manual secure link delivery and verified phone OTP for a warehouse-agent identity, following the current warehouse-agent invitation controls. Acceptance links the existing approved profile and user, then creates no assignment by itself. An authorized admin grants the programme assignment in a separate audited mutation. Raw tokens stay out of Convex.

| Actor | Read scope | Allowed changes | Fields withheld |
| --- | --- | --- | --- |
| Buyer | Own buyer's requests and fulfilment | Draft/submit request, acknowledge buyer revision, request cancellation, accept/reject delivered lot lines, provide own payment evidence | Other buyers, farmer contacts, farmer-specific prices, Kuapa purchase cost and margin |
| Farmer | Own declarations, offers, lots, and obligations | Draft declaration, accept/decline current offer online, request issue | Other farmers, buyer-private data beyond accepted terms, platform margin |
| Transporter/driver | Assigned active plan and necessary stops | Record assigned movement and evidence online | Prices, budgets, ledgers, unrelated contacts and plans |
| Assigned pilot ops | Assigned programme and capability | Review demand, manage offers, inspect, plan, record custody, resolve operational issues as capability allows | Finance evidence and funding source details without admin finance grant |
| Finance admin | Granted programme and finance permission | Establish budget, reserve/release funds, post external settlement evidence, financial correction | Other programmes outside scope |
| Support/admin | Granted programme and named permission | Read or manage only the records covered by that permission | Other programmes and unnecessary private evidence |
| Auditor | Granted programme read permissions | Read immutable history and redacted evidence metadata | Mutations, provider secrets, raw private object keys |

## API modules

All list queries accept `{ programmeId, cursor?: string, limit: number }` plus the named filter and return `{ page, nextCursor?: string, isDone: boolean }`. Validators cap `limit` at 50. Detail queries return a recipient-safe projection, never a raw document.

### Programme, principal, assignment, and evidence APIs

| API | Arguments | Result | Consumer / owner |
| --- | --- | --- | --- |
| `pilotAuth.currentPrincipal` | none | principal, profiles, active assignment summaries, admin pilot grants | all authenticated apps, KD-03 |
| `pilotProgrammes.listAvailable` | page args | programmes visible to principal | app, ops, admin; KD-03 |
| `pilotProgrammes.get` | `programmeId` | safe programme and current configuration state | all portals; KD-02/KD-03 |
| `pilotProgrammes.create` | programme fields, `idempotencyKey` | `programmeId`, `version` | admin; KD-02/KD-15 |
| `pilotProgrammes.updateConfiguration` | `programmeId`, typed configuration, `expectedVersion`, `idempotencyKey` | `programmeId`, `version` | admin; KD-15 |
| `pilotAssignments.grant` | `programmeId`, `targetUserId`, `capabilities`, optional expiry/invitation, `idempotencyKey` | `assignmentId`, `version` | admin; KD-03/KD-15 |
| `pilotAssignments.revoke` | `assignmentId`, `expectedVersion`, `reason`, `idempotencyKey` | `assignmentId`, `version` | admin; KD-03/KD-15 |
| `pilotAssignments.list` | page args, status | safe assignments | admin; KD-03/KD-15 |
| `uploads:createPending` | existing args plus pilot purpose and related entity | upload ID and provider input | all authorized actors through API; KD-03 |
| `uploads:complete` | existing completion args | upload ID and status | all authorized actors through API; KD-03 |
| `uploads:getReadableObject` | upload ID, authenticated principal from API | authorized object descriptor or null | all portals through API; KD-03 |

### Demand APIs

| API | Arguments | Result | Consumer / owner |
| --- | --- | --- | --- |
| `pilotRequests.createDraft` | `programmeId`, buyer profile, typed request fields, `idempotencyKey` | `requestId`, `version` | buyer; KD-05/KD-11 |
| `pilotRequests.updateDraft` | `requestId`, changed draft fields, `expectedVersion`, `idempotencyKey` | `requestId`, `version` | buyer; KD-05/KD-11 |
| `pilotRequests.submit` | `requestId`, `expectedVersion`, `idempotencyKey` | request summary | buyer; KD-05/KD-11 |
| `pilotRequests.beginReview` | `requestId`, `expectedVersion`, `idempotencyKey` | request summary | ops; KD-05/KD-13 |
| `pilotRequests.createAgreementRevision` | `requestId`, typed agreement, `expectedRequestVersion`, `idempotencyKey` | revision ID and number | ops/admin; KD-05/KD-13 |
| `pilotRequests.acknowledgeAgreement` | `requestId`, `agreementRevisionId`, `expectedRequestVersion`, `idempotencyKey` | request and revision summaries | buyer; KD-05/KD-11 |
| `pilotRequests.confirm` | `requestId`, `agreementRevisionId`, `confirmedGrams`, `expectedRequestVersion`, `idempotencyKey` | request summary and readiness blockers | ops; KD-05/KD-13 |
| `pilotRequests.requestCancellation` | `requestId`, `expectedVersion`, `reason`, `idempotencyKey` | cancellation state and consequences preview | buyer or ops; KD-05 onward |
| `pilotRequests.resolveCancellation` | `requestId`, `expectedVersion`, typed resolution, `idempotencyKey` | request, released records, issue IDs | scoped ops and finance for finance actions; KD-05/KD-09/KD-10 |
| `pilotRequests.get` | `requestId` | actor-safe aggregate | buyer, ops, admin; KD-05/KD-11/KD-13/KD-15 |
| `pilotRequests.listMine` | page args and status | buyer-safe requests | buyer; KD-11 |
| `pilotRequests.listAssigned` | page args and status/window | ops-safe requests | ops; KD-13 |
| `pilotOrders.listOrderRefs` | source filter plus page args | discriminated `OrderRef` summaries | buyer/admin shared navigation; KD-05/KD-11/KD-15 |

### Supply, offer, and allocation APIs

| API | Arguments | Result | Consumer / owner |
| --- | --- | --- | --- |
| `pilotSupply.createDeclaration` | `programmeId`, farmer profile, declaration fields, `idempotencyKey` | declaration ID/version | farmer or assigned ops; KD-06/KD-12/KD-13 |
| `pilotSupply.updateDeclaration` | declaration ID, fields, expected version, idempotency key | declaration ID/version | farmer or assigned ops; KD-06 |
| `pilotSupply.reviewDeclaration` | declaration ID, decision/reason, expected version, idempotency key | declaration summary | assigned ops; KD-06 |
| `pilotOffers.createRevision` | request/declaration IDs, typed terms, expected request/declaration versions, idempotency key | offer/revision IDs | assigned ops; KD-06 |
| `pilotOffers.send` | offer/revision IDs, expected offer version, idempotency key | offer summary | assigned ops; KD-06 |
| `pilotOffers.decide` | offer ID, revision ID, `accepted` or `declined`, expected offer version, idempotency key | offer and allocation summary | farmer; KD-06/KD-12 |
| `pilotAllocations.hold` | offer revision, grams, expiry, expected versions, idempotency key | allocation ID/version | assigned ops; KD-06 |
| `pilotAllocations.release` | allocation ID, grams, reason, expected version, idempotency key | allocation summary | assigned ops; KD-06 onward |
| `pilotSupply.listMine` | page args/status | farmer-safe declarations/offers | farmer; KD-12 |
| `pilotSupply.listForRequest` | request ID/page args | assigned ops supply view | ops; KD-13 |

`pilotOffers.decide` re-reads the current revision, expiry, request mode, declaration availability, and active commitments in one transaction. It rejects an old tab, changed payload, expired offer, or competing over-allocation.

### Quality, lot, logistics, and acceptance APIs

| API | Arguments | Result | Consumer / owner |
| --- | --- | --- | --- |
| `pilotInspections.record` | allocation, agreement revision, readings, quantities, evidence, idempotency key | inspection and lot/sublot summaries | assigned inspector; KD-07 |
| `pilotInspections.correct` | inspection ID, corrected typed record, reason, idempotency key | new inspection and superseded ID | assigned inspector; KD-07 |
| `pilotLots.recordDisposition` | lot ID, disposition, owner consent when required, evidence, expected version, idempotency key | lot and issue summaries | scoped ops; KD-07/KD-10 |
| `pilotLots.listForActor` | page args/filter | actor-safe lots | farmer, ops, admin; KD-07/KD-12/KD-13 |
| `pilotFulfilment.createPlan` | request/agreement IDs, windows/destination, idempotency key | plan ID/version/blockers | assigned ops; KD-08 |
| `pilotFulfilment.updatePlan` | plan/stops/vehicle fields, expected version, idempotency key | plan/version/blockers | assigned ops; KD-08 |
| `pilotFulfilment.assignDriver` | plan ID, transporter/driver, capacity, expected version, idempotency key | plan summary | assigned ops; KD-08 |
| `pilotFulfilment.markReady` | plan ID, expected version, idempotency key | plan summary | assigned ops; KD-08 |
| `pilotFulfilment.recordCustody` | plan/stop/lot IDs, event, grams, evidence, expected versions, idempotency key | custody event and projections | assigned driver or ops; KD-08 |
| `pilotFulfilment.acceptDelivery` | request/plan/agreement IDs, lot-keyed lines, buyer acknowledgement, idempotency key | acceptance revision, issues, obligations | buyer; KD-08/KD-09 |
| `pilotFulfilment.getPlan` | plan ID | actor-safe plan/stops/lots/blockers | buyer, farmer, driver, ops, admin; KD-08/KD-11 through KD-15 |
| `pilotFulfilment.listAssignedToDriver` | page args/status | driver-safe plans | transporter; KD-14 |

`pilotFulfilment.recordCustody` can complete a coordination collection after quality and readiness checks. For `kuapa_purchase`, its positive collection path calls `pilotProcurement.acceptCollectionPurchase`; it cannot patch the lot or create a payable itself.

### Purchasing and finance APIs

| API | Arguments | Result | Consumer / owner |
| --- | --- | --- | --- |
| `pilotFinance.createBudget` | programme, source/evidence, capacity, provenance, idempotency key | budget ID/version | finance admin; KD-09/KD-15 |
| `pilotFinance.adjustBudget` | budget ID, typed addition/correction, expected version, idempotency key | budget/version/available capacity | finance admin; KD-09 |
| `pilotFinance.reserveFunding` | budget/request/agreement/offer revisions, produce and known-cost amounts, expiry, expected budget version, idempotency key | reservation and budget summaries | finance admin; KD-09 |
| `pilotFinance.releaseFunding` | reservation ID, unused amount, reason, expected versions, idempotency key | reservation and budget summaries | finance admin; KD-09 |
| `pilotProcurement.acceptCollectionPurchase` | `requestId`, `lotId`, `farmerOfferRevisionId`, `inspectionId`, `buyerAgreementRevisionId`, `acceptedGrams`, custody event/evidence, `fundingReservationId`, `expectedFundingReservationVersion`, `expectedBudgetVersion`, `expectedLotVersion`, `idempotencyKey` | lot, custody event, farmer payable entry, reservation, budget, activity event | called by fulfilment; KD-09 |
| `pilotFinance.prepareBuyerPayment` | request ID, amount, purpose, idempotency key | provider-neutral initialization request | buyer through API; KD-09/KD-11 |
| `pilotFinance.recordProviderResult` | trusted API principal, transaction/reference/status/amount, provider event key | transaction and posting refs | API webhook/verification; KD-09 |
| `pilotFinance.recordExternalSettlement` | obligation ID, amount, evidence, paidAt, idempotency key | payment entry and derived obligation status | finance admin; KD-09/KD-15 |
| `pilotFinance.reverseEntry` | entry ID, reason, evidence, idempotency key | compensating entry | finance admin; KD-09 |
| `pilotFinance.getRequestStatement` | request ID | actor-safe statement and completeness | buyer/farmer/finance; KD-09/KD-11/KD-12/KD-15 |
| `pilotFinance.getProgrammeSummary` | page/date/basis filters | separated actual/estimate totals | finance/admin; KD-15 |

`pilotProcurement.acceptCollectionPurchase` is one Convex transaction. It authenticates the principal; checks assignment, request mode, current accepted offer and inspection revisions, quality, quantities, title, custody, approval, reservation expiry, budget versions, and capacity; consumes the reservation into committed capacity; records collection and Kuapa title; creates the farmer payable once; inserts the activity event; and completes the idempotency record. Any failure rolls back every write. It calls no provider.

### Activity, issues, notifications, and demo APIs

| API | Arguments | Result | Consumer / owner |
| --- | --- | --- | --- |
| `pilotActivity.listForRequest` | request ID/page args | recipient-safe timeline | all portals; KD-10 |
| `pilotIssues.open` | request/lot/plan refs, type, summary, evidence, idempotency key | issue ID/version | authorized actor; KD-10 |
| `pilotIssues.resolve` | issue ID, resolution/evidence, expected version, idempotency key | issue and affected projections | scoped ops/admin; KD-10 |
| `pilotIssues.listAssigned` | page args/status/deadline | safe issue list | ops/admin; KD-10/KD-13/KD-15 |
| `pilotNotifications.enqueueForEvent` | internal event ID | notification IDs | domain mutations; KD-10 |
| `pilotDemo.seedDataset` | guarded deployment, programme/scenario/checkpoint, supplied clock, idempotency key | dataset ID/checkpoint | test-utils only; KD-17 |
| `pilotDemo.resetDataset` | guarded deployment, exact dataset ID, idempotency key | deleted counts and reset checkpoint | test-utils only; KD-17 |

Production APIs use server time. The fake clock exists only in guarded demo/test helpers and deterministic pure calculations. A browser cannot send `now`, enable demo mode, or select a provider mode.

## Transition guards

The request path is `draft -> submitted -> under_review -> quoted -> confirmed -> fulfilling -> delivered -> closed`. `cancelled` and `disputed` are explicit branches. `quoted` requires a current unexpired buyer agreement revision. `confirmed` requires buyer acknowledgement and accepted farmer commitments for the exact confirmed grams. A partial confirmation first creates and acknowledges a lower buyer agreement revision. `closed` requires all delivery discrepancies and financial obligations settled or explicitly resolved.

An offer follows `draft -> sent -> accepted | declined | expired | withdrawn`. A material change creates a revision and returns the head to `draft`. Only the current sent revision may be accepted. The server checks expiry using server time and rechecks available supply in the acceptance transaction.

An allocation distinguishes provisional, committed, and quality-cleared quantity. Readiness sums only `clearedGrams - releasedGrams` from current passed or partial inspections. A quality correction, release, cancellation, expiry, or changed buyer specification re-evaluates readiness.

A plan follows `planning -> ready -> assigned -> collecting -> in_transit -> delivered`, with cancellation and discrepancy handling. `ready` requires a current acknowledged buyer revision, sufficient cleared lots, matching commercial mode, active assignments, valid windows, enough vehicle capacity when a vehicle is assigned, no blocking issue, and the agreement's financial release condition. A driver records custody facts only.

Quality follows `pending | passed | partial | failed | superseded`. A missing required reading stays pending. Only current accepted grams load. Reinspection failure reduces cleared quantity and reopens readiness.

Payment status is derived separately from delivery. Due dates for the fixtures are computed as 23:59:59.999 on the next `Africa/Accra` calendar date after the trigger, stored as UTC milliseconds. At `now === dueAt` payment is on time. It becomes overdue only at `now > dueAt`.

## Cancellation and rejection hooks

All modules call one internal `evaluatePilotCancellation(requestId)` service. It returns the current stage, permitted initiators, required capabilities, releasable allocations and reservations, preserved lots and obligations, required issues, and notifications. `pilotRequests.resolveCancellation` executes that plan with expected versions in one transaction. Later tickets add their owned consequences to this service instead of adding permissive cancellation mutations.

| Current facts | Result |
| --- | --- |
| No accepted farmer commitment | Withdraw current quotes/offers, release provisional holds, create no fee. |
| Commitment but no collection/title transfer | Release uncollected commitments and unused funding reservations. Keep acceptance history and existing agreed obligations. |
| Collected coordination lot | Keep farmer title and current custody, hold the lot, open a disposition issue, release only uncollected quantity. |
| Collected Kuapa purchase lot | Keep Kuapa title, farmer payable, and committed funding. Open a disposition/resale issue. Release only unused quantity and reservation. |
| Delivered, partly accepted, or disputed | Use lot-level acceptance and issue resolution. Do not directly cancel accepted or rejected physical facts. |
| Settled or closed | Reopen through an authorized correction and post compensating financial entries. Never edit or delete the original posting. |

`cancellationState: "requested"` is separate from `status: "cancelled"`. A cancelled request may retain held lots and unpaid or disputed obligations and is not financially closed.

Buyer acceptance lines preserve lot and sublot identity. Coordination rejection leaves rejected quantity farmer-owned with its current custodian, and commission applies only to buyer-accepted produce. Purchase rejection leaves the acquired quantity Kuapa-owned and the farmer payable unchanged. An ambiguous mixed-load rejection opens issues for every possibly affected lot and blocks only the disputed settlement and closure. Every rejection needs a holding, return, or reinspection plan with a custodian and deadline before resolution.

## Financial posting ownership and invariants

Each economic event has one authoritative `postingKey`. Domain mutations own postings as follows:

| Event | Posting owner | Required entries |
| --- | --- | --- |
| Buyer agreement acknowledgement | none | Estimates may be calculated for display; no actual posting. |
| Coordination buyer acceptance | `pilotFulfilment.acceptDelivery` | Buyer produce obligation, farmer proceeds obligations, coordination-fee revenue, and any agreed buyer transport obligation, each for accepted lot quantities only. |
| Purchase collection acceptance | `pilotProcurement.acceptCollectionPurchase` | Purchase inventory cost and farmer payable at the accepted collection quantity. |
| Buyer payment success | `pilotFinance.recordProviderResult` | Buyer receipt that settles named buyer obligations once. |
| External farmer or cost payment | `pilotFinance.recordExternalSettlement` | Payment against a named obligation and a budget `spent` event when purchase capacity backs it. |
| Actual transport/handling approval | `pilotFinance.recordExternalSettlement` or explicit cost approval | One actual cost. Coordination reimbursement is a separate buyer obligation/receipt. |
| Buyer rejection or cancellation | issue/cancellation resolution | No automatic deletion. Post refunds, adjustments, or reversals only from an evidenced resolution. |
| Correction | `pilotFinance.reverseEntry` | A compensating entry linked through `reversesEntryId`; the original remains. |

Collected buyer funds, Kuapa revenue, farmer liabilities, inventory cost, reimbursements, and operating costs use distinct purposes and are never netted into one row. Estimates and actuals never share a posting. Unknown actual costs make contribution `Incomplete`; they do not become zero.

Budget counters equal the sum of `pilotBudgetEvents`. Negative available capacity, negative counters, over-release, double consumption, and a second `postingKey` are rejected in the transaction. Active reservations reduce available capacity. Purchase acceptance moves the accepted amount from reserved to committed. Payment moves it from committed to spent. Expiry releases only unused reservation. Buyer cancellation cannot release capacity backing an acquired-lot payable.

Coordination farmer funds never count as a purchasing budget. A buyer deposit can count only when programme configuration and evidence explicitly permit it. A funding record is evidence supplied to the product; it does not claim an independent bank balance check.

## Event names

Domain transactions emit these exact `pilotActivityEvents.eventName` values:

```text
pilot.programme.created
pilot.programme.configuration_updated
pilot.assignment.granted
pilot.assignment.revoked
pilot.request.created
pilot.request.submitted
pilot.request.review_started
pilot.request.agreement_revised
pilot.request.agreement_acknowledged
pilot.request.confirmed
pilot.request.cancellation_requested
pilot.request.cancelled
pilot.request.disputed
pilot.supply.declared
pilot.supply.reviewed
pilot.offer.sent
pilot.offer.accepted
pilot.offer.declined
pilot.offer.expired
pilot.allocation.held
pilot.allocation.committed
pilot.allocation.released
pilot.inspection.recorded
pilot.inspection.superseded
pilot.quality.shortfall
pilot.lot.created
pilot.lot.disposition_recorded
pilot.fulfilment.plan_created
pilot.fulfilment.ready
pilot.fulfilment.driver_assigned
pilot.custody.recorded
pilot.delivery.recorded
pilot.delivery.accepted
pilot.delivery.rejected
pilot.budget.approved
pilot.funding.reserved
pilot.funding.released
pilot.purchase.collection_accepted
pilot.financial.entry_posted
pilot.financial.entry_reversed
pilot.payment.recorded
pilot.payment.overdue
pilot.issue.opened
pilot.issue.resolved
```

The state write, financial write when present, activity event, notification enqueue record, and idempotency completion occur in the same Convex transaction. Provider delivery happens later. Recipient views use stored redacted text so a query cannot expose an admin event payload to a farmer or driver.

## Migration and rollback sequence

1. Add shared closed unions, integer validators, calculation helpers, `OrderRef`, and typed pagination. Do not change legacy fields.
2. Add the 23 pilot tables and indexes. Add the optional pilot upload scope and closed upload purpose/entity literals.
3. Add the authenticated principal helper and Firebase Convex auth configuration. Wire frontend token propagation before exposing pilot queries.
4. Add assignment permissions and the `pilot_programme` admin scope. Default existing admin assignments and warehouse assignments to their current meaning; none match a pilot programme.
5. Add read-only pilot programme and assignment queries, then mutations, domain modules in ticket order, and recipient-safe projections.
6. Add portal entry points only after their backend dependencies and negative authorization tests pass.
7. Seed only guarded `sample_only` data through KD-17. Never run a production backfill or global reset.

No legacy-row backfill is required. Missing new optional upload scope means non-pilot upload. Existing `buyerOrders` and `paymentTransactions` remain warehouse records because pilot records use different tables. Existing totals keep their current queries.

Rollback disables pilot navigation, scheduled jobs, provider initiation, and pilot mutations through server configuration, then leaves pilot tables readable to authorized admins for audit and correction. It does not delete rows or reverse financial history. Warehouse routes and scheduled work continue. Any later schema removal needs a separate reviewed migration after retention requirements are met.

## Scenario traces

Scenario A creates one `pilotBuyerRequests` coordination row, an acknowledged buyer revision for 5,000 kg, four farmer offer revision chains, allocations, lots, and inspections. C's identified 200 kg sublot fails and reduces cleared allocation to 4,800 kg. The plan stays blocked until D's 200 kg offer is accepted and inspected. Collection records custody without a warehouse. Buyer acceptance posts GH₵25,000 produce obligations, GH₵23,750 farmer proceeds, GH₵1,250 coordination revenue, GH₵1,500 transport reimbursement, and one GH₵1,500 actual transport cost. Each value has one posting key. C receives no proceeds or fee on the failed sublot.

If the buyer rejects a coordination lot, title passes only for the accepted line. The rejected line remains farmer-owned and held with the recorded custodian. A lot-level issue blocks its settlement. Cancellation after collection preserves farmer title and custody; cancellation after settlement uses compensating entries.

Scenario B creates a separate `kuapa_purchase` request, a sample-only GH₵21,500 budget, and reservations of GH₵20,000 produce plus GH₵1,500 known cost. `pilotProcurement.acceptCollectionPurchase` consumes reserved produce capacity, transfers title for inspected accepted grams, and creates the farmer payable due the next local calendar day. It needs no warehouse. Buyer rejection later leaves title and payable unchanged, holds Kuapa stock, and opens a disposition issue. Buyer payment delay changes neither the farmer due date nor the payable. Payment moves budget capacity from committed to spent; it does not restore available capacity.

Two concurrent Scenario B reservations against the same budget version cannot both reserve the same available pesewas. Two offer acceptances cannot commit the same declared grams. Retrying either with the same key and payload returns the first result; changing the payload under the same key fails.

## Verification checklist for downstream tickets

- Trace both scenarios with integer grams and pesewas and reconcile every lot, allocation, budget event, and financial posting.
- Exercise the millisecond before, at, and after each due time with a server-controlled test clock.
- Race offer acceptance, allocation, budget reservation, purchase collection acceptance, and payment reconciliation.
- Test revocation, cross-programme IDs, copied upload IDs, old revisions, expired holds, missing quality readings, mixed modes, and mismatched idempotency payloads.
- Run warehouse regression tests and confirm no pilot request appears in warehouse run readiness, inventory, storage fees, sales, dispatches, payments, or totals.
- Confirm the complete no-facility path and the separately configured assessed-facility path.
