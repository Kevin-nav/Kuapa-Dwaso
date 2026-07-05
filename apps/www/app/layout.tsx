import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kuapa Dwaso | Warehouse Produce Aggregation",
  description:
    "Kuapa Dwaso helps farmers store produce at community warehouses while buyers order verified warehouse stock.",
  keywords: [
    "agriculture",
    "warehouse aggregation",
    "Ghana",
    "smallholder farmers",
    "produce storage",
    "produce buyers",
    "dispatch",
  ],
  openGraph: {
    title: "Kuapa Dwaso | Warehouse Produce Aggregation",
    description:
      "Warehouse-verified produce inventory, storage receipts, buyer orders, sales, and dispatch tracking.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kuapa Dwaso | Warehouse Produce Aggregation",
    description:
      "Farmers store locally. Buyers order from verified warehouse stock.",
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
