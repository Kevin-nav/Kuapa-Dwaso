# Maize preview runbook

This temporary flow presents Kuapa Dwaso as the coordinator between farmers,
buyers, transporters, and operations. Kuapa Dwaso does not buy or resell the
maize in this flow. The setup creates no purchasing budget, funding reservation,
purchase approval or warehouse. It records buyer-to-farmer maize obligations,
a configurable 3% seller-side coordination fee, and separate buyer transport
and handling charges. Operations receives a lightweight approved
profile with no assigned warehouses so its name and role display correctly.

The command creates or reuses four shared identities:

| Role        | Name           | Prepared work                          |
| ----------- | -------------- | -------------------------------------- |
| Farmer      | Ama Mensah     | Three accepted maize offers            |
| Buyer       | Adwoa Owusu    | Three confirmed maize requests         |
| Transporter | Kwame Asare    | Three assigned collection jobs         |
| Operations  | Akosua Boateng | Three inspections and collection plans |

The three routes contain 100, 150, and 200 bags of 50 kg maize. The first
request combines 40 bags from the shared farmer with two 30-bag background
farmer lots. Those two background profiles have no Firebase login and use the
team-owned farmer phone for collection contact. Buyer projections show only
anonymous numbered collection points; operations and the assigned transporter
retain the exact source contacts. Convex stores
the quantities as 5,000 kg, 7,500 kg, and 10,000 kg.

## Configure the setup window

Set these values outside the repository:

```text
PREVIEW_SETUP_CONVEX_URL
PREVIEW_SETUP_ADMIN_FIREBASE_UID
PREVIEW_ACCESS_FARMER_FIREBASE_UID
PREVIEW_ACCESS_BUYER_FIREBASE_UID
PREVIEW_ACCESS_TRANSPORTER_FIREBASE_UID
PREVIEW_ACCESS_WAREHOUSE_AGENT_FIREBASE_UID
PREVIEW_FARMER_PHONE_NUMBER
PREVIEW_BUYER_PHONE_NUMBER
PREVIEW_TRANSPORTER_PHONE_NUMBER
PREVIEW_OPERATIONS_PHONE_NUMBER
PREVIEW_CLEANUP_DEPLOYMENT
PREVIEW_CLEANUP_START_AT
PREVIEW_CLEANUP_END_AT
PREVIEW_ACCESS_CUTOFF_UTC
FIREBASE_PROJECT_ID
FIREBASE_SERVICE_ACCOUNT_JSON_BASE64
NEXT_PUBLIC_FIREBASE_API_KEY
```

Use four distinct E.164 phone numbers controlled by the team. Put the same
numbers in `PREVIEW_SMS_RECIPIENT_ALLOWLIST`. The private admin UID must differ
from all four shared-account UIDs.

Current time must fall inside the cleanup window. The window cannot exceed 14
days. Leave at least 10 hours between setup and the access cutoff so all three
prepared routes have valid collection and delivery windows.

## Review and execute

The command is a dry run unless `--execute` is present:

```text
corepack pnpm preview:setup
```

The dry run checks the deployment, Firebase UID and phone ownership, the
private admin identity, and the bounded time window. It prints the accounts and
records it will prepare without writing data.

After reviewing that output, run:

```text
corepack pnpm preview:setup -- --execute --confirm=PROVISION_PREVIEW_ACTORS
```

The script uses the normal self-onboarding mutations for the farmer, buyer, and
transporter profiles. One admin-authenticated setup mutation then creates or
updates the exact `MAIZE-PREVIEW-2026` programme, verifies those profiles,
creates the zero-warehouse operations profile, grants a time-bounded pilot
assignment, and prepares the three ready coordination jobs. The mutation fails
if its programme code, seed keys, actors, or existing jobs point to unrelated
data.

The programme and every setup-created request carry server-side preview
markers. The backend ignores funding and warehouse-profile requirements only
when all of these conditions hold:

- The programme is active with live provenance.
- Its `previewCoordinationUntil` timestamp is still in the future.
- The request is a coordination request marked by the server while that
  programme is active. Browsers cannot submit this marker.

An expired, unmarked, sample-only, or Kuapa-purchase request uses the normal
production finance and warehouse checks.

Save the `cleanupEnvironment` object printed by a successful run. It contains
the exact programme, four public user IDs, and two background farmer user IDs
required by `preview:cleanup`.

## Open public access

Deploy the programme ID printed by setup:

```text
PREVIEW_ACCESS_ENABLED=true
NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED=true
NEXT_PUBLIC_PREVIEW_PROGRAMME_ID=<programme ID printed by preview:setup>
NEXT_PUBLIC_DEMO_PRESENTATION=false
```

The preview flag hides warehouse navigation and purchasing controls. The admin
still sees read-only marketplace totals and per-request coordination balances.
It does not authorize backend actions. Convex uses the expiring markers and
authenticated identities for that decision.

Keep `PREVIEW_SMS_RECIPIENT_ALLOWLIST` limited to team-owned numbers. The normal
limit is 12 segments per phone number per UTC hour. The approved event date can
use the higher limit:

```text
PREVIEW_SMS_HOURLY_SEGMENT_LIMIT=12
PREVIEW_SMS_HIGH_CAPACITY_UTC_DATES=2026-09-17
PREVIEW_SMS_HIGH_CAPACITY_HOURLY_SEGMENT_LIMIT=120
```

Messages to other numbers and promotional SMS remain blocked.

## Close access and remove records

Turn off both access flags first. Preview the session revocation, then execute
it with its separate confirmation:

```text
corepack pnpm preview:revoke-sessions
corepack pnpm preview:revoke-sessions -- --execute --confirm=REVOKE_PREVIEW_SESSIONS
```

Allow up to one hour for an already-issued Firebase ID token to expire. Then
preview database cleanup:

```text
corepack pnpm preview:cleanup
```

Review every count and warning. Execute only after the operator confirms the
programme ID, four public user IDs, two background farmer IDs, and time window:

```text
corepack pnpm preview:cleanup -- --execute --confirm=DELETE_PREVIEW_WINDOW_DATA
```

Cleanup accepts only the bounded preview programme, deletes matched transaction
records and the two background-only farmer profiles/users, and closes the
programme. It does not delete the shared Firebase accounts or the public farmer,
buyer, transporter, and operations profiles.
