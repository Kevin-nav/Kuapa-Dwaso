# KuapaDwaso

Farmer-to-buyer digital marketplace with SMS onboarding, agent-assisted listing, bulk produce aggregation, logistics coordination, payments, and supply-demand intelligence.

This repository is a pnpm + Turborepo monorepo. The structure is intentionally strict so two developers can work flexibly without drifting away from shared UI, backend, domain, and low-bandwidth principles.

Start with the docs in `docs/intent-and-initial-plans/` and `docs/plans/`.

Convex is configured from the top-level `convex/` folder. To connect this checkout to the existing `KuapaDwaso` Convex project, run `corepack pnpm convex:dev` and select the existing project when prompted.

For the Next.js apps, copy the generated root `CONVEX_URL` value into `NEXT_PUBLIC_CONVEX_URL` in `apps/app/.env.local` and `apps/admin/.env.local`.
