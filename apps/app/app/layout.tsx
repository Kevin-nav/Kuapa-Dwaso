import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRuntime } from "@kuapa-dwaso/ui/pwa";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { AuthProvider } from "./auth/AuthProvider";
import { AppOutboxReplayer } from "./pwa/AppOutboxReplayer";
import { PilotDemoIndicator } from "./pilot/PilotDemoIndicator";
import "./globals.css";

export const metadata: Metadata = {
  title: "KuapaDwaso App",
  description: "Maize supply, orders, collections, and payments with Kuapa Dwaso.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Kuapa Dwaso", statusBarStyle: "default" },
  icons: { apple: "/pwa/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#173d2b", width: "device-width", initialScale: 1, viewportFit: "cover" };

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>
          <AuthProvider><AppOutboxReplayer />{process.env.NEXT_PUBLIC_DEMO_PRESENTATION === "true" ? <PilotDemoIndicator /> : null}{children}</AuthProvider>
        </ConvexClientProvider>
        <PwaRuntime enabled={process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_PWA_DEV === "true"} />
      </body>
    </html>
  );
}
