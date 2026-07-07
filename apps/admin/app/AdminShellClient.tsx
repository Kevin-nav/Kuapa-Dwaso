"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminShell } from "@kuapa-dwaso/dashboard-ui";

type AdminShellClientProps = {
  children: ReactNode;
};

export function AdminShellClient({ children }: AdminShellClientProps) {
  const pathname = usePathname() || "/";

  return (
    <AdminShell pathname={pathname} LinkComponent={Link}>
      {children}
    </AdminShell>
  );
}
