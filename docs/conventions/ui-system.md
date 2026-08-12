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
