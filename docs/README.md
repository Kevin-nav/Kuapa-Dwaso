# Documentation

Local development uses the repo root `.env.local` as the primary env file.
The Next apps and API also support root `.env` as a fallback. The app package
`dev` and `build` scripts load root `.env.local`, then root `.env`, then any
app-local env files as optional overrides. Normal local dev should not duplicate
`NEXT_PUBLIC_*` values under individual apps.

Only `NEXT_PUBLIC_*` values are browser-exposed. Keep API secrets, provider
credentials, Firebase Admin config, Resend, and R2 values server-side only.

Check browser env presence without printing values:

```text
corepack pnpm env:check-next-public
```
