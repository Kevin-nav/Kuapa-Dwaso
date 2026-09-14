"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { AdminShell } from "@kuapa-dwaso/dashboard-ui";
import { SampleDataBanner } from "@kuapa-dwaso/ui/pilot";
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
  );
  const pilotProgrammes = useQuery(
    api.pilotProgrammes.listAvailable,
    actorUserId === undefined ? "skip" : { limit: 20 },
  ) as { page: Array<{ demoContext: { programmeId: string; programmeName: string; dataMode: "live" | "sample_only"; datasetId?: string } }> } | undefined;
  const sampleProgrammes = pilotProgrammes?.page
    .map((programme) => programme.demoContext)
    .filter((context) => context.dataMode === "sample_only") ?? [];
  const demoPresentation = process.env.NEXT_PUBLIC_DEMO_PRESENTATION === "true";

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
      {demoPresentation ? <SampleDataBanner programmes={sampleProgrammes} /> : null}
      {children}
    </AdminShell>
  );
}
