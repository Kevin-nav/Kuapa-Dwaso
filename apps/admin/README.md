# Admin Console

This app is for the admin console served from a subdomain such as `admin.domain.com`.

It may contain heavier operational UI such as dashboards, tables, audit logs, dispute management, and hotspot analysis. Admin-only code must remain isolated from the public site and normal user app.

`/auth` provides the minimal Firebase email/password entry path for admins and warehouse managers. Configure `NEXT_PUBLIC_FIREBASE_*` and `NEXT_PUBLIC_CONVEX_URL` in the repo root `.env.local` for local development; app-local env files are optional overrides only. Firebase email verification and MFA enrollment/challenge setup must be enabled in the Firebase project before real admin invite acceptance.
