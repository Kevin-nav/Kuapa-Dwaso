# ADR-0001: Monorepo and App Boundaries

## Status

Accepted

## Decision

Use a Corepack-managed pnpm workspace with Turborepo.

Use separate app folders for the public site, main product app, warehouse
operations console, admin console, and NestJS API:

```text
apps/www/
apps/app/
apps/ops/
apps/admin/
apps/api/
```

Use shared packages for UI, dashboard UI, design tokens, types, validators, permissions, config, utilities, SMS behavior, tests, TypeScript configuration, and ESLint configuration.

## Rationale

Separate deployable app folders protect low-bandwidth users from downloading
warehouse operations, dashboard, or admin code when they only need public or
focused product pages.

Shared packages keep the product consistent while allowing developers to own feature flows flexibly.

## Consequences

Folder boundaries are stricter than filenames.

New top-level folders, new shared packages, and folder moves require agreement
and documentation. `apps/ops/` is accepted by ADR-0002 as the warehouse-agent
operations boundary for the warehouse pivot.
