import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kuapa Dwaso | Verified Produce Marketplace",
  description:
    "Kuapa Dwaso links smallholder farmers to wholesale buyers through trusted local agents and simple SMS access.",
  keywords: [
    "agriculture",
    "marketplace",
    "Ghana",
    "smallholder farmers",
    "SMS trading",
    "produce buyers",
    "plantain",
  ],
  openGraph: {
    title: "Kuapa Dwaso | Verified Produce Marketplace",
    description:
      "Agent-verified produce lots and SMS access for farmers, buyers, and partners.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kuapa Dwaso | Verified Produce Marketplace",
    description:
      "Trusted local agents connect farmers to bulk buyers, with SMS access for any phone.",
  },
};

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display-brand",
  display: "swap",
});

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`${jakarta.variable} ${outfit.variable} scroll-smooth`}>
      <body className="antialiased font-sans bg-brand-surface text-brand-ink">
        {children}
      </body>
    </html>
  );
}
