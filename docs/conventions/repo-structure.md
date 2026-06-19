# Repo Structure Convention

The top-level folder contract is strict:

```text
apps/
packages/
convex/
docs/
```

The approved app folders are:

```text
apps/www/
apps/app/
apps/admin/
apps/api/
```

The approved shared package folders are:

```text
packages/design-tokens/
packages/ui/
packages/dashboard-ui/
packages/types/
packages/validators/
packages/permissions/
packages/config/
packages/utils/
packages/sms-parser/
packages/sms-flows/
packages/sms-templates/
packages/test-utils/
packages/typescript-config/
packages/eslint-config/
```

Folder responsibilities are strict. Filenames inside those folders may evolve as implementation needs become clearer.

New app folders, new shared packages, top-level folder changes, and folder moves require agreement from both developers and should be recorded as a decision.

