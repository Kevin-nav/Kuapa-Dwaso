# Repo Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Initialize Git and create the stable Turborepo + pnpm monorepo foundation described in the approved repository design.

**Architecture:** The repo will use strict top-level folders, separate deployable app folders, shared packages for UI/domain/tooling contracts, and a NestJS API boundary. This first implementation creates structure and guardrails only; product feature code comes later.

**Tech Stack:** Git, Corepack, pnpm workspaces, Turborepo, TypeScript, ESLint, NestJS folder conventions, Next.js app placeholders.

---

### Task 1: Initialize Git

**Files:**
- Create: `.git/`
- Create: `.gitignore`

**Step 1: Initialize repository**

Run: `git init`

Expected: repository initialized in the workspace.

**Step 2: Add ignore rules**

Create `.gitignore` with Node, pnpm, Turborepo, Next.js, Convex, logs, build outputs, and environment file ignores.

**Step 3: Verify status**

Run: `git status --short`

Expected: docs and generated setup files appear as untracked files.

### Task 2: Create Monorepo Workspace Files

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.npmrc`
- Create: `.editorconfig`

**Step 1: Add root package metadata**

Create root package scripts for `dev`, per-app dev commands, `build`, `lint`, `typecheck`, `test`, and `format`.

**Step 2: Add workspace globs**

Create workspace globs for `apps/*` and `packages/*`.

**Step 3: Add Turborepo pipeline**

Create tasks for build, dev, lint, typecheck, test, and format.

**Step 4: Add Corepack/pnpm settings**

Add `.npmrc` and package manager metadata so pnpm is consistently used.

### Task 3: Create Strict Folder Contract

**Files:**
- Create folders under `apps/`
- Create folders under `packages/`
- Create folder `convex/`
- Create convention docs under `docs/conventions/`
- Create decision docs under `docs/decisions/`
- Create architecture docs under `docs/architecture/`

**Step 1: Create app folders**

Create `apps/www`, `apps/app`, `apps/admin`, and `apps/api`.

**Step 2: Create shared package folders**

Create the approved package folders for UI, dashboard UI, design tokens, domain contracts, SMS, utilities, tests, TypeScript config, and ESLint config.

**Step 3: Add placeholder package metadata**

Each app and package gets minimal package metadata so pnpm can resolve workspace boundaries.

### Task 4: Add Shared TypeScript Configuration

**Files:**
- Create: `packages/typescript-config/package.json`
- Create: `packages/typescript-config/base.json`
- Create: `packages/typescript-config/nextjs.json`
- Create: `packages/typescript-config/nestjs.json`
- Create: `packages/typescript-config/package.json`
- Create root `tsconfig.json`

**Step 1: Add strict base config**

Create a strict TypeScript base config with shared compiler rules.

**Step 2: Add app-specific presets**

Create Next.js and NestJS presets that extend the base config.

**Step 3: Add root references config**

Create a root TypeScript config for editor and tooling visibility.

### Task 5: Add Shared ESLint Configuration

**Files:**
- Create: `packages/eslint-config/package.json`
- Create: `packages/eslint-config/base.js`
- Create: `packages/eslint-config/next.js`
- Create: `packages/eslint-config/nest.js`

**Step 1: Add shared lint config package**

Create a workspace package that apps and packages can extend.

**Step 2: Add import restriction placeholders**

Add rules that can enforce architectural imports once source files are added.

### Task 6: Add App and Package Placeholders

**Files:**
- Create minimal package metadata and README files across app/package folders.

**Step 1: Add app README files**

Each app README states its responsibility and import restrictions.

**Step 2: Add package README files**

Each package README states what belongs in the package and what should not.

### Task 7: Validate and Commit

**Files:**
- All generated files

**Step 1: Run Git status**

Run: `git status --short`

Expected: setup files are staged or visible as new files.

**Step 2: Run package manager sanity command**

Run: `corepack pnpm --version`

Expected: pnpm is available through Corepack.

**Step 3: Run workspace list**

Run: `corepack pnpm list --depth -1`

Expected: workspace packages are discovered.

**Step 4: Commit**

Run: `git add . && git commit -m "chore: initialize monorepo foundation"`

Expected: initial commit created.
