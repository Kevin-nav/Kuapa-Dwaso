# Runnable Monorepo Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the agriculture marketplace monorepo runnable with minimal independent frontend apps, a NestJS Fastify API, shared config, and working root commands.

**Architecture:** Keep the approved `apps/` and `packages/` boundaries intact. Each app owns only its minimal boot files, shared packages expose tiny TypeScript entrypoints, and the public site stays free of dashboard/admin imports.

**Tech Stack:** pnpm workspace, Turborepo, Next.js, React, NestJS, Fastify adapter, TypeScript, ESLint flat config.

---

### Task 1: Shared Tooling

**Files:**
- Modify: `packages/eslint-config/base.js`
- Modify: `packages/eslint-config/next.js`
- Modify: `packages/eslint-config/nest.js`
- Modify: app and package manifests/config files

**Steps:**
1. Convert the shared ESLint package to ESLint 9 flat config exports.
2. Add per-workspace `eslint.config.mjs` files that import the shared config.
3. Add per-workspace `tsconfig.json` files extending the shared TypeScript configs.
4. Run `corepack pnpm lint` and `corepack pnpm typecheck`.

### Task 2: Frontend Apps

**Files:**
- Modify: `apps/www`
- Modify: `apps/app`
- Modify: `apps/admin`

**Steps:**
1. Add minimal Next.js app-router files for each app.
2. Set unique dev ports and independent page copy.
3. Use shared UI only where appropriate; keep `apps/www` away from `@kuapa-dwaso/dashboard-ui`.
4. Run `corepack pnpm build`.

### Task 3: API App

**Files:**
- Modify: `apps/api`

**Steps:**
1. Add a minimal NestJS Fastify bootstrap.
2. Add a thin health module/controller at `/health`.
3. Keep code under `apps/api/src/modules`.
4. Run API typecheck/build through root scripts.

### Task 4: Shared Packages and Verification

**Files:**
- Modify: selected `packages/*`

**Steps:**
1. Add tiny exports for design tokens, UI, dashboard UI, types, and utilities.
2. Build all packages through Turbo.
3. Run `corepack pnpm list --depth -1`.
4. Run `git status --short`.
5. Commit the completed runnable foundation.
