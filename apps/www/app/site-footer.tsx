import { officialContactEmail, officialContactHref } from "@kuapa-dwaso/config";
import { Logo } from "./site-header";

export function SiteFooter({ appAuthHref }: { appAuthHref: string }) {
  return (
    <footer className="bg-brand-ink py-12 text-white sm:py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <a href="/" className="flex items-center gap-2.5">
              <Logo className="h-8 w-8" />
              <span className="font-display text-lg font-bold text-white">
                Kuapa Dwaso
              </span>
            </a>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Warehouse-based produce aggregation and scheduled market delivery
              for farmers, traders, partners, and transporters in Ghana.
            </p>
          </div>
          <FooterLinks
            title="Product"
            links={[
              ["How it works", "/#how"],
              ["For farmers", "/#how"],
              ["For buyers", "/#buyers"],
              ["For warehouses", "/#warehouse"],
            ]}
          />
          <FooterLinks
            title="Company"
            links={[
              ["Blog", "/blog"],
              ["About", "/#how"],
              ["Partners", "/#warehouse"],
              ["Join the pilot", appAuthHref],
            ]}
          />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#7dd8a0]">
              Contact
            </h3>
            <a
              className="mt-4 inline-block text-sm font-semibold text-white hover:text-[#7dd8a0]"
              href={officialContactHref}
            >
              {officialContactEmail}
            </a>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              For partnerships, visits, events, and general enquiries.
            </p>
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
          <li key={`${label}-${href}`}>
            <a href={href} className="transition-colors hover:text-white">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
