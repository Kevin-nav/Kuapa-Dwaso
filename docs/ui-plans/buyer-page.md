
## 1. Archetype — one sharpening

Your "Kwame" is right. One addition that changes UI decisions:

**Kwame often isn't the one holding the phone.** In low-literacy contexts, a son/daughter/agent frequently operates it *for* him. That means:

- **Every screen must survive being read aloud.** Money math, receipt codes, and statuses need to make sense verbally ("twelve days times five bags times two cedis").
- Favor **plain nouns over app-jargon**: "Money owed to you" beats "Net payable."

This reinforces your existing calls — it doesn't contradict them.

---

## 2. Color tokens — corrected with real contrast

Your instinct on `field` (#2d8a4e) is correct. Verified numbers on white:

| Color | Contrast on white | Verdict |
|:--|:--|:--|
| `field` #2d8a4e | **3.28:1** | ❌ fails AA for text; OK for large icons/borders only |
| `fieldDark` #1f6b3a | **4.85:1** | ✅ AA for normal text & buttons |
| `ink` #0f1f14 | 16.9:1 | ✅ |
| `gray[600]` #4b5563 | 7.5:1 | ✅ good for "muted" in sunlight |
| `gray[500]` #6b7280 | 5.2:1 | ⚠️ avoid for critical labels outdoors |

**Verdict:** adopt `fieldDark` exactly as you proposed. One refinement — you'll also want a **dark-green text token** that isn't full ink, for eyebrows/links on white:

```ts
palette: {
  // ...existing
  fieldDark: "#1f6b3a",  // AA-safe primary button (4.85:1)
  fieldTint: "#e8f3ec",  // selected/active surface fill
  fieldText: "#166534",  // green text/links on white (5.9:1) ✅
}
```

Then your app `globals.css` — I've adjusted two things from yours (`--eyebrow` → use `fieldText` for AA, and added focus + press tokens):

```css
/* apps/app/globals.css */
@theme {
  --color-bg:            #f5f7f0;  /* unify to brand surface ✅ */
  --color-surface:       #ffffff;
  --color-ink:           #0f1f14;
  --color-text:          #2b3037;  /* gray[800] */
  --color-text-muted:    #4b5563;  /* gray[600] — sunlight-safe */
  --color-line:          #dde3d5;
  --color-primary:       #1f6b3a;  /* fieldDark, AA-safe */
  --color-primary-press: #2d8a4e;  /* field, press feedback */
  --color-focus:         #166534;  /* fieldText, 3px focus ring */
  --eyebrow:             #166534;  /* fieldText, not the 3.3:1 green */
}
```

**One caution on `warning` (#b45309):** it's AA on white (4.6:1) — good. But `warningBg` (#fdf3e3) text-on-tint pairings can be weak. Rule: **status text always uses the strong status color, never the bg color, as foreground.**

---

## 3. Gaps your plan doesn't cover yet

Your page designs are strong. These are the missing pieces that make or break trust for Kwame specifically:

### a) Currency & number formatting (non-negotiable for this user)
- **Always** `GHS` prefix, never bare numbers, never `₵` symbol alone (ambiguous when read aloud).
- **Thousands separators** and **no trailing decimals** unless pesewas exist: `GHS 1,200` not `GHS 1200.00`.
- **Tabular figures** so columns of deductions align vertically — critical for the Sales page subtraction to be scannable.
- Negative/deduction amounts: `−GHS 80` with the minus glyph, in `danger`, right-aligned.

### b) Empty & first-run states (you designed the "full" states only)
Every list needs a calm, non-technical empty state:

```
   [ package icon, muted ]
   No produce stored yet

   When you bring produce to the
   warehouse, it will appear here.

   [ Contact warehouse ]
```

Same pattern for Receipts, Fees, Sales. **Never** show an empty table or a raw "0 results."

### c) Error & failed-action states (trust is fragile → errors terrify)
- **Submit failed (offline):** don't discard the report. "Saved. We'll send this when you're back online." Queue it.
- **Load failed:** "Couldn't load your receipts. [Try again]" — never a stack trace, never a blank screen.
- **Optimistic caution:** for anything money-related, do **not** show optimistic success. Show "Submitting…" then confirmed. A false "Paid" is catastrophic for trust.

### d) The "Needs attention" logic (you specified the UI, not the rules)
Define precedence so only **one** urgent thing shows, ranked:
1. Payment withheld/disputed (their money)
2. Fee overdue
3. Produce marked spoiled/rejected
4. Fee accruing soon

Show the single highest; "+2 more" link if others exist. Multiple red cards = permanent anxiety, which you rightly want to avoid.

### e) Confirmation, not just action, on money & contact
- "Report an issue" → after submit, show a **reference number** ("Report #R-104 sent"). Kwame needs proof he complained, same as he needs proof of produce.
- Copy-code button → toast "RCP-2401 copied" (visual + brief), since he can't always tell it worked.

### f) Notifications strategy (implied by "needs attention" but undesigned)
Given expensive data: **SMS/WhatsApp for money events** (sold, paid, fee overdue), **in-app for everything else.** Don't rely on push he may never enable. This is arguably your highest-trust, lowest-cost feature.

### g) Accessibility specifics for outdoor/one-handed
- **Focus ring:** 3px `--color-focus`, always visible (agents may use keyboards/screen readers).
- **Text scaling:** layout must survive 200% font scale without clipping money figures — test this, small Androids force large system fonts.
- **Bottom-sheet reachability:** primary action (Submit/Call) at the **bottom** of sheets, thumb zone.
- **No hover-dependent info** — touch only.

---

## 4. Small refinements to your existing pages

- **Receipt Detail:** add a subtle **"screenshot-friendly"** layout — Kwame *will* screenshot this as proof to share on WhatsApp. Make the code + verified badge + warehouse name fit in the top ~40% so a screenshot crop still proves it. Consider a "Share receipt" action generating a clean image.
- **Storage Fees "How fees work":** default it **open on first visit**, collapsed thereafter (remember state). First-time trust > tidiness.
- **Sales page progress bar (part-paid):** label it — "GHS 150 of GHS 300 paid" — a bare bar is meaningless read aloud.
- **Filter chips:** show the **selected** chip in `fieldTint` bg + `fieldText`, unselected as `neutral` outline. Never rely on a subtle underline.

---

## 5. Suggested build order (what to nail first)

1. **Tokens + globals unification** (foundation, unblocks everything)
2. **Receipt Detail** — the trust anchor; get the "show the math" + share right
3. **Home** with conditional attention logic
4. **Sales/Payment** with itemized deductions
5. Fees → Produce → Receipts list → Contact → Report sheet
6. Empty/error/offline states as a **cross-cutting pass**, not an afterthought

---


# Document 3: Buyer App UI Product Spec

## Platform Overview

The platform is a warehouse-based agricultural produce aggregation system. Instead of farmers taking produce directly to city markets without guaranteed buyers, farmers deposit produce at community warehouses. Warehouse agents verify and record the produce, and buyers purchase from available warehouse inventory. This creates a more reliable system for sourcing produce, tracking stock, managing orders, and coordinating dispatch.

## Buyer App Overview

The Buyer App helps buyers find and order verified produce from warehouses. Buyers should not need to negotiate with every individual farmer. They should be able to browse available warehouse stock, filter by crop, grade, location, quantity, and price, place orders, and track fulfillment. The buyer experience should focus on reliability, available stock, and order clarity. Private farmer information must not be exposed.

## Main UI Areas

### Buyer Onboarding

This page collects the buyer’s basic profile.

The form should capture:

* Buyer type
* Business or organization name
* Phone number
* Destination market
* Basic profile details

The page should be a simple one-page form.

### Browse Inventory

This is the buyer’s main marketplace page.

Buyers should be able to filter by:

* Crop
* Warehouse or community
* Grade
* Quantity
* Price
* Destination market
* Delivery date

Results should show:

* Crop
* Grade
* Available quantity
* Warehouse or community
* Price or price range
* Sell-by date
* Dispatch availability

The buyer should only see warehouse and produce information. Farmer names, phone numbers, and private farmer details should not be shown.

### Inventory Summary

This page helps the buyer review stock before ordering.

It should show:

* Crop
* Grade
* Available quantity
* Warehouse or community
* Price
* Estimated fees, if available
* Pickup or dispatch notes
* Sell-by date

The purpose is to help the buyer decide whether to place an order.

### Create Order

This page allows the buyer to request produce.

The form should capture:

* Crop
* Quantity
* Unit
* Grade preference
* Destination market
* Requested delivery date
* Max price or agreed price

The page should include a clear review section before submission.

### Order Status

This page helps the buyer track an order.

It should show:

* Order status
* Payment status
* Requested quantity
* Matched or reserved quantity
* Destination
* Total amount
* Reservation status
* Dispatch status later

A simple timeline is better than a complex dashboard.

### Reservation and Fulfillment Status

This page explains whether the buyer’s requested stock has been reserved, partially fulfilled, released, expired, or completed.

It should show:

* Reserved quantity
* Fulfilled quantity
* Released quantity
* Current reservation status
* Related order link

## MVP Focus

The Buyer App should first focus on:

1. Buyer onboarding
2. Browse inventory
3. Inventory summary
4. Create order
5. Order status
6. Reservation status
