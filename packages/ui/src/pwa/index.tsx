"use client";

import { useEffect, useState } from "react";
import type { ConnectivityState } from "@kuapa-dwaso/types";
import type { PwaSurface } from "@kuapa-dwaso/types";
import { disableWebPush, enableWebPush, isWebPushEnabled } from "@kuapa-dwaso/utils/pwa";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function ConnectivityBanner({ state, pendingCount = 0 }: { state: ConnectivityState; pendingCount?: number }) {
  if (state === "online" && pendingCount === 0) return null;
  const text = state === "offline"
    ? `You are offline${pendingCount > 0 ? ` — ${pendingCount} action${pendingCount === 1 ? "" : "s"} saved on this device` : ""}.`
    : state === "limited"
      ? "Your connection is limited. Live information may be unavailable."
      : `${pendingCount} action${pendingCount === 1 ? "" : "s"} waiting to sync.`;
  return <div role="status" style={{ padding: "10px 14px", background: "#f1ebfb", color: "#5b21b6", border: "1px solid #d9c9f2", borderRadius: 12, marginBottom: 12, fontWeight: 700 }}>{text}</div>;
}

export function InstallAppCard({ appName }: { appName: string }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(() => typeof window === "undefined" ? true : window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (standalone) return null;
  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <section style={{ padding: 16, border: "1px solid #dfe7df", borderRadius: 16, background: "#fff", display: "grid", gap: 10 }}>
      <strong>Install {appName}</strong>
      <span style={{ color: "#526052" }}>Open it from your home screen and keep essential screens available on unreliable connections.</span>
      <button type="button" className="btn btn-secondary" onClick={() => { void (async () => {
        if (promptEvent !== null) {
          await promptEvent.prompt();
          const choice = await promptEvent.userChoice;
          if (choice.outcome === "accepted") setStandalone(true);
        } else setShowHelp((current) => !current);
      })(); }}>{promptEvent === null ? "How to install" : "Install app"}</button>
      {showHelp ? <small>{isIos ? "In Safari, tap Share, then Add to Home Screen." : "Use your browser menu and choose Install app or Add to home screen."}</small> : null}
    </section>
  );
}

export function UpdateAvailableBanner({ onUpdate }: { onUpdate: () => void }) {
  return <div role="status" style={{ position: "fixed", insetInline: 12, bottom: 84, zIndex: 1000, padding: 12, borderRadius: 12, background: "#173d2b", color: "white", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><span>A safer, faster version is ready.</span><button type="button" onClick={onUpdate} style={{ minHeight: 40, paddingInline: 14 }}>Update</button></div>;
}

export function SyncStatusPanel({ pendingCount, needsAttentionCount, onRetry }: { pendingCount: number; needsAttentionCount: number; onRetry?: () => void }) {
  return <section aria-label="Sync status" style={{ padding: 14, border: "1px solid #dfe7df", borderRadius: 14 }}><strong>{pendingCount} pending</strong>{needsAttentionCount > 0 ? <p>{needsAttentionCount} action{needsAttentionCount === 1 ? " needs" : "s need"} your attention.</p> : <p>Saved actions sync when this app is open and the connection returns.</p>}{onRetry ? <button type="button" className="btn btn-secondary" onClick={onRetry}>Retry now</button> : null}</section>;
}

export function PushNotificationSettings({ supported, enabled, onEnable, onDisable }: { supported: boolean; enabled: boolean; onEnable: () => Promise<void>; onDisable: () => Promise<void> }) {
  return <section style={{ padding: 16, border: "1px solid #dfe7df", borderRadius: 16, background: "#fff", display: "grid", gap: 10 }}><strong>Important notifications</strong><span>{supported ? "Get privacy-safe alerts for time-sensitive updates." : "Push notifications are not available in this browser. SMS and email are unchanged."}</span>{supported ? <button type="button" className="btn btn-secondary" onClick={() => void (enabled ? onDisable() : onEnable())}>{enabled ? "Turn off notifications" : "Turn on notifications"}</button> : null}</section>;
}

export function PwaRuntime({ enabled = true }: { enabled?: boolean }) {
  const [updateRegistration, setUpdateRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) return;
    let mounted = true;
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (!mounted) return;
        if (registration.waiting !== null) setUpdateRegistration(registration);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller !== null) setUpdateRegistration(registration);
          });
        });
      } catch {
        // The web application remains fully usable when service workers are unavailable.
      }
    };
    const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number };
    const idleId = idleWindow.requestIdleCallback?.(() => void register(), { timeout: 2500 });
    if (idleId === undefined) window.setTimeout(() => void register(), 1000);
    const reload = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", reload);
    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener("controllerchange", reload);
    };
  }, [enabled]);

  if (updateRegistration === null) return null;
  return <UpdateAvailableBanner onUpdate={() => updateRegistration.waiting?.postMessage({ type: "SKIP_WAITING" })} />;
}

export function PushNotificationController({ surface, apiBaseUrl, getToken }: { surface: PwaSurface; apiBaseUrl: string | undefined; getToken: () => Promise<string> }) {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string>();
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  useEffect(() => { if (supported) void isWebPushEnabled().then(setEnabled).catch(() => undefined); }, [supported]);
  if (apiBaseUrl === undefined || apiBaseUrl.length === 0) return null;
  return <div style={{ display: "grid", gap: 8 }}><PushNotificationSettings supported={supported} enabled={enabled} onEnable={async () => { setError(undefined); try { await enableWebPush({ apiBaseUrl, surface, getToken }); setEnabled(true); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not enable notifications."); } }} onDisable={async () => { setError(undefined); try { await disableWebPush({ apiBaseUrl, getToken }); setEnabled(false); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not disable notifications."); } }} />{error !== undefined ? <small role="alert" style={{ color: "#b42318" }}>{error}</small> : null}</div>;
}
