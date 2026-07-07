# Farmer App — UI/UX Design Plan

Before diving in, the single most important thing: **your user archetype should drive every decision here.** Let me state the assumption I'm designing around, and please correct me if it's off.

## User Archetype (my working assumption)

**"Kwame, the community farmer"**
- Smallholder farmer, 30–55, brings produce to a local warehouse
- **Low-to-mid digital literacy** — comfortable with WhatsApp/mobile money, not with dashboards
- **Low-end Android**, small screen, **intermittent/expensive data**
- May read English as a second language; scans more than reads
- **Trust is fragile** — money, fees, and "did they really receive my produce?" are emotional
- Uses the phone **outdoors, one-handed, in bright sunlight**

If that's right, the design must prioritize: **large touch targets, high contrast, plain language, money always visible, no ambiguity, offline-tolerance.** This is a *digital receipt book*, not an analytics tool.

---

## 1. Color Token Improvements

Your palette is solid and on-brand. A few targeted changes for this specific archetype:

### Issues to fix
1. **`palette.field` (#2d8a4e) as a large-button background may fail AA with white text.** It's borderline (~3.3:1 for normal text). Fine for large text/icons, risky for small labels.
2. **The farmer app currently uses a different background (`#eef5f8`) and ink (`#16242a`) than the design tokens.** This fragmentation will bite you. Farmer app leans teal/blue while the brand is green — pick one. Given "warehouse/agriculture," I'd unify on the **green brand** and drop the teal-blue app background.
3. **No dedicated "primary action" token guaranteed for AA on buttons.**

### Proposed additions

```ts
palette: {
  // ...existing
  fieldDark: "#1f6b3a",   // AA-safe green for buttons w/ white text (4.6:1)
  fieldTint: "#e8f3ec",   // subtle green fill for selected/active surfaces
}
```

### Recommended app-level mapping (unify with brand)

```css
/* apps/app/globals.css */
@theme {
  --color-bg:            #f5f7f0; /* palette.surface, warm — matches brand */
  --color-surface:       #ffffff; /* gray[0], cards */
  --color-ink:           #0f1f14; /* palette.ink */
  --color-text:          #2b3037; /* gray[800] body */
  --color-text-muted:    #4b5563; /* gray[600] — NOT lighter, sunlight! */
  --color-line:          #dde3d5; /* palette.line */
  --color-primary:       #1f6b3a; /* fieldDark — AA-safe */
  --color-primary-press: #2d8a4e; /* field, for pressed feedback */
  --eyebrow:             #2f6f4e; /* align to green, drop the teal */
}
```

> **Key call:** switch the farmer app off the teal-blue (`#eef5f8`) background onto the warm brand surface. Consistency across your ecosystem builds trust and reduces maintenance.

### Status colors — keep, with one note
Your status set is good and AA-conscious. For **money-critical statuses**, I recommend reinforcing color with **icon + text label always** (never color alone) — critical for colorblind users and sunlight readability.

---

## 2. Global Patterns

**Navigation — bottom tab bar (not a hamburger).** Thumb-reachable, always visible, only 4 items:

```
[ Home ]   [ Produce ]   [ Receipts ]   [ Fees ]
  home       package        receipt       wallet
```
Warehouse Contact and Report Issue live inside Home + Receipt Detail (contextual), not as tabs — keeps the bar uncluttered.

**Touch targets:** minimum **48×48px**, primary buttons **56px** tall, full-width.

**Typography scale (mobile-first, large):**
- Page title: 22–24px, `gray[900]`, semibold
- Card title: 17px, `gray[900]`
- Body: 16px (never below 15px), `gray[800]`
- Meta/label: 14px, `gray[600]`
- Money figures: **20px+, tabular numerals, bold**

**Status chip component (universal):**
```
[● icon]  Label
```
| Status | Token set | Icon |
| :-- | :-- | :-- |
| Paid / Verified / Fresh | success | check-circle |
| Pending / Under review | warning | clock |
| Sold / In-transit / Reserved | info | truck / tag |
| Suspended / Rejected / Spoiled / Overdue | danger | alert-triangle |
| Draft / Cancelled | neutral | minus-circle |

**Icons:** use a single line-icon set (Lucide is ideal — clean, agricultural-friendly). No emojis, agreed.

**Offline/loading:** skeleton cards (not spinners), a subtle offline banner (`neutralBg`), and "Last updated 2h ago" timestamps so farmers trust the data.

---

## 3. Page-by-Page Design

### Farmer Home
Goal: *"Is everything okay, or do I need to act?"* answered in 3 seconds.

```
┌─────────────────────────────┐
│  Good afternoon, Kevin       │   ← greeting, warmth
│  Akwatia Community Warehouse │   ← their warehouse, always anchored
├─────────────────────────────┤
│  ┌──── SUMMARY STRIP ─────┐  │
│  │ 3 batches │ GHS 240 due │  │   ← 2 big numbers, tappable
│  │ stored    │ to you      │  │
│  └───────────┴─────────────┘  │
├─────────────────────────────┤
│  ⚠ Needs attention (if any)  │   ← danger/warning card ONLY if real
│  Storage fee overdue · GHS 40│      appears conditionally, at top
│  [ View ]                    │
├─────────────────────────────┤
│  Recent produce      See all>│
│  ▸ Maize · 5 bags · Stored   │   ← 2–3 compact rows
│  ▸ Cassava · 3 bags · Sold   │
├─────────────────────────────┤
│  Recent receipts     See all>│
│  ▸ RCP-2401 · Maize · Fresh  │
├─────────────────────────────┤
│  [ 📞 Contact warehouse ]     │   ← full-width, icon+label
│  [ ⚑ Report an issue ]        │
└─────────────────────────────┘
```
**Principle:** the "Needs attention" card only renders when true — no permanent anxiety. When all clear, show a calm reassurance line: *"Everything is in order."* with a subtle success tint.

---

### My Produce
Mobile cards, not tables. Each card is a tap target → Receipt Detail.

```
┌─────────────────────────────┐
│ 🌽 Maize            [● Stored]│  ← crop icon + status chip
│ 5 bags · Grade A             │
│ Akwatia Warehouse            │
│ ─────────────────────────    │
│ 12 days stored   Fee: GHS 24 │  ← the two things they worry about
└─────────────────────────────┘
```
- **Filter chips** at top: `All · Stored · Sold · Fees due` (horizontal scroll)
- Storage-fee indicator uses `warning` tint if accruing/overdue, `neutral` if minimal
- Crop uses a **recognizable line icon** per crop type (maize, cassava, etc.) — aids low-literacy scanning

---

### My Receipts
List of receipt cards. Emphasize the **receipt code** (it's their proof).

```
┌─────────────────────────────┐
│ RCP-2401            [● Fresh]│
│ Maize · 5 bags               │
│ Akwatia · Received 24 Jun    │
│                    [ Copy ⧉ ]│  ← copy code inline
└─────────────────────────────┘
```
Search/filter by code at top. Tap anywhere → Receipt Detail.

---

### Receipt Detail  ⭐ (trust anchor page)
This must *feel like proof*. Design it like an official document/deposit slip.

```
┌─────────────────────────────┐
│         RECEIPT              │
│      RCP-2401         [Copy] │  ← big, monospace, prominent
│      [● Verified]            │
├─────────────────────────────┤
│  Crop        Maize           │  ← clean two-column key/value
│  Quantity    5 bags          │
│  Grade       A               │
│  Warehouse   Akwatia         │
│  Received    24 Jun 2026     │
│  Storage rate GHS 2 / bag / day│
├─────────────────────────────┤
│  STORAGE FEE                 │
│  12 days × 5 bags × GHS 2    │  ← show the MATH, not just total
│  ───────────────────────     │
│  Total so far      GHS 120   │  ← big, bold
├─────────────────────────────┤
│  [ 📞 Contact warehouse ]     │
│  [ ⚑ Report an issue ]        │
└─────────────────────────────┘
```
**Critical UX detail:** always show *how* the fee is calculated. Opaque fees destroy trust. A verified badge + warehouse name = "the warehouse really has my produce."

---

### Storage Fees
Transparency page. Lead with the total, then break down per receipt.

```
┌─────────────────────────────┐
│  Total open fees             │
│  GHS 240                     │  ← hero number
│  Across 3 receipts           │
├─────────────────────────────┤
│  How fees work            ⌄  │  ← collapsible plain-language explainer
│  You pay per bag, per day... │
├─────────────────────────────┤
│  RCP-2401 · Maize            │
│  12 days × GHS 10   [● Open] │
│  GHS 120                     │
├─────────────────────────────┤
│  RCP-2388 · Cassava          │
│  8 days × GHS 15  [● Waived] │  ← waived shown in success/neutral
│  GHS 0                       │
└─────────────────────────────┘
```
- Status per receipt: **Paid / Deducted / Waived / Disputed / Open** — chip + label
- A **"Dispute this fee"** link opens Report Issue pre-filled with the receipt — gives farmers recourse, which builds trust

---

### Sales & Payment Status
The emotional core — this is their money.

```
┌─────────────────────────────┐
│ 🌽 Maize sold        [● Paid]│
│ 4 bags · 20 Jun              │
│ ───────────────────────────  │
│ Gross          GHS 400       │
│ − Storage fee   −GHS 80      │  ← deductions itemized, in danger tone
│ − Commission    −GHS 20      │
│ ───────────────────────────  │
│ Net paid to you  GHS 300     │  ← largest, boldest, success color
└─────────────────────────────┘
```
- Payment status chip: `Pending · Part-paid · Paid · Withheld · Disputed`
- **Never hide deductions** — itemize them. Farmers trust what they can see subtracted.
- Part-paid shows a slim progress bar (`fieldDark` fill).

---

### Warehouse Contact
Simple, action-oriented.

```
┌─────────────────────────────┐
│  Akwatia Community Warehouse │
│  Akwatia, Eastern Region     │
├─────────────────────────────┤
│  Open        Mon – Sat       │
│  Hours       7am – 5pm       │
├─────────────────────────────┤
│  [ 📞 Call warehouse ]        │  ← tel: link, one tap
│  [ 💬 WhatsApp ]              │  ← farmers live in WhatsApp
│  [ ⚑ Report an issue ]        │
└─────────────────────────────┘
```
Direct `tel:` and `wa.me` deep links — meet them where they already are.

---

### Report Issue (bottom sheet, not a page)
Keep it light. Category chips + optional note, so a low-literacy user can report with taps only:

```
What's the problem?
[ Wrong quantity ] [ Fee dispute ]
[ Produce damaged ] [ Payment ] [ Other ]

Note (optional): ____________
[ Attach photo 📷 ]
[     Submit report     ]
```

---

## 4. Priority Recommendations Summary

1. **Unify the app onto the green brand** (drop the teal-blue background) — consistency = trust.
2. **Add `fieldDark` (#1f6b3a)** as the AA-safe primary button color.
3. **Bottom tab nav, 4 items** — thumb-first, always visible.
4. **Money and fees always show the math** — the #1 trust driver for this archetype.
5. **Status = icon + label + color**, never color alone (sunlight + colorblindness).
6. **Cards over tables everywhere**, 48px+ targets, 16px+ text.
7. **Conditional "needs attention"** on Home — no permanent anxiety.
8. **WhatsApp + tel deep links** for warehouse contact.
9. **Skeletons + "last updated" timestamps** for the intermittent-connectivity reality.
