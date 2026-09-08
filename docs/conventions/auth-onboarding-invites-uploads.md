# Auth, Onboarding, Invites, and Uploads

Firebase is the identity and session layer for the MVP. Convex remains the
product system of record for platform users, profile links, invitations,
onboarding state, RBAC assignments, and upload metadata.

## Identity and Profiles

Phone-auth users may self-onboard as farmers, buyers, or transporters. Farmer
profiles can also be created first by warehouse agents and later claimed only by
a Firebase identity that verifies the same phone number.

Warehouse agents do not receive operational access from phone verification
alone. Their warehouse-agent profile must exist and be approved, and invite
acceptance only links the Firebase identity to that profile.

Admins and warehouse managers use verified Firebase Google or email/password identities. Their
invitations record the MFA requirement and acceptance requires verified email
plus satisfied MFA when the invite requires it.

## Invitations

Raw invitation tokens are generated and delivered by the API provider boundary.
Convex stores only token hashes and invite state. Invite acceptance must fail
closed when the verified Firebase email or phone number does not match the
invite target.

Invitation delivery supports only `email` and `manual_link`. Email delivery uses
the Resend provider boundary. A manual link is returned once to the authorized
admin UI for copying or QR presentation; only its hash is persisted. SMS must
never contain an account invitation link. SMS remains a transactional channel
for receipt, payment, reservation, run, dispatch, reminder, and operational
alerts.

Role and delivery/authentication combinations are fixed:

| Invitation        | Delivery                    | Authentication                    | Scope/security                                                                |
| ----------------- | --------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| Platform admin    | Email only                  | Verified Google or email/password | Privileged MFA required                                                       |
| Warehouse manager | Email only                  | Verified Google or email/password | Privileged MFA and a warehouse-scoped `warehouse_manager` assignment required |
| Warehouse agent   | Email or manual secure link | Verified phone OTP                | Invitation establishes warehouse/profile; reuse an existing matching identity |
| Pilot operator    | Email or manual secure link | Verified phone OTP                | Invitation links an approved operations profile to one named pilot; a separate active assignment grants capabilities |
| Transporter       | Email or manual secure link | Verified phone OTP                | Reuse an existing matching identity/profile                                   |

Acceptance is single-use, expiration- and revocation-aware, audited, and
idempotent at the identity/profile boundary. Error messages may explain how to
recover, but must not reveal a raw token or weaken target matching.

Pilot operators authenticate with the same approved warehouse-agent identity,
but they do not need a warehouse assignment. A `pilot_operations_invite` links
the verified phone identity to an approved operations profile and records the
intended programme; it never grants programme access by itself. An authorized
admin must create a separate `pilotAssignments` grant with explicit
capabilities. Revoked or expired assignments stop authorizing reads and writes
immediately. Convex compares pilot actor IDs with the authenticated Firebase
subject, including on API-mediated invitation and evidence operations.

## Uploads

Frontend apps never receive Cloudflare credentials. Produce intake photos are
posted through the authenticated API so browser-to-R2 CORS is not part of the
agent flow. Other authenticated writes may use R2 presigned PUT URLs. Produce intake photos use stable
public read URLs so buyer listings do not depend on expiring links; all other
reads, previews, and downloads use authorized presigned GET URLs. Convex stores upload metadata including owner, purpose, content
type, size, object key, status, and related entity. Initial upload purposes are
image-only and size-limited for transporter truck photos, produce intake
photos, condition evidence, dispute evidence, dispatch proof photos, and
profile evidence.

Only produce listing photos and approved blog hero/content images may use public R2 reads. Identity, profile,
condition, dispute, and dispatch evidence stays private, and frontend code must
not construct evidence URLs. Admin and ops evidence UI must request a short-lived signed GET
URL from the API/provider seam after the authenticated user has passed Convex
upload access checks.

Upload evidence follows the product lifecycle `pending_upload` -> `uploaded`
or `attached`, then optional admin review to `verified` or `rejected`.
Operational evidence may also be marked `expired` or `deleted` without exposing
storage credentials to frontend apps. Related entity scoping is enforced in
Convex: assigned warehouse agents can attach warehouse-scoped inventory,
dispatch, and dispute evidence only for their warehouses; admins must hold
`uploads:read` or `uploads:manage` for the target scope; transporter truck
photos attach to transporter profiles.

Provider failures should be recoverable and must not corrupt Convex product
state.

Maize-pilot evidence is always private and must include both a pilot programme
ID and a related pilot entity. Convex loads that entity, verifies it belongs to
the supplied programme, and then checks the current buyer, farmer, driver,
administrator, or pilot-operator scope. Owning an upload does not preserve
access after an operator assignment is revoked. The API forwards the verified
Firebase ID token to Convex for pilot upload creation, completion, status, and
read authorization; it never treats a request body actor ID as authentication.

## Provider and Deployment Setup

Firebase browser/client config belongs only in frontend app env files. Enable
Google as a Firebase sign-in provider for admin identities. Authenticator-app
MFA uses Firebase TOTP and requires Firebase Authentication with Identity
Platform plus project-level TOTP enablement. SMS MFA may remain available as a
fallback and requires allowed SMS regions and authorized admin origins. Firebase
Admin config belongs only in `apps/api` runtime env. The API verifies Firebase
ID tokens with Firebase Admin credentials and then resolves the Convex user
profile before RBAC checks. Follow the Firebase Admin ID-token verification
setup for service-account requirements:
https://firebase.google.com/docs/auth/admin/verify-id-tokens

Convex also validates Firebase ID tokens for pilot functions. Configure
`FIREBASE_PROJECT_ID` in the Convex deployment environment (or the existing
`NEXT_PUBLIC_FIREBASE_PROJECT_ID` during local development) so
`convex/auth.config.ts` accepts the same Firebase issuer used by the apps and
API.

Resend is the API email provider boundary for admin and warehouse-manager
invitations. Required staging/prod env vars are:

```text
RESEND_API_KEY=
RESEND_FROM_EMAIL=
PUBLIC_APP_URL=
```

The API calls Resend with bearer authentication as documented by Resend:
https://resend.com/docs/api-reference/introduction. Resend API keys are
secrets and should stay API-only; Resend recommends treating API keys as
confidential tokens:
https://resend.com/docs/dashboard/api-keys/introduction. In local development,
missing Resend env vars return a mock delivery result. In production, missing
Resend env vars fail closed.

SMS remains mock-first for local development. Supported provider modes are
`SMS_PROVIDER=mock` and `SMS_PROVIDER=arkesel`. `SMS_FROM_NAME` is the branded
sender ID sent to the provider, and Arkesel credentials stay API-only:

```text
SMS_PROVIDER=mock
SMS_FROM_NAME=KuapaDwaso
ARKESEL_SMS_API_KEY=
ARKESEL_WEBHOOK_SIGNATURE_HEADER=x-arkesel-signature
ARKESEL_WEBHOOK_SIGNATURE_SECRET=
NOTIFICATION_DELIVERY_SECRET=
```

Arkesel delivery uses the V2 JSON SMS endpoint through the API provider seam.
Template rendering remains platform-owned; Arkesel receives only rendered text
and normalized E.164 recipients. Firebase Phone Auth remains the phone
authentication mechanism for farmer, buyer, and transporter signup/login in
this slice. Do not route product auth OTP through Arkesel until a separate auth
migration is designed.

The V2 send response contains a receipt for each accepted recipient. The API
stores the matching provider message ID per recipient so a delivery report
updates the correct `smsDeliveries` record. The provider also accepts the older
single-object response shape for compatibility.

Sender IDs must be 1-11 alphanumeric characters with at least one letter. Do
not use emojis, spaces, punctuation, or special symbols. MTN Ghana requires
sender ID approval before production delivery; unapproved sender IDs can be
blocked or rejected.

Arkesel delivery reports post to:

```text
POST /sms/webhooks/arkesel/delivery
```

The notification delivery worker posts to:

```text
POST /sms/webhooks/deliveries/process
```

In production, `NOTIFICATION_DELIVERY_SECRET` must be configured and callers
must send it as `x-notification-delivery-secret`. Local development may omit
the secret. The endpoint claims pending SMS notification records, renders
platform-owned transactional templates, sends through the configured SMS
provider seam, and records idempotent delivery attempts in `smsDeliveries`.
Domain workflows should continue creating notification records instead of
calling Arkesel or provider-specific code directly.

The available Arkesel documentation does not confirm webhook signature
verification. By default the endpoint accepts unsigned delivery reports and
records raw payloads for audit. When `ARKESEL_WEBHOOK_SIGNATURE_SECRET` is set,
the endpoint fails closed unless the configured signature header is present and
matches the current HMAC-SHA256 verifier. Confirm the exact signature algorithm
and header format with Arkesel support before enabling this in production.

Production preflight questions for Arkesel support:

- Does Arkesel sign delivery webhooks? If so, what header and algorithm are
  used?
- Can Arkesel provide outbound webhook IP ranges for allowlisting?
- What webhook retry policy and backoff apply when the API returns non-2xx?
- What are the V2 SMS API rate limits per second and per minute?
- Are there MTN Ghana setup or recurring fees for branded sender ID approval?

Cloudflare R2 credentials are API-only:

```text
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_PUBLIC_BUCKET=
CLOUDFLARE_R2_PUBLIC_BASE_URL=https://images.example.com
R2_PRESIGN_TTL_SECONDS=900
R2_READ_PRESIGN_TTL_SECONDS=300
UPLOAD_MAX_SIZE_BYTES=8388608
```

Presigned upload and read URLs use the R2 S3-compatible endpoint,
`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, matching Cloudflare's R2 S3 API
and presigned URL docs:
https://developers.cloudflare.com/r2/api/s3/api/
https://developers.cloudflare.com/r2/api/s3/presigned-urls/

Buckets used from browsers must have CORS that allows the deployed app origins,
`PUT` and `GET`, and the `Content-Type` header for signed uploads. Cloudflare's
CORS setup is documented at:
https://developers.cloudflare.com/r2/buckets/cors/

`CLOUDFLARE_R2_PUBLIC_BASE_URL` is the public R2 development URL or custom
domain used only for `produce_intake_photo`, `blog_hero_image`, and
`blog_content_image` assets. Blog images must be related to a `blog_post` and
pass the separate blog write permission check.

## Payment Provider Setup

Buyer payments use the API payment-provider seam. Local development and smoke
tests should use:

```text
PAYMENT_PROVIDER=mock
```

Paystack is the first real adapter:

```text
PAYMENT_PROVIDER=paystack
PAYSTACK_PUBLIC_KEY=
PAYSTACK_SECRET_KEY=
PAYSTACK_WEBHOOK_SECRET=
```

Paystack secret keys and webhook secrets are API-only and must never be exposed
through `NEXT_PUBLIC_*` variables. Product workflows store provider-neutral
payment transactions, webhook events, and farmer payout ledger rows; actual
farmer bank or mobile-money transfer automation remains manual/ledger-only until
a separate payout automation boundary is designed.

Paystack webhooks should post to:

```text
POST /payments/webhooks/paystack
```

Invite links use `PUBLIC_APP_URL` and currently resolve to:

```text
<PUBLIC_APP_URL>/invites/accept?token=<raw token>
```

Raw invite tokens are delivered only by the API provider boundary. Convex stores
only token hashes. Email links are passed to Resend; manual links are returned
once to the authorized admin session for copy or QR presentation.

## Privileged MFA Setup

Admin and warehouse-manager users sign in with Firebase Google or email/password. Invite
acceptance fails closed unless the Firebase ID token has the invited verified
email and, when required, Firebase second-factor evidence. Convex admin RBAC
also requires active admin status, Google or email/password auth, verified email, and
verified MFA before granting privileged permissions.

The admin app implements Firebase TOTP and SMS MFA enrollment and sign-in
challenge state with the Firebase Web SDK. Production projects still need
Firebase Auth Google and/or email/password enabled, email verification
templates configured, multi-factor authentication enabled, TOTP enabled through
the Firebase Admin SDK or project configuration API, allowed domains configured
for the deployed admin origin, and reCAPTCHA allowed to run on that origin for
SMS MFA.
Arkesel is not used for privileged auth OTP in this slice.

Inspect the current Firebase MFA configuration without changing it:

```text
corepack pnpm firebase:totp
```

Enable TOTP with one adjacent interval on the Firebase project configured by
the local staging environment:

```text
corepack pnpm firebase:totp -- --confirm --adjacent-intervals=1
```

The command loads the ignored root `.env.staging` file when present, prints no
credentials, and only updates the TOTP provider configuration. Firebase MFA is
project-wide, so when staging and production share a Firebase project this
provider setting is available to both environments; enrollment and application
policy still determine which users must use it.

## First Staging Platform Owner

The permanent first staging owner must complete Firebase sign-in, verified
email, and TOTP enrollment before receiving Convex access. After those steps,
run the guarded seed command with the staging environment injected:

```powershell
$env:PLATFORM_OWNER_EMAIL="owner@example.com"
$env:PLATFORM_OWNER_NAME="Platform Owner"
$env:PLATFORM_OWNER_PHONE_NUMBER="+233..."
corepack pnpm seed:staging:platform-owner -- --confirm
```

The command resolves the Firebase UID by email, verifies that Google or
email/password authentication and a TOTP factor are present, creates or updates
the active Convex admin profile, and bootstraps a global `platform_owner`
assignment with no expiry. It fails closed if the identity is unverified or
TOTP is missing. The bootstrap mutation will not create a second global owner
when an active one already exists.

## Rate Limits and Abuse Guards

The API has an in-memory rate-limit provider for invite sends and upload
presign requests:

```text
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_INVITE_SEND_MAX=20
API_RATE_LIMIT_UPLOAD_PRESIGN_MAX=60
```

This is development- and single-process-staging-safe, but it is not a
distributed production abuse-control system. Before multi-instance production,
replace the provider with Redis, an edge store, or another shared counter while
keeping the same operation keys.

## Smoke Cleanup

Backend smoke runs create records with a unique run id. To clean a completed
run, pass the exact run id and explicit confirmation:

```text
SMOKE_RUN_ID=<run id> corepack pnpm smoke:backend:cleanup -- --confirm
```

Use `--dry-run` to preview matches:

```text
SMOKE_RUN_ID=<run id> corepack pnpm smoke:backend:cleanup -- --confirm --dry-run
```

Cleanup deletes only records whose identifiers are derived from that smoke run
id. After all known run ids have been cleaned, remove explicit smoke snapshots,
orphaned smoke charges, and the fixed bootstrap user with:

```text
corepack pnpm smoke:backend:cleanup -- --confirm --all --dry-run
corepack pnpm smoke:backend:cleanup -- --confirm --all
```

The all-runs cleanup matches only explicit `smoke`, `backend-smoke`, or
`example.test` markers. If the bootstrap user assigned a permanent owner, the
permanent assignment is retained and its `assignedBy` reference is repaired to
the permanent owner before the smoke user is deleted.

## Provider Readiness Doctor

Run the dry provider/config doctor before staging or production cutover:

```text
corepack pnpm provider:doctor
corepack pnpm provider:doctor -- --mode=production
```

The default dev mode allows mock SMS/payment providers and reports missing
provider variables as warnings where local development can still run. Production
or provider mode fails when Firebase, Convex, Arkesel, notification delivery,
Paystack, R2 private signed access, or app URL configuration is incomplete. The
doctor does not call paid provider APIs.

Production console and provider checklist:

- Firebase Auth: enable Google and email/password for admins and warehouse managers,
  phone auth for farmer/buyer/transporter entry, TOTP and optional SMS MFA for privileged users,
  reCAPTCHA on deployed origins, email verification templates, and allowed
  domains for all deployed frontend origins.
- Arkesel: configure delivery reports to `POST /sms/webhooks/arkesel/delivery`,
  approve the production sender ID, confirm webhook signing/header details,
  outbound IP ranges, retry policy, and rate limits with support.
- Paystack: configure `POST /payments/webhooks/paystack`, use test mode for
  MVP/demo, and keep secret/webhook keys API-only.
- Notification delivery: schedule or trigger a worker to call
  `POST /sms/webhooks/deliveries/process` with
  `x-notification-delivery-secret: <NOTIFICATION_DELIVERY_SECRET>`.
- R2: expose only produce listing photos and approved blog media through the configured public domain;
  keep every evidence purpose private, use signed PUT URLs for writes and
  signed GET URLs for private reads, and configure browser upload CORS.

Outstanding provider blockers to confirm before production:

- Arkesel webhook signature algorithm/header format and retry behavior.
- Arkesel production sender ID approval timeline, especially MTN Ghana.
- Paystack production account status and exact webhook event coverage needed
  for payment reconciliation.
- Firebase project allowed domains, MFA rollout policy, and reCAPTCHA behavior
  on every deployed app origin.
- R2 CORS rules for all deployed origins and maximum signed URL lifetimes.
