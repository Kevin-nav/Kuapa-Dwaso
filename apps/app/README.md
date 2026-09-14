# Main Product App

This app is for the main authenticated product served from a subdomain such as `app.domain.com`.

It owns farmer, buyer, and transporter self-service workflows. Warehouse-agent operations belong in `apps/ops`. It should prioritize low-bandwidth pages, route-level loading, simple farmer-facing UI, and shared packages for UI, validation, permissions, and domain types.

Auth routes:

- `/auth/phone` verifies farmer, buyer, and transporter phone identities with Firebase OTP and links profiles through Convex.
- `/invites/accept?token=...` accepts admin, warehouse-manager, and warehouse-agent invites. Email invites require a verified Firebase email and configured Firebase MFA; warehouse-agent invites use phone OTP.

For local development, put `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_CONVEX_URL`, and
`NEXT_PUBLIC_API_URL` in the repo root `.env.local`. The app scripts load root
`.env.local`, then root `.env`, then app-local env files as optional overrides.

Normal deployments should leave `NEXT_PUBLIC_DEMO_PRESENTATION=false`. Set it to
`true` only in a separate presentation deployment; that build shows sample-only
programmes and the required demonstration notice.
