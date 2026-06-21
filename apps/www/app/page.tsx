"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Sprout,
  TrendingUp,
  Droplets,
  Activity,
  ArrowRight,
  Globe,
  Users,
  Menu,
  X,
  CheckCircle,
  Database,
  ArrowUpRight,
  Leaf,
  BarChart3,
  Truck,
  Shield,
} from "lucide-react";
import { DotField } from "@agriculture/ui";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";

gsap.registerPlugin(ScrollTrigger);

/* ─── Animated Counter Hook ─── */
function useAnimatedCounter(target: string, triggerRef: React.RefObject<HTMLElement | null>) {
  const counterRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!counterRef.current || !triggerRef.current) return;

    // Parse the target into numeric and suffix parts
    const numericMatch = target.match(/^([\d.]+)(.*)$/);
    if (!numericMatch) return;

    const endValue = parseFloat(numericMatch[1]);
    const suffix = numericMatch[2] || "";
    const hasDecimal = numericMatch[1].includes(".");

    const obj = { value: 0 };

    const tween = gsap.to(obj, {
      value: endValue,
      duration: 2,
      ease: "power2.out",
      scrollTrigger: {
        trigger: triggerRef.current,
        start: "top 85%",
        once: true,
      },
      onUpdate: () => {
        if (counterRef.current) {
          counterRef.current.textContent = hasDecimal
            ? obj.value.toFixed(1) + suffix
            : Math.round(obj.value).toLocaleString() + suffix;
        }
      },
    });

    return () => {
      tween.kill();
    };
  }, [target, triggerRef]);

  return counterRef;
}

/* ─── Stat Item Component ─── */
function StatItem({
  target,
  label,
  triggerRef,
  id,
}: {
  target: string;
  label: string;
  triggerRef: React.RefObject<HTMLElement | null>;
  id: string;
}) {
  const counterRef = useAnimatedCounter(target, triggerRef);
  return (
    <div className="space-y-1.5 group" id={id}>
      <p className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display text-brand-field stat-counter">
        <span ref={counterRef}>0</span>
      </p>
      <p className="text-xs sm:text-sm text-brand-surface/70 font-medium tracking-wide uppercase group-hover:text-brand-surface/90 transition-colors">
        {label}
      </p>
    </div>
  );
}

/* ─── Feature Card Data ─── */
const featureCards = [
  {
    id: "feature-card-growers",
    icon: Sprout,
    iconBg: "bg-brand-field",
    iconColor: "text-brand-surface",
    checkColor: "text-brand-field",
    title: "For Modern Growers",
    description:
      "List your crops directly to major distributors, set fair target pricing, track field moisture, and manage logistics effortlessly.",
    features: [
      "Direct-to-Buyer crop listings",
      "IoT soil and yield telemetry",
      "Automated payout contracts",
    ],
    linkText: "Grower platform details",
    linkHref: "/grower-info",
    linkColor: "text-brand-field",
    glowColor: "bg-brand-field/5 group-hover:bg-brand-field/10",
  },
  {
    id: "feature-card-buyers",
    icon: Users,
    iconBg: "bg-brand-sky",
    iconColor: "text-brand-surface",
    checkColor: "text-brand-sky",
    title: "For Crop Buyers",
    description:
      "Access verified grower profiles, browse high-resolution crop catalogs, review soil health, and place high-volume purchasing agreements securely.",
    features: [
      "Verified quality certificates",
      "Real-time logistics shipping tracking",
      "Source transparency mapping",
    ],
    linkText: "Buyer sourcing details",
    linkHref: "/buyer-info",
    linkColor: "text-brand-sky",
    glowColor: "bg-brand-sky/5 group-hover:bg-brand-sky/10",
  },
  {
    id: "feature-card-partners",
    icon: TrendingUp,
    iconBg: "bg-brand-ink",
    iconColor: "text-brand-field",
    checkColor: "text-brand-field",
    title: "For Agronomy Partners",
    description:
      "Deploy precision analytical services, connect smart IoT nodes to our platform, integrate drone crop data, and provide smart supply contracts.",
    features: [
      "Developer API telemetry streaming",
      "Drone scan data upload",
      "Yield analytics reporting",
    ],
    linkText: "Agronomy partner APIs",
    linkHref: "/partner-info",
    linkColor: "text-brand-ink",
    glowColor: "bg-brand-ink/5 group-hover:bg-brand-ink/10",
  },
];

/* ─── Tech Feature Data ─── */
const techFeatures = [
  {
    icon: Droplets,
    iconBg: "bg-brand-field/10",
    iconColor: "text-brand-field",
    title: "Soil Diagnostics",
    description:
      "Soil moisture, pH balance, and temperature statistics are uploaded directly to verified buyers.",
  },
  {
    icon: Activity,
    iconBg: "bg-brand-sky/10",
    iconColor: "text-brand-sky",
    title: "NDVI Drone Imagery",
    description:
      "Multispectral drone imaging verifies canopy thickness and highlights field yield potential before harvest.",
  },
  {
    icon: Database,
    iconBg: "bg-brand-ink/10",
    iconColor: "text-brand-field",
    title: "Traceability Log",
    description:
      "Every shipment is linked to a permanent record tracking crop origins, soil health, and shipping timeline.",
  },
  {
    icon: Globe,
    iconBg: "bg-brand-field/10",
    iconColor: "text-brand-field",
    title: "Decentralized Logistics",
    description:
      "Connect automatically with verified agricultural freight carriers to schedule prompt delivery.",
  },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFeatureIdx, setActiveFeatureIdx] = useState(0);

  // Animation refs
  const headerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaButtonsRef = useRef<HTMLDivElement>(null);
  const heroImageRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const featureCardsRef = useRef<HTMLDivElement>(null);
  const techRef = useRef<HTMLElement>(null);
  const techImageRef = useRef<HTMLDivElement>(null);
  const techTextRef = useRef<HTMLDivElement>(null);
  const ctaBannerRef = useRef<HTMLElement>(null);
  const featureScrollRef = useRef<HTMLDivElement>(null);

  // Handle mobile menu body scroll lock
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Mobile feature carousel scroll tracking
  const handleFeatureScroll = useCallback(() => {
    const el = featureScrollRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const cardWidth = el.firstElementChild
      ? (el.firstElementChild as HTMLElement).offsetWidth
      : 1;
    const idx = Math.round(scrollLeft / cardWidth);
    setActiveFeatureIdx(Math.min(idx, featureCards.length - 1));
  }, []);

  useEffect(() => {
    /* ─── Hero Entrance ─── */
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.fromTo(
      headerRef.current,
      { y: -30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 }
    );

    if (titleRef.current) {
      tl.fromTo(
        titleRef.current,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8 },
        "-=0.4"
      );
    }

    tl.fromTo(
      subtitleRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6 },
      "-=0.5"
    );

    tl.fromTo(
      ctaButtonsRef.current,
      { y: 15, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6 },
      "-=0.4"
    );

    tl.fromTo(
      heroImageRef.current,
      { scale: 0.92, y: 30, opacity: 0, rotateY: -5 },
      { scale: 1, y: 0, opacity: 1, rotateY: 0, duration: 1.0 },
      "-=0.5"
    );

    /* ─── ScrollTrigger: Features Section ─── */
    if (featuresRef.current) {
      // Section header
      const sectionHeader = featuresRef.current.querySelector(".section-header");
      if (sectionHeader) {
        gsap.fromTo(
          sectionHeader,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: sectionHeader,
              start: "top 85%",
              once: true,
            },
          }
        );
      }

      // Feature cards (desktop stagger)
      const cards = featuresRef.current.querySelectorAll(".feature-card-item");
      if (cards.length) {
        gsap.fromTo(
          cards,
          { y: 60, opacity: 0, scale: 0.95 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.7,
            stagger: 0.15,
            ease: "power3.out",
            scrollTrigger: {
              trigger: featureCardsRef.current,
              start: "top 85%",
              once: true,
            },
          }
        );
      }
    }

    /* ─── ScrollTrigger: Technology Section ─── */
    if (techImageRef.current) {
      gsap.fromTo(
        techImageRef.current,
        { x: -60, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: techRef.current,
            start: "top 75%",
            once: true,
          },
        }
      );
    }

    if (techTextRef.current) {
      gsap.fromTo(
        techTextRef.current,
        { x: 60, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: techRef.current,
            start: "top 75%",
            once: true,
          },
        }
      );

      // Stagger tech cards
      const techCards = techTextRef.current.querySelectorAll(".tech-card");
      if (techCards.length) {
        gsap.fromTo(
          techCards,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: techTextRef.current,
              start: "top 80%",
              once: true,
            },
          }
        );
      }
    }

    /* ─── ScrollTrigger: CTA Banner ─── */
    if (ctaBannerRef.current) {
      gsap.fromTo(
        ctaBannerRef.current.querySelector(".cta-inner"),
        { scale: 0.92, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ctaBannerRef.current,
            start: "top 80%",
            once: true,
          },
        }
      );
    }

    return () => {
      tl.kill();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-brand-surface text-brand-ink selection:bg-brand-field/20 selection:text-brand-field">
      {/* ═══ HEADER ═══ */}
      <header
        ref={headerRef}
        className="sticky top-0 z-50 w-full glass-navbar transition-all duration-300"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo */}
          <a
            href="#"
            className="flex items-center space-x-2.5 group"
            id="nav-logo"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-field flex items-center justify-center text-brand-surface shadow-md group-hover:scale-105 group-hover:shadow-lg transition-all duration-300">
              <Sprout className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-lg sm:text-xl font-bold font-display tracking-tight text-brand-ink">
              Agri<span className="text-brand-field">Market</span>
            </span>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8">
            {["Features", "Technology", "About Us", "Partners"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s/g, "-")}`}
                className="text-sm font-medium link-underline hover:text-brand-field transition-colors"
                id={`link-${item.toLowerCase().replace(/\s/g, "-")}`}
              >
                {item}
              </a>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <a
              href="/login"
              className="text-sm font-semibold hover:text-brand-field transition-colors px-4 py-2"
              id="btn-login-desktop"
            >
              Sign In
            </a>
            <a
              href="/get-started"
              className="btn-magnetic bg-brand-field hover:bg-brand-field-light text-brand-surface text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center space-x-2"
              id="btn-get-started-desktop"
            >
              <span>Get Started</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-brand-ink focus:outline-none p-2 rounded-lg hover:bg-brand-field/10 transition-colors"
              aria-label="Toggle menu"
              id="btn-mobile-menu-toggle"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ═══ MOBILE NAV OVERLAY ═══ */}
      {mobileMenuOpen && (
        <>
          <div
            className="mobile-nav-backdrop md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="md:hidden mobile-nav-drawer fixed top-16 left-0 right-0 z-50 glass-panel p-6 shadow-2xl border-t border-brand-field/10">
            <nav className="flex flex-col space-y-3">
              {["Features", "Technology", "About Us", "Partners"].map(
                (item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase().replace(/\s/g, "-")}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-base font-semibold hover:text-brand-field p-3 rounded-xl hover:bg-brand-field/5 transition-colors"
                    id={`link-${item.toLowerCase().replace(/\s/g, "-")}-mobile`}
                  >
                    {item}
                  </a>
                )
              )}
              <hr className="border-brand-field/10 my-1" />
              <div className="flex flex-col space-y-3 pt-1">
                <a
                  href="/login"
                  className="w-full text-center text-base font-semibold hover:text-brand-field p-3 rounded-xl border border-brand-field/20 transition-colors"
                  id="btn-login-mobile"
                >
                  Sign In
                </a>
                <a
                  href="/get-started"
                  className="w-full text-center bg-brand-field hover:bg-brand-field-light text-brand-surface text-base font-semibold p-3 rounded-xl shadow-sm transition-all"
                  id="btn-get-started-mobile"
                >
                  Get Started
                </a>
              </div>
            </nav>
          </div>
        </>
      )}

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-grow">
        {/* ─── HERO SECTION ─── */}
        <section className="relative min-h-[85vh] lg:min-h-[90vh] flex items-center justify-center py-16 sm:py-20 overflow-hidden bg-brand-surface">
          {/* Interactive Dot Canvas Background */}
          <div className="absolute inset-0 z-0 pointer-events-auto">
            <DotField
              dotRadius={2.5}
              dotSpacing={18}
              cursorRadius={500}
              bulgeStrength={90}
              glowRadius={200}
            />
          </div>

          {/* Dark gradient overlay for dot contrast */}
          <div className="hero-gradient-overlay absolute inset-0 z-[1]" />

          {/* Grain texture for depth */}
          <div className="grain-overlay z-[1]" />

          {/* Hero Content Wrapper */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* LEFT: Image (shown first on mobile for visual hook) */}
            <div
              ref={heroImageRef}
              className="lg:col-span-5 relative w-full flex justify-center order-first lg:order-last"
            >
              <div className="hero-image-tilt relative w-full max-w-sm sm:max-w-md lg:max-w-lg aspect-[4/3] lg:aspect-auto lg:h-[480px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-brand-field/10 bg-brand-surface/40 group">
                <Image
                  src="/hero-agriculture.png"
                  alt="Modern smart agriculture field at sunrise with precision drone scanning crops"
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  id="img-hero-showcase"
                />

                {/* Tech overlay card inside hero image */}
                <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 glass-panel p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-brand-field/10 shadow-lg flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-brand-field/15 flex items-center justify-center text-brand-field">
                      <Activity className="w-5 h-5 animate-pulse-gentle" />
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-[11px] font-bold tracking-wider text-brand-field uppercase">
                        Crop Telemetry
                      </p>
                      <h4 className="text-xs sm:text-sm font-bold text-brand-ink">
                        Automated Crop Yield Scan
                      </h4>
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-xs font-semibold text-brand-field bg-brand-field/10 px-2 sm:px-2.5 py-1 rounded-full flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-field animate-pulse" />
                    <span>Active</span>
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT: Heading and Text */}
            <div className="lg:col-span-7 flex flex-col justify-center text-left space-y-5 sm:space-y-6 order-last lg:order-first">
              <div className="hero-badge inline-flex items-center space-x-2.5 rounded-full px-4 py-1.5 w-fit">
                <Sprout className="w-4 h-4 text-brand-field" />
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-field font-display">
                  Digital Agriculture Ecosystem
                </span>
              </div>

              <h1
                ref={titleRef}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold font-display leading-[1.08] tracking-tight text-brand-ink"
                id="hero-main-title"
              >
                Cultivating the <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-field via-brand-field-light to-brand-sky inline-block">
                  Future of Farming
                </span>
              </h1>

              <p
                ref={subtitleRef}
                className="text-base sm:text-lg text-brand-ink/80 max-w-xl leading-relaxed"
                id="hero-subtitle"
              >
                A high-fidelity digital marketplace connecting modern growers,
                verified buyers, and crop partners. Trade smarter with precision
                metrics and full transparency.
              </p>

              {/* CTA Action Buttons */}
              <div
                ref={ctaButtonsRef}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2"
              >
                <a
                  href="/marketplace"
                  className="btn-magnetic bg-brand-field hover:bg-brand-field-light text-brand-surface font-semibold px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl text-center flex items-center justify-center space-x-2.5"
                  id="btn-enter-marketplace"
                >
                  <span>Explore Marketplace</span>
                  <ArrowRight className="w-5 h-5" />
                </a>
                <a
                  href="#technology"
                  className="btn-magnetic glass-panel hover:bg-brand-field/5 border border-brand-field/15 hover:border-brand-field/25 text-brand-ink font-semibold px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl text-center"
                  id="btn-learn-more"
                >
                  How It Works
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ─── STATS STRIP ─── */}
        <section
          ref={statsRef}
          className="bg-brand-ink text-brand-surface py-10 sm:py-14 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(84,115,91,0.15),transparent_40%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(47,111,125,0.1),transparent_40%)]" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 md:gap-4 text-center relative z-10">
            <StatItem
              target="12K+"
              label="Registered Growers"
              triggerRef={statsRef}
              id="stat-growers"
            />
            <StatItem
              target="450K"
              label="Tons Traded"
              triggerRef={statsRef}
              id="stat-traded"
            />
            <StatItem
              target="25K"
              label="IoT Field Nodes"
              triggerRef={statsRef}
              id="stat-sensors"
            />
            <StatItem
              target="99.8%"
              label="Fulfillment Rate"
              triggerRef={statsRef}
              id="stat-delivery"
            />
          </div>
        </section>

        {/* ─── FEATURES / TARGET AUDIENCE ─── */}
        <section
          id="features"
          ref={featuresRef}
          className="py-16 sm:py-24 bg-gradient-to-b from-brand-surface/30 to-brand-surface"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-16">
            {/* Section Header */}
            <div className="section-header max-w-3xl mx-auto text-center space-y-4">
              <h2 className="text-xs font-bold text-brand-field uppercase tracking-wider font-display">
                Targeted Solutions
              </h2>
              <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold font-display text-brand-ink tracking-tight">
                Designed for the Entire Agricultural Supply Chain
              </p>
              <p className="text-sm sm:text-base md:text-lg text-brand-ink/75 max-w-xl mx-auto leading-relaxed">
                Empowering growers, buyers, and partners with tailored tools
                that streamline trade, logistics, and data collection.
              </p>
            </div>

            {/* Feature Cards — Desktop Grid / Mobile Horizontal Scroll */}
            <div
              ref={featureCardsRef}
              className="hidden md:grid md:grid-cols-3 gap-8"
            >
              {featureCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.id}
                    className="feature-card-item premium-card p-7 sm:p-8 rounded-3xl text-left flex flex-col justify-between group"
                    id={card.id}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl transition-colors ${card.glowColor}" />
                    <div className="space-y-6 relative z-10">
                      <div
                        className={`card-icon w-14 h-14 rounded-2xl ${card.iconBg} flex items-center justify-center ${card.iconColor} shadow-md`}
                      >
                        <Icon className="w-7 h-7" />
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-xl font-bold font-display text-brand-ink">
                          {card.title}
                        </h3>
                        <p className="text-sm text-brand-ink/75 leading-relaxed">
                          {card.description}
                        </p>
                      </div>
                      <ul className="space-y-2.5 text-xs font-semibold text-brand-ink/90">
                        {card.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-center space-x-2"
                          >
                            <CheckCircle
                              className={`w-4 h-4 ${card.checkColor} flex-shrink-0`}
                            />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <a
                      href={card.linkHref}
                      className={`mt-8 text-sm font-bold ${card.linkColor} flex items-center space-x-1 hover:space-x-2 transition-all`}
                    >
                      <span>{card.linkText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                );
              })}
            </div>

            {/* Mobile Feature Carousel */}
            <div className="md:hidden">
              <div
                ref={featureScrollRef}
                className="feature-carousel flex gap-4 overflow-x-auto px-1 pb-4 -mx-1"
                onScroll={handleFeatureScroll}
              >
                {featureCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.id}
                      className="feature-card-item premium-card p-6 rounded-2xl text-left flex flex-col justify-between group w-[85vw] max-w-[340px]"
                      id={`${card.id}-mobile`}
                    >
                      <div className="space-y-5 relative z-10">
                        <div
                          className={`card-icon w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center ${card.iconColor} shadow-md`}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold font-display text-brand-ink">
                            {card.title}
                          </h3>
                          <p className="text-sm text-brand-ink/75 leading-relaxed">
                            {card.description}
                          </p>
                        </div>
                        <ul className="space-y-2 text-xs font-semibold text-brand-ink/90">
                          {card.features.map((feature) => (
                            <li
                              key={feature}
                              className="flex items-center space-x-2"
                            >
                              <CheckCircle
                                className={`w-4 h-4 ${card.checkColor} flex-shrink-0`}
                              />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <a
                        href={card.linkHref}
                        className={`mt-6 text-sm font-bold ${card.linkColor} flex items-center space-x-1`}
                      >
                        <span>{card.linkText}</span>
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    </div>
                  );
                })}
              </div>

              {/* Scroll Indicators */}
              <div className="flex items-center justify-center gap-2 pt-3">
                {featureCards.map((_, idx) => (
                  <div
                    key={idx}
                    className={`scroll-indicator ${
                      activeFeatureIdx === idx ? "active" : ""
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── TECHNOLOGY SHOWCASE ─── */}
        <section
          id="technology"
          ref={techRef}
          className="py-16 sm:py-24 bg-brand-surface border-t border-brand-field/10"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-16 items-center">
            {/* Left Column: Visual Showcase */}
            <div
              ref={techImageRef}
              className="lg:col-span-6 relative flex justify-center order-last lg:order-first"
            >
              <div className="relative w-full max-w-lg aspect-[4/3] lg:aspect-auto lg:h-[500px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border border-brand-field/10 group">
                <Image
                  src="/smart-farming-showcase.png"
                  alt="Precision greenhouse hydroponics with telemetry sensors showing plant growth indices"
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  id="img-tech-showcase"
                />

                {/* Visual Accent */}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-ink/65 via-transparent to-transparent" />

                {/* Telemetry statistics floating card */}
                <div className="absolute top-4 sm:top-6 left-4 sm:left-6 glass-panel px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-brand-field/15 shadow-sm text-xs font-semibold text-brand-ink flex items-center space-x-2 animate-float">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-field animate-pulse" />
                  <span>Real-time Telemetry Active</span>
                </div>
              </div>
            </div>

            {/* Right Column: Text & Features list */}
            <div ref={techTextRef} className="lg:col-span-6 space-y-6 sm:space-y-8 text-left">
              <div className="space-y-3 sm:space-y-4">
                <h2 className="text-xs font-bold text-brand-field uppercase tracking-wider font-display">
                  Precision Agronomy
                </h2>
                <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold font-display tracking-tight text-brand-ink">
                  Smarter Trade Backed by Concrete Yield Telemetry
                </p>
                <p className="text-sm sm:text-base text-brand-ink/75 leading-relaxed">
                  We integrate data from active farm sensors, weather models,
                  and drone mapping reports so that trade agreements are based on
                  factual, verifiable quality.
                </p>
              </div>

              {/* Small micro features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {techFeatures.map((feat) => {
                  const Icon = feat.icon;
                  return (
                    <div
                      key={feat.title}
                      className="tech-card space-y-3 p-4 sm:p-5 rounded-2xl glass-panel border border-brand-field/8"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl ${feat.iconBg} flex items-center justify-center ${feat.iconColor}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm sm:text-base font-bold font-display text-brand-ink">
                        {feat.title}
                      </h4>
                      <p className="text-xs text-brand-ink/75 leading-relaxed">
                        {feat.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ─── CTA BANNER ─── */}
        <section
          ref={ctaBannerRef}
          className="py-16 sm:py-24 relative overflow-hidden bg-brand-surface"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="cta-inner relative rounded-2xl sm:rounded-3xl overflow-hidden bg-brand-ink text-brand-surface px-6 py-12 sm:p-16 md:p-20 shadow-2xl border border-brand-field/20">
              {/* Animated gradient mesh */}
              <div className="absolute inset-0 cta-gradient-mesh" />

              {/* Decorative corner elements */}
              <div className="absolute top-0 right-0 w-72 sm:w-96 h-72 sm:h-96 bg-brand-field/10 rounded-full blur-3xl -mr-12 -mt-12" />
              <div className="absolute bottom-0 left-0 w-72 sm:w-96 h-72 sm:h-96 bg-brand-sky/8 rounded-full blur-3xl -ml-12 -mb-12" />

              {/* Grain texture */}
              <div className="grain-overlay opacity-[0.02]" />

              <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-brand-field/15 flex items-center justify-center text-brand-field mx-auto animate-pulse-gentle">
                  <Sprout className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>

                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold font-display tracking-tight text-brand-surface">
                  Ready to Cultivate Better Connections?
                </h2>

                <p className="text-sm sm:text-base md:text-lg text-brand-surface/85 max-w-xl mx-auto leading-relaxed">
                  Join AgriMarket today. Sign up as a grower, register as a
                  commercial buyer, or integrate your agronomic telemetry node.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                  <a
                    href="/get-started"
                    className="btn-magnetic w-full sm:w-auto bg-brand-field hover:bg-brand-field-light text-brand-surface font-semibold px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-center"
                    id="btn-cta-signup"
                  >
                    Create Free Account
                  </a>
                  <a
                    href="/contact"
                    className="btn-magnetic w-full sm:w-auto bg-brand-surface/10 hover:bg-brand-surface/20 text-brand-surface border border-brand-surface/25 font-semibold px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-center"
                    id="btn-cta-contact"
                  >
                    Schedule Platform Demo
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-brand-ink text-brand-surface/80 border-t border-brand-surface/10 py-12 sm:py-16 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Footer top row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-8 md:gap-8">
            {/* Footer Logo & Brand info */}
            <div className="md:col-span-5 space-y-4 text-left">
              <a
                href="#"
                className="flex items-center space-x-2.5 group"
                id="footer-logo"
              >
                <div className="w-8 h-8 rounded-lg bg-brand-field flex items-center justify-center text-brand-surface group-hover:scale-105 transition-transform duration-300">
                  <Sprout className="w-5 h-5" />
                </div>
                <span className="text-lg font-bold font-display tracking-tight text-brand-surface">
                  Agri<span className="text-brand-field">Market</span>
                </span>
              </a>
              <p className="text-xs sm:text-sm text-brand-surface/65 max-w-sm leading-relaxed">
                AgriMarket is a premium digital trading platform providing
                telemetry-backed security, traceability log verification, and
                fair marketplace exchange.
              </p>
            </div>

            {/* Links Column 1: Platform */}
            <div className="md:col-span-2 text-left space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-field font-display">
                Platform
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <a
                    href="/marketplace"
                    className="link-underline hover:text-brand-field transition-colors"
                    id="footer-link-market"
                  >
                    Explore Crops
                  </a>
                </li>
                <li>
                  <a
                    href="/logistics"
                    className="link-underline hover:text-brand-field transition-colors"
                    id="footer-link-logistics"
                  >
                    Freight Logistics
                  </a>
                </li>
                <li>
                  <a
                    href="/analytics"
                    className="link-underline hover:text-brand-field transition-colors"
                    id="footer-link-analytics"
                  >
                    Soil Analytics
                  </a>
                </li>
                <li>
                  <a
                    href="/pricing"
                    className="link-underline hover:text-brand-field transition-colors"
                    id="footer-link-pricing"
                  >
                    Pricing Models
                  </a>
                </li>
              </ul>
            </div>

            {/* Links Column 2: Resources */}
            <div className="md:col-span-3 text-left space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-field font-display">
                Resources
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <a
                    href="/developers"
                    className="link-underline hover:text-brand-field transition-colors"
                    id="footer-link-api"
                  >
                    API Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="/sensors"
                    className="link-underline hover:text-brand-field transition-colors"
                    id="footer-link-iot"
                  >
                    IoT Node Config
                  </a>
                </li>
                <li>
                  <a
                    href="/blog"
                    className="link-underline hover:text-brand-field transition-colors"
                    id="footer-link-blog"
                  >
                    Smart Farming Blog
                  </a>
                </li>
                <li>
                  <a
                    href="/help"
                    className="link-underline hover:text-brand-field transition-colors"
                    id="footer-link-help"
                  >
                    Support Help Center
                  </a>
                </li>
              </ul>
            </div>

            {/* Links Column 3: Legal */}
            <div className="md:col-span-2 text-left space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-field font-display">
                Legal
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <a
                    href="/privacy"
                    className="link-underline hover:text-brand-field transition-colors"
                    id="footer-link-privacy"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="/terms"
                    className="link-underline hover:text-brand-field transition-colors"
                    id="footer-link-terms"
                  >
                    Terms of Trade
                  </a>
                </li>
                <li>
                  <a
                    href="/cookies"
                    className="link-underline hover:text-brand-field transition-colors"
                    id="footer-link-cookies"
                  >
                    Cookie Settings
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer divider */}
          <div className="footer-divider" />

          {/* Footer bottom */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-brand-surface/50">
            <p>© {new Date().getFullYear()} AgriMarket Inc. All rights reserved.</p>
            <div className="flex items-center space-x-4">
              <span>Built with precision agriculture technology</span>
              <Leaf className="w-3.5 h-3.5 text-brand-field" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
