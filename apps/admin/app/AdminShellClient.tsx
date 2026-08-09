"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { AdminShell } from "@kuapa-dwaso/dashboard-ui";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAdminAuth } from "./auth/AdminAuthProvider";

type AdminShellClientProps = {
  children: ReactNode;
};

export function AdminShellClient({ children }: AdminShellClientProps) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { principal, signOut } = useAdminAuth();
  const actorUserId =
    principal?.role === "admin" && principal.status === "active"
      ? (principal.userId as Id<"users">)
      : undefined;
  const warehouses = useQuery(
    api.warehouses.list,
    actorUserId === undefined ? "skip" : { actorUserId, limit: 100 },
  ) as { _id: Id<"warehouses">; name: string }[] | undefined;
  const effectiveAccess = useQuery(
    api.adminAccess.getEffectiveAccess,
    actorUserId === undefined
      ? "skip"
      : { actorUserId, adminUserId: actorUserId },
  ) as { permissions: string[] } | undefined;

  if (pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  return (
    <AdminShell
      pathname={pathname}
      LinkComponent={Link}
      warehouseOptions={(warehouses ?? []).map((warehouse) => ({
        id: warehouse._id,
        name: warehouse.name,
      }))}
      principalName={principal?.name ?? "Admin"}
      principalRoleLabel={
        principal?.role === "admin" ? "Administrator" : "Not linked"
      }
      onSignOut={async () => {
        await signOut();
        router.replace("/auth");
      }}
      showStories={effectiveAccess?.permissions.includes("blog:read") === true}
    >
      {children}
    </AdminShell>
  );
}
