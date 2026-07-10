# Firebase Authentication Hardening Design

## Context

Staging phone signup failed with `auth/captcha-check-failed` because Firebase
Authentication did not authorize `app-staging.kuapadwaso.com`. The Firebase
project now authorizes the App, Ops, and Admin hostnames for staging and
production. The applications still expose raw Firebase errors, reuse failed
reCAPTCHA verifier instances, and rely on a manual deployment checklist for
authorized domains.

## Goals

- Show concise, actionable authentication messages without exposing Firebase
  implementation details.
- Let users retry phone and MFA challenges after reCAPTCHA failures or expiry.
- Apply consistent behavior to App phone authentication, Ops phone sign-in,
  and Admin authentication and SMS MFA.
- Fail provider readiness checks when an expected deployed authentication host
  is absent from Firebase's authorized-domain configuration.
- Preserve the existing Firebase identity architecture and low-bandwidth UI.

## Non-goals

- Replacing Firebase phone authentication with a custom OTP provider.
- Changing account roles, onboarding, invitation, or authorization rules.
- Adding new applications, packages, or folder boundaries.
- Sending a real SMS as part of automated tests.

## Approach

Add a small browser-safe authentication error helper to the existing
`packages/utils` package. The helper will accept an unknown error, identify a
provider code structurally, and return a user-facing message for the operation
being performed. It will not import Firebase, keeping the package lightweight
and reusable by all frontend applications.

Map known cases such as invalid phone numbers, invalid or expired verification
codes, expired sessions, CAPTCHA/domain failures, rate limits and quota limits,
network failures, disabled users, invalid credentials, and provider outages.
Unknown failures will receive a safe operation-specific fallback. Raw provider
messages will not be rendered to users.

App and Ops phone flows, plus Admin sign-in and SMS MFA flows, will use the
shared mapper. Phone and MFA challenge code will clear a failed reCAPTCHA
verifier and create a fresh verifier for a later attempt. Components will also
clear verifiers on unmount to avoid stale widgets and resources.

Extend the existing provider doctor rather than introducing a separate tool.
In provider/production mode it will query Firebase's public project
configuration using the public web API key, parse expected authentication
origins supplied through configuration, and fail if a hostname is not
authorized. Local development will retain an offline-friendly warning when the
live check cannot be performed. Expected origins will cover App, Ops, and Admin
for the target environment without exposing secrets.

## Data Flow

1. A user starts phone verification, sign-in, or MFA.
2. The frontend creates an invisible Firebase reCAPTCHA verifier on demand.
3. Firebase either returns a confirmation/challenge or throws a coded error.
4. On failure, the frontend clears challenge state as appropriate, disposes of
   the verifier when it may be invalid, and renders the mapped message.
5. A retry creates a fresh verifier.
6. Before deployment, the provider doctor compares configured auth-origin
   hostnames with Firebase's live authorized-domain list and blocks a release
   on a mismatch.

No raw Firebase error text or credentials are sent to the application API.

## User-facing Error Behavior

- Domain/CAPTCHA configuration failures: explain that phone verification is
  temporarily unavailable and ask the user to retry later.
- Invalid phone input: ask for a complete valid phone number.
- Invalid or expired OTP: explain whether to re-enter or request a new code.
- Rate or quota limits: advise waiting before another attempt.
- Network failures: ask the user to check connectivity and retry.
- Invalid admin credentials: use a neutral email/password message.
- Unknown failures: use a safe operation-specific fallback and never show the
  provider's raw message.

Status text and error text will not contradict each other. Buttons will return
to an actionable state after failure.

## Verification

- Unit tests cover known error-code mappings, nested provider errors, unknown
  values, safe fallbacks, and domain-list comparison.
- Type checking and linting cover `packages/utils`, App, Ops, and Admin.
- Production builds verify package boundaries and browser bundles.
- Provider doctor tests/checks verify both allowed and missing hostnames.
- Staging browser verification confirms signup loads, challenge retry remains
  usable, and no raw Firebase error appears. Automated verification will avoid
  sending an SMS to a real number.

## Operational Notes

The Firebase console remains the source of truth for authorized domains. The
provider doctor is a regression guard, not a configuration writer. Adding or
renaming a deployed authentication hostname requires updating Firebase first
and then the environment's expected auth origins.
