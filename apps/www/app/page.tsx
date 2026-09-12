import { officialContactHref } from "@kuapa-dwaso/config";
import Image from "next/image";
import { Suspense } from "react";
import heroImage from "../public/image1.webp";
import fieldImage from "../public/image3.webp";
import type { PublicBlogPost } from "./blog/data";
import { getLatestPosts } from "./blog/data";
import { StoryCard } from "./blog/story-card";
import { SiteFooter } from "./site-footer";
import { Logo, SiteHeader } from "./site-header";

const promises = [
  ["Demand comes first", "We begin with a real buyer requirement"],
  ["Terms stay clear", "You see the important terms before you decide"],
  [
    "Quality gets checked",
    "Produce is checked against what the buyer asked for",
  ],
  [
    "Delivery is coordinated",
    "We bring supply together for a practical journey",
  ],
] as const;

const steps = [
  {
    title: "A buyer tells us what they need",
    body: "We capture the crop, quantity, quality, location, date, and payment expectations.",
  },
  {
    title: "We find farmers who can supply it",
    body: "We check available produce and bring together enough supply for the request.",
  },
  {
    title: "Everyone sees the terms",
    body: "Farmers review the offer and decide whether it works for them before produce moves.",
  },
  {
    title: "We check and coordinate",
    body: "Quality is checked, quantities are brought together, and transport is arranged.",
  },
  {
    title: "The order is delivered",
    body: "Delivery, buyer acceptance, payment, and farmer settlement are recorded clearly.",
  },
] as const;

function getAppOrigin() {
  const appUrl =
    process.env.PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://app.kuapadwaso.com";

  return appUrl;
}

function onboardingIntentHref(appOrigin: string, intent: "request_maize_supply" | "sell_maize") {
  const url = new URL("/signup", appOrigin);
  url.searchParams.set("intent", intent);
  return url.toString();
}

function getAppLoginHref() {
  const appUrl =
    process.env.PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://app.kuapadwaso.com";

  return new URL("/", appUrl).toString();
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const appOrigin = getAppOrigin();
  const appAuthHref = new URL("/signup", appOrigin).toString();
  const farmerHref = onboardingIntentHref(appOrigin, "sell_maize");
  const buyerHref = onboardingIntentHref(appOrigin, "request_maize_supply");
  const appLoginHref = getAppLoginHref();
  const params = await searchParams;
  const inviteToken =
    typeof params.token === "string" ? params.token : undefined;

  return (
    <div className="min-h-screen bg-brand-surface text-brand-ink">
      <SiteHeader joinHref={appAuthHref} loginHref={appLoginHref} />
      <main>
        <HeroSection farmerHref={farmerHref} buyerHref={buyerHref} />
        <PilotNote />
        <PromiseBar />
        <MarketSection buyerHref={buyerHref} />
        <HowItWorks />
        <AudienceSection farmerHref={farmerHref} buyerHref={buyerHref} />
        <WarehouseProgression />
        <BrandSection />
        <Suspense fallback={<FieldStoriesFallback />}>
          <LatestStories />
        </Suspense>
        {inviteToken === undefined ? null : (
          <InvitedAccess loginHref={appLoginHref} inviteToken={inviteToken} />
        )}
        <FinalCta farmerHref={farmerHref} buyerHref={buyerHref} />
      </main>
      <SiteFooter appAuthHref={appAuthHref} />
    </div>
  );
}

function HeroSection({ farmerHref, buyerHref }: { farmerHref: string; buyerHref: string }) {
  return (
    <section className="relative flex min-h-[82vh] items-end overflow-hidden sm:min-h-[85vh]">
      <Image
        src={heroImage}
        alt="Produce sellers and buyers at a market in Ghana"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[66%_center] sm:object-[70%_center]"
      />
      <div className="hero-scrim absolute inset-0" />
      <div className="relative mx-auto w-full max-w-6xl px-5 pb-14 pt-28 sm:px-6 sm:pb-20 sm:pt-40">
        <div className="max-w-3xl">
          <p className="eyebrow text-brand-gold">
            Farmer&apos;s Market · Ghana
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-[length:var(--text-hero)] font-bold leading-[1.02] text-white">
            We find the buyer
            <br />
            <span className="text-[#8ae0a8]">before the produce moves.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
            Our first software pilot is for commercial maize buyers and farmers
            with maize to sell. We record the terms, quality checks, collection,
            delivery and settlement without requiring a Kuapa Dwaso warehouse.
          </p>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:gap-4">
            <a href={buyerHref} className="btn-primary">
              Request maize supply
            </a>
            <a href={farmerHref} className="btn-ghost">
              I have maize to sell
            </a>
            <a href="#how" className="hero-text-link">
              See how it works
              <ArrowIcon />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function PilotNote() {
  return (
    <aside className="border-b border-brand-line bg-brand-gold/15">
      <p className="mx-auto max-w-6xl px-5 py-3 text-center text-sm font-semibold leading-relaxed text-brand-ink sm:px-6">
        Pilot software is ready for controlled demonstrations. Live commercial
        operations, partner commitments and payment outcomes must be confirmed
        transaction by transaction.
      </p>
    </aside>
  );
}

function PromiseBar() {
  return (
    <section
      aria-label="What you can expect"
      className="border-b border-brand-line bg-brand-surface"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-5 gap-y-8 px-5 py-10 sm:px-6 md:grid-cols-4 md:py-12">
        {promises.map(([title, body], index) => (
          <div key={title} className="promise-item">
            <span aria-hidden="true">0{index + 1}</span>
            <p className="mt-3 font-display text-lg font-bold text-brand-ink">
              {title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-brand-ink/60">
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MarketSection({ buyerHref }: { buyerHref: string }) {
  return (
    <section id="market" className="bg-brand-ink py-20 text-white sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <p className="eyebrow text-[#8ae0a8]">A clearer way to trade</p>
          <h2 className="mt-4 max-w-xl font-display text-[length:var(--text-h2)] font-bold leading-tight">
            Less uncertainty for both sides of the market.
          </h2>
          <div className="mt-9 grid gap-8 sm:grid-cols-2">
            <div>
              <p className="market-label">For farmers</p>
              <h3 className="mt-3 font-display text-2xl font-semibold">
                Know the opportunity before you move your produce.
              </h3>
              <p className="mt-3 leading-relaxed text-white/68">
                See what a buyer needs and understand the important terms before
                you decide.
              </p>
            </div>
            <div>
              <p className="market-label">For buyers</p>
              <h3 className="mt-3 font-display text-2xl font-semibold">
                Reach farmers who can meet a real requirement.
              </h3>
              <p className="mt-3 leading-relaxed text-white/68">
                Share what you need and receive produce checked against the
                quality you agreed to.
              </p>
            </div>
          </div>
          <a
            href={buyerHref}
            className="mt-9 inline-flex items-center gap-2 font-bold text-[#8ae0a8]"
          >
            Request maize supply
            <ArrowIcon />
          </a>
        </div>
        <figure className="market-figure relative overflow-hidden">
          <Image
            src={fieldImage}
            alt="People checking produce together at a market"
            width={1440}
            height={960}
            sizes="(max-width: 1024px) 100vw, 45vw"
            placeholder="blur"
            className="aspect-[4/3] h-full w-full object-cover object-[52%_center]"
          />
          <figcaption>
            Good trade begins with a shared understanding.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="bg-brand-surface py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-4 font-display text-[length:var(--text-h2)] font-bold leading-tight text-brand-ink">
              From a real need to a completed delivery.
            </h2>
          </div>
          <p className="max-w-xl self-end text-base leading-relaxed text-brand-ink/65 sm:text-lg">
            Kuapa Dwaso stays involved through the journey so farmers and buyers
            are not left to coordinate everything alone.
          </p>
        </div>

        <ol className="process-grid mt-12 lg:mt-16">
          {steps.map((step, index) => (
            <li key={step.title} className="process-step">
              <span className="process-number">0{index + 1}</span>
              <h3 className="mt-6 font-display text-[length:var(--text-h3)] font-semibold text-brand-ink">
                {step.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-brand-ink/68">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function AudienceSection({ farmerHref, buyerHref }: { farmerHref: string; buyerHref: string }) {
  return (
    <section
      id="people"
      className="border-y border-brand-line bg-[#edf1e7] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <p className="eyebrow">Built around real people</p>
        <h2 className="mt-4 max-w-2xl font-display text-[length:var(--text-h2)] font-bold leading-tight text-brand-ink">
          Tell us what you grow, what you need, or how you can help.
        </h2>
        <div className="mt-10 grid gap-5 md:mt-12 md:grid-cols-3 md:gap-6">
          <AudienceCard
            number="01"
            title="Farmers"
            body="Declare maize that is available, then review the exact quantity, price, quality conditions, purchaser and payment responsibility before accepting an offer."
            linkLabel="I have maize to sell"
            href={farmerHref}
          />
          <AudienceCard
            number="02"
            title="Buyers"
            body="Commercial buyers can request a maize type, quantity, quality specification, destination and delivery window before any produce is collected."
            linkLabel="Request maize supply"
            href={buyerHref}
          />
          <AudienceCard
            number="03"
            title="Partners"
            body="Work with us across farmer access, agriculture, quality, transport, and market connections."
            linkLabel="Talk with our team"
            href={officialContactHref}
          />
        </div>
      </div>
    </section>
  );
}

function WarehouseProgression() {
  return (
    <section className="bg-brand-ink py-20 text-white sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
        <div><p className="eyebrow text-[#8ae0a8]">What comes later</p><h2 className="mt-4 font-display text-[length:var(--text-h2)] font-bold leading-tight">Warehouses follow evidence. They do not come first.</h2></div>
        <div className="grid gap-5 text-white/72 sm:grid-cols-3">
          <div><strong className="text-white">1 · Prove transactions</strong><p className="mt-2 leading-relaxed">Repeat buyer demand, accepted quality, reliable delivery, payment behaviour and actual costs are recorded first.</p></div>
          <div><strong className="text-white">2 · Use storage when justified</strong><p className="mt-2 leading-relaxed">Existing partner facilities may be assessed for a specific transaction when storage adds real value.</p></div>
          <div><strong className="text-white">3 · Invest conditionally</strong><p className="mt-2 leading-relaxed">A future Kuapa Dwaso warehouse depends on proven volume, utilisation, location and sustainable economics. None is currently implied.</p></div>
        </div>
      </div>
    </section>
  );
}

function AudienceCard({
  number,
  title,
  body,
  linkLabel,
  href,
}: {
  number: string;
  title: string;
  body: string;
  linkLabel: string;
  href: string;
}) {
  return (
    <a href={href} className="audience-card">
      <span className="audience-number">{number}</span>
      <h3 className="mt-8 font-display text-2xl font-semibold text-brand-ink">
        {title}
      </h3>
      <p className="mt-3 flex-1 text-base leading-relaxed text-brand-ink/68">
        {body}
      </p>
      <span className="card-arrow">
        {linkLabel}
        <ArrowIcon />
      </span>
    </a>
  );
}

function BrandSection() {
  return (
    <section className="overflow-hidden bg-brand-surface py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:px-6 md:grid-cols-[auto_1fr] md:items-center md:gap-12">
        <Logo className="h-28 w-28 text-brand-field sm:h-32 sm:w-32" />
        <div>
          <p className="eyebrow">Our name</p>
          <p className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-snug text-brand-ink sm:text-4xl">
            Kuapa Dwaso means <em>Farmer&apos;s Market</em> in Akan. It is the
            idea at the heart of what we are building.
          </p>
        </div>
      </div>
    </section>
  );
}

async function LatestStories() {
  const posts = await Promise.race([
    getLatestPosts(3),
    new Promise<PublicBlogPost[]>((resolve) => {
      setTimeout(() => resolve([]), 3000);
    }),
  ]);

  if (posts.length === 0) {
    return <FieldStoriesFallback />;
  }

  return (
    <section className="bg-[#f4f2e9] py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="flex items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Learning from the field</p>
            <h2 className="mt-4 font-display text-[length:var(--text-h2)] font-bold leading-tight">
              Stories and insights
            </h2>
          </div>
          <a
            className="hidden font-bold text-brand-field sm:block"
            href="/blog"
          >
            Explore our stories
          </a>
        </div>
        <div className="blog-related__grid landing-stories mt-10">
          {posts.map((post) => (
            <StoryCard key={post._id} post={post} />
          ))}
        </div>
        <a
          className="mt-7 inline-block font-bold text-brand-field sm:hidden"
          href="/blog"
        >
          Explore our stories
        </a>
      </div>
    </section>
  );
}

function FieldStoriesFallback() {
  return (
    <section className="bg-[#f4f2e9] py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:px-6 md:grid-cols-[1fr_auto] md:items-end md:gap-16">
        <div>
          <p className="eyebrow">Learning from the field</p>
          <h2 className="mt-4 max-w-2xl font-display text-[length:var(--text-h2)] font-bold leading-tight">
            We listen before we build.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-brand-ink/65 sm:text-lg">
            Our direction is shaped by conversations with farmers, buyers, and
            agricultural partners. Read what we are learning as the pilot takes
            shape.
          </p>
        </div>
        <a className="field-stories-link" href="/blog">
          Explore our stories
          <ArrowIcon />
        </a>
      </div>
    </section>
  );
}

function InvitedAccess({
  loginHref,
  inviteToken,
}: {
  loginHref: string;
  inviteToken: string;
}) {
  const inviteHref = new URL(
    `/invites/accept?token=${encodeURIComponent(inviteToken)}`,
    loginHref,
  ).toString();

  return (
    <aside className="bg-brand-surface px-5 py-5 text-center text-sm text-brand-ink/65 sm:px-6">
      Have a staff invitation?{" "}
      <a className="font-bold text-brand-field" href={inviteHref}>
        Continue to your invitation
      </a>
    </aside>
  );
}

function FinalCta({ farmerHref, buyerHref }: { farmerHref: string; buyerHref: string }) {
  return (
    <section className="relative overflow-hidden bg-brand-field py-16 text-center sm:py-20">
      <div className="final-cta-pattern absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl px-5 sm:px-6">
        <p className="eyebrow justify-center text-brand-gold">Take part</p>
        <h2 className="mt-4 font-display text-[length:var(--text-h2)] font-bold leading-tight text-white">
          Tell us what you grow or what you need to buy.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/82 sm:text-lg">
          Join the pilot and help shape a more dependable way for produce to
          reach the right market.
        </p>
        <div className="mt-8 grid gap-3 sm:flex sm:justify-center sm:gap-4">
          <a href={buyerHref} className="btn-light">
            Request maize supply
          </a>
          <a href={farmerHref} className="btn-ghost">
            I have maize to sell
          </a>
        </div>
      </div>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 8h11M9 3.5 13.5 8 9 12.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
