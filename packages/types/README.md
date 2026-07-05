# Types

Owns shared TypeScript domain types, roles, statuses, and cross-app contracts.

Apps should import shared domain contracts from here instead of recreating them locally.

The primary product vocabulary is warehouse based: `warehouse_agent`,
`warehouse`, `inventory_batch`, `storage_receipt`, `storage_fee_ledger`,
`buyer_order`, `sale_record`, and `dispatch`.

Fee rule snapshots are part of the shared contract so historical storage fees,
buyer charges, and sale deductions remain reproducible after admin edits a fee
rule.
