import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRuntime } from "@kuapa-dwaso/ui/pwa";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { AuthProvider } from "./auth/AuthProvider";
import { AppOutboxReplayer } from "./pwa/AppOutboxReplayer";
import "./globals.css";

export const metadata: Metadata = {
  title: "KuapaDwaso App",
  description: "Farmer, buyer, and transporter access to the Kuapa Dwaso warehouse network.",
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
          <AuthProvider><AppOutboxReplayer />{children}</AuthProvider>
        </ConvexClientProvider>
        <PwaRuntime enabled={process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_PWA_DEV === "true"} />
      </body>
    </html>
  );
}
