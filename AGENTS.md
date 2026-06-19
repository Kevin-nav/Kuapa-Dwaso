# Agent Instructions

Read these before changing code:

- `docs/conventions/repo-structure.md`
- `docs/conventions/ownership-model.md`
- `docs/conventions/ui-system.md`
- `docs/conventions/backend-structure.md`
- `docs/conventions/network-performance.md`
- `docs/decisions/ADR-0001-monorepo-and-app-boundaries.md`

## Core Rules

- Keep the top-level folders fixed: `apps/`, `packages/`, `convex/`, `docs/`.
- Do not add app folders, shared package folders, or move folders without explicit user approval.
- Folder responsibilities are strict; filenames inside those folders may evolve.
- Use shared packages for reusable UI, domain types, validators, permissions, config, utilities, SMS behavior, and tooling config.
- Keep `apps/www` lightweight. It must not import `packages/dashboard-ui` or admin-only code.
- Keep provider SDK logic out of frontend apps.
- API code belongs under the NestJS responsibility folders in `apps/api/src/`.
- Preserve low-bandwidth behavior: lazy-load heavy UI, avoid browser-heavy shared packages, and keep SMS/webhook flows mockable.
- Use strict TypeScript and shared lint/type configs.
- Update `docs/decisions/` and relevant `docs/conventions/` files when architecture or folder boundaries change.

Before finishing repo-wide setup changes, run:

```text
corepack pnpm list --depth -1
git status --short
```
