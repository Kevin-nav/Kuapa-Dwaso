# Wave 1 Implementation Inventory

**Date:** 2026-06-23

**Integration branch:** `codex/wave2-integration-prep`

**Source state:** `master` after Wave 0 plus merged Wave 1 PRs, with PR #5 and PR #6 resolved locally into this branch.

## Conflict Resolution Notes

PR #5, listings and bulk lots, was merged before PR #6 because buyer offers depend on buyer-visible bulk lots.

The final conflict choices were:

- Keep the permission-key model from the merged identity/access work.
- Add PR #5 listing and bulk lot permissions to that model.
- Add PR #6 buyer/deal permissions, deal status transitions, and quantity reservation helpers to the same model.
- Keep PR #5's full `convex/bulkLots.ts` implementation for create/add/remove/recalculate/status workflows.
- Add PR #6's buyer-facing `searchActiveForBuyers` query and available-quantity calculation to `convex/bulkLots.ts`.
- Keep root workspace dependencies on `@kuapa-dwaso/types`, `@kuapa-dwaso/permissions`, and `@kuapa-dwaso/utils`.
- Keep the new `rejected` deal status introduced by the buyer/deal workflow.

## Implemented Backend Foundation

The Convex schema now includes the core MVP tables:

- `users`
- `farmers`
- `agents`
- `buyers`
- `produceListings`
- `bulkLots`
- `deals`
- `transportProviders`
- `transportRequests`
- `approvalRequests`
- `auditLogs`
- `disputes`
- `notifications`
- `appSettings`

Shared packages now define domain roles, statuses, validators, permission helpers, audit shapes, buyer search contracts, deal contracts, hotspot records, and bulk lot calculation utilities.

## Implemented API Foundation

`apps/api` now has:

- health module
- foundation readiness endpoint
- typed API environment helper
- Firebase token verifier provider
- Convex user profile provider
- Firebase auth guard
- role/permission guard decorators
- current principal decorator
- guard tests for Firebase auth and role/permission checks

The API still does not expose product workflow endpoints. Product behavior currently lives in Convex functions.

## Implemented Identity And Access

Implemented pieces:

- Firebase-authenticated request principal shape
- optional auth-disabled development path
- Convex-backed profile hydration by auth provider id
- role and permission guard helpers
- user profile upsert and status update Convex functions

Still missing:

- real deployed Firebase Admin credential wiring
- frontend auth flows
- full endpoint protection across future API routes

## Implemented Agent And Farmer Workflow

Implemented Convex modules:

- `convex/agents.ts`
- `convex/farmers.ts`
- `convex/workflowHelpers.ts`

Implemented capabilities:

- submit agent application
- approve, reject, suspend, and unsuspend agents
- create farmer lead
- complete farmer profile
- assign farmer to agent
- verify or reject farmer
- query farmers by id, farmer code, phone number, assigned agent, and verification status
- audit important agent/farmer changes

Still missing:

- SMS-created farmer lead flow
- frontend agent/admin screens
- sensitive farmer phone/payment-recipient approval flow

## Implemented Listings And Bulk Lots

Implemented Convex modules and utilities:

- `convex/listings.ts`
- `convex/bulkLots.ts`
- `packages/utils/src/index.ts`
- `packages/utils/test/bulkLots.test.mjs`

Implemented listing capabilities:

- create listing
- update listing
- update listing status
- expire a single listing
- mark expired listings in batches
- query listings by agent, farmer, status, crop, and location

Implemented bulk lot capabilities:

- create bulk lot from listing ids
- reject duplicate/incompatible listing membership
- add listing to bulk lot
- remove listing from forming or active bulk lot
- recalculate bulk lot quantity, farmer count, grade, price range, and pickup window compatibility
- update bulk lot status
- buyer-facing active bulk lot search with available quantity

Still missing:

- image upload/provider integration
- scheduled listing expiry job
- UI for listing and bulk lot management

## Implemented Buyer Offers And Deals

Implemented Convex modules:

- `convex/auth.ts`
- `convex/buyers.ts`
- `convex/deals.ts`

Implemented capabilities:

- create or update buyer profile
- get buyer by user id or buyer id
- create offer against buyer-visible bulk lot
- idempotent offer creation with client request id
- validate offer quantity against bulk lot available quantity
- list deals by buyer, agent, bulk lot, or status
- counter offer
- mark accepted pending farmer approval
- update deal status through allowed transitions
- reject or cancel offer
- audit important deal changes

Still missing:

- actual approval engine that turns `accepted_pending_farmer_approval` into `accepted`
- transport request creation from accepted deals
- payment initialization and webhook handling

## Implemented Admin Observability And Intelligence

Implemented Convex modules:

- `convex/admin.ts`
- `convex/auditLogs.ts`
- `convex/disputes.ts`
- `convex/hotspots.ts`
- `convex/observabilityAccess.ts`

Implemented capabilities:

- create audit logs
- list audit logs by entity, recent activity, or filters
- create disputes
- update dispute status
- list disputes by status or entity
- platform summary counts
- recent activity query
- basic supply, demand, and opportunity hotspot scoring

Still missing:

- admin dashboard UI wiring
- richer hotspot demand signals such as buyer searches
- dispute resolution workflows beyond status updates

## Verification Completed

Commands run successfully:

- `corepack pnpm --filter @kuapa-dwaso/permissions typecheck`
- `corepack pnpm --filter @kuapa-dwaso/permissions test`
- `corepack pnpm --filter @kuapa-dwaso/types typecheck`
- `corepack pnpm --filter @kuapa-dwaso/validators typecheck`
- `corepack pnpm --filter @kuapa-dwaso/utils typecheck`
- `corepack pnpm --filter @kuapa-dwaso/utils test`
- `corepack pnpm --filter @kuapa-dwaso/api typecheck`
- `corepack pnpm convex:dev:once`
- `corepack pnpm typecheck`
- `corepack pnpm lint`

Convex one-shot preparation succeeded and confirmed new indexes, including:

- `deals.by_buyer_bulk_lot_client_request`
- `farmers.by_assigned_agent_verification_status`

## Wave 3 Readjustment Recommendations

Keep Wave 3, but adjust its order.

Recommended next order:

1. **Wave 2 integration pass**
   - Normalize actor inputs across Convex modules.
   - Reduce duplicated audit-log helper code.
   - Confirm all cross-module status transitions.
   - Add small integration-level tests or smoke scripts if the repo pattern supports them.

2. **Approvals engine**
   - This is now the highest-leverage next backend feature.
   - Deals already stop at `accepted_pending_farmer_approval`.
   - Build approval requests, locked payloads, approve/reject/expire, and action application.
   - Keep SMS as a later channel; approvals should work without SMS first.

3. **Transport coordination**
   - Schema exists, but workflow functions are not implemented yet.
   - Build transporter profile functions, request creation from accepted deals, matching, assignment, and status updates.

4. **Paystack payments**
   - Payment status exists on deals, but no Paystack provider, payment reference model, initialization endpoint, or webhook handler exists yet.
   - Build after deal acceptance and transport handoff are stable.

5. **Jobs and notifications**
   - Listing expiry exists as a mutation but not as a scheduled/API job.
   - Hotspot scoring exists as a query, but no job endpoint is wired.
   - Notifications table exists, but notification functions are not implemented.

6. **SMS**
   - Still intentionally not implemented.
   - Once approvals are channel-agnostic, SMS can plug into farmer registration, notifications, and approval responses.

Do not start Wave 3 with payments. The approval engine should come first because it is the missing bridge between buyer offers and trusted deal acceptance.
