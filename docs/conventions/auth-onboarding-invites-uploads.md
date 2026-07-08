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

Admins and warehouse managers use Firebase email/password identities. Their
invitations record the MFA requirement and acceptance requires verified email
plus satisfied MFA when the invite requires it.

## Invitations

Raw invitation tokens are generated and delivered by the API provider boundary.
Convex stores only token hashes and invite state. Invite acceptance must fail
closed when the verified Firebase email or phone number does not match the
invite target.

Email delivery uses the Resend provider boundary. SMS invite delivery is modular
and mock-only until a real provider is selected.

## Uploads

Frontend apps never receive Cloudflare credentials. The API creates R2
presigned PUT URLs and Convex stores upload metadata including owner, purpose,
content type, size, object key, status, and related entity. Initial upload
purposes are image-only and size-limited for transporter truck photos, produce
intake photos, condition evidence, dispute evidence, dispatch proof photos, and
profile evidence.

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

## Provider and Deployment Setup

Firebase browser/client config belongs only in frontend app env files. Firebase
Admin config belongs only in `apps/api` runtime env. The API verifies Firebase
ID tokens with Firebase Admin credentials and then resolves the Convex user
profile before RBAC checks. Follow the Firebase Admin ID-token verification
setup for service-account requirements:
https://firebase.google.com/docs/auth/admin/verify-id-tokens

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
CLOUDFLARE_R2_PUBLIC_BASE_URL=
R2_PRESIGN_TTL_SECONDS=900
UPLOAD_MAX_SIZE_BYTES=8388608
```

Presigned upload URLs use the R2 S3-compatible endpoint,
`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, matching Cloudflare's R2 S3 API
and presigned URL docs:
https://developers.cloudflare.com/r2/api/s3/api/
https://developers.cloudflare.com/r2/api/s3/presigned-urls/

Buckets used from browsers must have CORS that allows the deployed app origins,
`PUT`, and the `Content-Type` header. Cloudflare's CORS setup is documented at:
https://developers.cloudflare.com/r2/buckets/cors/

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

Invite links use `PUBLIC_APP_URL` and currently resolve to:

```text
<PUBLIC_APP_URL>/invite/accept?token=<raw token>
```

Raw invite tokens are delivered only by the API provider boundary. Convex stores
only token hashes.

## Privileged MFA Setup

Admin and warehouse-manager users sign in with Firebase email/password. Invite
acceptance fails closed unless the Firebase ID token has the invited verified
email and, when required, Firebase second-factor evidence. Convex admin RBAC
also requires active admin status, email/password auth, verified email, and
verified MFA before granting privileged permissions.

The admin app implements Firebase SMS MFA enrollment and sign-in challenge
state with the Firebase Web SDK. Production projects still need Firebase Auth
email/password enabled, email verification templates configured, multi-factor
authentication enabled in the Firebase console, allowed domains configured for
the deployed admin origin, and reCAPTCHA allowed to run on that origin.
Arkesel is not used for privileged auth OTP in this slice.

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
id. It intentionally does not delete the fixed `smoke-backend-admin` bootstrap
user, because that user may hold the first platform-owner assignment in a local
or smoke environment.
