# Warehouse Operations App

This app is for the warehouse-agent operations console served from a subdomain such as `ops.domain.com`.

It owns daily warehouse workflows such as farmer lookup, produce intake, receipt lookup, inventory status updates, storage fee review, dispatch preparation, and dispute escalation. The current app shell is intentionally minimal so warehouse-agent UI work can start without pulling admin dashboard code into the skeleton.

Run locally with:

```text
corepack pnpm --filter @kuapa-dwaso/ops dev
```

Set `NEXT_PUBLIC_CONVEX_URL` in `.env.local` before starting the app.
