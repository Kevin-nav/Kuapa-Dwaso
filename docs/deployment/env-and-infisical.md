# Env and Infisical Mapping

Use the root templates as the source inventory for managed environments:

- `.env.example` remains the local development template.
- `.env.example.staging` maps to the staging Infisical environment.
- `.env.example.prod` maps to the production Infisical environment.

The production branch should read from the production Infisical environment.
The main branch should read from the staging Infisical environment unless a
deployment target is intentionally local/mock-only.

## Scope

API-only secrets must stay server-side: Firebase Admin credentials, Resend,
Arkesel, notification delivery, Paystack secret/webhook keys, and Cloudflare R2
credentials. The Cloudflare Tunnel token is deployment-only secret material and
also belongs in Infisical. Frontend apps must receive only `NEXT_PUBLIC_*`
values.

Store Firebase Admin credentials as `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`, not
as raw JSON. Base64 is packaging for an env var; Infisical provides encryption
at rest and access control for the secret.

`NEXT_PUBLIC_*` values are public client values. They are safe to expose to the
browser but still need correct staging or production values at build/runtime.

## Deployment Origins

The code currently consumes deployment origins through:

- `PUBLIC_APP_URL` for API invite links.
- `NEXT_PUBLIC_API_URL` for browser-to-API calls and provider doctor webhook
  URL output.
- `PUBLIC_API_URL` only as a provider doctor fallback when `NEXT_PUBLIC_API_URL`
  is absent.
- `FIREBASE_AUTH_ORIGINS` as a comma-separated list of the App, Ops, and Admin
  HTTPS origins that Firebase must authorize before a release can build.

Admin, ops, and public web origins are configured in the hosting/provider
consoles today rather than through repo env variables. Use those origins for
Firebase allowed domains, R2 CORS, Arkesel delivery webhook configuration, and
Paystack webhook configuration:

- App: `https://app.<domain>`
- API: `https://api.<domain>`
- Admin: `https://admin.<domain>`
- Ops: `https://ops.<domain>`
- Public site: `https://<domain>`

## Provider Checks

Run the presence-only provider readiness doctor after Infisical injection:

```text
corepack pnpm provider:doctor -- --mode=production
```

The doctor does not call paid provider APIs. It reads Firebase's public project
configuration and fails production/provider mode when any hostname in
`FIREBASE_AUTH_ORIGINS` is absent from Firebase Authentication's authorized
domains. In development mode it may warn
about missing real provider values; production mode fails closed for incomplete
Firebase, Convex, Arkesel, notification delivery, Paystack, private R2, and URL
configuration.

Keep Cloudflare R2 private. `CLOUDFLARE_R2_PUBLIC_BASE_URL` is intentionally
unsupported and should not be present in any Infisical environment.

Cloudflare Tunnel uses dashboard-managed token mode. Store each environment's
tunnel token in that environment's Infisical inventory as
`CLOUDFLARE_TUNNEL_TOKEN`. The Infisical Operator syncs it into the
`cloudflare-tunnel-token` Kubernetes Secret, and the `cloudflared` Deployment
reads it without a `credentials.json` file. GitHub Secrets do not hold
Cloudflare Tunnel tokens.

Kubernetes bootstraps the Infisical Operator with Universal Auth credentials in
the namespace-local `infisical-universal-auth` Secret. That Secret contains
only `clientId` and `clientSecret`; application runtime values continue to live
in Infisical and are synced into `kuapa-dwaso-runtime` and
`cloudflare-tunnel-token`.

## Firebase Admin Base64

Download the Firebase Admin service-account JSON from the Firebase console, then
base64-encode the file and store the result in Infisical as
`FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`.

PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\firebase-service-account.json")) | Set-Clipboard
```

macOS/Linux:

```bash
base64 -w 0 /path/to/firebase-service-account.json
```

If `base64 -w 0` is unavailable on macOS, use:

```bash
base64 /path/to/firebase-service-account.json | tr -d '\n'
```
