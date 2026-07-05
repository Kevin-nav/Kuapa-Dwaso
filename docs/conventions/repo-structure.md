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
apps/ops/
apps/admin/
apps/api/
```

`apps/ops/` is the warehouse operations app for warehouse-agent workflows:
produce intake, receipt lookup, inventory condition/status updates, dispatch
preparation, and local warehouse support. It is intended for an operations
subdomain such as `ops.<domain>`.

`apps/admin/` is for platform administration: warehouse setup, fee
configuration, warehouse-agent approval, oversight, disputes, audit, and reporting.

`apps/app/` is for farmer, buyer, and transporter self-service workflows.

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
