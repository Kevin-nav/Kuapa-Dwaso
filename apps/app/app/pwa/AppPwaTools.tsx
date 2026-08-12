"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConnectivityState, CurrentPlatformPrincipal, SelfServiceWorkspace } from "@kuapa-dwaso/types";
import { ConnectivityBanner } from "@kuapa-dwaso/ui/pwa";
import { authorizedSelfServiceWorkspaces, listOfflineActions, saveWorkspacePreference } from "@kuapa-dwaso/utils/pwa";

export function AppConnectivity({ ownerUserId }: { ownerUserId?: string }) {
  const [state, setState] = useState<ConnectivityState>("online");
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      setState(navigator.onLine ? "online" : "offline");
      if (ownerUserId === undefined) setPendingCount(0);
      else void listOfflineActions(ownerUserId).then((items) => { if (active) setPendingCount(items.length); }).catch(() => undefined);
    };
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => { active = false; window.removeEventListener("online", refresh); window.removeEventListener("offline", refresh); };
  }, [ownerUserId]);
  return <ConnectivityBanner state={state} pendingCount={pendingCount} />;
}

export function WorkspaceSwitcher({ principal, current }: { principal: CurrentPlatformPrincipal; current: SelfServiceWorkspace }) {
  const router = useRouter();
  const workspaces = useMemo(() => authorizedSelfServiceWorkspaces(principal), [principal]);
  if (workspaces.length < 2) return null;
  return <div aria-label="Switch workspace" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "8px 16px" }}>{workspaces.map((workspace) => <button type="button" className={workspace === current ? "btn btn-primary" : "btn btn-secondary"} key={workspace} onClick={() => { void saveWorkspacePreference(principal.userId, workspace); router.push(`/${workspace}`); }}>{workspace[0]?.toUpperCase()}{workspace.slice(1)}</button>)}</div>;
}
