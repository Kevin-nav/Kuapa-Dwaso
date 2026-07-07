# Warehouse Operations App

This app is for the warehouse-agent operations console served from a subdomain such as `ops.domain.com`.

It owns daily warehouse workflows such as farmer lookup, produce intake, receipt lookup, inventory status updates, storage fee review, dispatch preparation, and dispute escalation. The current app shell is intentionally minimal so warehouse-agent UI work can start without pulling admin dashboard code into the skeleton.

Run locally with:

```text
corepack pnpm --filter @kuapa-dwaso/ops dev
```

Set `NEXT_PUBLIC_CONVEX_URL` and the `NEXT_PUBLIC_FIREBASE_*` browser auth values in the repo root `.env.local` before starting the app. This app loads root env files from `next.config.ts`; app-local env files are optional overrides only.

Ops resolves the current Firebase user to a Convex platform principal with `auth.resolveCurrentPrincipal`. The old `NEXT_PUBLIC_OPS_ACTOR_USER_ID` path is now a local-development fallback only and is ignored unless `NEXT_PUBLIC_ENABLE_DEV_ACTOR_FALLBACK=true`.
