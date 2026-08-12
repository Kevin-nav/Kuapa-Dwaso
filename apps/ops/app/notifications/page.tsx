"use client";

import { useCallback } from "react";
import { Bell, Download, Smartphone } from "lucide-react";
import { InstallAppCard, PushNotificationController } from "@kuapa-dwaso/ui/pwa";
import { useOpsAuth } from "../auth/OpsAuthProvider";

export default function NotificationsPage() {
  const { firebaseUser } = useOpsAuth();
  const getPushToken = useCallback(async () => {
    if (firebaseUser === null) {
      throw new Error("Sign in again to change notification settings.");
    }
    return await firebaseUser.getIdToken();
  }, [firebaseUser]);

  return (
    <div className="page-stack ops-device-settings">
      <header className="page-header">
        <div>
          <p className="eyebrow">Device preferences</p>
          <h1>Notifications &amp; app</h1>
          <p>Keep warehouse alerts and install options in one predictable place.</p>
        </div>
      </header>

      <section className="section-card ops-device-settings-intro" aria-labelledby="device-settings-heading">
        <div className="ops-device-settings-icon" aria-hidden="true"><Bell size={22} /></div>
        <div>
          <h2 id="device-settings-heading">This device</h2>
          <p>
            Browser alerts are optional. SMS delivery and your warehouse activity continue even when alerts are off.
          </p>
        </div>
      </section>

      <div className="ops-device-settings-grid">
        <section aria-label="Install warehouse app" className="ops-device-setting-group">
          <div className="ops-device-setting-label"><Download size={18} /><span>Installation</span></div>
          <InstallAppCard appName="Kuapa Dwaso Warehouse" />
        </section>
        <section aria-label="Push notification preferences" className="ops-device-setting-group">
          <div className="ops-device-setting-label"><Smartphone size={18} /><span>Browser alerts</span></div>
          {firebaseUser === null ? null : (
            <PushNotificationController
              surface="ops"
              apiBaseUrl={process.env.NEXT_PUBLIC_API_URL}
              ownerKey={firebaseUser.uid}
              getToken={getPushToken}
            />
          )}
        </section>
      </div>
    </div>
  );
}
