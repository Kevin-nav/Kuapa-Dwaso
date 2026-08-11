"use client";

import { useCallback } from "react";
import { InstallAppCard, PushNotificationController } from "@kuapa-dwaso/ui/pwa";
import { useAuth } from "../auth/AuthProvider";

export function ProfilePwaTools() {
  const { firebaseUser } = useAuth();
  const getToken = useCallback(async () => {
    if (firebaseUser === null) throw new Error("Sign in again to change notification settings.");
    return await firebaseUser.getIdToken();
  }, [firebaseUser]);
  return <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
    <InstallAppCard appName="Kuapa Dwaso" />
    {firebaseUser === null ? null : <PushNotificationController surface="app" apiBaseUrl={process.env.NEXT_PUBLIC_API_URL} ownerKey={firebaseUser.uid} getToken={getToken} />}
  </div>;
}
