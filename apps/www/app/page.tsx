import Image from "next/image";

const proofPoints = [
  ["Warehouse-verified", "Produce is received, weighed, graded, and recorded"],
  ["Storage receipts", "Farmers get clear records for every inventory batch"],
  ["Buyer orders", "Buyers order from real warehouse stock"],
  ["Dispatch ready", "Warehouse-to-market movement is tracked"],
] as const;

const steps = [
  {
    title: "Farmers deposit produce",
    body: "Farmers bring produce to a nearby community warehouse instead of carrying goods blindly to the city.",
  },
  {
    title: "Warehouse agents record inventory",
    body: "Warehouse agents weigh, grade, photograph, and create inventory batches with storage receipts.",
  },
  {
    title: "Buyers order verified stock",
    body: "Buyers purchase from available warehouse inventory, and dispatches move produce to the buyer or destination market.",
  },
] as const;

const audiences = [
  {
    title: "For Farmers",
    href: "/farmers",
    body: "Store produce locally, track storage fees, see sale status, and receive one-way SMS updates.",
  },
  {
    title: "For Buyers",
    href: "/buyers",
    body: "Source verified produce from warehouse stock by crop, grade, location, and dispatch day.",
  },
  {
    title: "For Warehouses",
    href: "/warehouses",
    body: "Run intake, receipts, storage fee tracking, reservations, sales, dispatches, and audit-ready operations.",
  },
] as const;

const navLinks = [
  ["How it works", "#how"],
  ["Warehouse model", "#warehouse"],
  ["Buyers", "#buyers"],
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-surface text-brand-ink">
      <SiteHeader />
      <main>
        <HeroSection />
        <ProofBar />
        <WarehouseSection />
        <HowItWorks />
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
          <span className="font-display text-lg font-bold text-brand-ink">Kuapa Dwaso</span>
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

        <a href="/join" className="rounded-full bg-brand-field px-4 py-2 text-sm font-bold text-white md:hidden">
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
        alt="Produce vendors and operators at a Ghana market"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[66%_center] sm:object-[70%_center]"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, rgba(15, 31, 20, 0.94) 0%, rgba(15, 31, 20, 0.82) 34%, rgba(15, 31, 20, 0.18) 64%, rgba(15, 31, 20, 0.42) 100%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-6xl px-5 pb-14 pt-28 sm:px-6 sm:pb-20 sm:pt-40">
        <div className="max-w-xl">
          <p className="eyebrow text-brand-gold">Warehouse-based produce aggregation</p>
          <h1 className="mt-4 font-display text-[length:var(--text-hero)] font-bold leading-[1.05] text-white">
            Store locally.
            <br />
            <span className="text-[#7dd8a0]">Sell from verified stock.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-white/85 sm:text-lg">
            Kuapa Dwaso helps farmers deposit produce at community warehouses,
            gives buyers access to verified inventory, and tracks storage fees,
            sales, and dispatches in one system.
          </p>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:gap-4">
            <a href="/farmers" className="btn-primary">
              Store produce
            </a>
            <a href="/buyers" className="btn-ghost">
              Source inventory
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

function WarehouseSection() {
  return (
    <section id="warehouse" className="bg-brand-ink py-20 text-white sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="eyebrow text-[#7dd8a0]">The warehouse is the trust point</p>
          <h2 className="mt-4 font-display text-[length:var(--text-h2)] font-bold leading-tight">
            Every batch has a place, an owner, a status, and a fee record.
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-white/70 sm:text-lg">
            The platform tracks who owns the produce, where it is stored, how
            much is available, what has been reserved or sold, and which fees
            were applied at the time.
          </p>
        </div>
        <figure className="relative overflow-hidden rounded-2xl bg-white/5">
          <Image
            src="/image3.png"
            alt="Produce being checked and recorded at market"
            width={1440}
            height={960}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="aspect-[4/3] h-full w-full object-cover object-[52%_center]"
          />
        </figure>
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
          From warehouse intake to sale and dispatch.
        </h2>

        <ol className="mt-12 grid gap-8 lg:mt-16 lg:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-5 sm:gap-6">
              <span className="step-number">{index + 1}</span>
              <div>
                <h3 className="font-display text-[length:var(--text-h3)] font-semibold text-brand-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-brand-ink/70">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
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
          One warehouse network, clear roles.
        </h2>
        <div className="mt-10 grid gap-5 md:mt-12 md:grid-cols-3 md:gap-6">
          {audiences.map((audience) => (
            <a key={audience.title} href={audience.href} className="audience-card">
              <h3 className="font-display text-xl font-semibold text-brand-ink">{audience.title}</h3>
              <p className="mt-3 flex-1 text-base leading-relaxed text-brand-ink/70">{audience.body}</p>
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
      <div className="relative mx-auto max-w-2xl px-5 sm:px-6">
        <h2 className="font-display text-[length:var(--text-h2)] font-bold leading-tight text-white">
          Build the warehouse flow.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-white/85 sm:text-lg">
          The MVP proves one simple loop: deposit produce, create a receipt,
          reserve stock, sell it, dispatch it, and show the farmer a clear net
          update.
        </p>
        <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:justify-center sm:gap-4">
          <a href="/join" className="btn-light">
            Join the pilot
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
              <span className="font-display text-lg font-bold text-white">Kuapa Dwaso</span>
            </a>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Warehouse-based produce storage, inventory, sales, and dispatch
              for farmers and buyers in Ghana.
            </p>
          </div>

          <FooterLinks
            title="Product"
            links={[
              ["How it works", "#how"],
              ["For farmers", "/farmers"],
              ["For buyers", "/buyers"],
              ["For warehouses", "/warehouses"],
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
              Farmer updates
            </h3>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-white/60">
                Farmers receive one-way SMS updates for receipts, fees, sales,
                dispatches, and payments.
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
      <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#7dd8a0]">{title}</h3>
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

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#2d8a4e" />
      <path d="M16 26c0-8 2-14 9-18-1 8-3 14-9 18Z" fill="#f5f7f0" opacity="0.95" />
      <path d="M15 26c0-7-2-12-8-15 1 7 3 12 8 15Z" fill="#f5f7f0" opacity="0.6" />
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
