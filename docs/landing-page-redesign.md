# Kuapa Dwaso — Landing Page Redesign Specification

**Version:** 1.0 · **Direction:** "Documentary meets fintech" — editorial photography, confident type, radical restraint.

---

## 1. Design Principles

1. **The photos are the product.** Every decorative element competes with Image 1–3. When in doubt, remove.
2. **Demonstrate low-bandwidth values.** No canvas loops, no JS-driven animation. CSS transitions only, all under 300ms. Target < 90KB JS on this route.
3. **One accent per section.** Either a photo, a color band, or a graphic — never two.
4. **Type does the heavy lifting.** Big Outfit headlines, quiet Jakarta body.

---

## 2. Design Tokens (additions)

Keep your existing palette. Add these to `packages/design-tokens/src/index.ts`:

```ts
export const tokens = {
  // existing...
  brandField: "#2d8a4e",
  brandFieldLight: "#38a85c",
  brandSky: "#0d9488",
  brandSurface: "#f5f7f0",
  brandInk: "#0f1f14",

  // new
  brandClay: "#c2410c", // warm accent pulled from Image 2's red umbrella
  brandInkSoft: "#1a2e20", // section backgrounds slightly lighter than ink
  brandLine: "#dde3d5", // hairline borders on surface
  brandGold: "#eab308", // sparing use: plantain yellow, badges only
};
```

**Rationale:** `brandClay` ties the UI to the red umbrella photo — this is what makes the palette feel *derived from your world* rather than a generic green agri-theme. `brandGold` echoes the plantain; use it for exactly one thing (the "Pilot" badge) so it stays special.

### Typography scale

```css
:root {
  --font-display: "Outfit", sans-serif;
  --font-body: "Plus Jakarta Sans", sans-serif;

  --text-hero: clamp(2.5rem, 6vw, 4.5rem); /* weight 700, lh 1.05 */
  --text-h2: clamp(1.875rem, 4vw, 3rem); /* weight 700, lh 1.1  */
  --text-h3: 1.375rem; /* weight 600, lh 1.3  */
  --text-body: 1.0625rem; /* weight 400, lh 1.65 */
  --text-eyebrow: 0.8125rem; /* weight 600, tracking 0.12em, uppercase */
}
```

The **eyebrow** (small uppercase label above headlines) is the recurring editorial device that unifies every section:

```css
.eyebrow {
  font: 600 var(--text-eyebrow) var(--font-body);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--brand-field);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.eyebrow::before {
  content: "";
  width: 24px;
  height: 2px;
  background: currentColor;
}
```

---

## 3. Page Structure Overview

```
┌──────────────────────────────────────┐
│ 1. Navbar (solid, hairline border)   │
│ 2. Hero — Image 1 full-bleed         │
│ 3. Proof bar (stats strip)           │
│ 4. SMS section (dark, phone mockup)  │
│ 5. How it works (3 steps + Image 3)  │
│ 6. Agent story (Image 2 + copy)      │
│ 7. Audience cards (flat, 3-up)       │
│ 8. Final CTA band                    │
│ 9. Footer                            │
└──────────────────────────────────────┘
```

---

## 4. Section-by-Section Spec + Code

### 4.1 Navbar

Drop the frosted glass. A solid surface bar with a 1px bottom hairline reads more institutional/trustworthy and costs nothing to render.

```tsx
<header className="sticky top-0 z-50 bg-[--brand-surface] border-b border-[--brand-line]">
  <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
    <a href="/" className="flex items-center gap-2.5">
      <Logo className="h-8 w-8" />
      <span className="font-display text-lg font-700 text-[--brand-ink]">
        Kuapa Dwaso
      </span>
    </a>
    <div className="hidden items-center gap-8 md:flex">
      <a href="#how" className="nav-link">How it works</a>
      <a href="#agents" className="nav-link">Agents</a>
      <a href="#buyers" className="nav-link">Buyers</a>
      <a
        href="/join"
        className="rounded-full bg-[--brand-field] px-5 py-2.5
          text-sm font-600 text-white transition-colors
          hover:bg-[--brand-field-light]"
      >
        Join the pilot
      </a>
    </div>
  </nav>
</header>
```

**Logo SVG** — a plantain-leaf mark, simple enough to read at 24px:

```html
<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="8" fill="#2d8a4e" />
  <path
    d="M16 26c0-8 2-14 9-18-1 8-3 14-9 18Z"
    fill="#f5f7f0"
    opacity="0.95"
  />
  <path
    d="M15 26c0-7-2-12-8-15 1 7 3 12 8 15Z"
    fill="#f5f7f0"
    opacity="0.6"
  />
</svg>
```

---

### 4.2 Hero — Image 1

**Image:** the wide market scene (two agents standing, vendor in purple headwrap, plantain piles, green umbrellas).

**Layout:** full-viewport-width image, min-height `85vh`. A left-to-right dark gradient carries the text. The vendor and agents sit in the right two-thirds — keep them fully visible; the gradient must fade out by ~55% width.

```tsx
<section className="relative min-h-[85vh] flex items-end">
  <Image
    src="/images/hero-market.jpg"
    alt="Kuapa Dwaso agents speaking with a plantain vendor at
      a market in Ghana"
    fill
    priority
    className="object-cover object-[70%_center]"
  />
  {/* Gradient scrim */}
  <div
    className="absolute inset-0"
    style={{
      background: `linear-gradient(100deg,
        rgba(15, 31, 20, 0.92) 0%,
        rgba(15, 31, 20, 0.75) 30%,
        rgba(15, 31, 20, 0.15) 60%,
        rgba(15, 31, 20, 0.35) 100%)`,
    }}
  />
  <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-40">
    <div className="max-w-xl">
      <p className="eyebrow !text-[--brand-gold]">
        Now piloting · Western Region, Ghana
      </p>
      <h1
        className="mt-4 font-display text-[length:--text-hero]
          font-700 leading-[1.05] text-white"
      >
        The market is already here.
        <br />
        <span className="text-[#7dd8a0]">We connect it.</span>
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-white/85">
        Kuapa Dwaso links smallholder farmers to wholesale buyers
        through trusted local agents — and a simple SMS line that
        works on any phone.
      </p>
      <div className="mt-8 flex flex-wrap gap-4">
        <a href="/agents" className="btn-primary">Become an agent</a>
        <a href="/buyers" className="btn-ghost">Buy in bulk</a>
      </div>
    </div>
  </div>
</section>
```

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  background: var(--brand-field);
  padding: 0.875rem 1.75rem;
  font: 600 1rem var(--font-body);
  color: #fff;
  transition: background-color 0.2s ease;
}
.btn-primary:hover {
  background: var(--brand-field-light);
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  border: 1.5px solid rgba(255, 255, 255, 0.4);
  padding: 0.875rem 1.75rem;
  font: 600 1rem var(--font-body);
  color: #fff;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}
.btn-ghost:hover {
  border-color: #fff;
  background: rgba(255, 255, 255, 0.08);
}
```

**Detail:** note the accent green in the headline is `#7dd8a0`, not `brand-field` — brand green fails contrast on the dark scrim; this lighter tint passes AA.

---

### 4.3 Proof Bar

Replaces the "Launch Readiness Strip." Thin, quiet, sits directly under the hero on surface color. Real numbers only — if a metric isn't real yet, use qualitative statements.

```tsx
<section className="border-b border-[--brand-line] bg-[--brand-surface]">
  <div
    className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6
      py-10 md:grid-cols-4"
  >
    {[
      ["Agent-verified", "Every listing checked in person"],
      ["Any phone", "Full access via SMS — no data needed"],
      ["Bulk-first", "Aggregated lots sized for wholesale"],
      ["Pilot live", "Operating in the Western Region"],
    ].map(([title, sub]) => (
      <div key={title}>
        <p className="font-display text-lg font-700 text-[--brand-ink]">
          {title}
        </p>
        <p className="mt-1 text-sm text-[--brand-ink]/60">{sub}</p>
      </div>
    ))}
  </div>
</section>
```

---

### 4.4 SMS Section (dark) — your differentiator

**Layout:** `brand-ink` background, two columns. Left: eyebrow + headline + copy + command chips. Right: a **pure-SVG keypad phone** showing a real conversation. SVG means it's crisp, ~2KB, zero images.

```tsx
<section className="bg-[--brand-ink] py-24 text-white">
  <div
    className="mx-auto grid max-w-6xl items-center gap-16 px-6
      lg:grid-cols-2"
  >
    <div>
      <p className="eyebrow !text-[#7dd8a0]">No smartphone required</p>
      <h2
        className="mt-4 font-display text-[length:--text-h2]
          font-700 leading-tight"
      >
        If your phone can text,
        <br />
        you can trade.
      </h2>
      <p className="mt-6 max-w-md text-white/70 leading-relaxed">
        Farmers register, check offers, and approve sales with
        simple SMS commands. No app, no data bundle, no fuss.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {["JOIN", "STATUS", "YES / NO", "HELP"].map((c) => (
          <code
            key={c}
            className="rounded-lg border border-white/15
              bg-white/5 px-4 py-2 font-mono text-sm
              text-[#7dd8a0]"
          >
            {c}
          </code>
        ))}
      </div>
    </div>
    <PhoneMockup />
  </div>
</section>
```

**Keypad phone SVG** (`PhoneMockup`). Deliberately a *feature phone*, not an iPhone — that's the point:

```html
<svg
  viewBox="0 0 260 480"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-label="SMS conversation with Kuapa Dwaso on a keypad phone"
>
  <!-- Body -->
  <rect x="10" y="10" width="240" height="460" rx="28"
    fill="#1a2e20" stroke="#3a5a45" stroke-width="2" />
  <!-- Earpiece -->
  <rect x="105" y="26" width="50" height="6" rx="3" fill="#3a5a45" />
  <!-- Screen -->
  <rect x="28" y="44" width="204" height="240" rx="8" fill="#c8e6c9" />
  <!-- Screen header -->
  <rect x="28" y="44" width="204" height="26" rx="8" fill="#2d8a4e" />
  <text x="130" y="61" text-anchor="middle" font-family="monospace"
    font-size="11" fill="#fff">Kuapa Dwaso · 1945</text>

  <!-- Outgoing msg -->
  <rect x="120" y="80" width="100" height="24" rx="6" fill="#2d8a4e" />
  <text x="170" y="96" text-anchor="middle" font-family="monospace"
    font-size="10" fill="#fff">JOIN</text>

  <!-- Incoming msg -->
  <rect x="40" y="112" width="160" height="52" rx="6" fill="#fff" />
  <text x="48" y="128" font-family="monospace" font-size="9"
    fill="#0f1f14">Akwaaba! You are now</text>
  <text x="48" y="141" font-family="monospace" font-size="9"
    fill="#0f1f14">registered. Reply STATUS</text>
  <text x="48" y="154" font-family="monospace" font-size="9"
    fill="#0f1f14">to see your listings.</text>

  <!-- Outgoing msg -->
  <rect x="120" y="172" width="100" height="24" rx="6" fill="#2d8a4e" />
  <text x="170" y="188" text-anchor="middle" font-family="monospace"
    font-size="10" fill="#fff">STATUS</text>

  <!-- Incoming msg -->
  <rect x="40" y="204" width="170" height="66" rx="6" fill="#fff" />
  <text x="48" y="220" font-family="monospace" font-size="9"
    fill="#0f1f14">Plantain: 40 bunches</text>
  <text x="48" y="233" font-family="monospace" font-size="9"
    fill="#0f1f14">Offer: GHS 22/bunch</text>
  <text x="48" y="246" font-family="monospace" font-size="9"
    fill="#0f1f14">Buyer: Takoradi Foods</text>
  <text x="48" y="259" font-family="monospace" font-size="9"
    fill="#2d8a4e" font-weight="bold">Reply YES to accept</text>

  <!-- D-pad -->
  <circle cx="130" cy="322" r="24" fill="none"
    stroke="#3a5a45" stroke-width="2" />
  <circle cx="130" cy="322" r="10" fill="#3a5a45" />

  <!-- Keypad: 4 rows x 3 keys -->
  <g fill="#233a2b" stroke="#3a5a45" stroke-width="1">
    <rect x="42"  y="358" width="52" height="20" rx="6" />
    <rect x="104" y="358" width="52" height="20" rx="6" />
    <rect x="166" y="358" width="52" height="20" rx="6" />
    <rect x="42"  y="384" width="52" height="20" rx="6" />
    <rect x="104" y="384" width="52" height="20" rx="6" />
    <rect x="166" y="384" width="52" height="20" rx="6" />
    <rect x="42"  y="410" width="52" height="20" rx="6" />
    <rect x="104" y="410" width="52" height="20" rx="6" />
    <rect x="166" y="410" width="52" height="20" rx="6" />
    <rect x="42"  y="436" width="52" height="20" rx="6" />
    <rect x="104" y="436" width="52" height="20" rx="6" />
    <rect x="166" y="436" width="52" height="20" rx="6" />
  </g>
  <g font-family="monospace" font-size="10" fill="#7dd8a0"
    text-anchor="middle">
    <text x="68"  y="372">1</text><text x="130" y="372">2</text>
    <text x="192" y="372">3</text>
    <text x="68"  y="398">4</text><text x="130" y="398">5</text>
    <text x="192" y="398">6</text>
    <text x="68"  y="424">7</text><text x="130" y="424">8</text>
    <text x="192" y="424">9</text>
    <text x="68"  y="450">*</text><text x="130" y="450">0</text>
    <text x="192" y="450">#</text>
  </g>
</svg>
```

Optional flourish (cheap, CSS-only): fade the message bubbles in sequence when the section scrolls into view via a single `IntersectionObserver` toggling a class:

```css
.sms-msg {
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.sms-in-view .sms-msg { opacity: 1; transform: none; }
.sms-in-view .sms-msg:nth-child(2) { transition-delay: 0.5s; }
.sms-in-view .sms-msg:nth-child(3) { transition-delay: 1s; }
.sms-in-view .sms-msg:nth-child(4) { transition-delay: 1.5s; }

@media (prefers-reduced-motion: reduce) {
  .sms-msg { transition: none; opacity: 1; transform: none; }
}
```

(Wrap each bubble `<rect>`+`<text>` in a `<g class="sms-msg">`.)

---

### 4.5 How It Works — 3 steps + Image 3

**Image:** the negotiation photo (two agents seated opposite the vendor, peppers and yellow eggplants in the foreground).

**Layout:** section header, then a numbered vertical rail on the left, Image 3 on the right at step 2's height. Numbers use big outlined display digits — an editorial trick that avoids icon-library genericism.

```tsx
<section id="how" className="bg-[--brand-surface] py-24">
  <div className="mx-auto max-w-6xl px-6">
    <p className="eyebrow">How it works</p>
    <h2
      className="mt-4 max-w-lg font-display
        text-[length:--text-h2] font-700 text-[--brand-ink]"
    >
      From farm gate to wholesale, in three steps.
    </h2>

    <div className="mt-16 grid gap-12 lg:grid-cols-2 lg:gap-20">
      <ol className="space-y-12">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-6">
            <span className="step-number">{i + 1}</span>
            <div>
              <h3 className="font-display text-[length:--text-h3]
                font-600 text-[--brand-ink]">
                {s.title}
              </h3>
              <p className="mt-2 max-w-sm leading-relaxed
                text-[--brand-ink]/70">
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <figure className="relative overflow-hidden rounded-2xl">
        <Image
          src="/images/agents-verifying.jpg"
          alt="Agents verifying produce quantities with a vendor
            at her stall"
          width={640}
          height={480}
          className="h-full w-full object-cover"
        />
        <figcaption
          className="absolute bottom-0 w-full bg-gradient-to-t
            from-[--brand-ink]/80 to-transparent p-5 pt-12
            text-sm text-white/90"
        >
          Agents confirm quantity and quality on the ground before
          a lot goes live.
        </figcaption>
      </figure>
    </div>
  </div>
</section>
```

```css
.step-number {
  font: 700 3rem var(--font-display);
  line-height: 1;
  color: transparent;
  -webkit-text-stroke: 1.5px var(--brand-field);
  flex-shrink: 0;
  min-width: 3.5rem;
}
```

```ts
const STEPS = [
  {
    title: "Farmers list their harvest",
    body: "Through a local agent or a single SMS, farmers post what they have — crop, quantity, and location.",
  },
  {
    title: "Agents verify and bundle",
    body: "Trusted agents visit in person, confirm the goods, and combine smaller harvests into wholesale-ready lots.",
  },
  {
    title: "Buyers purchase with confidence",
    body: "Wholesale buyers browse verified, aggregated lots and deal in quantities that make the trip worthwhile.",
  },
];
```

---

### 4.6 The Agent Story — Image 2

**Image:** three women laughing under the big red umbrella.

**Layout:** this is your emotional peak, so break the grid. Slightly warm background tint (`#faf6ef`), image on the left bleeding to the viewport edge, pull-quote treatment on the right. The red umbrella justifies a single `brandClay` accent here — the only place it appears on the page.

```tsx
<section id="agents" className="bg-[#faf6ef] py-24">
  <div
    className="mx-auto grid max-w-6xl items-center gap-12 px-6
      lg:grid-cols-[1.1fr_1fr] lg:gap-20"
  >
    <figure className="relative">
      <Image
        src="/images/agents-red-umbrella.jpg"
        alt="Two Kuapa Dwaso agents laughing with a market vendor
          under a red umbrella"
        width={720}
        height={540}
        className="rounded-2xl object-cover"
      />
      {/* Offset frame accent */}
      <div
        aria-hidden
        className="absolute -bottom-4 -right-4 -z-10 h-full w-full
          rounded-2xl border-2 border-[--brand-clay]/30"
      />
    </figure>

    <div>
      <p className="eyebrow !text-[--brand-clay]">The agent network</p>
      <h2
        className="mt-4 font-display text-[length:--text-h2]
          font-700 text-[--brand-ink]"
      >
        Trust isn't built in an app. It's built at the stall.
      </h2>
      <p className="mt-6 leading-relaxed text-[--brand-ink]/70">
        Our agents live in the communities they serve. They know
        which farmer's plantain travels well and which buyer pays
        on time. Kuapa Dwaso gives that local knowledge the reach
        of a national marketplace.
      </p>
      <blockquote
        className="mt-8 border-l-2 border-[--brand-clay] pl-5"
      >
        <p className="font-display text-xl font-600 italic
          text-[--brand-ink]">
          "The sellers already know me. Now I can bring them
          buyers from anywhere."
        </p>
        <cite className="mt-2 block text-sm not-italic
          text-[--brand-ink]/60">
          — Field agent, Western Region pilot
        </cite>
      </blockquote>
      <a href="/agents" className="btn-primary mt-8">
        Become an agent
      </a>
    </div>
  </div>
</section>
```

The **offset frame** (a clay-colored outline shifted 16px down-right behind the photo) is a small editorial detail that reads "designed," not "templated."

---

### 4.7 Audience Cards — flattened

No gradient masks, no lift-and-glow. Flat cards, hairline borders, one inline SVG icon each, and a hover that only shifts the arrow. Restraint = professionalism.

```tsx
<section id="buyers" className="bg-[--brand-surface] py-24">
  <div className="mx-auto max-w-6xl px-6">
    <p className="eyebrow">Who it's for</p>
    <h2 className="mt-4 font-display text-[length:--text-h2]
      font-700 text-[--brand-ink]">
      One marketplace, three ways in.
    </h2>
    <div className="mt-12 grid gap-6 md:grid-cols-3">
      {AUDIENCES.map((a) => (
        <a key={a.title} href={a.href} className="audience-card">
          <span className="text-[--brand-field]">{a.icon}</span>
          <h3 className="mt-5 font-display text-xl font-600
            text-[--brand-ink]">
            {a.title}
          </h3>
          <p className="mt-3 flex-1 leading-relaxed
            text-[--brand-ink]/70">
            {a.body}
          </p>
          <span className="card-arrow">
            Learn more
            <svg width="16" height="16" viewBox="0 0 16 16"
              fill="none" aria-hidden>
              <path d="M2 8h11M9 3.5 13.5 8 9 12.5"
                stroke="currentColor" stroke-width="1.75"
                stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </a>
      ))}
    </div>
  </div>
</section>
```

```css
.audience-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--brand-line);
  border-radius: 1rem;
  background: #fff;
  padding: 2rem;
  transition: border-color 0.2s ease;
}
.audience-card:hover {
  border-color: var(--brand-field);
}
.card-arrow {
  margin-top: 1.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font: 600 0.9375rem var(--font-body);
  color: var(--brand-field);
}
.card-arrow svg {
  transition: transform 0.2s ease;
}
.audience-card:hover .card-arrow svg {
  transform: translateX(4px);
}
```

**The three icons** (24×24, stroke style, consistent 1.75 weight):

Grower — sprout:

```html
<svg width="28" height="28" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
  stroke-linejoin="round" aria-hidden="true">
  <path d="M12 21v-8" />
  <path d="M12 13c0-4 2.5-7 7-7 0 4-2.5 7-7 7Z" />
  <path d="M12 13c0-3-2-5.5-5.5-5.5 0 3 2 5.5 5.5 5.5Z" />
  <path d="M5 21h14" />
</svg>
```

Buyer — crate/scale:

```html
<svg width="28" height="28" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
  stroke-linejoin="round" aria-hidden="true">
  <path d="M3 9h18l-1.5 11h-15L3 9Z" />
  <path d="M8 9V6a4 4 0 0 1 8 0v3" />
</svg>
```

Partner — handshake/network:

```html
<svg width="28" height="28" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
  stroke-linejoin="round" aria-hidden="true">
  <circle cx="6" cy="6" r="2.5" />
  <circle cx="18" cy="6" r="2.5" />
  <circle cx="12" cy="18" r="2.5" />
  <path d="M7.8 7.8 10.5 16M16.2 7.8 13.5 16M8.5 6h7" />
</svg>
```

```ts
const AUDIENCES = [
  {
    title: "For Growers",
    href: "/growers",
    icon: <SproutIcon />,
    body: "Sell your harvest at fair bulk prices without leaving the farm. List by SMS or through your local agent.",
  },
  {
    title: "For Buyers",
    href: "/buyers",
    icon: <CrateIcon />,
    body: "Source verified, aggregated produce lots in one place. Skip the middlemen guesswork and buy at scale.",
  },
  {
    title: "For Partners",
    href: "/partners",
    icon: <NetworkIcon />,
    body: "NGOs, agronomy services, and lenders: plug into a real network of verified farmers and transactions.",
  },
];
```

---

### 4.8 Final CTA Band

Solid `brand-field`, one sentence, two buttons. A subtle **leaf-contour SVG pattern** at low opacity gives it texture without noise-filter cost:

```tsx
<section className="relative overflow-hidden bg-[--brand-field]
  py-20 text-center">
  <LeafPattern className="pointer-events-none absolute inset-0
    h-full w-full opacity-[0.07]" />
  <div className="relative mx-auto max-w-2xl px-6">
    <h2 className="font-display text-[length:--text-h2] font-700
      text-white">
      Join the pilot.
    </h2>
    <p className="mt-4 text-lg text-white/85">
      Whether you grow it, buy it, or move it — there's a place
      for you at the market.
    </p>
    <div className="mt-8 flex flex-wrap justify-center gap-4">
      <a href="/join"
        className="rounded-full bg-white px-7 py-3.5 font-600
          text-[--brand-field] transition-colors
          hover:bg-[--brand-surface]">
        Get started
      </a>
      <a href="/contact" className="btn-ghost">Talk to us</a>
    </div>
  </div>
</section>
```

`LeafPattern` — a tiling background of leaf outlines:

```html
<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <pattern id="leaves" width="120" height="120"
      patternUnits="userSpaceOnUse">
      <path
        d="M30 90c0-25 8-45 30-58-5 25-12 45-30 58Z"
        fill="none" stroke="#fff" stroke-width="1.5" />
      <path
        d="M85 55c0-18 6-32 21-41-3 18-8 32-21 41Z"
        fill="none" stroke="#fff" stroke-width="1.5" />
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#leaves)" />
</svg>
```

---

### 4.9 Footer

`brand-ink` background, four columns (Product / Company / Legal / SMS shortcode reminder). Include the SMS number prominently — the footer is where a farmer's relative on a smartphone looks it up for them:

```tsx
<div className="rounded-xl border border-white/10 bg-white/5 p-5">
  <p className="text-sm text-white/60">No internet? Text</p>
  <p className="mt-1 font-mono text-2xl font-700 text-[#7dd8a0]">
    JOIN → 1945
  </p>
</div>
```

---

## 5. Cross-Cutting Requirements

### Section divider (optional)

A single gentle field-contour curve between the proof bar and SMS section, so the surface→ink transition isn't a hard line:

```html
<svg viewBox="0 0 1440 80" preserveAspectRatio="none"
  class="block w-full h-12 md:h-20 bg-[--brand-surface]"
  aria-hidden="true">
  <path
    d="M0 80 C 360 20, 720 60, 1080 30 S 1440 50, 1440 50 L1440 80Z"
    fill="#0f1f14" />
</svg>
```

### Performance budget

- Images: AVIF/WebP via `next/image`, hero `priority`, everything else lazy. Hero source ≤ 250KB at 1920w.
- JS: zero client components except the one `IntersectionObserver` hook for the SMS animation. No canvas, no scroll libraries.
- Fonts: `next/font` with `display: swap`, subset to Latin, weights 400/600/700 only.

### Accessibility

- All decorative SVGs: `aria-hidden="true"`. The phone mockup keeps `role="img"` + label since it conveys content.
- Contrast: hero text sits on ≥ 0.75 opacity ink scrim (passes AA); never place text over the unscrimmed photo.
- `prefers-reduced-motion` disables the SMS bubble sequence (shown above).
- Heading order strictly `h1 → h2 → h3`; one `h1` (hero).

### Responsive behavior

| Breakpoint | Changes |
|---|---|
| `< 768px` | Hero `object-position` shifts to keep the vendor + agents in frame (`object-[65%_center]`); stats 2-col; steps stack above Image 3; agent section stacks image-first; cards 1-col |
| `768–1024px` | Cards 3-col; SMS section stacks, phone SVG max-width 320px centered |
| `> 1024px` | Full layouts as specced |

---

## 6. Build Order

1. Tokens + typography + eyebrow/button utility classes
2. Hero (biggest visual win, validates the photo treatment)
3. SMS section + phone SVG
4. How-it-works + agent story
5. Cards, CTA band, footer
6. Delete `DotField`, `.hero-image-tilt`, `.premium-card`, `.btn-magnetic` from the www bundle — verify the route's JS payload drops
