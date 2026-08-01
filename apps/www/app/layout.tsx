import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kuapa Dwaso | Scheduled Market Delivery",
  description:
    "Traders order verified warehouse stock before published cutoffs for scheduled delivery to selected market destinations.",
  keywords: [
    "agriculture",
    "warehouse aggregation",
    "Ghana",
    "smallholder farmers",
    "produce storage",
    "produce buyers",
    "dispatch",
    "scheduled market delivery",
  ],
  openGraph: {
    title: "Kuapa Dwaso | Scheduled Market Delivery",
    description:
      "Published order cutoffs and scheduled delivery of confirmed trader orders to selected market destinations.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kuapa Dwaso | Warehouse Produce Aggregation",
    description:
      "Farmers store locally. Traders order for published market delivery days.",
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
