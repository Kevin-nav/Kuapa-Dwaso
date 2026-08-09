"use client";

import { useEffect, useState } from "react";

const navLinks = [
  ["How it works", "/#how"],
  ["Warehouse model", "/#warehouse"],
  ["Who it is for", "/#buyers"],
  ["Blog", "/blog"],
] as const;

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="22" cy="30" r="6" fill="#2d8a4e" opacity="0.5" />
      <circle cx="18" cy="60" r="6" fill="#2d8a4e" opacity="0.65" />
      <circle cx="22" cy="90" r="6" fill="#2d8a4e" opacity="0.8" />
      <circle cx="48" cy="45" r="8" fill="#2d8a4e" opacity="0.85" />
      <circle cx="48" cy="75" r="8" fill="#2d8a4e" opacity="0.9" />
      <circle cx="88" cy="60" r="22" fill="#2d8a4e" />
    </svg>
  );
}

type SiteHeaderProps = {
  joinHref: string;
  loginHref: string;
};

export function SiteHeader({ joinHref, loginHref }: SiteHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Initialize immediately in case the page is already scrolled on load
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        isScrolled
          ? "border-b border-brand-line/50 bg-brand-surface/80 backdrop-blur-md shadow-sm"
          : "border-b border-brand-line bg-brand-surface"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
        <a
          href="/"
          className="flex items-center gap-2.5"
          aria-label="Kuapa Dwaso home"
        >
          <Logo className="h-8 w-8" />
          <span className="font-display text-lg font-bold text-brand-ink">
            Kuapa Dwaso
          </span>
        </a>

        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map(([label, href]) => (
            <a key={href} href={href} className="nav-link">
              {label}
            </a>
          ))}
          <a
            href={loginHref}
            className="text-sm font-bold text-brand-ink/72 transition-colors hover:text-brand-field"
          >
            Log in
          </a>
          <a
            href={joinHref}
            className="rounded-full bg-brand-field px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-field-light"
          >
            Join the pilot
          </a>
        </div>

        <div className="flex items-center gap-4 md:hidden">
          <a href="/blog" className="text-sm font-bold text-brand-ink/72">
            Blog
          </a>
          <a
            href={loginHref}
            className="text-sm font-bold text-brand-ink/72 transition-colors hover:text-brand-field"
          >
            Log in
          </a>
          <a
            href={joinHref}
            className="rounded-full bg-brand-field px-4 py-2 text-sm font-bold text-white"
          >
            Join
          </a>
        </div>
      </nav>
    </header>
  );
}
