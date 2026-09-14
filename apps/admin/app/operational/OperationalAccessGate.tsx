"use client";

import type { ReactNode } from "react";
import { AdminAccessState } from "@kuapa-dwaso/dashboard-ui";
import type { CurrentPlatformPrincipal } from "@kuapa-dwaso/types";

type OperationalAccessGateProps = {
  children: ReactNode;
  firebaseUser: unknown;
  principal: CurrentPlatformPrincipal | null | undefined;
  isAuthLoading: boolean;
  isDataLoading: boolean;
  isAllowed: boolean;
  loadingTitle?: string;
  deniedTitle?: string;
  deniedMessage?: string;
  limitedTitle?: string;
  limitedMessage?: string;
};

export function OperationalAccessGate({
  children,
  firebaseUser,
  principal,
  isAuthLoading,
  isDataLoading,
  isAllowed,
  loadingTitle = "Loading admin data",
  deniedTitle = "Admin sign-in required",
  deniedMessage = "This operational surface requires an active Convex admin principal.",
  limitedTitle = "Limited admin access",
  limitedMessage = "Your current admin role does not include this operational permission.",
}: OperationalAccessGateProps) {
  if (isAuthLoading || (firebaseUser !== null && principal === undefined) || isDataLoading) {
    return (
      <AdminAccessState
        variant="loading"
        title={loadingTitle}
        message="Checking identity, permissions, and current records."
      />
    );
  }

  if (firebaseUser === null || principal == null || principal.role !== "admin" || principal.status !== "active") {
    return (
      <AdminAccessState
        variant="denied"
        title={deniedTitle}
        message={deniedMessage}
        detail="Use the Admin sign in page and accept an admin or warehouse-manager invitation before opening operational data."
      />
    );
  }

  if (!isAllowed) {
    return (
      <AdminAccessState
        variant="limited"
        title={limitedTitle}
        message={limitedMessage}
        detail="Scoped roles may still allow other admin pages. Access is enforced again by Convex for every read and write."
      />
    );
  }

  return <>{children}</>;
}
