import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { WarehouseFilterProvider, AdminShell } from "@kuapa-dwaso/dashboard-ui";
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
          <WarehouseFilterProvider>
            <AdminShell>{children}</AdminShell>
          </WarehouseFilterProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
