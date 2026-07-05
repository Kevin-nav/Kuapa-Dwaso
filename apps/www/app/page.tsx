import Image from "next/image";
import type { ReactNode } from "react";

const proofPoints = [
  ["Agent-verified", "Every listing checked in person"],
  ["Any phone", "Full access via SMS. No data needed"],
  ["Bulk-first", "Aggregated lots sized for wholesale"],
  ["Pilot live", "Operating in the Western Region"],
] as const;

const steps = [
  {
    title: "Farmers list their harvest",
    body: "Through a local agent or a single SMS, farmers post what they have: crop, quantity, and location.",
  },
  {
    title: "Agents verify and bundle",
    body: "Trusted agents visit in person, confirm the goods, and combine smaller harvests into wholesale-ready lots.",
  },
  {
    title: "Buyers purchase with confidence",
    body: "Wholesale buyers browse verified, aggregated lots and deal in quantities that make the trip worthwhile.",
  },
] as const;

const audiences = [
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
    body: "Source verified, aggregated produce lots in one place. Skip the middleman guesswork and buy at scale.",
  },
  {
    title: "For Partners",
    href: "/partners",
    icon: <NetworkIcon />,
    body: "NGOs, agronomy services, and lenders can plug into a real network of verified farmers and transactions.",
  },
] as const;

const navLinks = [
  ["How it works", "#how"],
  ["Agents", "#agents"],
  ["Buyers", "#buyers"],
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-surface text-brand-ink">
      <SiteHeader />
      <main>
        <HeroSection />
        <ProofBar />
        <SectionCurve />
        <SmsSection />
        <HowItWorks />
        <AgentStory />
        <AudienceCards />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-brand-line bg-brand-surface">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
        <a href="/" className="flex items-center gap-2.5" aria-label="Kuapa Dwaso home">
          <Logo className="h-8 w-8" />
          <span className="font-display text-lg font-bold text-brand-ink">
            Kuapa Dwaso
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map(([label, href]) => (
            <a key={href} href={href} className="nav-link">
              {label}
            </a>
          ))}
          <a
            href="/join"
            className="rounded-full bg-brand-field px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-field-light"
          >
            Join the pilot
          </a>
        </div>

        <a
          href="/join"
          className="rounded-full bg-brand-field px-4 py-2 text-sm font-bold text-white md:hidden"
        >
          Join
        </a>
      </nav>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative flex min-h-[82vh] items-end overflow-hidden sm:min-h-[85vh]">
      <Image
        src="/image1.png"
        alt="Kuapa Dwaso agents speaking with a plantain vendor at a market in Ghana"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[66%_center] sm:object-[70%_center]"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, rgba(15, 31, 20, 0.94) 0%, rgba(15, 31, 20, 0.8) 34%, rgba(15, 31, 20, 0.18) 64%, rgba(15, 31, 20, 0.38) 100%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-6xl px-5 pb-14 pt-28 sm:px-6 sm:pb-20 sm:pt-40">
        <div className="max-w-xl">
          <p className="eyebrow text-brand-gold">Now piloting in Western Region, Ghana</p>
          <h1 className="mt-4 font-display text-[length:var(--text-hero)] font-bold leading-[1.05] text-white">
            The market is already here.
            <br />
            <span className="text-[#7dd8a0]">We connect it.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-white/85 sm:text-lg">
            Kuapa Dwaso links smallholder farmers to wholesale buyers through
            trusted local agents and a simple SMS line that works on any phone.
          </p>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:gap-4">
            <a href="/agents" className="btn-primary">
              Become an agent
            </a>
            <a href="/buyers" className="btn-ghost">
              Buy in bulk
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofBar() {
  return (
    <section className="border-b border-brand-line bg-brand-surface">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-5 gap-y-8 px-5 py-9 sm:px-6 sm:py-10 md:grid-cols-4">
        {proofPoints.map(([title, sub]) => (
          <div key={title}>
            <p className="font-display text-lg font-bold text-brand-ink">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-brand-ink/60">{sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionCurve() {
  return (
    <svg
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className="block h-12 w-full bg-brand-surface md:h-20"
      aria-hidden="true"
    >
      <path
        d="M0 80 C 360 20, 720 60, 1080 30 S 1440 50, 1440 50 L1440 80Z"
        fill="#0f1f14"
      />
    </svg>
  );
}

function SmsSection() {
  return (
    <section className="bg-brand-ink pb-20 pt-10 text-white sm:pb-24 sm:pt-16">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="eyebrow text-[#7dd8a0]">No smartphone required</p>
          <h2 className="mt-4 font-display text-[length:var(--text-h2)] font-bold leading-tight">
            If your phone can text,
            <br />
            you can trade.
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-white/70 sm:text-lg">
            Farmers register, check offers, and approve sales with simple SMS
            commands. No app, no data bundle, no fuss.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {["JOIN", "STATUS", "YES / NO", "HELP"].map((command) => (
              <code
                key={command}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 font-mono text-sm text-[#7dd8a0]"
              >
                {command}
              </code>
            ))}
          </div>
        </div>
        <PhoneMockup />
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="bg-brand-surface py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-4 max-w-xl font-display text-[length:var(--text-h2)] font-bold leading-tight text-brand-ink">
          From farm gate to wholesale, in three steps.
        </h2>

        <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-2 lg:gap-20">
          <ol className="space-y-10 sm:space-y-12">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-5 sm:gap-6">
                <span className="step-number">{index + 1}</span>
                <div>
                  <h3 className="font-display text-[length:var(--text-h3)] font-semibold text-brand-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-md text-base leading-relaxed text-brand-ink/70">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <figure className="relative overflow-hidden rounded-2xl bg-brand-line">
            <Image
              src="/image3.png"
              alt="Agents verifying produce quantities with a vendor at her stall"
              width={1440}
              height={960}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="aspect-[4/3] h-full w-full object-cover object-[52%_center]"
            />
            <figcaption className="absolute bottom-0 w-full bg-gradient-to-t from-brand-ink/85 to-transparent p-5 pt-12 text-sm leading-relaxed text-white/90">
              Agents confirm quantity and quality on the ground before a lot
              goes live.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

function AgentStory() {
  return (
    <section id="agents" className="overflow-hidden bg-[#faf6ef] py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <figure className="relative isolate">
          <Image
            src="/image2.png"
            alt="Two Kuapa Dwaso agents laughing with a market vendor under a red umbrella"
            width={1440}
            height={960}
            sizes="(max-width: 1024px) 100vw, 52vw"
            className="relative z-10 aspect-[4/3] w-full rounded-2xl object-cover object-[50%_center]"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-3 -right-3 z-0 h-full w-full rounded-2xl border-2 border-brand-clay/30 sm:-bottom-4 sm:-right-4"
          />
        </figure>

        <div>
          <p className="eyebrow text-brand-clay">The agent network</p>
          <h2 className="mt-4 font-display text-[length:var(--text-h2)] font-bold leading-tight text-brand-ink">
            Trust is not built in an app. It is built at the stall.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-brand-ink/70 sm:text-lg">
            Our agents live in the communities they serve. They know which
            farmer&apos;s plantain travels well and which buyer pays on time. Kuapa
            Dwaso gives that local knowledge the reach of a national marketplace.
          </p>
          <blockquote className="mt-8 border-l-2 border-brand-clay pl-5">
            <p className="font-display text-xl font-semibold italic text-brand-ink">
              &quot;The sellers already know me. Now I can bring them buyers from
              anywhere.&quot;
            </p>
            <cite className="mt-2 block text-sm not-italic text-brand-ink/60">
              Field agent, Western Region pilot
            </cite>
          </blockquote>
          <a href="/agents" className="btn-primary mt-8">
            Become an agent
          </a>
        </div>
      </div>
    </section>
  );
}

function AudienceCards() {
  return (
    <section id="buyers" className="bg-brand-surface py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <p className="eyebrow">Who it is for</p>
        <h2 className="mt-4 font-display text-[length:var(--text-h2)] font-bold leading-tight text-brand-ink">
          One marketplace, three ways in.
        </h2>
        <div className="mt-10 grid gap-5 md:mt-12 md:grid-cols-3 md:gap-6">
          {audiences.map((audience) => (
            <a key={audience.title} href={audience.href} className="audience-card">
              <span className="text-brand-field">{audience.icon}</span>
              <h3 className="mt-5 font-display text-xl font-semibold text-brand-ink">
                {audience.title}
              </h3>
              <p className="mt-3 flex-1 text-base leading-relaxed text-brand-ink/70">
                {audience.body}
              </p>
              <span className="card-arrow">
                Learn more
                <ArrowIcon />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-brand-field py-16 text-center sm:py-20">
      <LeafPattern className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]" />
      <div className="relative mx-auto max-w-2xl px-5 sm:px-6">
        <h2 className="font-display text-[length:var(--text-h2)] font-bold leading-tight text-white">
          Join the pilot.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-white/85 sm:text-lg">
          Whether you grow it, buy it, or move it, there is a place for you at
          the market.
        </p>
        <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:justify-center sm:gap-4">
          <a href="/join" className="btn-light">
            Get started
          </a>
          <a href="/contact" className="btn-ghost">
            Talk to us
          </a>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-brand-ink py-12 text-white sm:py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <a href="/" className="flex items-center gap-2.5">
              <Logo className="h-8 w-8" />
              <span className="font-display text-lg font-bold text-white">
                Kuapa Dwaso
              </span>
            </a>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Agent-verified produce lots for farmers, wholesale buyers, and
              partners across Ghana.
            </p>
          </div>

          <FooterLinks
            title="Product"
            links={[
              ["How it works", "#how"],
              ["For growers", "/growers"],
              ["For buyers", "/buyers"],
              ["For agents", "/agents"],
            ]}
          />
          <FooterLinks
            title="Company"
            links={[
              ["About", "/about"],
              ["Partners", "/partners"],
              ["Contact", "/contact"],
              ["Join the pilot", "/join"],
            ]}
          />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#7dd8a0]">
              SMS access
            </h3>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-white/60">No internet? Text</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#7dd8a0]">
                JOIN to 1945
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-sm text-white/45">
          <p>Copyright 2026 Kuapa Dwaso. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({
  title,
  links,
}: {
  title: string;
  links: readonly (readonly [string, string])[];
}) {
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#7dd8a0]">
        {title}
      </h3>
      <ul className="mt-4 space-y-3 text-sm text-white/65">
        {links.map(([label, href]) => (
          <li key={href}>
            <a href={href} className="transition-colors hover:text-white">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="mx-auto w-full max-w-[270px] sm:max-w-[320px] lg:max-w-[360px]">
      <svg
        viewBox="0 0 260 480"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="SMS conversation with Kuapa Dwaso on a keypad phone"
        className="phone-shadow h-auto w-full"
      >
        <rect
          x="10"
          y="10"
          width="240"
          height="460"
          rx="28"
          fill="#1a2e20"
          stroke="#3a5a45"
          strokeWidth="2"
        />
        <rect x="105" y="26" width="50" height="6" rx="3" fill="#3a5a45" />
        <rect x="28" y="44" width="204" height="240" rx="8" fill="#c8e6c9" />
        <path d="M36 44h188a8 8 0 0 1 8 8v18H28V52a8 8 0 0 1 8-8Z" fill="#2d8a4e" />
        <text x="130" y="61" textAnchor="middle" fontFamily="monospace" fontSize="11" fill="#fff">
          Kuapa Dwaso - 1945
        </text>

        <MessageGroup>
          <rect x="120" y="80" width="100" height="24" rx="6" fill="#2d8a4e" />
          <text x="170" y="96" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#fff">
            JOIN
          </text>
        </MessageGroup>
        <MessageGroup>
          <rect x="40" y="112" width="160" height="52" rx="6" fill="#fff" />
          <text x="48" y="128" fontFamily="monospace" fontSize="9" fill="#0f1f14">
            Akwaaba! You are now
          </text>
          <text x="48" y="141" fontFamily="monospace" fontSize="9" fill="#0f1f14">
            registered. Reply STATUS
          </text>
          <text x="48" y="154" fontFamily="monospace" fontSize="9" fill="#0f1f14">
            to see your listings.
          </text>
        </MessageGroup>
        <MessageGroup>
          <rect x="120" y="172" width="100" height="24" rx="6" fill="#2d8a4e" />
          <text x="170" y="188" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#fff">
            STATUS
          </text>
        </MessageGroup>
        <MessageGroup>
          <rect x="40" y="204" width="170" height="66" rx="6" fill="#fff" />
          <text x="48" y="220" fontFamily="monospace" fontSize="9" fill="#0f1f14">
            Plantain: 40 bunches
          </text>
          <text x="48" y="233" fontFamily="monospace" fontSize="9" fill="#0f1f14">
            Offer: GHS 22/bunch
          </text>
          <text x="48" y="246" fontFamily="monospace" fontSize="9" fill="#0f1f14">
            Buyer: Takoradi Foods
          </text>
          <text x="48" y="259" fontFamily="monospace" fontSize="9" fill="#2d8a4e" fontWeight="bold">
            Reply YES to accept
          </text>
        </MessageGroup>

        <circle cx="130" cy="322" r="24" fill="none" stroke="#3a5a45" strokeWidth="2" />
        <circle cx="130" cy="322" r="10" fill="#3a5a45" />
        <g fill="#233a2b" stroke="#3a5a45" strokeWidth="1">
          {[
            [42, 358],
            [104, 358],
            [166, 358],
            [42, 384],
            [104, 384],
            [166, 384],
            [42, 410],
            [104, 410],
            [166, 410],
            [42, 436],
            [104, 436],
            [166, 436],
          ].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="52" height="20" rx="6" />
          ))}
        </g>
        <g fontFamily="monospace" fontSize="10" fill="#7dd8a0" textAnchor="middle">
          {[
            ["1", 68, 372],
            ["2", 130, 372],
            ["3", 192, 372],
            ["4", 68, 398],
            ["5", 130, 398],
            ["6", 192, 398],
            ["7", 68, 424],
            ["8", 130, 424],
            ["9", 192, 424],
            ["*", 68, 450],
            ["0", 130, 450],
            ["#", 192, 450],
          ].map(([label, x, y]) => (
            <text key={label} x={x} y={y}>
              {label}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}

function MessageGroup({ children }: { children: ReactNode }) {
  return <g>{children}</g>;
}

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#2d8a4e" />
      <path d="M16 26c0-8 2-14 9-18-1 8-3 14-9 18Z" fill="#f5f7f0" opacity="0.95" />
      <path d="M15 26c0-7-2-12-8-15 1 7 3 12 8 15Z" fill="#f5f7f0" opacity="0.6" />
    </svg>
  );
}

function SproutIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21v-8" />
      <path d="M12 13c0-4 2.5-7 7-7 0 4-2.5 7-7 7Z" />
      <path d="M12 13c0-3-2-5.5-5.5-5.5 0 3 2 5.5 5.5 5.5Z" />
      <path d="M5 21h14" />
    </svg>
  );
}

function CrateIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9h18l-1.5 11h-15L3 9Z" />
      <path d="M8 9V6a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function NetworkIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M7.8 7.8 10.5 16M16.2 7.8 13.5 16M8.5 6h7" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h11M9 3.5 13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LeafPattern({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <defs>
        <pattern id="leaves" width="120" height="120" patternUnits="userSpaceOnUse">
          <path d="M30 90c0-25 8-45 30-58-5 25-12 45-30 58Z" fill="none" stroke="#fff" strokeWidth="1.5" />
          <path d="M85 55c0-18 6-32 21-41-3 18-8 32-21 41Z" fill="none" stroke="#fff" strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#leaves)" />
    </svg>
  );
}
