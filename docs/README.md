# Documentation

Local development uses the repo root `.env.local` as the primary env file.
The Next apps and API also support root `.env` as a fallback. Per-app env files
are optional overrides only; deployment platforms should provide environment
variables directly for each deployed app or service.

Only `NEXT_PUBLIC_*` values are browser-exposed. Keep API secrets, provider
credentials, Firebase Admin config, Resend, and R2 values server-side only.
