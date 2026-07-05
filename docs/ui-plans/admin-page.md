# Admin Page UI Plan

## 1. Color Token Improvements

Your brand palette is strong for marketing surfaces, but an admin console lives and dies by **semantic status colors** — and right now you're missing a dedicated, accessible set. You're currently overloading `gold`, `clay`, and `field` to mean too many things. Statuses (verified/suspended, payment paid/pending, dispute open/resolved, stock fresh/expiring) need unambiguous, consistent tokens.

### Add a semantic status layer

```ts
// design-tokens/src/index.ts — semantic additions
export const status = {
  // Success / positive / verified / paid / fresh
  success: "#15803d",
  successBg: "#e7f4ec",
  successBorder: "#bfe3ca",

  // Warning / pending / expiring soon / under review
  warning: "#b45309",     // darker than gold for AA on light bg
  warningBg: "#fdf3e3",
  warningBorder: "#f2dcae",

  // Danger / suspended / rejected / spoilage / overdue
  danger: "#b91c1c",
  dangerBg: "#fbeaea",
  dangerBorder: "#f0c4c4",

  // Info / neutral-active / reserved / in-transit
  info: "#0e7490",        // aligns with your sky teal family
  infoBg: "#e3f2f4",
  infoBorder: "#b7dde1",

  // Neutral / inactive / draft / cancelled
  neutral: "#64748b",
  neutralBg: "#f1f3f5",
  neutralBorder: "#dde1e6",
};
```

**Why these values:** your `gold #eab308` and `clay #c2410c` are lovely accents but fail or barely pass AA as text/badge fills on light backgrounds. The tokens above are tuned to pass AA (4.5:1) as text on their paired `*Bg` tints, so badges read cleanly.

### Add a neutral gray ramp

Your admin app only defines one background (`#f6f7f9`) and one text color (`#20242a`). Tables need 5–6 steps for headers, zebra rows, hover, borders, and muted secondary text:

```ts
export const gray = {
  0:  "#ffffff",   // cards, table surface
  25: "#f6f7f9",   // app background (your existing)
  50: "#eef0f3",   // table header, zebra
  100:"#e2e6ea",   // hairlines / dividers
  300:"#c2c8d0",   // disabled borders
  500:"#6b7280",   // secondary/muted text
  700:"#3a4048",   // body text
  900:"#20242a",   // headings (your existing)
};
```

### Keep brand accents purposeful

- `field #2d8a4e` → primary actions, active nav, key metric emphasis
- `sky #0d9488` → links, secondary/info accents, chart primary
- `gold`, `clay`, `emerald` → **charts and data viz only**, not status. This keeps status meaning consistent and stops the UI from feeling noisy.

**Result:** brand for identity + action, semantic layer for state, gray ramp for structure. That separation is what makes admin tools feel professional.

## 2. Global Layout & Navigation

```text
┌──────────────────────────────────────────────────────────────┐
│ Top bar: logo · global search · warehouse filter · user menu   │
├────────────┬─────────────────────────────────────────────────┤
│ Sidebar    │  Page header (title · breadcrumb · primary action)│
│ (icons +   │─────────────────────────────────────────────────│
│  labels)   │  Filter/toolbar row                               │
│            │─────────────────────────────────────────────────│
│ • Overview │                                                   │
│ • Warehouses│  Content: metric cards / data table / detail     │
│ • Agents   │                                                   │
│ • Farmers  │                                                   │
│ • Buyers   │                                                   │
│ • Fee Rules│                                                   │
│ • Inventory│                                                   │
│ • Orders   │                                                   │
│ • Sales    │                                                   │
│ • Dispatch │                                                   │
│ • Disputes │                                                   │
│ • Audit    │                                                   │
│ • Reports  │                                                   │
└────────────┴─────────────────────────────────────────────────┘
```

Guidelines:
- **Collapsible sidebar** (icon-only when collapsed) — admins on smaller laptops need horizontal room for wide tables.
- **Group the nav** to mirror your MVP mental model: *Operations* (Overview, Inventory, Orders, Sales, Dispatch) · *People* (Farmers, Buyers, Agents) · *Configuration* (Warehouses, Fee Rules) · *Governance* (Disputes, Audit, Reports). Grouping 13 items prevents a wall of links.
- **Global warehouse filter in the top bar** — since almost every screen is warehouse-scoped, a persistent warehouse selector saves repeated filtering. Default to "All warehouses."
- Use **lucide/heroicons outline** icons at ~18px, consistent stroke. No emoji anywhere.

## 3. Reusable Component Patterns

### Status badge (the workhorse)
Pill with tint background + colored dot + label. Never color-only (accessibility). Map every status to a token:

| Domain | Status → token |
|---|---|
| Farmer/Buyer/Agent | Verified→success · Pending→warning · Suspended→danger · Inactive→neutral |
| Inventory | Available→success · Reserved→info · Expiring soon→warning · Expired/Spoiled→danger |
| Order | Reserved→info · Fulfilled→success · Cancelled→neutral |
| Payment | Paid→success · Pending→warning · Overdue→danger |
| Dispute | Open→warning · Under review→info · Resolved→success · Cancelled→neutral |
| Dispatch | Scheduled→neutral · In transit→info · Delivered→success · Delayed→danger |

### Data table standard
- Sticky header, zebra rows (`gray.50`), row hover (`gray.50` slightly darker), 44px row height.
- Right-align numeric columns (quantity, amounts); use tabular figures.
- **Column-adjacent filters + search** in a toolbar above the table; show active filters as removable chips.
- Row click → **side drawer** (not full navigation) for detail/inspect. Keeps the list context and is faster for oversight work.
- Bulk actions bar appears on row selection.
- Always show: result count, pagination, and empty/loading/error states.

### Metric card
Label (muted) · big value · small delta or context line. Keep to one accent per card; don't rainbow the dashboard.

### Confirmation for sensitive actions
Fee rule changes, agent suspension, dispute resolution → require a confirm modal that **restates the impact** ("This rate applies to Maize · Grade A across 4 warehouses, effective immediately"). This directly supports your "careful and controlled" requirement for fees.

## 4. Screen-by-Screen (MVP) UX Notes

**1. Admin Overview**
- Top row: 4–6 metric cards (Farmers, Buyers, Warehouses, Agents, Available inventory, Open orders).
- Two attention widgets styled with warning/danger tints: **Open disputes** and **Stock nearing expiry** — these are the "act now" items.
- Recent activity feed (compact, timestamped, actor + action).
- Warehouse intelligence summary as a small table (utilization %, low-stock, expiring) — tables before charts per your spec.

**2. Warehouse Management**
- Table list → drawer/detail with tabbed sections: *Profile* (code, name, location hierarchy), *Capacity & crops*, *Agents*, *Schedule* (operating/dispatch days shown as a 7-day chip row), *Destination markets*.
- Status badge prominent. Capacity shown as a utilization bar (field green → warning as it approaches full).

**3. Agent Management**
- List with status + assigned warehouse count. Actions (Approve / Suspend / Assign) as explicit buttons in the drawer, each with confirmation.
- "Assign warehouses" = multi-select with search, showing which are already covered.

**4. Farmer Oversight**
- List filterable by verification + account status + community.
- Detail drawer tabs: *Profile & verification*, *Produce & receipts* (linked table), *Disputes*. Verification actions gated behind confirm + note field.

**5. Fee Rule Management**
- This screen should feel deliberate: no inline-editing of live rates. Editing creates a **new version** with an effective date; show version history and clearly mark the *currently active* rule.
- Scope shown explicitly (Warehouse / Crop / Grade / Unit chips). Confirm modal restates scope + impact.

**6. Inventory Oversight**
- Powerful filter bar (warehouse, crop, grade, status, sell-by, receipt code) with saved-filter chips.
- Color the sell-by column by proximity: fresh→normal, ≤N days→warning, past→danger.
- Detail drawer with tabs: *Details*, *Change history*, *Disputes*, *Audit log* — one place to inspect everything about a lot.

**7. Dispute Management**
- Board or table view; group/filter by status. Each dispute drawer: related entity link, summary, timeline of actions, resolution notes field.
- Clear state transitions as buttons: Mark under review → Resolve → (or Cancel). Resolution requires a note.

**8. Audit Logs**
- Read-only table: actor, role, action, entity, timestamp.
- **Before/after collapsed by default** (expand row → diff view: removed in danger tint, added in success tint). Filter by actor, entity type, date range.

## Suggested build order within MVP
1. Design tokens + status badge + table + drawer + metric card (the shared primitives — build once, reuse everywhere).
2. Overview → Warehouses → Agents → Farmers.
3. Fee rules (needs the versioning/confirm pattern).
4. Inventory → Disputes → Audit.

Getting the shared primitives right first is what will make all 13 screens feel consistent and cut your build time dramatically.
