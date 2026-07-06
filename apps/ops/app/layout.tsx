import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { WarehouseProvider } from "./context/WarehouseContext";
import LayoutShell from "./LayoutShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "KuapaDwaso Ops",
  description: "Warehouse operations console for warehouse-agent workflows."
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>
          <WarehouseProvider>
            <LayoutShell>{children}</LayoutShell>
          </WarehouseProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
