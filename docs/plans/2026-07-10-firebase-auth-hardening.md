# Firebase Authentication Hardening Implementation Plan


**Goal:** Make Firebase authentication failures recoverable and user-friendly across App, Ops, and Admin, while blocking builds whose deployed auth hosts are not authorized by Firebase.

**Architecture:** Add provider-agnostic error translation to the existing browser-safe utilities package, then consume it in each Firebase UI. Add a small testable domain comparison module to provider tooling and call it from both the provider doctor and the image-build workflow before publishing images.

**Tech Stack:** TypeScript 6, React 19, Next.js 16, Firebase Web SDK 12, Node.js test runner, pnpm/Turborepo, GitHub Actions.

---

### Task 1: Shared safe authentication messages

**Files:**
- Modify: `packages/utils/src/index.ts`
- Create: `packages/utils/test/authErrors.test.mjs`

1. Write failing tests for direct/nested Firebase codes, safe operation fallbacks, invalid phone/code, expired code/session, CAPTCHA/domain failure, rate/quota limits, network failure, disabled users, and invalid credentials. Assert raw provider messages are never returned.
2. Run `corepack pnpm --filter @kuapa-dwaso/utils test`; expect failure because `getAuthErrorMessage` is absent.
3. Add `AuthOperation`, structural code extraction, and `getAuthErrorMessage(error, operation)` without importing Firebase.
4. Re-run the utility tests; expect all tests to pass.
5. Commit `packages/utils/src/index.ts` and `packages/utils/test/authErrors.test.mjs` with `feat: add safe authentication error messages`.

### Task 2: App and Ops phone challenge recovery

**Files:**
- Modify: `apps/app/package.json`
- Modify: `apps/app/app/auth/PhoneAuthPanel.tsx`
- Modify: `apps/ops/package.json`
- Modify: `apps/ops/app/auth/page.tsx`
- Modify: `pnpm-lock.yaml`

1. Confirm both components currently render `err.message` and retain the failed reCAPTCHA verifier.
2. Add `@kuapa-dwaso/utils: workspace:*` to App and Ops.
3. In App, use the mapper and a verifier disposer that calls `clear()`, nulls the ref, and runs on send failure and unmount. Preserve OTP confirmation for code-entry errors, but reset expired sessions.
4. Apply the same verifier lifecycle and safe messages to Ops.
5. Run App and Ops type checks; expect both to pass.
6. Commit with `fix: harden phone authentication retries`.

### Task 3: Admin sign-in and MFA hardening

**Files:**
- Modify: `apps/admin/package.json`
- Modify: `apps/admin/app/auth/page.tsx`
- Modify: `pnpm-lock.yaml`

1. Add `@kuapa-dwaso/utils: workspace:*` to Admin.
2. Use the shared helper for password sign-in, MFA challenge send/verify, and MFA enrollment send/verify while preserving `auth/multi-factor-auth-required` handling.
3. Clear and null the Admin verifier after failed challenge sends and on unmount.
4. Run the Admin type check; expect it to pass.
5. Commit with `fix: harden admin Firebase authentication`.

### Task 4: Firebase authorized-domain release guard

**Files:**
- Create: `packages/test-utils/src/firebase-auth-domains.mjs`
- Create: `packages/test-utils/src/check-firebase-auth-domains.mjs`
- Create: `packages/test-utils/test/firebase-auth-domains.test.mjs`
- Modify: `packages/test-utils/src/provider-doctor.mjs`
- Modify: `packages/test-utils/package.json`
- Modify: `.env.example.staging`
- Modify: `.env.example.prod`
- Modify: `.github/workflows/build-publish-images.yml`
- Modify: `docs/deployment/env-and-infisical.md`
- Modify: `docs/deployment/github-actions-and-secrets.md`

1. Write failing tests for comma-separated HTTPS origins, invalid origins, case-insensitive hostname comparison, and missing domains.
2. Run `corepack pnpm --filter @kuapa-dwaso/test-utils test`; expect module-not-found failure.
3. Implement the module and CLI. Query Firebase's public project configuration, compare `authorizedDomains` with `FIREBASE_AUTH_ORIGINS`, and never print the API key.
4. Make provider/production doctor mode require and check `FIREBASE_AUTH_ORIGINS`; keep dev/mock mode offline-friendly.
5. Export `FIREBASE_AUTH_ORIGINS` from Infisical in the image workflow and run the CLI once in the App matrix job before image publication.
6. Add App/Ops/Admin origins to staging and production templates and update deployment docs.
7. Run tooling tests and a live staging check; expect all configured staging hosts to pass.
8. Commit with `ci: verify Firebase authorized domains`.

### Task 5: Full verification and staging check

1. Run focused tests, lint, and type checks for utils, test-utils, App, Ops, and Admin; expect all to pass.
2. Run production builds for App, Ops, and Admin; expect all to pass.
3. Run `corepack pnpm list --depth -1` and `git status --short` as required by the repository instructions.
4. Open staging signup, confirm it renders and initializes the phone step without console errors, and verify live Firebase config contains all staging hosts. Do not submit a real phone number.
5. Report the root cause, protections, verification results, deployment requirement, and the Infisical variable required by the new workflow.
