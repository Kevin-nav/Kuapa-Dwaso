# ADR-0004: Role-smart PWA and offline boundary

## Status

Accepted

## Decision

The self-service app is one installable PWA that resolves farmer, buyer, and
transporter accounts to their last authorized workspace. Warehouse operations
and administration are separate installable PWAs on their existing origins.
The public marketing site remains non-installable.

Each installable origin owns a small service worker. Service workers cache only
application-shell documents, hashed static assets, icons, and explicitly public
images. Provider requests, Convex/API traffic, authentication, payments,
uploads, RSC flight responses, and private signed media are never HTTP-cached.

Private offline data is versioned, account-bound IndexedDB data and is removed
on sign-out or account change. Offline writes are restricted to farmer issues,
warehouse farmer registration/intake/issues, and conflict-checked transporter
status updates. Buyer orders, financial operations, inventory adjustments, and
administration always require a live connection.

Outbox replay is guaranteed only while the app is open or resumed. Browser
Background Sync is not a correctness dependency. Server mutations use client
action IDs, and state transitions can include an expected status for conflict
protection.

Web Push is an optional delivery fan-out from canonical in-app notifications.
SMS and email remain independent. Provider credentials remain API-only.

## Consequences

- No app or package boundary changes are required.
- Service-worker rollback must publish a cleanup worker at the same URL.
- Cached data is always labelled stale and never grants authorization.
- iPhone users install through Add to Home Screen before enabling Web Push.
