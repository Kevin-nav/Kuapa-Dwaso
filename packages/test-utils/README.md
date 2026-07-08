# Test Utils

Owns shared test fixtures, factories, and helpers once the test suite needs them.

## Backend Smoke Flow

Run the Convex-backed backend smoke flow with:

```text
corepack pnpm smoke:backend
```

The runner prints a `runId`. To remove only records derived from that exact run
id:

```text
SMOKE_RUN_ID=<run id> corepack pnpm smoke:backend:cleanup -- --confirm
```

Add `--dry-run` to preview matched records without deleting them.

## Provider Readiness Doctor

Run the dry provider/config readiness check with:

```text
corepack pnpm provider:doctor
corepack pnpm provider:doctor -- --mode=production
```

The doctor validates env presence and shape for Firebase, Convex, Arkesel,
notification delivery, Paystack, private R2 signed access, and app URLs. It does
not call paid provider endpoints.
