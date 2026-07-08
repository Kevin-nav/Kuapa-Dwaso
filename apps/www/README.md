# Public Site

This app is for the public website served from a root domain such as `domain.com`.

It should stay lightweight and should not import dashboard-heavy components, admin-only dependencies, provider SDKs, or authenticated product workflow code.

For local development, public `NEXT_PUBLIC_*` values can live in the repo root
`.env.local`. The app scripts load root `.env.local`, then root `.env`, then
app-local env files as optional overrides.
