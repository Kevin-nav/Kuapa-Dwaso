import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { AdminAuthProvider } from "./auth/AdminAuthProvider";
import { WarehouseFilterProvider } from "@kuapa-dwaso/dashboard-ui";
import { AdminShellClient } from "./AdminShellClient";
import "./globals.css";

export const metadata: Metadata = {
  title: "KuapaDwaso Admin",
  description: "Admin console for the agriculture marketplace."
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>
          <AdminAuthProvider>
            <WarehouseFilterProvider>
              <AdminShellClient>{children}</AdminShellClient>
            </WarehouseFilterProvider>
          </AdminAuthProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
