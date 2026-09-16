import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRuntime } from "@kuapa-dwaso/ui/pwa";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { OpsAuthProvider } from "./auth/OpsAuthProvider";
import { PilotOperationsProvider } from "./context/PilotOperationsContext";
import { WarehouseProvider } from "./context/WarehouseContext";
import LayoutShell from "./LayoutShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "KuapaDwaso Ops",
  description: "Demand-led maize programme and warehouse operations console.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "KD Warehouse", statusBarStyle: "default" },
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
          <OpsAuthProvider>
            <PilotOperationsProvider>
              <WarehouseProvider>
                <LayoutShell>{children}</LayoutShell>
              </WarehouseProvider>
            </PilotOperationsProvider>
          </OpsAuthProvider>
        </ConvexClientProvider>
        <PwaRuntime enabled={process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_PWA_DEV === "true"} />
      </body>
    </html>
  );
}
