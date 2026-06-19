# Repo Structure and Collaboration Design

## Purpose

This document defines the stable repository structure and collaboration rules for the farmer-to-buyer agricultural marketplace.

The goal is to let two developers work flexibly across product flows while preserving consistent architecture, UI, backend structure, shared domain rules, and low-bandwidth performance.

The project should favor stable folder boundaries, shared contracts, strict typing, and clear ownership practices. Detailed implementation files may evolve as the project grows, but the folder structure and architectural principles should change rarely and only by agreement.

## Monorepo Tooling

The repository will use:

- Corepack
- pnpm workspaces
- Turborepo
- TypeScript in strict mode
- Shared linting and formatting configuration

The purpose of this tooling is to keep local development, package linking, type checking, linting, and build tasks consistent across both developers' machines.

## Top-Level Repository Structure

The top-level folders are strict:

```text
apps/
packages/
convex/
docs/
```

These folders represent the main architectural boundaries of the system. New top-level folders should not be added casually.

Folder moves or changes to this top-level structure require both developers to agree and should be documented as an architecture decision.

## Apps

The application layer should be split by deployable surface:

```text
apps/
  www/
  app/
  admin/
  api/
```

### Public Site

`apps/www` is the public website, intended for the root domain such as `domain.com`.

It should stay lightweight, mostly static where practical, and focused on public pages. It must not import dashboard-heavy components, admin-only tools, provider SDKs, or authenticated product workflow code.

### Main Product App

`apps/app` is the main user application, intended for a subdomain such as `app.domain.com`.

It will contain user-facing product workflows for farmers, agents, buyers, and transport providers. It should prioritize low-bandwidth operation, simple loading states, route-level code splitting, and careful use of heavy features.

### Admin App

`apps/admin` is the admin console, intended for a subdomain such as `admin.domain.com`.

It can contain heavier operational UI such as audit logs, monitoring screens, data tables, charts, dispute management, and hotspot dashboards. Admin-only dependencies should remain isolated from the public site and normal user app.

### API App

`apps/api` is the custom backend API.

The backend will use NestJS with TypeScript and the Fastify adapter. NestJS provides a strong structure for integration-heavy work such as SMS webhooks, Paystack webhooks, Firebase authentication verification, farmer approval workflows, scheduled jobs, and provider isolation.

## API Structure

The API should be organized by folders that express responsibility:

```text
apps/api/src/
  modules/
  workflows/
  providers/
  guards/
  middleware/
  filters/
  pipes/
  config/
  lib/
```

The exact files inside these folders may evolve as the backend grows. The rule is about responsibility and placement, not a fixed file list.

### API Folder Responsibilities

`modules/` contains NestJS modules for API-facing areas such as SMS, payments, approvals, jobs, and health checks.

`workflows/` contains product workflows and business processes such as SMS registration, farmer approval, payment verification, transport matching, and hotspot calculation.

`providers/` contains wrappers around third-party or infrastructure services such as Africa's Talking, Paystack, Firebase, and Convex.

`guards/`, `middleware/`, `filters/`, and `pipes/` contain request protection, request handling, error handling, and validation plumbing.

`config/` contains typed runtime configuration.

`lib/` contains API-local helpers that are not shared domain rules.

### API Rules

Routes and controllers should stay thin. They should accept requests, validate inputs, call services or workflows, and return responses.

Product behavior belongs in workflows, not directly inside request handlers.

Provider-specific logic belongs in providers, not scattered across workflows or controllers.

Shared domain rules must live in shared packages when they are used by more than one app or layer.

The API should not maintain a separate domain model that conflicts with Convex or the shared packages.

## Convex

Convex owns core application data, realtime workflows, queries, and mutations.

The Convex folder is strict:

```text
convex/
```

Files inside `convex/` should be organized around domain areas such as users, farmers, agents, buyers, listings, bulk lots, deals, approvals, SMS conversations, notifications, audit logs, disputes, and hotspots.

The exact file layout may evolve, but the responsibility should remain clear: Convex owns core data access and mutations.

The API backend should call Convex for persistent application data changes instead of creating a parallel data layer.

## Shared Packages

The shared package layer is strict:

```text
packages/
  design-tokens/
  ui/
  dashboard-ui/
  types/
  validators/
  permissions/
  config/
  utils/
  sms-parser/
  sms-flows/
  sms-templates/
  test-utils/
  typescript-config/
  eslint-config/
```

New shared packages require both developers to agree and should be documented. Shared packages are the main mechanism for preventing drift between apps and contributors.

### Design Tokens

`packages/design-tokens` is the source of visual constants.

It owns colors, spacing, typography, radii, shadows, breakpoints, z-index values, and status colors.

Apps should not invent random visual constants. New visual rules should be added here when they are meant to be reused.

### UI

`packages/ui` contains shared everyday components used across apps.

Examples include buttons, icon buttons, inputs, selects, text areas, checkboxes, switches, modals, drawers, badges, tabs, toasts, tooltips, form fields, empty states, loading states, error states, and page headers.

If a visual component is used by more than one app, it should live here or be promoted here quickly.

### Dashboard UI

`packages/dashboard-ui` contains heavier operational components for dashboard and admin experiences.

Examples include dashboard shells, navigation layouts, data tables, filter bars, metric displays, activity feeds, timelines, audit log views, notification lists, search panels, and bulk action controls.

`apps/www` must not import from `packages/dashboard-ui`.

### Types

`packages/types` contains shared TypeScript domain types, roles, statuses, and cross-app contracts.

Apps should not define their own duplicate roles, statuses, or domain types.

### Validators

`packages/validators` contains shared validation schemas.

Validation should be reused across frontend forms, API boundaries, Convex mutations, webhook payloads, and SMS command processing where practical.

### Permissions

`packages/permissions` contains role and action permission logic.

Product permissions should not be scattered as inline role checks across the apps. Shared permission helpers should be used for actions such as approving agents, creating listings, accepting deals, viewing audit logs, assigning transport, and updating sensitive farmer data.

### Config

`packages/config` contains shared constants and configuration values used by product logic.

Examples include supported crops, regions, communities, units, quality grades, listing expiry rules, approval expiry rules, deal statuses, and transport statuses.

### Utils

`packages/utils` contains shared pure helper functions.

Examples include ID generation, phone number formatting, currency formatting, expiry calculations, and simple scoring helpers.

### SMS Packages

SMS behavior should be split across dedicated packages:

- `packages/sms-parser` for message normalization and command parsing
- `packages/sms-flows` for SMS state machines
- `packages/sms-templates` for standardized SMS copy

SMS wording and flow rules should not be duplicated inside app-specific code.

### Test Utilities

`packages/test-utils` contains shared fixtures, factories, and test helpers once the test suite needs them.

### Shared Tooling Config

`packages/typescript-config` and `packages/eslint-config` contain shared TypeScript and linting configuration.

Every app and package should use these shared configs so strict typing and linting rules stay consistent.

## TypeScript and Linting Rules

The codebase should be fully typed and use strict TypeScript defaults.

Recommended rules:

- Strict TypeScript mode is required.
- Implicit `any` should not be allowed.
- Floating promises should be caught by linting.
- Unused variables should fail linting unless intentionally ignored.
- Shared path aliases should be consistent.
- Environment variables should be accessed through typed configuration helpers.
- API, webhook, form, and Convex inputs should be validated at boundaries.
- Shared types should be imported from shared packages instead of recreated locally.

The purpose of these rules is to catch small mistakes early and make cross-package changes safer.

## Ownership Model

Ownership is hybrid and flexible.

Feature flows may have temporary milestone owners, but any developer may work across frontend, API, Convex, and packages when the feature requires it.

Shared surfaces require extra care:

- Folder structure
- Shared UI
- Dashboard UI
- Design tokens
- Domain types
- Validators
- Permissions
- SMS flows
- SMS templates
- Shared config
- API provider boundaries
- Convex schema and core mutations

Changes to shared surfaces should be reviewed by the other developer whenever practical.

Ownership is not a restriction on who can edit code. It is a responsibility model for preserving consistency.

## Folder Structure Protection Rules

These rules are intended to prevent accidental architectural drift:

1. Top-level folders are fixed: `apps/`, `packages/`, `convex/`, and `docs/`.
2. New app folders require a documented decision.
3. New shared package folders require a documented decision.
4. Feature folders may be added inside existing apps when they match the app's responsibility.
5. Shared components must live in `packages/ui` or `packages/dashboard-ui`.
6. Domain types, statuses, validators, and permissions must live in shared packages.
7. Apps must not define their own duplicate shared roles or statuses.
8. Backend provider SDK logic must not enter frontend apps.
9. Admin-only dependencies must not be imported by `apps/www`.
10. Folder moves require both developers to agree.

Tooling should eventually enforce these rules where possible through package exports, TypeScript path aliases, lint import restrictions, and review checklists.

## Low-Bandwidth and Network Performance Rules

The product must be designed for users who may have slow or unreliable network access.

Stable rules:

1. Public pages must stay lightweight.
2. Admin and dashboard code must stay isolated from public pages.
3. Maps, charts, analytics, and heavy tables should be lazy-loaded.
4. Shared packages should avoid browser-heavy dependencies.
5. Images should be optimized and compressed before upload where practical.
6. Agent forms should support draft saving where practical.
7. Farmer-facing screens should prefer simple lists, clear text, and low-image layouts.
8. External service failures should produce clear recoverable states.
9. Paystack should use test mode for MVP and demo work.
10. SMS and webhook flows should be mockable locally.

The public site should not load code for dashboards. The main app should not load admin-only tools. Admin screens may be heavier because they serve operational users, but heavy features should still load only when needed.

## Documentation Rules

Documentation should distinguish between stable principles and changing implementation plans.

Stable architecture and convention documents should avoid naming exact code files in a way that implies all code must live only in those files. Folder responsibilities should be strict, but files inside those folders may evolve.

When folder structure changes, shared package boundaries change, or app boundaries change, the team should document the decision.

Suggested documentation areas:

```text
docs/conventions/
docs/decisions/
docs/plans/
docs/architecture/
```

`docs/conventions/` should contain stable rules.

`docs/decisions/` should contain architecture decisions.

`docs/plans/` should contain implementation plans and milestone plans.

`docs/architecture/` should contain higher-level system design notes.

## Recommended Decision

Use a Turborepo-powered pnpm monorepo with separate deployable apps for the public site, main product app, admin console, and NestJS API.

Use shared packages for UI, dashboard UI, design tokens, types, validators, permissions, config, utilities, SMS parsing, SMS flows, SMS templates, and shared tooling configuration.

Keep folder boundaries strict and documented, while allowing filenames and implementation details inside those folders to evolve naturally.

This structure supports flexible hybrid ownership while preserving product consistency, strong typing, low-bandwidth performance, and long-term maintainability.
