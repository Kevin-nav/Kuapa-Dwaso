import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "KuapaDwaso | Smart KuapaDwaso & Precision Farming",
  description: "Connecting growers, buyers, and partners on a modern digital platform. Discover fresh crops, precision farming telemetry, and seamless trade solutions.",
  keywords: ["agriculture", "marketplace", "precision farming", "smart agriculture", "organic crops", "drone crop telemetry", "growers", "buyers"],
  openGraph: {
    title: "KuapaDwaso | Smart KuapaDwaso & Precision Farming",
    description: "Discover the future of digital farming trade and precision agronomy on our integrated platform.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "KuapaDwaso | Smart Agriculture & Precision Trade",
    description: "Precision farming telemetry and seamless agriculture crop trading.",
  }
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased font-sans bg-brand-surface text-brand-ink">
        {children}
      </body>
    </html>
  );
}
