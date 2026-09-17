import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@kuapa-dwaso/ui/toast";
import { PwaRuntime } from "@kuapa-dwaso/ui/pwa";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { AdminAuthProvider } from "./auth/AdminAuthProvider";
import { WarehouseFilterProvider } from "@kuapa-dwaso/dashboard-ui";
import { AdminShellClient } from "./AdminShellClient";
import "./globals.css";

export const metadata: Metadata = {
  title: "KuapaDwaso Admin",
  description: "Admin console for the agriculture marketplace.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "KD Admin", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/pwa/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#173d2b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <ConvexClientProvider>
            <AdminAuthProvider>
              <WarehouseFilterProvider>
                <AdminShellClient>{children}</AdminShellClient>
              </WarehouseFilterProvider>
            </AdminAuthProvider>
          </ConvexClientProvider>
        </ToastProvider>
        <PwaRuntime
          enabled={
            process.env.NODE_ENV === "production" ||
            process.env.NEXT_PUBLIC_PWA_DEV === "true"
          }
        />
      </body>
    </html>
  );
}
