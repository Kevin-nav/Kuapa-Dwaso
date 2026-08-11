"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConnectivityState, CurrentPlatformPrincipal, SelfServiceWorkspace } from "@kuapa-dwaso/types";
import { ConnectivityBanner, InstallAppCard, PushNotificationController } from "@kuapa-dwaso/ui/pwa";
import { authorizedSelfServiceWorkspaces, listOfflineActions, saveWorkspacePreference } from "@kuapa-dwaso/utils/pwa";
import { useAuth } from "../auth/AuthProvider";

export function AppConnectivity({ ownerUserId }: { ownerUserId?: string }) {
  const [state, setState] = useState<ConnectivityState>("online");
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    const refresh = () => {
      setState(navigator.onLine ? "online" : "offline");
      if (ownerUserId !== undefined) void listOfflineActions(ownerUserId).then((items) => setPendingCount(items.length)).catch(() => undefined);
    };
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => { window.removeEventListener("online", refresh); window.removeEventListener("offline", refresh); };
  }, [ownerUserId]);
  return <ConnectivityBanner state={state} pendingCount={pendingCount} />;
}

export function WorkspaceSwitcher({ principal, current }: { principal: CurrentPlatformPrincipal; current: SelfServiceWorkspace }) {
  const router = useRouter();
  const workspaces = useMemo(() => authorizedSelfServiceWorkspaces(principal), [principal]);
  if (workspaces.length < 2) return null;
  return <div aria-label="Switch workspace" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "8px 16px" }}>{workspaces.map((workspace) => <button type="button" className={workspace === current ? "btn btn-primary" : "btn btn-secondary"} key={workspace} onClick={() => { void saveWorkspacePreference(principal.userId, workspace); router.push(`/${workspace}`); }}>{workspace[0]?.toUpperCase()}{workspace.slice(1)}</button>)}</div>;
}

export function ProductInstallCard() {
  return <InstallAppCard appName="Kuapa Dwaso" />;
}

export function ProductPushSettings() {
  const { firebaseUser } = useAuth();
  if (firebaseUser === null) return null;
  return <PushNotificationController surface="app" apiBaseUrl={process.env.NEXT_PUBLIC_API_URL} getToken={() => firebaseUser.getIdToken()} />;
}
