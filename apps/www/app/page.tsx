import Image from "next/image";
import { SiteHeader, Logo } from "./site-header";

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
    href: "#how",
    body: "Store produce locally, track storage fees, see sale status, and receive one-way SMS updates.",
  },
  {
    title: "For Buyers",
    href: "#buyers",
    body: "Source verified produce from warehouse stock by crop, grade, location, and dispatch day.",
  },
  {
    title: "For Warehouses",
    href: "#warehouse",
    body: "Run intake, receipts, storage fee tracking, reservations, sales, dispatches, and audit-ready operations.",
  },
] as const;

function getAppAuthHref() {
  const appUrl = process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://app-staging.kuapadwaso.com";

  return new URL("/signup", appUrl).toString();
}

export default function LandingPage() {
  const appAuthHref = getAppAuthHref();

  return (
    <div className="min-h-screen bg-brand-surface text-brand-ink">
      <SiteHeader joinHref={appAuthHref} />
      <main>
        <HeroSection appAuthHref={appAuthHref} />
        <ProofBar />
        <WarehouseSection />
        <HowItWorks />
        <AudienceCards />
        <FinalCta appAuthHref={appAuthHref} />
      </main>
      <SiteFooter appAuthHref={appAuthHref} />
    </div>
  );
}



function HeroSection({ appAuthHref }: { appAuthHref: string }) {
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
            <a href={appAuthHref} className="btn-primary">
              Join the pilot
            </a>
            <a href="#buyers" className="btn-ghost">
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

function FinalCta({ appAuthHref }: { appAuthHref: string }) {
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
          <a href={appAuthHref} className="btn-light">
            Join the pilot
          </a>
          <a href="#buyers" className="btn-ghost">
            Explore roles
          </a>
        </div>
      </div>
    </section>
  );
}

function SiteFooter({ appAuthHref }: { appAuthHref: string }) {
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
              ["For farmers", "#how"],
              ["For buyers", "#buyers"],
              ["For warehouses", "#warehouse"],
            ]}
          />
          <FooterLinks
            title="Company"
            links={[
              ["About", "#how"],
              ["Partners", "#warehouse"],
              ["Contact", appAuthHref],
              ["Join the pilot", appAuthHref],
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



function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h11M9 3.5 13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
