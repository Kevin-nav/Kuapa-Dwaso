"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ConnectivityState } from "@kuapa-dwaso/types";
import type { PwaSurface } from "@kuapa-dwaso/types";
import { disableWebPush, enableWebPush, getWebPushStatus } from "@kuapa-dwaso/utils/pwa";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const deviceCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 760,
  padding: "clamp(14px, 4vw, 20px)",
  border: "1px solid rgba(45, 138, 78, 0.18)",
  borderRadius: 18,
  background: "linear-gradient(135deg, #ffffff 0%, #f7faf4 100%)",
  boxShadow: "0 10px 28px rgba(15, 31, 20, 0.06)",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "clamp(12px, 3vw, 16px)",
};

const deviceActionStyle: CSSProperties = {
  minHeight: 44,
  padding: "10px 17px",
  border: "1px solid #1f6b3a",
  borderRadius: 999,
  background: "#1f6b3a",
  color: "#ffffff",
  cursor: "pointer",
  font: "inherit",
  fontSize: 14,
  fontWeight: 750,
  lineHeight: 1.2,
  boxShadow: "0 6px 14px rgba(31, 107, 58, 0.16)",
};

function DeviceIcon({ children }: { children: ReactNode }) {
  return <span aria-hidden="true" style={{ width: 44, height: 44, flex: "0 0 44px", borderRadius: 14, background: "#e7f4ec", color: "#1f6b3a", display: "grid", placeItems: "center" }}>{children}</span>;
}

function InstallIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>;
}

function BellIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
}

function subscribeToDisplayMode(onChange: () => void): () => void {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function standaloneSnapshot(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function ConnectivityBanner({ state, pendingCount = 0 }: { state: ConnectivityState; pendingCount?: number }) {
  if (state === "online" && pendingCount === 0) return null;
  const text = state === "offline"
    ? `You are offline${pendingCount > 0 ? ` — ${pendingCount} action${pendingCount === 1 ? "" : "s"} saved on this device` : ""}.`
    : state === "limited"
      ? "Your connection is limited. Current information may be unavailable."
      : `${pendingCount} action${pendingCount === 1 ? "" : "s"} waiting to sync.`;
  return <div role="status" style={{ padding: "10px 14px", background: "#f1ebfb", color: "#5b21b6", border: "1px solid #d9c9f2", borderRadius: 12, marginBottom: 12, fontWeight: 700 }}>{text}</div>;
}

export function InstallAppCard({ appName }: { appName: string }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const standalone = useSyncExternalStore(subscribeToDisplayMode, standaloneSnapshot, () => true);
  const [installedFromPrompt, setInstalledFromPrompt] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (standalone || installedFromPrompt) return null;
  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <section style={deviceCardStyle}>
      <DeviceIcon><InstallIcon /></DeviceIcon>
      <div style={{ flex: "1 1 280px", minWidth: 0 }}>
        <span style={{ display: "block", marginBottom: 3, color: "#2d8a4e", fontSize: 11, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase" }}>App on this device</span>
        <strong style={{ display: "block", color: "#0f1f14", fontSize: 16, lineHeight: 1.35 }}>Install {appName}</strong>
        <span style={{ display: "block", marginTop: 4, color: "#526052", fontSize: 14, lineHeight: 1.5 }}>Faster return visits and essential screens when the connection is unreliable.</span>
      </div>
      <button type="button" disabled={isInstalling} style={{ ...deviceActionStyle, opacity: isInstalling ? 0.65 : 1 }} onClick={() => { void (async () => {
        if (promptEvent !== null) {
          setIsInstalling(true);
          try {
            await promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            if (choice.outcome === "accepted") setInstalledFromPrompt(true);
          } finally {
            setIsInstalling(false);
          }
        } else setShowHelp((current) => !current);
      })(); }}>{isInstalling ? "Opening…" : promptEvent === null ? "Installation help" : "Install app"}</button>
      {showHelp ? <small role="status" style={{ flexBasis: "100%", padding: "10px 12px", borderRadius: 12, background: "#eef6ef", color: "#365440", lineHeight: 1.5 }}>{isIos ? "In Safari, tap Share, then Add to Home Screen." : "Open your browser menu and choose Install app or Add to home screen."}</small> : null}
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
  const [isWorking, setIsWorking] = useState(false);
  return <section style={deviceCardStyle}>
    <DeviceIcon><BellIcon /></DeviceIcon>
    <div style={{ flex: "1 1 280px", minWidth: 0 }}>
      <span style={{ display: "block", marginBottom: 3, color: enabled ? "#15803d" : "#64748b", fontSize: 11, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase" }}>{enabled ? "Notifications on" : "Optional alerts"}</span>
      <strong style={{ display: "block", color: "#0f1f14", fontSize: 16, lineHeight: 1.35 }}>Important notifications</strong>
      <span style={{ display: "block", marginTop: 4, color: "#526052", fontSize: 14, lineHeight: 1.5 }}>{supported ? "Receive privacy-safe alerts for time-sensitive updates." : "This browser does not support push. SMS and email are unchanged."}</span>
    </div>
    {supported ? <button type="button" disabled={isWorking} aria-pressed={enabled} style={{ ...deviceActionStyle, background: enabled ? "#ffffff" : "#1f6b3a", color: enabled ? "#1f6b3a" : "#ffffff", boxShadow: enabled ? "none" : deviceActionStyle.boxShadow, opacity: isWorking ? 0.65 : 1 }} onClick={() => { void (async () => { setIsWorking(true); try { await (enabled ? onDisable() : onEnable()); } finally { setIsWorking(false); } })(); }}>{isWorking ? "Saving…" : enabled ? "Turn off" : "Turn on alerts"}</button> : null}
  </section>;
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

export function PushNotificationController({ surface, apiBaseUrl, ownerKey, getToken }: { surface: PwaSurface; apiBaseUrl: string | undefined; ownerKey: string; getToken: () => Promise<string> }) {
  const [status, setStatus] = useState<{ ownerKey: string; enabled: boolean }>();
  const [error, setError] = useState<string>();
  const enabled = status?.ownerKey === ownerKey && status.enabled;
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  useEffect(() => {
    let active = true;
    if (supported && apiBaseUrl !== undefined && apiBaseUrl.length > 0) {
      void getWebPushStatus({ apiBaseUrl, getToken }).then((value) => { if (active) setStatus({ ownerKey, enabled: value }); }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [apiBaseUrl, getToken, ownerKey, supported]);
  if (apiBaseUrl === undefined || apiBaseUrl.length === 0) return null;
  return <div style={{ width: "100%", maxWidth: 760, display: "grid", gap: 8 }}><PushNotificationSettings supported={supported} enabled={enabled} onEnable={async () => { setError(undefined); try { await enableWebPush({ apiBaseUrl, surface, getToken }); setStatus({ ownerKey, enabled: true }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not enable notifications."); } }} onDisable={async () => { setError(undefined); try { await disableWebPush({ apiBaseUrl, getToken }); setStatus({ ownerKey, enabled: false }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not disable notifications."); } }} />{error !== undefined ? <small role="alert" style={{ color: "#b42318", paddingInline: 4 }}>{error}</small> : null}</div>;
}
