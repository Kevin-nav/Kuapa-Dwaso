# UI System Convention

Reusable visual primitives belong in `packages/ui`.

Heavier operational dashboard components belong in `packages/dashboard-ui`.

Visual constants belong in `packages/design-tokens`.

The public site in `apps/www` must not import `packages/dashboard-ui`.

Apps should not create long-lived one-off buttons, badges, tables, form fields, status displays, or dashboard shells when a shared component is appropriate.

Authentication surfaces use the shared OTP input and expiry countdown from
`packages/ui`. SMS challenges enforce the shared five-minute application window
from `packages/utils`; expired challenges require a resend. Provider error codes
must be translated through the shared auth error mapper and must not be shown to
users as raw `auth/...` references.

Pilot transaction presentation is imported from `@kuapa-dwaso/ui/pilot` so it
does not enlarge the default public-safe UI entry point. Callers provide typed,
already-authorized terms, quantities, timeline events, evidence and financial
totals; presentation components do not fetch data, infer access from a route or
calculate commercial totals. `PilotTransactionSummary` in `dashboard-ui`
composes those primitives for dense operational views.

Authenticated shells derive sample-data notices from the programme records
returned by Convex. Mock payment, mock SMS and manually entered sample
inspection labels stay on their individual timeline events. Pilot interfaces
say `Collection location` and `Operations`; existing warehouse routes keep
their warehouse terminology.
