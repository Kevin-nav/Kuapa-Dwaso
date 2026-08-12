import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kuapa Dwaso | A Buyer Before Produce Moves",
  description:
    "Kuapa Dwaso connects buyer demand with farmers who can supply it and coordinates the journey from agreement to delivery.",
  keywords: [
    "agriculture",
    "agricultural market access",
    "Ghana",
    "smallholder farmers",
    "produce buyers",
    "produce aggregation",
    "farm produce delivery",
  ],
  openGraph: {
    title: "Kuapa Dwaso | A Buyer Before Produce Moves",
    description:
      "Connecting buyer demand with farmers who can supply it, then helping produce reach the right market.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kuapa Dwaso | A Buyer Before Produce Moves",
    description:
      "A clearer journey from buyer demand to farmer supply and delivery.",
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
    <html
      lang="en"
      className={`${jakarta.variable} ${outfit.variable} scroll-smooth`}
    >
      <body className="antialiased font-sans bg-brand-surface text-brand-ink">
        {children}
      </body>
    </html>
  );
}
