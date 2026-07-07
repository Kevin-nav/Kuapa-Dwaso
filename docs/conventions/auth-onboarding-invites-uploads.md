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
intake photos, condition evidence, dispute evidence, and profile evidence.

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

SMS remains mock-first. `SMS_PROVIDER=mock` is the only supported provider
mode. `SMS_FROM_NAME` is reserved for a future real provider. The API exposes a
generic SMS send interface with invite, notification, and OTP message kinds,
but only invite delivery is currently used and no custom OTP provider is
implemented.

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

Invite links use `PUBLIC_APP_URL` and currently resolve to:

```text
<PUBLIC_APP_URL>/invite/accept?token=<raw token>
```

Raw invite tokens are delivered only by the API provider boundary. Convex stores
only token hashes.

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
