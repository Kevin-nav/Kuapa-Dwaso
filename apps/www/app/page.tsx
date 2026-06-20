"use client";

import { useEffect, useRef, useState } from "react";
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
  ArrowUpRight
} from "lucide-react";
import { DotField } from "@agriculture/ui";
import gsap from "gsap";
import Image from "next/image";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Animation refs
  const headerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaButtonsRef = useRef<HTMLDivElement>(null);
  const heroImageRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // GSAP Page Load Entrance Animations
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // Staggered reveal
    tl.fromTo(
      headerRef.current,
      { y: -30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 }
    );

    if (titleRef.current) {
      // Split characters or words would be nice, but a line/block slide works cleanly and robustly
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
      { scale: 0.96, y: 30, opacity: 0 },
      { scale: 1, y: 0, opacity: 1, duration: 1.0 },
      "-=0.5"
    );

    tl.fromTo(
      statsRef.current?.children || [],
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.1 },
      "-=0.6"
    );

    // Clean up
    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-brand-surface text-brand-ink selection:bg-brand-field/20 selection:text-brand-field">
      {/* Header */}
      <header 
        ref={headerRef}
        className="sticky top-0 z-50 w-full glass-navbar transition-all duration-300"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center space-x-2.5 group" id="nav-logo">
            <div className="w-10 h-10 rounded-xl bg-brand-field flex items-center justify-center text-brand-surface shadow-md group-hover:scale-105 transition-transform duration-300">
              <Sprout className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold font-display tracking-tight text-brand-ink">
              Agri<span className="text-brand-field">Market</span>
            </span>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-sm font-medium hover:text-brand-field transition-colors" id="link-features">Features</a>
            <a href="#technology" className="text-sm font-medium hover:text-brand-field transition-colors" id="link-tech">Technology</a>
            <a href="#about" className="text-sm font-medium hover:text-brand-field transition-colors" id="link-about">About Us</a>
            <a href="#partners" className="text-sm font-medium hover:text-brand-field transition-colors" id="link-partners">Partners</a>
          </nav>

          {/* Action Button */}
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
              className="bg-brand-field hover:bg-brand-field/90 text-brand-surface text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 flex items-center space-x-2"
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
              className="text-brand-ink focus:outline-none p-2 rounded-lg hover:bg-brand-field/10"
              aria-label="Toggle menu"
              id="btn-mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden glass-panel absolute top-20 left-0 w-full p-6 shadow-xl border-t border-brand-field/10 animate-fade-in-up">
            <nav className="flex flex-col space-y-4">
              <a 
                href="#features" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold hover:text-brand-field p-2 rounded-lg hover:bg-brand-field/5 transition-colors"
                id="link-features-mobile"
              >
                Features
              </a>
              <a 
                href="#technology" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold hover:text-brand-field p-2 rounded-lg hover:bg-brand-field/5 transition-colors"
                id="link-tech-mobile"
              >
                Technology
              </a>
              <a 
                href="#about" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold hover:text-brand-field p-2 rounded-lg hover:bg-brand-field/5 transition-colors"
                id="link-about-mobile"
              >
                About Us
              </a>
              <a 
                href="#partners" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold hover:text-brand-field p-2 rounded-lg hover:bg-brand-field/5 transition-colors"
                id="link-partners-mobile"
              >
                Partners
              </a>
              <hr className="border-brand-field/10 my-2" />
              <div className="flex flex-col space-y-3 pt-2">
                <a 
                  href="/login" 
                  className="w-full text-center text-base font-semibold hover:text-brand-field p-2.5 rounded-lg border border-brand-field/20 transition-colors"
                  id="btn-login-mobile"
                >
                  Sign In
                </a>
                <a 
                  href="/get-started" 
                  className="w-full text-center bg-brand-field hover:bg-brand-field/90 text-brand-surface text-base font-semibold p-2.5 rounded-lg shadow-sm transition-all"
                  id="btn-get-started-mobile"
                >
                  Get Started
                </a>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center justify-center py-20 overflow-hidden bg-gradient-to-b from-brand-surface to-brand-surface/40">
          
          {/* Interactive Dot Canvas Background */}
          <div className="absolute inset-0 z-0 pointer-events-auto">
            <DotField 
              dotRadius={2.0} 
              dotSpacing={16} 
              cursorRadius={450} 
              bulgeStrength={80} 
              glowRadius={180}
            />
          </div>

          {/* Hero Content Wrapper */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Heading and Text */}
            <div className="lg:col-span-7 flex flex-col justify-center text-left space-y-6">
              <div className="inline-flex items-center space-x-2.5 bg-brand-field/10 border border-brand-field/20 rounded-full px-4 py-1.5 w-fit">
                <Sprout className="w-4 h-4 text-brand-field" />
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-field font-display">
                  Digital Agriculture ecosystem
                </span>
              </div>

              <h1 
                ref={titleRef} 
                className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display leading-[1.08] tracking-tight text-brand-ink"
                id="hero-main-title"
              >
                Cultivating the <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-field to-brand-sky">
                  Future of Farming
                </span>
              </h1>

              <p 
                ref={subtitleRef} 
                className="text-lg text-brand-ink/80 max-w-xl leading-relaxed"
                id="hero-subtitle"
              >
                A high-fidelity digital marketplace connecting modern growers, verified buyers, and crop partners. Trade smarter with precision metrics and full transparency.
              </p>

              {/* CTA Action Buttons */}
              <div 
                ref={ctaButtonsRef} 
                className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 pt-4"
              >
                <a
                  href="/marketplace"
                  className="bg-brand-field hover:bg-brand-field/90 text-brand-surface font-semibold px-8 py-4 rounded-2xl shadow-lg shadow-brand-field/10 hover:shadow-brand-field/20 hover:-translate-y-0.5 active:translate-y-0 transition-all text-center flex items-center justify-center space-x-2.5"
                  id="btn-enter-marketplace"
                >
                  <span>Explore Marketplace</span>
                  <ArrowRight className="w-5 h-5" />
                </a>
                <a
                  href="#technology"
                  className="glass-panel hover:bg-brand-field/5 border border-brand-field/15 hover:border-brand-field/25 text-brand-ink font-semibold px-8 py-4 rounded-2xl transition-all text-center"
                  id="btn-learn-more"
                >
                  How It Works
                </a>
              </div>
            </div>

            {/* Right Column: Hero Showcase Image */}
            <div 
              ref={heroImageRef} 
              className="lg:col-span-5 relative w-full flex justify-center"
            >
              <div className="relative w-full max-w-md sm:max-w-lg aspect-square lg:aspect-auto lg:h-[480px] rounded-3xl overflow-hidden shadow-2xl border border-brand-field/10 bg-brand-surface/40 group">
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
                <div className="absolute bottom-6 left-6 right-6 glass-panel p-5 rounded-2xl border border-brand-field/10 shadow-lg flex items-center justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-11 h-11 rounded-xl bg-brand-field/15 flex items-center justify-center text-brand-field">
                      <Activity className="w-5.5 h-5.5 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold tracking-wider text-brand-field uppercase">Crop Telemetry</p>
                      <h4 className="text-sm font-bold text-brand-ink">Automated Crop Yield Scan</h4>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-brand-field bg-brand-field/10 px-2.5 py-1 rounded-full flex items-center">
                    Active
                  </span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Stats Strip */}
        <section className="bg-brand-ink text-brand-surface py-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(84,115,91,0.15),transparent_40%)]" />
          <div 
            ref={statsRef}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 text-center relative z-10"
          >
            <div className="space-y-1" id="stat-growers">
              <p className="text-3xl sm:text-4xl font-extrabold font-display text-brand-field">12K+</p>
              <p className="text-xs sm:text-sm text-brand-surface/70 font-medium tracking-wide uppercase">Registered Growers</p>
            </div>
            <div className="space-y-1" id="stat-traded">
              <p className="text-3xl sm:text-4xl font-extrabold font-display text-brand-field">450K</p>
              <p className="text-xs sm:text-sm text-brand-surface/70 font-medium tracking-wide uppercase">Tons Traded</p>
            </div>
            <div className="space-y-1" id="stat-sensors">
              <p className="text-3xl sm:text-4xl font-extrabold font-display text-brand-field">25K</p>
              <p className="text-xs sm:text-sm text-brand-surface/70 font-medium tracking-wide uppercase">IOT Field Nodes</p>
            </div>
            <div className="space-y-1" id="stat-delivery">
              <p className="text-3xl sm:text-4xl font-extrabold font-display text-brand-field">99.8%</p>
              <p className="text-xs sm:text-sm text-brand-surface/70 font-medium tracking-wide uppercase">Fulfillment Rate</p>
            </div>
          </div>
        </section>

        {/* Features / Target Audience Section */}
        <section id="features" className="py-24 bg-gradient-to-b from-brand-surface/30 to-brand-surface">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-16">
            
            {/* Section Header */}
            <div className="max-w-3xl mx-auto space-y-4">
              <h2 className="text-xs font-bold text-brand-field uppercase tracking-wider font-display">Targeted Solutions</h2>
              <p className="text-3xl sm:text-4xl font-extrabold font-display text-brand-ink tracking-tight">
                Designed for the Entire Agricultural Supply Chain
              </p>
              <p className="text-base sm:text-lg text-brand-ink/75 max-w-xl mx-auto leading-relaxed">
                Empowering growers, buyers, and partners with tailored tools that streamline trade, logistics, and data collection.
              </p>
            </div>

            {/* Features Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Card 1: Growers */}
              <div 
                className="glass-panel p-8 rounded-3xl text-left border border-brand-field/10 shadow-sm hover:shadow-xl hover:border-brand-field/25 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
                id="feature-card-growers"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-field/5 rounded-full blur-2xl group-hover:bg-brand-field/10 transition-colors" />
                <div className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-brand-field flex items-center justify-center text-brand-surface shadow-md">
                    <Sprout className="w-7 h-7" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-bold font-display text-brand-ink">For Modern Growers</h3>
                    <p className="text-sm text-brand-ink/75 leading-relaxed">
                      List your crops directly to major distributors, set fair target pricing, track field moisture, and manage logistics effortlessly.
                    </p>
                  </div>
                  <ul className="space-y-2.5 text-xs font-semibold text-brand-ink/90">
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-brand-field flex-shrink-0" />
                      <span>Direct-to-Buyer crop listings</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-brand-field flex-shrink-0" />
                      <span>IoT soil and yield telemetry</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-brand-field flex-shrink-0" />
                      <span>Automated payout contracts</span>
                    </li>
                  </ul>
                </div>
                <a href="/grower-info" className="mt-8 text-sm font-bold text-brand-field flex items-center space-x-1 hover:space-x-2 transition-all">
                  <span>Grower platform details</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              {/* Card 2: Buyers */}
              <div 
                className="glass-panel p-8 rounded-3xl text-left border border-brand-field/10 shadow-sm hover:shadow-xl hover:border-brand-field/25 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
                id="feature-card-buyers"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-sky/5 rounded-full blur-2xl group-hover:bg-brand-sky/10 transition-colors" />
                <div className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-brand-sky flex items-center justify-center text-brand-surface shadow-md">
                    <Users className="w-7 h-7" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-bold font-display text-brand-ink">For Crop Buyers</h3>
                    <p className="text-sm text-brand-ink/75 leading-relaxed">
                      Access verified grower profiles, browse high-resolution crop catalogs, review soil health, and place high-volume purchasing agreements securely.
                    </p>
                  </div>
                  <ul className="space-y-2.5 text-xs font-semibold text-brand-ink/90">
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-brand-sky flex-shrink-0" />
                      <span>Verified quality certificates</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-brand-sky flex-shrink-0" />
                      <span>Real-time logistics shipping tracking</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-brand-sky flex-shrink-0" />
                      <span>Source transparency mapping</span>
                    </li>
                  </ul>
                </div>
                <a href="/buyer-info" className="mt-8 text-sm font-bold text-brand-sky flex items-center space-x-1 hover:space-x-2 transition-all">
                  <span>Buyer sourcing details</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              {/* Card 3: Partners */}
              <div 
                className="glass-panel p-8 rounded-3xl text-left border border-brand-field/10 shadow-sm hover:shadow-xl hover:border-brand-field/25 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
                id="feature-card-partners"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-ink/5 rounded-full blur-2xl group-hover:bg-brand-ink/10 transition-colors" />
                <div className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-brand-ink flex items-center justify-center text-brand-surface shadow-md border border-brand-surface/20">
                    <TrendingUp className="w-7 h-7 text-brand-field" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-bold font-display text-brand-ink">For Agronomy Partners</h3>
                    <p className="text-sm text-brand-ink/75 leading-relaxed">
                      Deploy precision analytical services, connect smart IoT nodes to our platform, integrate drone crop data, and provide smart supply contracts.
                    </p>
                  </div>
                  <ul className="space-y-2.5 text-xs font-semibold text-brand-ink/90">
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-brand-field flex-shrink-0" />
                      <span>Developer API telemetry streaming</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-brand-field flex-shrink-0" />
                      <span>Drone scan data upload</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-brand-field flex-shrink-0" />
                      <span>Yield analytics reporting</span>
                    </li>
                  </ul>
                </div>
                <a href="/partner-info" className="mt-8 text-sm font-bold text-brand-ink flex items-center space-x-1 hover:space-x-2 transition-all">
                  <span>Agronomy partner APIs</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

            </div>

          </div>
        </section>

        {/* Technology Showcase Section */}
        <section id="technology" className="py-24 bg-brand-surface border-t border-brand-field/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            
            {/* Left Column: Visual Showcase */}
            <div className="lg:col-span-6 relative flex justify-center order-last lg:order-first">
              <div className="relative w-full max-w-lg aspect-square lg:aspect-auto lg:h-[500px] rounded-3xl overflow-hidden shadow-xl border border-brand-field/10 group">
                <Image 
                  src="/smart-farming-showcase.png" 
                  alt="Precision greenhouse hydrophonics with telemetry sensors showing plant growth indices"
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  id="img-tech-showcase"
                />
                
                {/* Visual Accent */}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-ink/65 via-transparent to-transparent" />
                
                {/* Telemetry statistics floating card */}
                <div className="absolute top-6 left-6 glass-panel px-4 py-2.5 rounded-xl border border-brand-field/15 shadow-sm text-xs font-semibold text-brand-ink flex items-center space-x-2 animate-bounce">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-field animate-ping" />
                  <span>Real-time Telemetry Active</span>
                </div>
              </div>
            </div>

            {/* Right Column: Text & Features list */}
            <div className="lg:col-span-6 space-y-8 text-left">
              <div className="space-y-4">
                <h2 className="text-xs font-bold text-brand-field uppercase tracking-wider font-display">Precision Agronomy</h2>
                <p className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-brand-ink">
                  Smarter Trade Backed by Concrete Yield Telemetry
                </p>
                <p className="text-base text-brand-ink/75 leading-relaxed">
                  We integrate data from active farm sensors, weather models, and drone mapping reports so that trade agreements are based on factual, verifiable quality.
                </p>
              </div>

              {/* Small micro features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                <div className="space-y-3 p-5 rounded-2xl glass-panel border border-brand-field/8">
                  <div className="w-10 h-10 rounded-xl bg-brand-field/10 flex items-center justify-center text-brand-field">
                    <Droplets className="w-5.5 h-5.5" />
                  </div>
                  <h4 className="text-base font-bold font-display text-brand-ink">Soil Diagnostics</h4>
                  <p className="text-xs text-brand-ink/75 leading-relaxed">
                    Soil moisture, pH balance, and temperature statistics are uploaded directly to verified buyers.
                  </p>
                </div>

                <div className="space-y-3 p-5 rounded-2xl glass-panel border border-brand-field/8">
                  <div className="w-10 h-10 rounded-xl bg-brand-sky/10 flex items-center justify-center text-brand-sky">
                    <Activity className="w-5.5 h-5.5" />
                  </div>
                  <h4 className="text-base font-bold font-display text-brand-ink">NDVI Drone Imagery</h4>
                  <p className="text-xs text-brand-ink/75 leading-relaxed">
                    Multispectral drone imaging verifies canopy thickness and highlights field yield potential before harvest.
                  </p>
                </div>

                <div className="space-y-3 p-5 rounded-2xl glass-panel border border-brand-field/8">
                  <div className="w-10 h-10 rounded-xl bg-brand-ink/10 flex items-center justify-center text-brand-ink">
                    <Database className="w-5.5 h-5.5 text-brand-field" />
                  </div>
                  <h4 className="text-base font-bold font-display text-brand-ink">Traceability Log</h4>
                  <p className="text-xs text-brand-ink/75 leading-relaxed">
                    Every shipment is linked to a permanent record tracking crop origins, soil health, and shipping timeline.
                  </p>
                </div>

                <div className="space-y-3 p-5 rounded-2xl glass-panel border border-brand-field/8">
                  <div className="w-10 h-10 rounded-xl bg-brand-field/10 flex items-center justify-center text-brand-field">
                    <Globe className="w-5.5 h-5.5" />
                  </div>
                  <h4 className="text-base font-bold font-display text-brand-ink">Decentralized Logistics</h4>
                  <p className="text-xs text-brand-ink/75 leading-relaxed">
                    Connect automatically with verified agricultural freight carriers to schedule prompt delivery.
                  </p>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* CTA Banner Section */}
        <section className="py-24 relative overflow-hidden bg-brand-surface">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-3xl overflow-hidden bg-brand-ink text-brand-surface px-8 py-16 sm:p-20 shadow-2xl border border-brand-field/20">
              
              {/* Graphic background lights */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-brand-field/15 rounded-full blur-3xl -mr-12 -mt-12" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-sky/10 rounded-full blur-3xl -ml-12 -mb-12" />

              <div className="relative z-10 max-w-3xl mx-auto text-center space-y-8">
                <div className="w-16 h-16 rounded-2xl bg-brand-field/15 flex items-center justify-center text-brand-field mx-auto">
                  <Sprout className="w-8 h-8" />
                </div>
                
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display tracking-tight text-brand-surface">
                  Ready to Cultivate Better Connections?
                </h2>
                
                <p className="text-base sm:text-lg text-brand-surface/85 max-w-xl mx-auto leading-relaxed">
                  Join AgriMarket today. Sign up as a grower, register as a commercial buyer, or integrate your agronomic telemetry node.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                  <a
                    href="/get-started"
                    className="w-full sm:w-auto bg-brand-field hover:bg-brand-field/90 text-brand-surface font-semibold px-8 py-4 rounded-xl shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 text-center"
                    id="btn-cta-signup"
                  >
                    Create Free Account
                  </a>
                  <a
                    href="/contact"
                    className="w-full sm:w-auto bg-brand-surface/10 hover:bg-brand-surface/20 text-brand-surface border border-brand-surface/25 font-semibold px-8 py-4 rounded-xl transition-all text-center"
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

      {/* Footer */}
      <footer className="bg-brand-ink text-brand-surface/80 border-t border-brand-surface/10 py-16 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8">
          
          {/* Footer Logo & Brand info */}
          <div className="md:col-span-5 space-y-4 text-left">
            <a href="#" className="flex items-center space-x-2.5 group" id="footer-logo">
              <div className="w-8 h-8 rounded-lg bg-brand-field flex items-center justify-center text-brand-surface group-hover:scale-105 transition-transform duration-300">
                <Sprout className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold font-display tracking-tight text-brand-surface">
                Agri<span className="text-brand-field">Market</span>
              </span>
            </a>
            <p className="text-xs sm:text-sm text-brand-surface/65 max-w-sm leading-relaxed">
              AgriMarket is a premium digital trading platform providing telemetry-backed security, traceability log verification, and fair marketplace exchange.
            </p>
            <p className="text-xs text-brand-surface/50">
              © {new Date().getFullYear()} AgriMarket Inc. All rights reserved.
            </p>
          </div>

          {/* Links Column 1: Platform */}
          <div className="md:col-span-2.5 text-left space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-field font-display">Platform</h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li><a href="/marketplace" className="hover:text-brand-field transition-colors" id="footer-link-market">Explore Crops</a></li>
              <li><a href="/logistics" className="hover:text-brand-field transition-colors" id="footer-link-logistics">Freight Logistics</a></li>
              <li><a href="/analytics" className="hover:text-brand-field transition-colors" id="footer-link-analytics">Soil Analytics</a></li>
              <li><a href="/pricing" className="hover:text-brand-field transition-colors" id="footer-link-pricing">Pricing Models</a></li>
            </ul>
          </div>

          {/* Links Column 2: Resources */}
          <div className="md:col-span-2.5 text-left space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-field font-display">Resources</h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li><a href="/developers" className="hover:text-brand-field transition-colors" id="footer-link-api">API Documentation</a></li>
              <li><a href="/sensors" className="hover:text-brand-field transition-colors" id="footer-link-iot">IoT Node Config</a></li>
              <li><a href="/blog" className="hover:text-brand-field transition-colors" id="footer-link-blog">Smart Farming Blog</a></li>
              <li><a href="/help" className="hover:text-brand-field transition-colors" id="footer-link-help">Support Help Center</a></li>
            </ul>
          </div>

          {/* Links Column 3: Legal */}
          <div className="md:col-span-2 text-left space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-field font-display">Legal</h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li><a href="/privacy" className="hover:text-brand-field transition-colors" id="footer-link-privacy">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-brand-field transition-colors" id="footer-link-terms">Terms of Trade</a></li>
              <li><a href="/cookies" className="hover:text-brand-field transition-colors" id="footer-link-cookies">Cookie Settings</a></li>
            </ul>
          </div>

        </div>
      </footer>
    </div>
  );
}
