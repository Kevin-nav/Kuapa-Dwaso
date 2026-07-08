# Admin Console

This app is for the admin console served from a subdomain such as `admin.domain.com`.

It may contain heavier operational UI such as dashboards, tables, audit logs, dispute management, and hotspot analysis. Admin-only code must remain isolated from the public site and normal user app.

`/auth` provides the Firebase email/password entry path for admins and warehouse managers. Configure `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_CONVEX_URL`, and `NEXT_PUBLIC_API_URL` in the repo root `.env.local` for local development. The app scripts load root `.env.local`, then root `.env`, then app-local env files as optional overrides.

`/auth` can also accept admin and warehouse-manager invite tokens through the API `POST /invitations/accept` path after the invited user signs in, verifies email, and satisfies the configured Firebase MFA requirement. The page shows explicit MFA enrollment/challenge states, but full Firebase MFA completion still requires project-level MFA enablement plus the app verifier/challenge wiring.

`/access` exposes the admin access-control foundation:

- Invite list, creation through the API delivery path, revocation, and pending-invite expiry.
- Admin user list with direct role assignment/revocation, group memberships, effective roles, and effective permissions.
- Access group list/detail, create/update/deactivate actions, member add/remove actions, and group role assignment/revocation.
- Permission preview for a selected admin user, permission, and scope.

Email invitations use the API Resend provider boundary. Local development can return mock delivery when Resend is not configured. SMS invitations remain mock-only until a real SMS provider is selected.
