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
