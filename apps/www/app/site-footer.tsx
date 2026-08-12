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
              Connecting buyer demand with farmers who can supply it, then
              helping produce reach the right market.
            </p>
          </div>
          <FooterLinks
            title="Product"
            links={[
              ["How it works", "/#how"],
              ["For farmers", "/#market"],
              ["For buyers", "/#market"],
              ["For partners", "/#people"],
            ]}
          />
          <FooterLinks
            title="Company"
            links={[
              ["Stories and insights", "/blog"],
              ["About", "/#market"],
              ["Contact", officialContactHref],
              ["Join the pilot", appAuthHref],
            ]}
          />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#7dd8a0]">
              Farmer updates
            </h3>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-white/60">
                Farmers receive simple SMS updates for important transaction
                events and payments.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-sm text-white/45">
          <a
            className="mb-3 inline-block font-semibold text-white/70 hover:text-white"
            href={officialContactHref}
          >
            {officialContactEmail}
          </a>
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
