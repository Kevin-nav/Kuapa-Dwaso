# KuapaDwaso

Farmer-to-buyer digital marketplace with SMS onboarding, agent-assisted listing, bulk produce aggregation, logistics coordination, payments, and supply-demand intelligence.

This repository is a pnpm + Turborepo monorepo. The structure is intentionally strict so two developers can work flexibly without drifting away from shared UI, backend, domain, and low-bandwidth principles.

Start with the docs in `docs/intent-and-initial-plans/` and `docs/plans/`.

Convex is configured from the top-level `convex/` folder. To connect this checkout to the existing `KuapaDwaso` Convex project, run `corepack pnpm convex:dev` and select the existing project when prompted.

Copy `.env.example` to the repo root as `.env.local` for local development.
The Next.js apps and API read the root `.env.local` first, then root `.env`.
App-local env files are optional overrides only; normal local dev should not
duplicate `NEXT_PUBLIC_*` values under individual apps.

After `corepack pnpm convex:dev` writes `CONVEX_URL` to the root `.env.local`,
set the root `NEXT_PUBLIC_CONVEX_URL` value to the same URL so browser code can
connect to Convex. To verify the Next apps can see required browser env values
without printing secrets, run:

```text
corepack pnpm env:check-next-public
```
