# Test Utils

Owns shared test fixtures, factories, and helpers once the test suite needs them.

## Next Public Env Check

Run the presence-only check for browser-exposed env required by the Next apps:

```text
corepack pnpm env:check-next-public
```

The check loads root `.env.local`, root `.env`, and optional app-local override
files using the same local precedence as the Next app scripts. It prints only
`set` or `missing`, never env values.

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

## Staging SMS Smoke Test

Send one live Arkesel SMS to the configured test number (`+233549037907`) using
the root `.env.staging` credentials:

```text
corepack pnpm sms:staging -- --confirm
```

The explicit confirmation prevents an accidental live send. The script prints
the provider message ID but never prints the API key.

## Provider Readiness Doctor

Run the dry provider/config readiness check with:

```text
corepack pnpm provider:doctor
corepack pnpm provider:doctor -- --mode=production
```

The doctor validates env presence and shape for Firebase, Convex, Arkesel,
notification delivery, Paystack, private R2 signed access, and app URLs. It does
not call paid provider endpoints.
