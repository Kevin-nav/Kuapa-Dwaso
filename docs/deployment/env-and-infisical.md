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
credentials. Frontend apps must receive only `NEXT_PUBLIC_*` values.

`NEXT_PUBLIC_*` values are public client values. They are safe to expose to the
browser but still need correct staging or production values at build/runtime.

## Deployment Origins

The code currently consumes deployment origins through:

- `PUBLIC_APP_URL` for API invite links.
- `NEXT_PUBLIC_API_URL` for browser-to-API calls and provider doctor webhook
  URL output.
- `PUBLIC_API_URL` only as a provider doctor fallback when `NEXT_PUBLIC_API_URL`
  is absent.

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

The doctor does not call paid provider APIs. In development mode it may warn
about missing real provider values; production mode fails closed for incomplete
Firebase, Convex, Arkesel, notification delivery, Paystack, private R2, and URL
configuration.

Keep Cloudflare R2 private. `CLOUDFLARE_R2_PUBLIC_BASE_URL` is intentionally
unsupported and should not be present in any Infisical environment.
