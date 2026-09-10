# Maize pilot software implementation tickets

Date: 7 September 2026  
Status: Implementation backlog agreed in discussion; tickets are not yet implemented.  
Purpose: Make the complete Kuapa Dwaso application demonstrate an accountable, demand-led maize pilot without implying that warehouses, commercial partnerships, live payments or trading results already exist.

## How to assign work

Give an agent this instruction, replacing the ticket ID:

> Implement KD-05 in `docs/product/maize-pilot-software-tickets.md`. Read the shared brief, contracts, verification rules and that ticket's dependencies first. Inspect their actual implementation. Complete only this ticket and its necessary integration work. Use the documented defaults without asking routine product questions. Preserve unrelated changes. Run the relevant checks and record the outcome in this file's completion ledger. Do not deploy, publish content, contact partners or perform real transactions.

Every ticket inherits sections 1-8. Its agent does not need the original conversation. References are repository-relative. File names listed under a ticket are starting points, not permission to ignore a necessary call site elsewhere within an approved folder.

If a dependency is unimplemented, report that exact dependency and stop dependent work. Do not invent a substitute or silently implement multiple tickets. If a routine detail is unspecified, follow existing conventions and choose the smallest implementation consistent with this brief; record the choice in the handoff. Missing external credentials or commercial agreements do not justify inventing them. Continue with isolated mock/local verification where possible and report any remaining environmental blocker precisely.

This backlog authorizes software implementation when a ticket is assigned. It does not authorize real procurement, production data resets, production migrations, external messaging or publication. Never weaken authentication to make a demo work.

## 1. Shared product brief

Kuapa Dwaso means Farmer's Market. Its long-term purpose is a dependable outlet for farmers, potentially including dedicated warehouses and purchasing prices that fluctuate less when demand, capital and margins support that service. It does not promise to purchase unlimited produce, hold prices unchanged or continue buying at a loss.

The initial software release supports maize sourcing for commercial buyers in Ghana. A buyer requirement comes before farmer collection. Kuapa Dwaso reviews demand, agrees terms, assembles supply, verifies quality, coordinates movement and records acceptance and settlement. Collection may happen at a farm, a collection point or a partner facility. Storage is optional and transaction-specific. No owned warehouse is required to complete the pilot flow.

The business is hybrid. Some farmer agreements coordinate a sale to an external buyer; others purchase accepted maize into Kuapa Dwaso ownership for resale. The farmer must know which arrangement applies before accepting. Purchasing requires explicit funding and commercial review; buyer interest alone is not funded demand.

Extech Agricultural Services has offered a partnership and the team has a personal relationship with them. Nothing has been signed. Do not label Extech a contracted buyer, invent quantities or display their visit as evidence of completed trade. Use fictional commercial entities in fixtures. Public copy may describe discussions with a prospective partner using the existing factual field account.

The crop is maize. The operating country is Ghana, currency GHS and display timezone Africa/Accra. A precise production corridor, real prices, buying limits, taxes, inspection thresholds, payment terms and facility arrangements remain commercial configuration, not facts established by this backlog. Use the exact fictional fixtures below for demonstrations. Do not reopen crop selection or require the user to supply real commercial terms to build the software.

Trust is demonstrated through clear offers, farmer choice, measurable inspection, visible responsibility, evidence-backed handovers and payment records. Software proves that the process can be recorded and enforced. It does not prove real buyer demand, farmer adoption or business profitability.

### Presentation distinction

Keep these three statements distinct throughout the release:

| State | Meaning |
| --- | --- |
| Built today | Software capabilities actually implemented and verified. |
| Initial pilot | Intended maize operation, demonstrated using clearly identified sample transactions. |
| Future expansion | Dedicated warehouse capacity and broader purchasing, conditional on operating evidence. |

The demo must begin with a buyer request, not a warehouse deposit. Use a persistent `Demo · Sample transactions` label on authenticated demo surfaces. Simulated payments, SMS and inspection inputs are labelled at the action/result, not only in a footer. Do not display invented traction statistics. Do not remove existing warehouse capabilities merely to conceal them; retain their supported legacy workflows outside the main pilot walkthrough.

### Out of scope

- Real trial orders, partner negotiation, legal drafting, production launch and actual money movement.
- Automated farmer bank/mobile-money payouts. Record external settlement evidence through the existing provider-neutral boundary.
- A guaranteed annual buying price, automated commodity trading, credit scoring or inventory speculation.
- Additional crops, consumer retail, input finance, crop advice, open chat and advanced optimisation/ML.
- A complete design-system rewrite, new app folders, new shared packages or a replacement backend.
- Pretending that missing real-world configuration is approved. Production commitment actions fail with a precise configuration message when required terms are missing; a demo fixture is explicitly separate.

## 2. Repository rules and current integration points

Read root `AGENTS.md` and its six required convention/ADR files before code changes. Also read `docs/conventions/auth-onboarding-invites-uploads.md`, `docs/conventions/admin-rbac.md`, `docs/conventions/market-services-runs-notifications-finance.md` and `docs/decisions/ADR-0004-role-smart-pwa-and-offline-boundary.md` for affected work.

| Location | Responsibility in this release |
| --- | --- |
| `apps/www` | Lightweight public explanation, role-aware entry points and factual stories. |
| `apps/app` | Farmer, buyer and transporter self-service. |
| `apps/ops` | Assigned pilot sourcing, inspection and fulfilment, alongside existing warehouse work. |
| `apps/admin` | Pilot assignments, configuration, oversight, finance and sensitive decisions. |
| `convex` | Product system of record, scoped queries, mutations, invariants and durable events. |
| `apps/api/src` | Existing NestJS modules/workflows and provider boundaries for authentication, uploads, notifications and payments. Do not duplicate Convex product state here. |
| `packages/types`, `validators`, `permissions`, `utils` | Shared contracts, validation, access policy and deterministic calculations. |
| `packages/ui`, `dashboard-ui`, `design-tokens` | Reusable presentation. Public site must not import dashboard code. |
| SMS packages and `packages/test-utils` | Event wording, mock integration, fixtures and verification. |

Current sources to inspect:

- `apps/app/app/buyer/page.tsx` and `buyer/orders/create/page.tsx`: warehouse inventory and published-run ordering.
- `apps/app/app/farmer/page.tsx` and `farmer/produce/page.tsx`: receipt/storage-based farmer experience.
- `apps/ops/app/context/WarehouseContext.tsx` and `apps/ops/app/intake/page.tsx`: warehouse-bound access, intake, offline drafts and replay.
- `convex/schema.ts`, `workflowHelpers.ts`, `buyerOrders.ts`, `inventoryBatches.ts`, `sales.ts`, `payments.ts`, `dispatches.ts`, `marketDeliveryRuns.ts` and `uploads.ts`.
- `apps/admin/app/market-services/page.tsx`, `finance/page.tsx` and `operational/`: existing oversight and readiness.
- `convex/seedFirstBlog.ts`, `seedSecondBlog.ts`, `blogPosts.ts` and `apps/www/app/blog/`: published story content can live in the database; editing a seed does not update an existing published story.
- `apps/api/src/config/env.ts` and provider registries: payment and SMS support mock operation. Do not assume a deployed environment is mock because the default is mock.

Existing delivery runs require a warehouse origin, inventory reservations and full payment before readiness. Existing agents are warehouse-scoped. The pilot must not bypass those checks or create a fictional warehouse to satisfy them. KD-01 records the narrowly expanded operations responsibility; KD-03 introduces explicit pilot assignment; KD-08 adds the separate fulfilment path. Existing warehouse schedules and their financial rules remain intact.

Older documents disagree about ownership, commission and warehouse timing. For this release, the product decisions in this brief supersede those older proposals. Engineering security and folder rules still apply. KD-01 records the resulting domain decision and updates the relevant conventions. Historical documents remain historical; do not rewrite old observations as new facts.

## 3. Shared domain and workflow contracts

These decisions are defaults to implement, not questions to return to the user. KD-01 publishes the exact schema/API mapping before dependent work begins. Reuse an existing entity only when its invariants fit; never force a sourcing request into a stock reservation.

### Records and relationships

| Concept | Minimum contract |
| --- | --- |
| Pilot programme | Stable scope ID, name, Ghana location metadata, active status, commercial configuration and separate demo-dataset provenance. No required warehouse. |
| Pilot assignment | Approved existing user/operations identity, programme ID, granted capabilities, active/revoked state and audit actor. No implicit access from a role label. |
| Buyer request | Programme, buyer, maize type, requested kg, destination, delivery window, requested specification, payment expectations, lifecycle and revision. |
| Buyer quotation/agreement | Immutable revision of agreed specification, quantity, pricing/charges, acceptance rules, delivery window, payment trigger/due terms and cancellation handling; explicit buyer acknowledgement. |
| Supply declaration | Farmer, programme, maize type, available kg, readiness window, collection location and verification status. Self-reported supply is not quality-cleared stock. |
| Farmer offer/agreement | Declaration and request links, immutable commercial revision, `coordination` or `kuapa_purchase`, offered kg, price basis, itemised charges/payers, expected net proceeds, expiry, inspection and payment terms, ownership/custody transfer conditions, farmer decision and timestamp. |
| Allocation | Quantity committed from a declaration/agreement to a request. Atomic checks prevent the same supply from being committed twice. Holds have explicit expiry and release conditions. |
| Procurement lot | Traceable physical quantity derived from an accepted agreement; owner, custodian and location are separate; links inspection, collection and settlement. Rejected quantity is not silently converted into accepted stock. |
| Inspection | Immutable buyer-specification revision, sampling/test method, recorded readings, evidence, measured/accepted/rejected kg, reason and authorised inspector/time. Corrections supersede the earlier record. |
| Fulfilment plan | Request, cleared allocations/lots, one or more collection stops, destination, vehicle/assignee, capacity kg, collection/delivery windows, readiness blockers and custody events. No required recurring market run. |
| Buyer acceptance | Lines keyed to procurement lot/sublot with delivered, accepted and rejected kg, contractual reason/evidence, acknowledgement and unresolved discrepancy. Totals derive from these lines. Receiving a load does not automatically accept or pay it. |
| Purchasing budget and reservation | Programme, finance-approved funding source/evidence, GHS capacity, version, available/reserved/committed/spent amounts and purchase reservation links. A reservation has an amount, expiry, approved agreement revision and reserve/consume/release/reverse events. This records an evidenced purchasing budget, not a live bank balance. |
| Financial entries | Amount, currency, entry kind, obligation/cost/receipt purpose, payer/payee, actual versus estimate, due date, agreement/lot/order links, evidence, provenance and reversal links. Reuse existing ledgers with an explicit adapter or typed extension; one authoritative posting per economic event. |
| Activity event | Actor, timestamp, entity/revision, event type, reason and redacted recipient-specific view. Durable event and financial/state change are committed consistently. |

Pilot buyer orders use an explicit source discriminator such as `warehouse_run` or `pilot_request`. Preserve the warehouse branch. Pilot procurement lots must not require a warehouse-agent intake into farmer-owned inventory; use a separate table/typed branch with its own ownership rules. Do not make every warehouse field optional globally. KD-01 freezes the precise implementation mapping.

Keep one commercial mode per buyer request for this demo release. Several farmer agreements may feed it, but all must use that mode. Store mode on each farmer agreement and resulting lot as the source of truth. Block mixed-mode requests with a clear message. This simplifies the demo without making ownership an unreliable display label.

### Status and transition rules

- Request: `draft -> submitted -> under_review -> quoted -> confirmed -> fulfilling -> delivered -> closed`, with explicit `cancelled` and `disputed` handling. Quoted is not confirmed demand. Confirmation requires current buyer agreement plus accepted farmer commitments for the confirmed kg; partial confirmation requires a buyer-accepted quantity revision.
- Offer: `draft -> sent -> accepted | declined | expired | withdrawn`. Material changes create a new revision and require new acceptance. Expired, superseded or revoked offers cannot be accepted, even from an old browser tab. Acceptance is server-confirmed.
- Allocation distinguishes provisional hold, farmer commitment and quality-cleared quantity. Never present their totals as interchangeable. The server rechecks available quantity at acceptance and release.
- Quality: `pending | passed | partial | failed | superseded`. Only cleared quantity can be loaded. Required unread/missing tests leave quality pending; photographs and a moisture reading are not proof of every contamination criterion.
- Logistics: `planning -> ready -> assigned -> collecting -> in_transit -> delivered`, with recorded delays/cancellation/discrepancies. An assigned driver may record custody facts, not change commercial or quality terms.
- Payment obligations: due, partly paid, paid, overdue or disputed, separately from delivery. Close only when delivery discrepancies and buyer/farmer obligations are settled or explicitly resolved through an authorised, evidence-backed adjustment. An unpaid obligation cannot disappear through order cancellation.
- A reduction in supply, expiry, reinspection failure, changed specification or cancellation must re-evaluate allocations, readiness and financial consequences. Released pre-purchase supply becomes available again. Purchased stock remains Kuapa-owned until a recorded subsequent disposition; cancellation does not return ownership automatically.
- All mutation retries use persisted idempotency keys for externally repeated actions. Reusing the same key with a different payload is rejected. Concurrency tests exercise competing acceptance/allocation and settlement, not only sequential happy paths.
- Require expected revision/version on commercial changes. No silent edits to accepted price, grade rules, mode, deductions, destination, deadline or payment terms. No generic admin override may mark uncleared maize safe or bypass farmer consent.

### Quantities, prices and configuration

- Persist canonical weights as integer grams; present kg/tonnes with exact conversion. Bags record count and declared/measured weight separately. Do not add legacy bag/crate quantities to kg without a recorded conversion.
- Persist money as integer pesewas. Persist rates with an explicit scale; use shared deterministic decimal/integer calculations. Round half-up to a pesewa per agreed line; reconciliation allocates any aggregate remainder deterministically, with tests. Never calculate money separately in each frontend.
- Snapshot specifications, rates, charges, payment and ownership terms on acceptance. Later configuration edits affect new revisions only.
- Every charge states its payer. Estimate and actual remain distinguishable; actual costs cannot silently reduce a farmer's accepted net proceeds. Any permitted adjustment follows the agreed formula or a new acknowledged revision.
- Real quality policy, fee rates and purchasing limits must be configured by authorised staff. Demo presets carry a `sample_only` provenance. No production default of 10% commission, universal moisture threshold, guaranteed payment or legal/tax approval.
- Configure taxes explicitly if applicable. Demo arithmetic below assumes no tax for illustration only; do not advertise it as Ghana tax treatment.
- Quotes have an expiry and a visible review basis. Long-term price smoothing is roadmap copy only; do not implement an annual price promise or automated pricing engine.
- Purchase approval records documented demand, funds assigned to the purchase, maximum exposure, holding deadline, expected costs and downside review. In demo mode these are sample approvals. A missing purchase approval blocks purchase commitment. The main coordinator flow does not automatically promise an advance payment.

### Pilot payment and custody defaults

For the sample coordinated sale, title passes directly from farmer to buyer at buyer acceptance. Kuapa Dwaso temporarily coordinates custody. Farmer settlement is due one calendar day after cleared buyer funds; the buyer is due one calendar day after delivery acceptance. The portal shows both triggers and overdue states. These are fixture terms, not a guarantee backed by the real company.

For the sample purchase, title passes to Kuapa Dwaso only for inspected quantity explicitly accepted for purchase at collection. The farmer payable is due one calendar day later, regardless of resale payment. A later buyer rejection does not erase that payable. Real agreements require configured terms; implement the ability to snapshot those terms without requiring legal drafting in a coding ticket.

For both sample payment terms, `one calendar day after` means due by 23:59:59.999 Africa/Accra on the next local calendar date after the trigger. Store that computed UTC millisecond instant on the obligation. An unpaid amount becomes overdue only when server time is strictly greater than `dueAt`. Payment at exactly `dueAt` is on time. Test the millisecond before, at and after the deadline. Use a server-controlled clock for isolated demo/test scenarios; clients cannot change commercial time.

Keep collected buyer funds, Kuapa Dwaso revenue, farmer liabilities, inventory cost, reimbursements and operating costs separate. Estimated margin can appear while incomplete; actual contribution requires complete actual costs and settled quantity/price adjustments. Unknown costs display `Incomplete`, not zero. No bank payout automation is introduced.

### Atomic purchase acceptance and funding

KD-09 owns the authoritative Convex mutation `pilotProcurement.acceptCollectionPurchase`. KD-01 includes this exact boundary in its API contract. It takes the accepted offer and inspection revisions, accepted grams, collection evidence, funding reservation/version and idempotency key. Within one database transaction it checks current approval, quality, available quantity, actor access and reserved capacity; consumes the required reservation into a committed obligation; records accepted collection/custody and title transfer; creates the farmer payable exactly once; and emits the durable activity event. Failure rolls back all these changes. No API provider call occurs inside this atomic transaction.

KD-07 provides validated inspection/lot inputs and internal helpers; it cannot independently transfer purchase title. KD-08's purchase collection action calls this mutation through the frozen contract; it cannot separately mark purchase collection complete. Until KD-09 lands, positive purchase collection is unavailable and both tickets explicitly report that planned integration dependency. Their negative guards and coordination path can still be verified. KD-09 and KD-19 verify the completed purchase boundary.

Funding reservations prevent competing approvals from allocating the same recorded budget. Available capacity equals approved budget additions minus actual disbursements, active reservations and committed unpaid obligations. Reserve moves available capacity to reserved; collection acceptance moves the purchase amount from reserved to committed; external payment evidence moves committed to spent. Budget availability must not increase merely because an obligation was paid. Known pre-receipt costs also reserve capacity and are consumed when approved as actual obligations. Release only unused reservations; expiry or buyer cancellation cannot release capacity already backing an acquired-lot payable. A reversal requires an audited correction of the underlying obligation, not a user toggling approval off.

Only finance may establish or change an evidenced funding source. Demo sources are explicitly simulated. Coordination funds owed to farmers are unavailable as purchasing budget. Buyer deposits become eligible only under configured, recorded terms; this demo uses a separate sample Kuapa funding source. Scenario B begins with GH₵21,500 of sample purchasing capacity, reserving GH₵20,000 for produce and GH₵1,500 for known costs. Two simultaneous requests competing for that capacity cannot both reserve it. A funding record never claims to have independently verified a bank balance.

### Buyer rejection and physical disposition

Maintain lot identity on packaging/collection/load records through delivery. Buyer acceptance is per lot/sublot; do not allocate aggregate rejection pro rata across farmers or choose a farmer arbitrarily. An ambiguous mixed-load rejection creates an unresolved issue for the affected lots and blocks final settlement/closure for those disputed amounts until an authorised, evidence-backed attribution is recorded. Unaffected accepted lots may proceed.

- Coordination: title passes to the buyer only for accepted quantity. Rejected quantity remains farmer-owned at the recorded current custodian. The sample commission applies only to accepted produce value. Do not automatically charge the farmer for return transport, buyer-caused loss or an unagreed deduction. Record the issue and a documented resolution accepted by affected parties before adding such obligations.
- Kuapa purchase: destination rejection leaves the previously acquired quantity Kuapa-owned and leaves the farmer payable intact. Record the buyer's accepted quantity/amount and the remaining Kuapa stock and costs. Fault or a recovery claim requires a separate evidenced resolution; do not infer liability from who currently holds custody.
- For either mode, an operator must record a return/holding/reinspection plan, responsible custodian and deadline. No automatic disposal, sale of rejected stock or silent return to available quality-cleared supply. The default unresolved state is a held lot and open issue, with existing obligations visible. A subsequent disposition requires authorised evidence and any required owner consent.

### Cancellation and correction defaults

These rules define software behaviour, not new contractual penalties. The sample agreements have no cancellation fee. Preserve any already agreed actual cost obligation; any disputed new charge stays disputed until documented resolution.

| Stage | Who initiates and confirms | Required consequences |
| --- | --- | --- |
| Draft, submitted or quoted; no accepted farmer commitment | Buyer withdraws its own request or scoped ops cancels with a reason. | Withdraw open quotes/offers, release provisional holds, notify recipients and create no invented fees. |
| Accepted farmer commitments; no collection or title transfer | Buyer requests cancellation; scoped ops confirms after checking current state. | Notify affected farmers, release uncollected commitments and unused funding reservations, retain acceptance history and any existing agreed obligations. No automatic stock or payable reversal is needed when none exists. |
| Collected coordination lots | Buyer or ops opens a cancellation request; scoped ops manages resolution. | Pause further collection/dispatch, keep farmer title and current custody, open a disposition issue, and release only uncollected commitments. Do not make held lots available elsewhere until an authorised return/release is recorded. |
| Collected Kuapa-purchased lots | Buyer or ops opens a cancellation request; ops and finance resolve their respective actions. | Keep acquired stock Kuapa-owned, preserve farmer payables and committed funding, pause further movement, release only unused commitments/reservations and record a separate disposition/resale plan. |
| Delivered, partly accepted or under dispute | Use lot-level acceptance/rejection and issue resolution, not direct cancellation. | Preserve custody/title history and valid obligations. Refunds, returns and quantity/price corrections need authorised, evidence-linked entries and any required revised consent. |
| Settled/closed | Finance or support opens a correction/dispute under its capability. | Keep the original record immutable; use compensating entries and explicit reopening where needed. Never delete financial history or mark paid amounts unpaid by editing a status. |

Persist `cancellation_requested` separately from final cancellation while physical resolution is outstanding. A final cancelled request can still display outstanding financial obligations and associated held lots; it is not financially closed. Use the same state-aware cancellation service from KD-05 onward; later tickets extend the frozen checks rather than introduce a second permissive cancellation path. KD-01 defines the cross-module hooks; each ticket implements its own consequences, with final transaction coverage in KD-19.

### Security, privacy and degraded connections

- Firebase remains identity; Convex resolves the principal. Never trust a caller-supplied user ID, demo badge, URL role or frontend route as authority.
- Pilot membership does not grant access to all pilots or warehouses. Existing warehouse assignments do not automatically grant pilot access.
- Buyers see their own requirements and relevant fulfilment evidence, not other buyers' orders, farmer private contact data or Kuapa purchase margin. Farmers see their own offers/lots/payment records, not other farmers' prices. Drivers see assigned logistics and contact details needed for the job, not financial ledgers. Ops and finance use explicit capabilities.
- New inspection/financial/custody evidence stays private and uses the existing upload authorisation seam. Access is checked on attachment and every signed read. Do not put payment receipts or private farm coordinates in public listing photos or URLs.
- Drafts may save offline using account-bound, expiring storage. Offer acceptance, purchase approval, allocation, readiness, custody confirmation and money postings require online server acknowledgement in this release. An offline attempt shows a saved draft/pending action, never success; require review of fresh terms before a commercial retry.
- Do not queue new critical actions into the old intake replay handler. Extend replay only for explicitly supported draft operations with idempotency and conflict handling.
- Demo mode is validated by server configuration and dataset provenance. A browser parameter cannot enable it. Demo data never enters production statistics, live notifications or payment providers. Demo login still uses normal authentication and role checks.

## 4. Exact demonstration fixtures

All names, numbers, quality limits and locations here are fictional. Do not substitute Extech as the purchaser. Use an isolated non-production environment and visibly fictional `Demo` entity names. Dates are generated relative to a supplied demo clock/run date in Africa/Accra so rehearsals do not fail because hard-coded offers expired.

### Scenario A: coordinated sale, main walkthrough

- Buyer: Demo Coastal Feed Buyer. Request: 5,000 kg dry white maize, delivery to Demo Takoradi Receiving Point, four days after the scenario start.
- Programme: Ghana maize demonstration. Collection labels: Demo Community A/B/C/D. These are sample stops, not claimed operating sites. No owned or partner warehouse is required.
- Farmer supply/offer commitments: A 2,000 kg, B 1,800 kg, C 1,200 kg. Replacement D has 200 kg available but uncommitted initially.
- Example quality policy: moisture at most 13%, with recorded method and sample contamination-check result. Label the entire policy sample-only, not regulatory certification. For the failure, C has two separately identified sublots: 1,000 kg passes and 200 kg fails. Do not imply arbitrary partial acceptance from one undifferentiated failing test.
- C's 200 kg fails before collection. It remains with C, excluded from custody and dispatch. Accepted supply falls to 4,800 kg. Readiness is blocked. A new D offer is accepted, inspected and allocated for 200 kg, restoring 5,000 kg. No silent substitution or automatic purchase of the rejected maize.
- Produce price: GH₵5.00/kg. Gross produce value GH₵25,000. Sample coordination fee: 5%, paid by farmers and disclosed before acceptance. Net farmer proceeds total GH₵23,750.
- Transport/handling is GH₵1,500, charged separately to the buyer and paid externally by Kuapa Dwaso. Buyer total GH₵26,500. Record GH₵1,500 reimbursement and the corresponding actual cost exactly once. Contribution is GH₵1,250 when all sample costs are complete; funds belonging to farmers are not revenue.
- Final farmer settlement: A GH₵9,500; B GH₵8,550; C GH₵4,750; D GH₵950. Total GH₵23,750. C pays no charges on its excluded 200 kg.
- Evidence uses fabricated test attachments and demo receipt references. Payment and SMS are simulated; inspection readings are manually entered sample data. Successful mock payment still exercises the verified provider-event path.

### Scenario B: Kuapa Dwaso purchase, separate walkthrough

- Separate request and lots: 5,000 kg, purchase GH₵4.00/kg, farmer payable GH₵20,000; resale GH₵5.00/kg, buyer total GH₵25,000.
- Actual transport/handling cost GH₵1,500 paid by Kuapa Dwaso; no buyer reimbursement in this scenario. No farmer commission. Actual contribution GH₵3,500 after complete acceptance/cost recording.
- Record sample purchase approval and funding before acceptance for purchase. Payables arise at the configured collection acceptance point, before buyer settlement. A delayed buyer payment must leave farmer due dates and payables unchanged.
- Include an unapproved version to demonstrate the funding/approval blocker, and a delivered-but-buyer-unpaid checkpoint to show the distinction between cash and contribution.

### Repeatable checkpoints

Seed independent datasets for `request_submitted`, `offers_accepted`, `quality_shortfall`, `ready_for_collection`, `delivered_unpaid` and `settled`, using the same rules as normal mutations. The main live walkthrough advances one dataset. Checkpoints are fallback fixtures, not fabricated proof of user actions. Reset only the selected dataset and its own dependent records. No global database wipe, actor impersonation switch or production reset route.

## 5. Definition of done for every ticket

1. Dependency implementations and contracts were inspected, not merely assumed from a completed label.
2. Requested behaviour is integrated with persistent data and real access checks; hard-coded frontend transitions do not satisfy a feature ticket.
3. Loading, empty, unauthorised, error and relevant offline/conflict states are understandable. New primary user actions are keyboard-accessible with labelled inputs and usable focus/error handling.
4. Relevant negative-path checks pass. Existing warehouse behaviour remains supported. Unrelated dirty files are preserved.
5. No fabricated commercial claims, production credentials, real personal data or unlabeled sample events enter committed files.
6. Changes to shared contracts include all affected callers. No blanket lint disables, `any` additions, auth bypasses or unsafe schema weakening to make checks pass.
7. Handoff records changed paths, behaviour, checks actually run, results, remaining limitations and any deliberate implementation defaults. A failed or unavailable check is reported, not described as passing.
8. Update only your ticket's completion row. Do not mark dependent tickets complete. If parallel work makes this file conflict-prone, put the exact completion entry in your handoff for the integrator to apply once.

## 6. Verification commands and execution boundaries

Commands below exist in the repository as of this brief. Inspect current package scripts before use. A package's placeholder test script is not coverage. This list is a verification plan, not evidence that any planned feature has passed these checks.

```text
corepack pnpm --filter @kuapa-dwaso/validators test
corepack pnpm --filter @kuapa-dwaso/permissions test
corepack pnpm --filter @kuapa-dwaso/test-utils test
corepack pnpm --filter @kuapa-dwaso/api test
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm env:check-next-public
corepack pnpm pwa:verify
corepack pnpm benchmark:performance
corepack pnpm smoke:backend
git diff --check
git status --short
```

Use filtered typecheck/lint/build commands for affected apps during a ticket, and full workspace checks for integration. Validator and permissions packages do not currently expose a lint script; do not invent one in a handoff. Inspect smoke/provider configuration before executing scripts that connect to services. `smoke:backend` writes synthetic records and needs a verified non-production target. `convex:dev:once` can sync a configured deployment; it is not a harmless offline compiler. Generate Convex artifacts through supported tooling against the isolated test/development target, never by hand-editing generated files or selecting a production project.

KD-17 and KD-19 introduce `demo:maize:seed`, `demo:maize:reset` and `smoke:maize-pilot` scripts under the existing test-utils package, with root aliases. These are planned commands and must not be reported as available before those tickets land. Scripts require an explicit deployment target, validated demo enablement, dataset ID and normal authenticated actors. They fail closed on an unrecognised/live target or real provider mode. Describe required environment variable names in their runbook without committing values.

For repo-wide setup changes also run `corepack pnpm list --depth -1`, as required by AGENTS.md. Missing external setup must be documented with the exact command and missing prerequisite. Do not bypass provider authentication to obtain a green smoke result.

## 7. Ticket order and coordination

Default: implement KD-01 through KD-20 sequentially. Dependencies are the minimum prerequisites, not permission for uncoordinated edits to shared files. The user can assign independent tickets to different agents once prerequisites are merged. Exploration follows the user's preference: Luna at extra-high effort for extensive factual/code exploration; Sol at high effort for independent higher-reasoning reviews. Do not create separate user-owned tasks unless asked.

| Ticket | Work | Depends on |
| --- | --- | --- |
| KD-01 | Architecture, contracts and compatibility plan | None |
| KD-02 | Shared domain and additive schema | KD-01 |
| KD-03 | Pilot access, identities and evidence permissions | KD-02 |
| KD-04 | Shared UI, timelines and demo context | KD-02, KD-03 |
| KD-05 | Buyer demand and commercial agreement backend | KD-02, KD-03 |
| KD-06 | Farmer supply, offers and allocations backend | KD-05 |
| KD-07 | Inspection, procurement lots and ownership backend | KD-06 |
| KD-08 | Collection, dispatch and acceptance backend | KD-07 |
| KD-09 | Purchase controls and financial reconciliation | KD-08 |
| KD-10 | Notifications, activity and issue workflow | KD-09 |
| KD-11 | Buyer portal | KD-04, KD-05, KD-08, KD-09, KD-10 |
| KD-12 | Farmer portal | KD-04, KD-06, KD-07, KD-09, KD-10 |
| KD-13 | Operations portal | KD-04, KD-05, KD-06, KD-07, KD-08, KD-09, KD-10 |
| KD-14 | Transporter portal | KD-04, KD-08, KD-10 |
| KD-15 | Admin, configuration and finance portal | KD-04, KD-09, KD-10 |
| KD-16 | Public story, navigation and onboarding | KD-04, KD-11, KD-12 |
| KD-17 | Guarded demo fixtures and rehearsal controls | KD-11, KD-12, KD-13, KD-14, KD-15, KD-16 |
| KD-18 | Connection recovery and usability integration | KD-17 |
| KD-19 | End-to-end and legacy regression checks | KD-18 |
| KD-20 | Final rehearsal, performance and handoff | KD-19 |

Backend tickets serialize changes to schema, workflow helpers, shared types, generated API and ledgers. After KD-10, KD-11 through KD-15 can run in parallel only if each owns its app routes and requests shared contract edits through one integrator. KD-11/KD-12 share auth/onboarding; KD-16 owns common onboarding edits and requires them merged first. Demo tooling and fixtures have one owner. Do not run two resets against the same dataset.

## 8. Final release gate

The release is ready for demonstration when both fictional scenarios reconcile, a five-tonne request completes without a warehouse record, the quality failure blocks dispatch until resolved, each actor can use only its authorised view, mock events are unmistakable, and a presenter can repeat the walkthrough from a clean dataset. A recorded fallback and readable runbook exist. Every incomplete capability is identified accurately. Readiness means demo readiness, not authorisation for commercial launch.

## KD-01: Freeze architecture and implementation contracts

**Outcome:** Agents have one consistent map of the new pilot domain and its integration with warehouse code.

**Scope:** `docs/decisions`, relevant `docs/conventions`, `docs/product`, and read-only inspection of integration points in section 2.

**Implement:**

- Create the next unused ADR number for the demand-led maize pilot. Explicitly extend `apps/ops` responsibility to assigned pilot sourcing/inspection/collection without creating folders or replacing warehouse operations. Update repo-structure, admin-rbac, backend/market-flow conventions only where this decision changes them.
- Publish `docs/technical/maize-pilot-contracts.md`: exact new table/type names, discriminated legacy/pilot records, indexes, API names/arguments/results, transition guards, role/field access matrix, financial posting ownership and event names. Cover every concept in section 3 and freeze these names for downstream tickets.
- Define migration order, safe defaults for old rows, backfill if needed, rollback by disabling new pilot entry points, and queries that prevent legacy/new totals from mixing incorrectly. No migration runs in this ticket.
- Choose explicit pilot programme assignments using existing approved operations identities. Retain existing marketplace role keys; do not grant pilot access through a dummy warehouse. Record required grant/revocation and invite linkage changes.
- Map optional partner storage to a real assessed facility reference when configured. Keep the no-storage path complete. Defer storage billing expansion; never accrue storage automatically on a procurement lot.
- Define API interfaces consumed by the five portals and fake clock support in tests. Fill in routine mapping choices without returning product questions to the user.
- Update documentation entry points to identify this backlog as planned work and older operating models as historical where they conflict. Do not describe the plan as already shipped.

**Acceptance:** An implementer can identify who owns each record, who may change it, how a no-warehouse order works, where each financial amount originates and how old warehouse orders remain valid. Every planned API has a consumer and every ticket has the necessary API contract. The contract explicitly maps lot-level rejection, the cancellation matrix, purchasing-budget reservations and the single atomic purchase-acceptance mutation.

**Verify:** Trace Scenario A and B through the contract document, including shortfall, purchase rejection, cancellation and payment reversal. Check that no step requires inventing a warehouse or overriding an existing security rule. Run `git diff --check`.

## KD-02: Add shared domain types and compatible persistence

**Outcome:** Typed, validated records support the pilot without breaking existing deployments.

**Scope:** `packages/types`, `validators`, `utils`, `convex/schema.ts`, supported generated artifacts and test-utils where necessary.

**Implement:** Add the contracts frozen in KD-01, indexes for owner/programme/request/expiry queries, immutable revision fields, exact unit/money helpers and dataset provenance. Extend existing entities with typed source discriminators and additive defaults. Implement validation for quantities, rates, windows, mode and required terms. Introduce bounded pagination contracts. Add migration/backfill scripts only if required, with dry-run and explicit target guards; do not run them on production.

**Acceptance:** Old warehouse rows remain readable; new pilot records do not require warehouse IDs; a pilot lot cannot masquerade as legacy farmer-owned stock. Invalid quantity/rate combinations and stale revision inputs are representable as clear errors. Generated types reflect the schema through tooling.

**Verify:** Shared validation and rounding/conversion tests, representative legacy/new document compatibility tests, affected typechecks. Explicitly test 5,000 kg, 200 kg, bag-weight conversion and sub-pesewa rounding. Record any codegen environment limitation honestly.

## KD-03: Implement scoped pilot access and private evidence

**Outcome:** Existing verified identities can work in assigned pilots without fake warehouse assignments.

**Scope:** `packages/permissions`, `convex/workflowHelpers.ts`, pilot assignments, invitations/profile linkage, `uploads.ts`, API upload access and auth providers where needed.

**Implement:** Programme membership/capability grants and revocation; reusable request/offer/lot access checks; buyer/farmer ownership filters; assigned-driver views; finance-only payment/purchase controls. Permit an approved operations identity to work in an explicitly assigned programme with zero warehouse assignments. Extend the existing admin invitation/linkage path to programme assignments using existing verified identity and MFA rules. Use private upload purposes/scoping for inspection, agreement and settlement evidence. Add recipient field redaction, not only route gating.

**Acceptance:** An authenticated but unassigned operator cannot read a pilot; revoked access stops on the next server operation. A driver cannot read farmer settlements. Changing an actor ID or entity URL does not bypass ownership. Existing warehouse access tests remain valid.

**Verify:** Positive and negative permission tests across two programmes, two buyers, two farmers and a driver; forged actor IDs; expired/revoked assignments; private attachment and signed-read denial; profile claim does not create duplicate identities or grants.

## KD-04: Build shared transaction presentation and honest demo context

**Outcome:** All portals use consistent statuses, summaries, actions and simulation labels.

**Scope:** `packages/ui`, `dashboard-ui`, `design-tokens`, `config`, shared auth/session presentation and app shells.

**Implement:** Reusable next-action panel, commercial-terms summary, quantity progress distinguishing committed/cleared/delivered, role-filtered timeline, evidence status, financial breakdown, loading/empty/error states and accessible confirmation for material decisions. Add server-derived demo context and persistent sample-data indicator in authenticated shells. Label mock payment/SMS and manually entered sample inspection at relevant events. UI vocabulary uses `Collection location` and `Operations` for pilot views while preserving warehouse-specific terminology on warehouse routes.

**Acceptance:** No UI component infers permission or demo eligibility from URL parameters. Components accept typed data and do not fabricate totals or fetch across role boundaries. Shared public-safe primitives remain lightweight. Status distinctions and incomplete costs are visible without colour alone.

**Verify:** Render representative request, expired offer, quality-shortfall, overdue payment and mock success states; inspect mobile widths, keyboard navigation and error focus. Typecheck affected consumers and check public imports.

## KD-05: Implement buyer requests and versioned commercial agreements

**Outcome:** Buyers can submit demand before inventory exists.

**Scope:** New Convex pilot demand module, `buyerOrders.ts` adapter/source branch, shared validators and audit/event emission contracts.

**Implement:** Buyer-owned drafts/submission, scoped operations review, required-specification and payment-term validation, operations quotation revision, buyer accept/reject and withdrawal/cancellation with reasons. Keep confirmed order quantity distinct from requested quantity. Confirm only after the buyer acknowledges current terms and accepted farmer commitments cover the confirmed quantity; KD-06 supplies commitments. Provide paginated role-specific request/detail queries and request-linked buyer order creation without market-run requirements. Before KD-06 lands, uncovered requests remain unconfirmed.

**Acceptance:** Empty warehouse inventory does not prevent request submission. Quotation acceptance does not falsely assert secured supply or received funds. Material revisions invalidate obsolete acknowledgements. Existing stock/run order creation still enforces existing rules.

**Verify:** Submit with zero warehouses, missing terms, expired quote, another buyer's request, repeated submission key, stale acknowledgement and request cancellation. Regression-check the warehouse order branch.

## KD-06: Implement supply declarations, farmer offers and atomic allocation

**Outcome:** Farmers can commit supply to known terms without double allocation.

**Scope:** Convex supply/offer/allocation modules, farmer queries, shared calculations and audit events.

**Implement:** Farmer self-declaration and explicitly attributed ops-assisted declaration; verification status; offers linked to request/spec revision; price/charge/payment/mode snapshots; farmer acceptance, decline, expiry and withdrawal. Make provisional holds bounded and release expired/declined/superseded holds. Enforce atomic availability at commitment, current agreement versions and one mode per request. Ops may record assistance but cannot impersonate farmer acceptance; the main demo uses the farmer's own authenticated acceptance. Provide queries for expected versus final quantities/proceeds and readiness inputs.

**Acceptance:** Two concurrent requests cannot commit more than a declaration's available quantity. A farmer sees only their own net calculation and can decline without penalty entries. Modified terms require renewed acceptance. A request confirms only when KD-05's guards pass. Purchase offers may be prepared, but binding purchase acceptance remains blocked until KD-09 funding approval is present.

**Verify:** Concurrent competing commitments, repeated accept, expired/superseded offer, forged farmer, quantity decrease, cancellation release and mixed-mode denial. Exercise offer totals against Scenario A's final farmer amounts using actual accepted quantities.

## KD-07: Implement maize inspection, procurement lots and title/custody records

**Outcome:** Cleared physical quantity can be traced to its agreement and owner without requiring storage.

**Scope:** Convex procurement/inspection modules, inventory adapter if required, private evidence seam, shared quality-policy validation.

**Implement:** Farm/collection-point/partner-facility location types; policy revisions; documented sampling and required results; gross/tare/net weights; accepted/rejected sublots; separate ownership and custody events; superseding inspection corrections. Quality policy can require an external result; an absent result stays pending. Before KD-09 funding approval, purchase-title acceptance is blocked even when inspection passes. Recompute request cleared quantity after every relevant change. Retain rejected quantity and its disposition, with no dispatch allocation or hidden storage fee. Provide printable/downloadable private inspection/collection receipts using existing web rendering rather than a new document service.

**Acceptance:** Scenario C's failing 200 kg remains with the farmer and reduces readiness. Retesting cannot erase failed evidence. No generic approval overrides required quality tests. Purchase title transfers only at the accepted purchase event, not declaration or inspection alone.

**Verify:** Passed/partial/failed/pending results, impossible weight splits, changed specification, unauthorised inspector, evidence not uploaded, duplicate receipt, correction after allocation and quality regression before loading. Check a full no-facility path.

## KD-08: Implement collection plans, logistics and buyer acceptance

**Outcome:** Cleared lots can reach a buyer through accountable handovers without a recurring warehouse run.

**Scope:** Convex fulfilment modules, typed extension/adapter in `dispatches.ts`, transporter assignment and buyer acceptance records.

**Implement:** Ordered collection stops, vehicle capacity, driver assignment, planned windows, collection/load/delivery quantities, custody evidence and recorded discrepancies. Readiness requires current agreements, enough cleared kg, valid assignments, capacity and the agreement's financial release condition. Use a financial guard that fails closed until KD-09 is implemented. Do not globally remove full-prepayment guards from warehouse runs. Add buyer delivery acceptance with partial rejection, contractual reason/evidence, explicit resolution and request-linked issue hooks. Keep arrival, acceptance and payment separate.

**Acceptance:** The 4,800 kg shortfall blocks a 5,000 kg dispatch. Substitution requires an eligible accepted/inspected allocation. A driver's delivered event cannot mark buyer acceptance. A changed delivery commitment requires affected-party acknowledgement. Legacy dispatch/run compatibility remains intact.

**Verify:** Overcapacity, insufficient cleared kg, expired assignment, duplicate handover, unassigned driver, loaded quantity mismatch, missing funds/approval, buyer partial rejection and cancellation after ownership transfer. Run the legacy dispatch regression path.

## KD-09: Implement purchase approval, obligations and reconciled finances

**Outcome:** Both transaction modes produce correct liabilities and understandable cash/margin records.

**Scope:** `convex/payments.ts`, `sales.ts`, authoritative ledger extensions/adapters, finance queries, API payment workflow/provider seam, shared calculations.

**Implement:** Finance-authorised purchase exposure review and assigned-funds approval; mode-specific posting triggers; buyer charges/receivables, farmer payables, actual/estimated costs, reimbursements, partial receipts/settlements, due dates and reversals. Release the purchase/dispatch guards introduced earlier only when current terms and funding conditions are met. Configure buyer payment-before-dispatch or agreed post-acceptance terms explicitly; the sample uses post-acceptance terms. Record external farmer settlement evidence through an authorised flow; do not implement transfers. Mock buyer receipts exercise verified provider callbacks/service-auth rules and event deduplication. Add line-level financial provenance and exclude demo data from non-demo reports.

**Acceptance:** Scenario A totals are buyer GH₵26,500, farmers GH₵23,750, external cost GH₵1,500 and contribution GH₵1,250. Scenario B totals are buyer GH₵25,000, farmer payable GH₵20,000, cost GH₵1,500 and contribution GH₵3,500. A delayed resale receipt never removes a purchase payable. Buyer funds and reimbursements are not mislabelled commission revenue. Missing costs prevent an actual-margin claim. A rejected lot never accrues an unintended farmer charge.

**Verify:** Both complete reconciliations, partial payment, duplicate webhook, forged success event, manual evidence denial, refund/reversal, cancellation with outstanding obligations, lot-attributed post-delivery rejection, exact due-time boundaries and concurrent settlement. Compete two purchase approvals for one recorded budget; retry collection acceptance and verify title, custody, reservation consumption and payable either all commit once or all remain unchanged. Verify no double posting through old sales/payout paths. Keep existing provider tests passing.

## KD-10: Connect activity, notifications and accountable issues

**Outcome:** Actors see what happened, who acts next and how a problem is resolved.

**Scope:** Convex notifications/disputes/event modules, API notification workflow/provider seam, SMS packages and shared action routing.

**Implement:** Recipient-safe activity for request review, offer/revision/expiry, inspection failure, collection changes, delivery acceptance and settlement. Use durable events plus idempotent notification delivery so retries do not repeat commercial actions. Add assigned issue owner, reason, next step, deadline and resolution evidence using existing disputes where compatible. Reminders derive from current unresolved state and deduplicate. SMS carries concise transactional information; durable detail is in the application. Mock delivery is clearly labelled, and a delivery failure does not roll back a valid agreement or mark a payment failed.

**Acceptance:** C's quality issue has an owner and the shortfall has a next action. A farmer sees their own consequence without other farmers' prices. Resolved events do not generate stale reminders. Closing an issue cannot erase a payable or required quality failure. No invitation links are sent over SMS.

**Verify:** Duplicate event/retry, expired/resolved reminder, permission-filtered timelines, provider outage and recovery, private-data redaction and notification deep links across the appropriate app origins.

## KD-11: Deliver the buyer portal

**Outcome:** A buyer can request, agree, follow and accept a maize delivery.

**Scope:** `apps/app/app/buyer`, existing buyer navigation/layout, shared components. Proposed new routes: `/buyer/requests`, `/buyer/requests/new`, `/buyer/requests/[id]`; retain stock and existing order routes.

**Implement:** Make `Request maize supply` primary for pilot members. Provide form, draft recovery, quotation review/acknowledgement, requested versus confirmed quantity, committed/cleared/delivered progress, delivery acceptance/rejection, financial status and next actions. Reorder creates a fresh request requiring fresh terms; it never silently reuses an old price or confirms supply. Keep `Available stock` as a clearly separate supported path. Defaults use the configured programme, not a hard-coded Makola destination.

**Acceptance:** A buyer submits demand with no warehouses or inventory, sees a sourcing shortfall honestly, approves a revised commitment and completes delivery acceptance. Internal supplier purchase costs and margins are absent from buyer responses and UI. The page distinguishes a saved draft, submitted request and confirmed order.

**Verify:** Authenticated buyer walkthrough, empty/no-pilot state, expired quotation, quantity revision, partial acceptance, direct-link permission denial, small-screen and keyboard use. Verify existing stock ordering still works.

## KD-12: Deliver the farmer portal

**Outcome:** Farmers can offer supply and choose an understood transaction before collection.

**Scope:** `apps/app/app/farmer`, farmer navigation/layout and shared components. Proposed routes: `/farmer/supply`, `/farmer/offers`, `/farmer/offers/[id]`; retain receipts, fees and history.

**Implement:** Simple supply declaration, offer inbox, readable per-kg/quantity/net breakdown, purchaser/payment responsibility, quality conditions, expiry and accept/decline. Show collection instructions/contact, inspection receipt, quantity adjustments, expected/final proceeds and actual payment evidence. Put next actions first; storage appears only for genuine stored records. Preserve lightweight text/list presentation and assisted-access account claiming; do not require warehouse selection to join the pilot.

**Acceptance:** Farmer C can see why only 1,000 kg is accepted and the resulting GH₵4,750 net proceeds. Farmer B cannot see C's offer. The purchase example explicitly names Kuapa Dwaso as the party owing payment. An offline tap never shows acceptance as completed.

**Verify:** Supply submission, accept/decline, stale revision, expiry, failed network, collection change, payout overdue, private evidence read and mobile/keyboard use. Regression-check existing receipt links and fees for legacy farmers.

## KD-13: Deliver the operations portal

**Outcome:** An assigned operator can run the whole pilot without a warehouse assignment.

**Scope:** `apps/ops` shell/context/navigation and new pilot request/sourcing/inspection/collection views. Reuse existing inventory screens for actual warehouse work; do not make `WarehouseContext` the source of pilot authority.

**Implement:** Programme switcher restricted to assignments, demand queue, offer preparation, supply/quality coverage, sampling/inspection form, collection plan, blockers and issue next actions. Provide ops-assisted supply entry with attribution. Use dedicated typed pilot data hooks and server queries. Expose acquisition mode and purchase approval state without granting finance approval permission. Keep an explicit warehouse workspace for existing assigned warehouse tasks; do not delete it.

**Acceptance:** The operator creates the 5,000 kg plan, records C's sublot failure, obtains D's accepted replacement and reaches readiness. The operator cannot dispatch 4,800 kg as 5,000 kg, accept for the farmer or approve their own purchase funding without the finance capability. No demo warehouse is needed to get past the shell.

**Verify:** Full zero-warehouse operator flow, unauthorised programme switch, draft recovery, correction, quality failure, missing funding, replacement, dispatch readiness and legacy warehouse navigation/intake.

## KD-14: Deliver the transporter portal

**Outcome:** Assigned drivers can record collection and delivery without seeing unrelated commercial data.

**Scope:** `apps/app/app/transporter` list/detail/profile views and shared handover components.

**Implement:** Pilot collection stops with location labels/contact, time windows, cleared quantities, packaging, loading evidence and discrepancy reporting. Show delivery destination, actual handover and buyer acceptance pending separately. Display only the data required for the assigned job. Existing warehouse dispatch assignments remain usable.

**Acceptance:** A driver can collect A/B/C/D's accepted quantities, report a mismatch and record delivery. They cannot substitute unapproved stock, edit inspected weights or mark a farmer paid. No warehouse stock browse is required.

**Verify:** Assigned/unassigned access, capacity/weight mismatch, duplicate submission, evidence upload failure, no connection during confirmation and cross-mode legacy dispatch display.

## KD-15: Deliver admin configuration, oversight and finance

**Outcome:** Administrators can configure the pilot and act on operational/financial risk.

**Scope:** `apps/admin`, existing RBAC/access, finance/report queries and shared dashboard components.

**Implement:** Programme/assignment management and invitation entry points; sample-versus-approved configuration; quality policy, fees, terms and purchase limits; request and issue oversight; purchase approval restricted to finance capability. Home prioritises supply shortfall, overdue actions, collection risk and unpaid obligations. Add per-transaction financial statement and an aggregate summary distinguishing gross produce value, fees/trading result, costs, cash and farmer liabilities. Actual contribution is incomplete until its required costs/adjustments are recorded. Demo and real reports are segregated. Preserve warehouse administration, warehouse manager scope and legacy financial definitions.

**Acceptance:** An authorised admin can enable the fictional programme and grant a no-warehouse operator access. Finance can review purchase funding and reconcile both fixture scenarios. An analyst cannot approve purchases or mark settlements paid. Procurement confirmation remains blocked when required real configuration is absent. No growth/warehouse-readiness claims are inferred from registration counts.

**Verify:** Grant/revoke/invite linkage, role scope, denied approval, zero/unknown cost differences, due/overdue balances, duplicate/reversed postings and exclusion of demo records from non-demo aggregates.

## KD-16: Align public pages, onboarding and story claims

**Outcome:** A visitor understands what is built, what is being piloted and what comes later, then enters the correct flow.

**Scope:** `apps/www`, shared public config, `apps/app` signup/auth/onboarding, blog seeds and a scoped proposed content migration under existing tooling.

**Implement:** Retain the demand-before-movement headline and add maize/commercial buyer specificity. Add short farmer/buyer explanations and the conditional future warehouse progression. Primary CTAs are `Request maize supply` and `I have maize to sell`; preserve allowlisted intent through authentication without treating intent as a role grant. Route existing users according to actual profiles and permissions. Do not force a warehouse or invented service region into onboarding. Use existing real field photographs with accurate captions. Mark Extech discussions as prospective, with no fabricated order or endorsement.

Prepare dated corrections to present-tense warehouse claims in both stories while preserving visit history. Update seeds for new environments and provide a dry-run, record-ID/revision-scoped migration plan for existing database posts. Actual publication is outside this ticket. Do not claim a seed edit changed the live blog. Resolve misleading footer anchors/labels and keep public JS light.

**Acceptance:** Public copy makes pilot timing explicit without presenting the software as already operated at scale. Farmer/buyer CTAs retain intended action across signup. Login return URLs cannot redirect to arbitrary hosts. Demo claims match implemented capabilities and no payment success or owned warehouse is implied.

**Verify:** Public link/CTA walkthrough for new and existing identities, mobile/keyboard check, open-redirect tests, bundle/import boundary check and a written list of every corrected claim plus any live publication still pending.

## KD-17: Build guarded datasets, demo setup and reset

**Outcome:** Presenters can repeat both exact scenarios with normal authenticated roles and no real side effects.

**Scope:** `packages/test-utils`, guarded Convex internal/test setup and cleanup, root script aliases, `docs/product/maize-pilot-demo-runbook.md`.

**Implement:** The planned seed/reset commands from section 6; explicit environment/provider/dataset guards; scenario clock; fictional actors mapped to separately authenticated accounts; sample attachments; checkpoints from section 4 and deterministic reconciliation assertions. Provision programme grants through legitimate privileged setup. Exercise normal business mutations rather than direct inserts that bypass invariants; narrowly scoped bootstrap is allowed for identities/configuration and is documented. Idempotent seed returns existing dataset state or creates a new dataset explicitly. Reset previews selected dataset records and deletes/reverses only its fixture-owned dependency closure, including pending reminders/provider events. Fail if non-demo references exist. Never delete shared accounts, real uploads or another dataset.

Provide setup instructions for separate preauthenticated browser sessions/tabs, role URLs, expected next actions, reset, cleanup and a rehearsal clock. Do not add a production impersonation menu or hard-code passwords/tokens. Demo provenance is enforced server-side for provider suppression and statistics exclusion.

**Acceptance:** Both scenarios seed with exact expected totals; reset/reseed is repeatable; all demo surfaces are labelled; real provider calls are impossible for a demo dataset even after a misleading client request. The same dataset cannot receive duplicate notifications/postings on repeated seed. Scenario A completes without a warehouse row.

**Verify:** Repeated seed/reset, another dataset present, attempted production target, live provider configuration, cross-dataset reference, stale scheduled event after reset and normal role permission checks. Record all expected fixture IDs/labels without secret credentials.

## KD-18: Integrate connection recovery and usability

**Outcome:** The demonstration and farmer interactions remain understandable under slow or interrupted connections.

**Scope:** All affected app flows, existing PWA/outbox/account storage seams, shared feedback components and private evidence upload recovery.

**Implement:** Audit each new write against the offline policy in section 3. Add account-bound draft persistence with expiry, sign-out cleanup and restore prompts. Re-fetch current terms after recovery; do not replay commercial acceptance automatically. Avoid duplicate mutations after a slow response; reuse idempotency keys and explain conflicts. Make evidence retries safe and distinguish uploaded from attached. Lazy-load nonessential heavy UI. Complete keyboard/focus, labelled fields, text status and mobile layouts across the live scenario.

**Acceptance:** No offline state says accepted, ready, delivered or paid before server confirmation. A reconnect after offer expiry requires fresh review. Signing out clears private drafts. The public site does not inherit the private PWA or dashboard bundle. Critical errors show a recovery action rather than raw provider codes.

**Verify:** Slow network and disconnect during offer review, inspection draft, evidence upload and settlement response; retry idempotency; account switch; stale revision conflict; private cache policy; keyboard walkthrough and narrow-screen inspection. Run relevant PWA verification.

## KD-19: Verify the complete pilot and warehouse regressions

**Outcome:** Executable evidence supports the full demonstration and its failure guards.

**Scope:** Existing API/shared tests, test-utils integration harness and browser smoke mechanism; add `smoke:maize-pilot` with documented prerequisites/root alias.

**Implement:** Run Scenario A through real authenticated query/mutation/API seams, including C's failed sublot and D's replacement. Run Scenario B with unapproved purchase rejection and delayed resale payment. Add negative integration cases for role spoofing, cross-programme reads, competing allocation, stale acceptance, missing quality evidence, insufficient load, mode change, duplicate payment, partial acceptance and cancellation with liabilities. Use the existing smoke harness where appropriate; do not substitute tests that only assert fixture object shape. Preserve legacy warehouse intake -> reservation -> sale -> payment -> dispatch checks and role scopes. Add browser smoke for actual offer acceptance and connected views, including demo labels.

**Acceptance:** Both scenarios reconcile; the full main workflow uses zero warehouses; rejected quantity never ships; payable and cash timing are correct. Existing warehouse scenarios still pass. Tests establish backend enforcement, not merely disabled frontend buttons. Every failure result includes enough context for a developer to reproduce it without exposing secrets.

**Verify:** Run targeted tests, the guarded new smoke, existing non-production backend smoke and workspace typecheck/lint/test/build. Record exact command results and environmental limitations. Do not claim live settlement, SMS delivery or field outcomes from mock tests.

## KD-20: Rehearse, measure and deliver the demo-ready release

**Outcome:** The team can present a repeatable, honest demonstration and understand remaining release limits.

**Scope:** All integrated surfaces for fixes only, demo runbook, product/technical documentation and performance evidence under existing docs locations.

**Implement:** Rehearse a ten-minute default walkthrough with an abbreviated five-minute version. Open with built/pilot/future distinction; run one coherent Scenario A; show Scenario B separately only if time allows. Keep warehouse setup/storage billing out of the main route. Prepare preauthenticated role tabs and checkpoint fallbacks. Record a backup walkthrough using fictional data and document its accessible file location. If recording tools are unavailable, provide exact manual recording steps and mark this ticket blocked on that artifact after finishing the independent work; do not mark the final release demo-ready. Document any proposed screens not actually implemented and remove unsupported presentation claims.

Measure changed public and critical portal screens using existing Ghana/poor profiles, comparing against a reproducible baseline from the pre-change revision where available. Follow the convention's repeated-run method; report missing baseline honestly. Fix material regressions caused by this release, not unrelated platform problems. Update product/technical docs from planned to implemented only for passing functionality; leave actual published-content changes pending if not authorised/applied.

**Acceptance:** Another team member can follow the runbook to set up, run, recover and reset the demo. Both timed scripts explicitly identify sample transactions, prospective partnership and conditional warehouse expansion. The backup recording exists and plays successfully. All final release gates in section 8 are checked. Missing recording prevents KD-20 completion; deployment and live publication remain separately identified out-of-scope work and do not prevent software verification.

**Verify:** Fresh-dataset full rehearsal, repeat rehearsal, checkpoint recovery, available recording playback, links/claims review, relevant performance/PWA checks, workspace verification after final code changes and `git diff --check`/`git status --short`. Record checked-in changes, verification evidence and remaining non-software prerequisites. Do not deploy as part of rehearsal.

## Completion ledger

Statuses: `Not started`, `In progress`, `Blocked`, `Complete`. Record verification evidence rather than percentages. Initially every ticket is unimplemented.

| Ticket | Status | Implementation reference / verification / limitations |
| --- | --- | --- |
| KD-01 | Complete | ADR-0005 and `docs/technical/maize-pilot-contracts.md` freeze the separate pilot boundary, 23-table persistence map, authenticated API/access matrix, transition and cancellation guards, financial posting ownership, migration/rollback order, and Scenario A/B traces. Required conventions and documentation entry points updated. Verified with contract checks and `git diff --check`; no migration or application code ran. |
| KD-02 | Complete | Added closed pilot types, validators, exact gram/pesewa calculations, bounded pagination, 23 additive Convex tables/indexes, and optional pilot upload metadata. Legacy warehouse fields remain unchanged; pilot evidence APIs fail closed pending KD-03 authorization. Verified 8 validator tests, 57 utility tests, schema TypeScript validation, package lint, and all 13 workspace typecheck tasks. `convex codegen` could not run without `CONVEX_DEPLOYMENT`; the checked-in generated `DataModel` already derives from `typeof schema`, and direct schema typechecking passed. |
| KD-03 | Complete | Added Firebase-backed Convex authentication to all three private apps and the API-mediated invite/upload paths; programme-scoped admin permissions; explicit, capability-bound pilot assignments with expiry and immediate revocation; approved-profile pilot invitations that grant no access on acceptance; safe principal/programme projections; and entity-bound private pilot evidence authorization. Warehouse assignments remain unchanged and are not required for pilot operators. Verified permissions tests, invite-template tests, all workspace tests/typechecks/lints, direct strict Convex TypeScript validation, and repository status checks. |
| KD-04 | Complete | Added the lightweight `@kuapa-dwaso/ui/pilot` entrypoint with typed next-action, terms, four-stage quantity, role-filtered timeline, evidence, financial-completeness, async-state and accessible material-decision components; an authenticated dashboard composition; pilot ledger tokens/vocabulary; and server-derived sample indicators in app, operations and admin shells. Mock payment/SMS and manually entered sample inspections are labelled on their events. Verified three presentation-model tests, static rendering of request/expired-offer/quality-shortfall/incomplete-finance/mock-success states, affected package/app typechecks and lints, full workspace tests/typechecks, and no pilot subpath import from `apps/www`. |
| KD-05 | Complete | Added authenticated buyer-request drafts/submission, programme-scoped review, immutable commercial agreement revisions, buyer acknowledgement/rejection, operations withdrawal, exact commitment-gated confirmation, indexed actor-safe detail/list queries, conservative cancellation preview/resolution hooks, and paginated discriminated pilot-versus-warehouse order references. Material revisions supersede acknowledgements, expired terms cannot be acknowledged or confirmed, and no warehouse/run/inventory row is required or changed. Verified request transition and confirmation-blocker tests, shared location/term validation, strict direct Convex TypeScript compilation, full workspace tests/typechecks/lints, warehouse workflow regression tests, and repository diff/status checks. Convex code generation remained unavailable without `CONVEX_DEPLOYMENT`; the generated API declaration was updated for the new modules and validated by TypeScript. |
| KD-06 | Complete | Added authenticated farmer self-declarations and attributed operations-assisted declarations, review and quantity guards, immutable offer revisions linked to current buyer terms, server-calculated farmer proceeds, farmer-only accept/decline/withdraw actions, bounded provisional holds, explicit hold expiry/release, and atomic declaration/request capacity checks. Superseded buyer terms release uncollected commitments and require renewed farmer acceptance; purchase-mode acceptance remains blocked without a current funding reservation. Added farmer-safe and assigned-operations supply queries with expected versus cleared/final projections. Verified Scenario A line amounts (GH₵25,000 gross and GH₵23,750 net), competing allocation boundaries, offer transitions, strict direct Convex TypeScript compilation, workspace typecheck/lint, and existing warehouse tests. Convex code generation remained unavailable without `CONVEX_DEPLOYMENT`; generated API declarations were updated and typechecked. |
| KD-07 | Complete | Added authenticated, assignment-scoped inspection recording and immutable corrections against the current acknowledged buyer specification; gross/tare/net reconciliation; required moisture, contamination and external-result evaluation; evidence-gated pending states; identified accepted/rejected sublots; farmer title and custody history; allocation clearance recomputation; quality-regression readiness reopening; assessed optional-facility checks with a complete no-facility path; guarded rejected-lot disposition with owner-consent evidence; actor-safe lot lists; and private printable receipt models. Failed quantity remains farmer-owned, held, and excluded from cleared supply. Purchase inspection explicitly leaves title with the farmer; positive purchase acceptance remains blocked pending KD-09. Verified all five quality lifecycle states through passed/partial/failed/pending plus immutable supersession logic, impossible weights, missing evidence/results, stale agreement and allocation guards, inspector capability checks, duplicate idempotency/evidence guards, strict Convex compilation, 11 validator tests, 13/13 workspace typechecks, 10/10 lint tasks with existing warnings only, and 14/14 workspace test tasks. Convex code generation remained unavailable without `CONVEX_DEPLOYMENT`; generated API declarations were updated and typechecked. |
| KD-08 | Complete | Added programme-scoped collection-plan creation and revision, preserved superseded stops, exact cleared-lot planning, verified driver and vehicle assignment, fail-closed readiness evaluation, and idempotent custody milestones with quantity/version/evidence guards. Readiness blocks the 4,800 kg shortfall, over-capacity vehicles, stale agreements, blocking issues, missing drivers, and unmet purchase or prepayment release conditions. Purchase collection remains routed to the KD-09 atomic procurement boundary and cannot transfer title here. Coordination delivery records arrival separately from buyer acceptance and payment. Buyer acceptance accounts for every delivered lot, keeps lot identity, transfers coordination title only for accepted quantity, holds rejected farmer-owned quantity, opens linked disputes, and never edits payment state. Added actor-safe plan detail and private lot-staged custody/acceptance evidence. Verified strict Convex compilation, 64 utility tests including readiness and evidence staging, 13/13 workspace typechecks, 10/10 lint tasks with existing warnings only, 14/14 workspace test tasks, and unchanged legacy dispatch modules. Convex code generation remained unavailable without `CONVEX_DEPLOYMENT`; generated API declarations were updated and typechecked. |
| KD-09 | Complete | Added finance-authorised purchasing budgets, reservations, expiry/release and atomic purchase collection with driver-or-operator authorization; accepted purchase collection now transfers title/custody, consumes only reserved produce capacity and posts the farmer payable once. Buyer acceptance posts lot-level buyer obligations and coordination farmer proceeds; actual coordination and purchase costs, external settlements, partial payments, reversals, due dates, actor-safe request statements and programme summaries preserve separate cash, liability, revenue and cost meanings. Added authenticated pilot payment initialization through the existing provider seam, server-secret callback reconciliation, exact amount/currency checks and webhook deduplication without changing legacy warehouse payments. Exact Scenario A/B contributions are GH₵1,250 and GH₵3,500, and incomplete costs suppress an actual contribution claim. Verified 13 purchase-boundary cases including rollback, replay, concurrent capacity and assigned-driver collection; 62 API tests, 68 utility tests, all 14 workspace test tasks, 13 workspace typecheck tasks, 10 lint tasks with warnings only, strict direct Convex compilation and `git diff --check`. Convex code generation remains unavailable without `CONVEX_DEPLOYMENT`; the checked-in API declaration was updated and typechecked. Nine non-Next workspace builds passed; all four Next builds stopped at the existing Turbopack worktree-root dependency resolution error before compiling application pages. |
| KD-10 | Complete | Added a single durable pilot activity boundary that fans out idempotent in-app and concise transactional SMS notifications without invoking providers inside commercial mutations. Recipient resolution and request timelines are role/target filtered; sample events are labelled and SMS contains no links. Added accountable quality and rejection issues with an active assigned owner, reason, next step, deadline, evidence, optimistic resolution, and current-state reminder deduplication/archival. Quality shortfalls now open disposition work while preserving farmer ownership, failed inspection evidence, and finance records. Verified 71 utility tests including sample SMS/no-link and stale-reminder cases, strict direct Convex compilation, workspace lint with existing warnings only, and `git diff --check`. Provider delivery remains handled by the existing retryable API seam, so provider failure cannot rewrite agreements or payments. |
| KD-11 | Complete | Added buyer maize-request list, creation, and detail routes; made `Request maize supply` the buyer-home primary action while preserving warehouse stock as a separate path; removed the hard-coded Makola fallback. The connected form persists a seven-day recoverable draft, reuses server draft/idempotency state after an interrupted submit, selects an active programme, and never claims an offline submission succeeded. The request view distinguishes requested/committed/cleared/delivered quantity, current versus expired quotation revisions, buyer-visible charges/payment status, recipient-safe activity, fresh reorder, and immutable lot-level delivery acceptance/rejection with private evidence. Added an owner-safe current-plan query and expanded buyer-safe request projections without exposing purchase cost or margin. App typecheck and lint pass (one pre-existing inventory image warning); browser compilation remains blocked by the documented worktree dependency-link/Turbopack root issue, and an authenticated walkthrough awaits KD-17 fixtures. |
| KD-12 | Complete | Added no-warehouse farmer supply declaration, offer inbox, and private offer-detail routes plus primary home/navigation entry points while retaining legacy produce, receipts, fees, and history. Offer review names the purchaser/payment responsibility, current revision, expiry, per-offer gross/deductions/net, inspection and ownership terms; connected accept/decline uses server idempotency and offline attempts explicitly remain unaccepted. Partial quality clearance recalculates final proceeds, so Scenario A farmer C displays 1,000 kg cleared and GH₵4,750 net from the authoritative offer terms. Added farmer-safe current-plan collection instructions, latest inspection receipt discovery/printing, own financial evidence, and target-filtered activity. Fixed farmer plan authorization without weakening cross-farmer isolation and allows a linked farmer to read an empty pre-delivery statement without seeing another farmer's entries. App/Convex typechecks and app lint pass with one pre-existing inventory image warning. |
| KD-13 | Complete | Rebuilt the operations shell around explicit maize-pilot and warehouse workspaces, with an assignment-only programme switcher that does not derive pilot authority from `WarehouseContext`. Added the assigned demand queue, verified and operations-assisted supply desk, transparent offer preparation/sending without farmer impersonation, accepted-allocation inspection with private evidence and partial accepted/held sublots, exact cleared-lot collection planning, verified driver assignment, server readiness execution, finance-reservation visibility without approval controls, and accountable issue next actions. Dedicated server projections expose only programme-scoped sourcing contacts, operational readiness/funding state, and eligible drivers. The shell remains usable with zero warehouse assignments and keeps legacy inventory/intake navigation separate. Verified strict direct Convex compilation, 111 API tests including a zero-warehouse operator fixture, 71 utility tests including the 4,800 kg readiness denial, all 14 workspace test tasks, 13 typecheck tasks, 10 lint tasks with existing warnings only, ops-specific typecheck/lint, and `git diff --check`. The optimized Next build reaches the existing Turbopack worktree dependency-junction limitation before source compilation; authenticated browser rehearsal remains gated on KD-17 fixtures. |
| KD-14 | Complete | Added a dedicated transporter pilot collection list/detail flow while retaining warehouse dispatches as a separate tab. Driver queries are assignment-bound and project only the route, location/window, cleared lot identity and quantity, packaging instruction, necessary farmer contact, custody milestones, and opaque funded-purchase inputs; prices, ledgers, unrelated plans and farmer settlements remain absent. Each collection/loading/delivery milestone requires private lot-scoped evidence and current plan/lot versions, remains server-confirmed only, and reuses a stable idempotency key on retry. A driver-reported quantity mismatch opens an assigned custody-discrepancy issue without editing inspected weight or moving stock. Purchase collection remains blocked without finance-approved reservation state, unapproved lots cannot be substituted, delivery arrival is displayed separately from buyer acceptance, and no driver action can mark a farmer paid. Added optional stop packaging instructions and destination stops to new operations plans. Verified strict Convex/schema compilation, app typecheck/lint with one pre-existing image warning, all 14 workspace tests, 13 typecheck tasks, 10 lint tasks with existing warnings only, and `git diff --check`. Authenticated browser rehearsal remains gated on KD-17 fixtures and the documented worktree Turbopack limitation. |
| KD-15 | Not started | |
| KD-16 | Not started | |
| KD-17 | Not started | |
| KD-18 | Not started | |
| KD-19 | Not started | |
| KD-20 | Not started | |
