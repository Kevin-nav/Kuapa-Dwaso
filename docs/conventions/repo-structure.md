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

`apps/ops/` is the operations app. It supports warehouse-agent workflows such
as produce intake, receipt lookup, inventory condition/status updates, dispatch
preparation, and local warehouse support. It also supports demand-led pilot
sourcing, inspection, collection, and custody work for users with an explicit
pilot programme assignment. A warehouse assignment does not grant pilot access,
and a pilot assignment does not require or create a warehouse. The app is
intended for an operations subdomain such as `ops.<domain>`.

`apps/admin/` is for platform administration: warehouse setup, fee
configuration, warehouse-agent approval, pilot programme configuration and
assignments, commercial and purchasing review, oversight, disputes, audit, and
reporting.

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
