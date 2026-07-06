# Warehouse Operations App — UI/UX Design Spec

## 1. User Archetype: The Warehouse Agent

Design every decision around this person:

- **Context:** Standing, often outdoors or in a shed, holding a phone in one hand while handling produce with the other. Bright sunlight, dusty screens, gloves sometimes.
- **Connectivity:** Intermittent 2G/3G. Actions must feel instant and survive network drops.
- **Pressure:** A queue of farmers waiting. Speed and error-prevention matter more than aesthetics.
- **Trust role:** The agent must *show the screen to the farmer* (receipts, fees). Some screens are dual-audience — legible at arm's length, low-literacy-friendly.

**Design principles derived from this:**

1. **One-hand, thumb-first.** Primary actions pinned to the bottom of the viewport on mobile. Minimum touch target 48×48px.
2. **Large type, high contrast.** Base font 16px, key numbers (weights, fees, receipt codes) 24–32px. Must pass WCAG AA in sunlight — prefer AAA for critical data.
3. **Offline-tolerant.** Every mutating action gets an optimistic pending state and a visible sync indicator.
4. **Progressive disclosure.** Intake is a stepper, not one long form.
5. **Confirmation-before-commit** for anything money- or quantity-related.
6. **Icons + labels always** (Lucide-style outline icons). Never icon-only for primary actions.

---

## 2. Color Token Improvements

Your palette is strong. Recommended additions/changes for this app specifically:

### Additions

```ts
// packages/design-tokens/src/index.ts

export const palette = {
  // ...existing...
  fieldDark: "#1f6b3a",     // pressed state for field buttons (fieldLight is hover)
  surfaceRaised: "#ffffff", // explicit card-on-surface token instead of reusing gray[0]
};

export const status = {
  // ...existing...
  // Offline/sync state — agents need this constantly and it must NOT
  // look like warning (which means "expiring soon" in inventory)
  offline: "#7c3aed",
  offlineBg: "#f1ebfb",
  offlineBorder: "#d9c9f2",
};

// New: focus ring token — field agents tab through intake forms on desktop,
// and a11y focus visibility matters in sunlight
export const interaction = {
  focusRing: "#0d9488",      // sky teal, distinct from field green fills
  focusRingOffset: "#f5f7f0",
};
```

### Adjustments

| Issue | Recommendation |
| :--- | :--- |
| `gold` (`#eab308`) vs `accent` (`#d4a843`) are near-duplicates | Consolidate: keep `gold` for badges, deprecate `accent` or rename it `goldMuted` with a documented single use (premium/verified marks). Two golds with no rule = inconsistent UI. |
| `warning` (`#b45309`) on `warningBg` is fine, but gold badges on white fail contrast | Add `goldInk: "#854d0e"` for text on gold badges. |
| Ops app hard-codes `#2f6f4e`, `#d8e3d8`, `#17251c` in `globals.css` | Replace with tokens: `palette.fieldDark`, `palette.line`, `palette.ink`. Drift between apps is already starting. |
| No disabled-fill token | Use `gray[50]` fill + `gray[400]` text as the documented disabled recipe. |

### Semantic mapping for this app

| Semantic role | Token |
| :--- | :--- |
| Primary action (Start Intake, Submit) | `field` / hover `fieldLight` / pressed `fieldDark` |
| Fresh / verified / paid | `success` set |
| Expiring ≤3 days | `warning` set |
| Spoiled / disputed / overdue fee | `danger` set |
| Reserved / in-transit | `info` set |
| Draft / inactive | `neutral` set |
| Offline / pending sync | `offline` set |
| Receipt code highlight | `gold` bg tint + `goldInk` text |

---

## 3. Global Layout & Navigation

**Mobile (primary):** Bottom tab bar, 4 items + FAB-style center action.

```
[ Home ]  [ Inventory ]  [ + Intake ]  [ Search ]  [ Issues ]
```

- `+ Intake` is a raised `field`-green circular button, 56px, centered — it's the #1 action of the day.
- Persistent top bar: warehouse name (left), sync status pill (right). Sync pill states: `● Synced` (success), `↻ Syncing (3)` (offline purple), `⚠ Offline — 5 pending` (offline purple, tappable to view queue).

**Desktop:** Left sidebar nav, content max-width ~1100px, tables instead of cards.

**Typography:** System stack or Inter. Scale: 14 (meta), 16 (body), 18 (labels on forms), 24 (section numbers), 32 (hero numbers like weight/fee).

---

## 4. Screen-by-Screen Design

### 4.1 Operations Home

Layout (mobile, top to bottom):

1. **Header:** "Kumasi Central Warehouse" + agent name + sync pill.
2. **Count cards** — 2×2 grid of tap-able stat cards on `surfaceRaised`, `line` border, 12px radius:
   - Today's intakes (icon: `package-plus`)
   - Items expiring ≤3 days (icon: `clock-alert`, `warning` accent border-left 3px)
   - Open issues (icon: `alert-triangle`, `danger` accent if >0)
   - Available batches (icon: `warehouse`)
3. **Quick actions** — full-width stacked buttons, 52px tall:
   - `Start Produce Intake` — solid `field`, white text (primary)
   - `Find Farmer by Phone` — outline
   - `Search Receipt Code` — outline
   - `Report Issue` — ghost, `gray[600]`
4. **Recent activity** — last 5 receipts as compact rows: receipt code (mono font, gold-tinted chip), crop, qty, time, status badge. Tap → receipt page.

No charts. Cards show a delta only as plain text ("+4 vs yesterday", `gray[500]`).

### 4.2 Farmer Lookup

- Large phone input, `tel` keyboard, auto-formats Ghana numbers (`024 XXX XXXX`), 20px font.
- Explicit **Search** button (52px, `field`) — no search-on-keystroke (saves data, avoids partial-match confusion).
- **Result card:** avatar initials circle (`field` tint), name (20px semibold), phone, community · region, "Farmer since 2024" meta. Primary button: **Start Intake for [Name]**.
- **No-match state:** friendly but efficient — `user-search` icon, "No farmer found with 024 XXX XXXX", primary button **Register New Farmer** (pre-fills the phone number into the registration form — never make the agent retype).
- Recent lookups list below the search (last 5, local-cached, works offline).

### 4.3 Agent-Assisted Registration

Single scrolling form, grouped in two visual sections on `surfaceRaised` cards:

**Identity**
- Full name (text)
- Phone number (pre-filled from lookup; a checkbox: "This phone belongs to someone else in the household" → reveals "Phone owner's name" field)

**Location**
- Region (select, drives next field)
- Community (searchable select, filtered by region)
- Preferred warehouse (select, defaults to agent's current warehouse — shown as pre-selected with "(this warehouse)" hint)

Sticky bottom bar: **Register & Start Intake** (primary, `field`) and **Register Only** (text link). Inline validation on blur, errors in `danger` with icon, never toast-only.

### 4.4 Produce Intake — Stepper (the flagship flow)

4 steps, progress dots at top, back always available, draft auto-saved locally per step:

**Step 1 — Who & Where**
- Farmer (locked-in card if arrived from lookup; otherwise search inline)
- Warehouse (defaulted, editable)

**Step 2 — Produce**
- Crop type: **large tappable tile grid** with icons (maize, cassava, tomato…) — faster than a dropdown for the top 8 crops, "More…" opens full searchable list
- Variety (select, filtered by crop)
- Grade: segmented control `A | B | C` — 48px tall segments, selected = `field` fill
- Condition notes (textarea, optional, plus quick-tag chips: "Slightly bruised", "Wet", "Mixed sizes")

**Step 3 — Quantity & Money**
- Quantity: numeric input with **oversized stepper buttons (±)**, 32px value display; unit segmented control (kg | bag | crate)
- Received date (default today, editable)
- Sell-by date OR shelf life quick-picks: chips `3 days · 7 days · 14 days · 30 days · Custom` — computed date shown underneath
- Storage rate (pre-filled from warehouse default, editable, shows "GHS X / bag / day" plainly)
- Asking / minimum price (currency input)

**Step 4 — Confirm with Farmer**
This is the show-the-farmer screen. Formatted like a receipt preview:
- Extra-large: crop, quantity + unit (32px), grade badge
- Medium: farmer name, storage rate, sell-by date, asking price
- A `warningBg` callout: "Confirm these details with the farmer before submitting."
- Button: **Confirm & Create Receipt** — requires one tap, then shows a 1.5s pressed/loading state (prevents double-submit).

If offline: submits to local queue, proceeds to receipt page marked **Pending sync** (offline purple banner).

### 4.5 Receipt Page

Dual-audience layout — center-aligned, ticket-like card on `surfaceRaised` with a dashed `line` border top edge:

1. Success check icon (`success`), "Receipt Created"
2. **Receipt code** — 28px monospace in a gold-tinted chip (`#fdf6e3`-style bg from gold at 12% + `goldInk` text), with a **Copy** icon-button beside it
3. Key facts as a two-column definition list: Farmer, Crop, Quantity, Grade, Date received, Storage rate, Status badge
4. Status badge uses the status token sets

Sticky bottom actions:
- **Share Receipt Code** (primary — native share sheet / SMS to farmer's phone)
- **Start Another Intake** (secondary — the agent's real next step)
- Overflow menu (`⋮`): Print/Export (marked "coming soon" if not built), Report Issue

### 4.6 Inventory List

- **Filter bar:** horizontal scrolling chips on mobile (Crop, Grade, Status, Expiring soon toggle), plus a search input for receipt code. Active filters shown as removable chips. Desktop: filter row above table.
- **Default sort:** sell-by date ascending — expiring stock surfaces first.
- **Mobile card** per batch:
  - Left border 3px in status color
  - Row 1: Crop + variety (semibold) · status badge
  - Row 2: "120 kg available of 150 kg received" · Grade B chip
  - Row 3: sell-by countdown ("Sell by in 2 days" in `warning` if ≤3 days, `danger` if past) · fee indicator icon (`coins` icon, `danger` tint if fees overdue/disputed)
- **Desktop table:** zebra `gray[50]`, header `gray[50]`, columns: Receipt code, Crop, Available/Received, Grade, Status, Sell-by, Fees, Warehouse.
- Empty state: `package-search` icon, "No batches match these filters", clear-filters button.

### 4.7 Inventory Detail

Sectioned single page (anchored tabs on desktop):

1. **Batch summary header:** crop + variety, status badge, receipt code chip, big available-quantity figure with a thin progress bar (available/received) in `field`.
2. **People & place:** farmer card (tap → farmer), warehouse card.
3. **Grade & condition:** grade badge + latest condition note + "Update condition" button.
4. **Fees:** current accrued fee (large number), status chip, "View fee ledger" link.
5. **Status timeline:** vertical timeline, dots colored by status token, each entry: status, timestamp, actor, reason if any.
6. **Related issues:** list or "No open issues".

**Actions** (bottom sheet on mobile via an **Actions** button; button row on desktop):
- Update condition · Adjust quantity · Change status · Escalate dispute

**Sensitive-action pattern:** Adjust quantity / change status / waive-related actions open a confirmation dialog that requires:
- New value
- **Reason** (required select: "Spoilage", "Weighing error", "Farmer withdrawal", "Other" + free text)
- A summary line: "Reduce from 120 kg → 95 kg (−25 kg)" before the destructive-styled confirm button (`danger` for reductions/spoilage, `field` otherwise).

### 4.8 Storage Fee View

Text-first, farmer-showable:

1. **Fee summary card**, big and plain:
   - "GHS 0.50 per bag per day" (18px)
   - "Stored 12 days" (18px)
   - Divider
   - "Total accrued: **GHS 6.00**" (28px, `ink`)
   - Status chip: Paid (success) / Pending (warning) / Waived (neutral) / Disputed (danger)
2. **Plain-language line** in `gray[600]`: "Fees stop when the produce is sold or collected."
3. **Fee history:** simple dated ledger rows — date, event ("Fee accrued", "Payment", "Waived"), amount, running balance. No table chrome on mobile, just rows with hairline dividers.
4. Action: **Dispute this fee** (ghost, `danger` text) → Issue Escalation with entity pre-linked.

### 4.9 Issue Escalation

Deliberately minimal:

1. **Issue type:** tile-select grid with icons — Farmer · Receipt · Inventory · Fees · Order · Warehouse
2. **Related entity:** search field (pre-filled and locked when arriving from another screen — show as a removable chip)
3. **Summary:** single-line input, required
4. **Notes:** one textarea, optional
5. **Submit Issue** — full-width primary

Confirmation screen shows a ticket reference code (same gold chip treatment as receipts) and "An admin will review this. You can check status from Issues."

---

## 5. Shared Component Patterns

| Component | Spec |
| :--- | :--- |
| **Status badge** | Pill, 12px semibold, `{status}Bg` fill, `{status}` text, `{status}Border` 1px border. Always paired with a leading 6px dot — never rely on color alone. |
| **Code chip** | Monospace, gold-tinted bg, `goldInk` text, copy affordance. Used for receipt & ticket codes. |
| **Primary button** | 52px mobile / 44px desktop, `field` fill, white text, 10px radius, `fieldDark` pressed, focus ring `interaction.focusRing` 2px offset 2px. |
| **Sticky action bar** | Bottom-fixed on mobile, `surfaceRaised` bg, top hairline `line`, safe-area padding. |
| **Offline banner** | Full-width, `offlineBg`, `offline` text + `cloud-off` icon: "You're offline — 3 actions will sync automatically." |
| **Confirmation dialog** | Title, before→after summary, required reason, cancel (ghost) + confirm (semantic color). |
| **Empty state** | Outline icon in `gray[300]`, one sentence, one action button. No illustrations needed in v1. |

## 6. Accessibility & Field-Readiness Checklist

- All status conveyed with color **+ icon/dot + text label**
- Contrast: body ≥ 4.5:1; hero numbers ≥ 7:1
- Inputs use correct keyboards (`tel`, `decimal`)
- No hover-dependent interactions
- Focus-visible rings on all interactive elements
- All forms recoverable: local draft persistence on intake and registration
- Timestamps in agent's local time, dates shown as "6 Jul 2026" (unambiguous)
