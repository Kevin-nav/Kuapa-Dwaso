# Maize preview runbook

This runbook prepares four shared profiles on one existing live maize
programme. It does not create or reconfigure a programme, weaken application
permissions, or expose an admin account on the public login pages.

The setup command creates or reuses these Firebase and Convex identities:

| Role        | Profile name   | Prepared activity                      |
| ----------- | -------------- | -------------------------------------- |
| Farmer      | Ama Mensah     | Three accepted maize offers            |
| Buyer       | Adwoa Owusu    | Three confirmed maize requests         |
| Transporter | Kwame Asare    | Three ready, assigned collection jobs  |
| Operations  | Akosua Boateng | Three inspections and collection plans |

Every prepared quantity uses 50 kg bags. The records contain 100, 150, and 200
bags, equal to 5,000 kg, 7,500 kg, and 10,000 kg. The interface presents these
as hundreds of bags; kilograms remain the canonical stored unit.

## Before setup

Choose one programme that is already active, has live provenance, and has an
approved live maize quality policy. Record its exact Convex ID in
`PREVIEW_CLEANUP_PROGRAMME_ID`. Set `NEXT_PUBLIC_PREVIEW_PROGRAMME_ID` to the
same ID for the App and Ops deployments.

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
PREVIEW_INSPECTION_EVIDENCE_UPLOAD_ASSET_IDS
PREVIEW_CLEANUP_DEPLOYMENT
PREVIEW_CLEANUP_PROGRAMME_ID
PREVIEW_CLEANUP_START_AT
PREVIEW_CLEANUP_END_AT
PREVIEW_ACCESS_CUTOFF_UTC
FIREBASE_PROJECT_ID
FIREBASE_SERVICE_ACCOUNT_JSON_BASE64
NEXT_PUBLIC_FIREBASE_API_KEY
```

Use four distinct E.164 phone numbers controlled by the team. Add the same
numbers to `PREVIEW_SMS_RECIPIENT_ALLOWLIST`. The admin UID must point to the
existing private admin account and must differ from all four shared-account
UIDs.

Choose the cleanup window before running setup. Current time must fall inside
that window, the window cannot exceed fourteen days, and the access cutoff must
be inside it. Keep those timestamps unchanged through cleanup.

The exact programme must also have one active purchasing budget with at least
enough available capacity to reserve the farmer proceeds for all three offers.
The setup command uses the existing finance approval mutation. It does not
insert a reservation or bypass the budget checks.

Full setup requires three distinct upload asset IDs in
`PREVIEW_INSPECTION_EVIDENCE_UPLOAD_ASSET_IDS`, separated by commas. Each asset
must already be a completed, private `pilot_inspection_evidence` upload owned by
Akosua Boateng and scoped to the exact programme. An inspection attaches its
asset, so the same asset cannot support more than one route.

If the four shared identities do not exist yet, bootstrap only the actors,
profiles, assignment, requests, and declarations first:

```text
corepack pnpm preview:setup -- --profiles-only --execute --confirm=PROVISION_PREVIEW_ACTORS
```

Sign in as Akosua Boateng and create the three private inspection evidence
uploads through the normal upload flow. Record their upload asset IDs, set
`PREVIEW_INSPECTION_EVIDENCE_UPLOAD_ASSET_IDS`, then run the full dry run and
execution below. Do not use `--profiles-only` for that second pass.

## Review and execute

Setup defaults to a dry run:

```text
corepack pnpm preview:setup
```

The full dry run checks Firebase UID and phone ownership, confirms the current
admin can read the exact programme, rejects sample-only or inactive programmes,
requires three distinct evidence IDs, and prints the intended profile, request,
inspection, finance, and route actions. It does not provision actors or write
Convex records.

After reviewing the output, execute with the exact confirmation:

```text
corepack pnpm preview:setup -- --execute --confirm=PROVISION_PREVIEW_ACTORS
```

The command uses Firebase Admin only to create or update the four named
accounts and mint short-lived tokens. It uses the application's authenticated
mutations for profile onboarding, verification, assignment, buyer agreement,
supply review, offers, funding reservation, inspection, collection planning,
driver assignment, and readiness. The command stops if existing records do not
match the exact programme, actors, quantities, terms, or evidence ownership.

Save the `cleanupEnvironment` object printed by a successful run. It contains
the four exact Convex user IDs expected by `preview:cleanup`:

```text
PREVIEW_FARMER_USER_ID
PREVIEW_BUYER_USER_ID
PREVIEW_TRANSPORTER_USER_ID
PREVIEW_OPERATIONS_USER_ID
```

Running setup again with the same inputs reuses the same Firebase accounts,
profiles, assignment, requests, declarations, accepted offers, inspections,
funding reservations, and ready plans. Attached evidence is accepted on a
rerun only when its inspection belongs to the exact paired request. Changing a
UID, phone number, evidence ID, programme, cutoff, or cleanup window should be
treated as a new reviewed setup.

## Open and close public access

Enable public access only after setup and a role-by-role rehearsal:

```text
PREVIEW_ACCESS_ENABLED=true
NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED=true
NEXT_PUBLIC_PREVIEW_PROGRAMME_ID=<the exact live programme ID>
NEXT_PUBLIC_DEMO_PRESENTATION=false
```

While access is open, keep the API at one replica because the temporary SMS
segment counter is process-local. This branch pins the API deployment to one;
confirm the live deployment has one ready API pod before opening access. Configure
`PREVIEW_SMS_RECIPIENT_ALLOWLIST` with only the four team-owned phone numbers.
The normal default is 12 segments per number per UTC hour. For Thursday,
2026-09-17, the supplied production example raises that limit to 120 segments:

```text
PREVIEW_SMS_HOURLY_SEGMENT_LIMIT=12
PREVIEW_SMS_HIGH_CAPACITY_UTC_DATES=2026-09-17
PREVIEW_SMS_HIGH_CAPACITY_HOURLY_SEGMENT_LIMIT=120
```

Promotional SMS and messages to numbers outside the allowlist are blocked while
shared access is enabled. Restore `deploy/k8s/base/workloads.yaml` to two API
replicas after shutdown.

When the preview closes, first turn both flags off. Check the four Firebase
accounts that will have their refresh tokens revoked:

```text
corepack pnpm preview:revoke-sessions
```

Revoke those sessions with the separate exact confirmation. The command also
requires `PREVIEW_ACCESS_ENABLED=false` in its environment:

```text
corepack pnpm preview:revoke-sessions -- --execute --confirm=REVOKE_PREVIEW_SESSIONS
```

Revoking refresh tokens does not cancel an ID token that Firebase has already
issued. Allow up to that token's normal one-hour lifetime before treating every
open browser session as closed.

Then preview the database cleanup:

```text
corepack pnpm preview:cleanup
```

Review every matched count and warning before executing:

```text
corepack pnpm preview:cleanup -- --execute --confirm=DELETE_PREVIEW_WINDOW_DATA
```

The cleanup command scopes removal to the exact programme, four actor user IDs,
and time window. It does not delete the shared Firebase accounts or profiles.
