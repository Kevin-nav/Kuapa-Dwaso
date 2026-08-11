/* global indexedDB, caches, window */

import type {
  ConnectivityState,
  OfflineOutboxItem,
  OfflineSnapshot,
  PwaSurface,
  SelfServiceWorkspace,
  CurrentPlatformPrincipal,
} from "@kuapa-dwaso/types";

const DATABASE_NAME = "kuapa-dwaso-pwa-v1";
const DATABASE_VERSION = 1;
const SNAPSHOTS = "snapshots";
const OUTBOX = "outbox";
const PREFERENCES = "preferences";

type StoredPreference = { key: string; ownerUserId: string; value: unknown; savedAt: number };

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Offline storage is unavailable."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOTS)) database.createObjectStore(SNAPSHOTS, { keyPath: "key" });
      if (!database.objectStoreNames.contains(OUTBOX)) database.createObjectStore(OUTBOX, { keyPath: "clientActionId" });
      if (!database.objectStoreNames.contains(PREFERENCES)) database.createObjectStore(PREFERENCES, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage."));
  });
}

async function transaction<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return await new Promise<T>((resolve, reject) => {
    const tx = database.transaction(storeName, mode);
    const request = run(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage request failed."));
    tx.oncomplete = () => database.close();
    tx.onerror = () => reject(tx.error ?? new Error("Offline storage transaction failed."));
  });
}

export async function saveOfflineSnapshot<T>(snapshot: OfflineSnapshot<T>): Promise<void> {
  const key = `${snapshot.ownerUserId}:${snapshot.surface}:${snapshot.collection}`;
  await transaction(SNAPSHOTS, "readwrite", (store) => store.put({ key, ...snapshot }));
}

export async function readOfflineSnapshot<T>(ownerUserId: string, surface: PwaSurface, collection: string): Promise<OfflineSnapshot<T> | undefined> {
  const key = `${ownerUserId}:${surface}:${collection}`;
  const record = await transaction<Record<string, unknown> | undefined>(SNAPSHOTS, "readonly", (store) => store.get(key));
  if (record === undefined || Number(record.expiresAt) <= Date.now() || record.ownerUserId !== ownerUserId) return undefined;
  return record as unknown as OfflineSnapshot<T>;
}

export async function saveWorkspacePreference(ownerUserId: string, workspace: SelfServiceWorkspace): Promise<void> {
  const preference: StoredPreference = { key: `workspace:${ownerUserId}`, ownerUserId, value: workspace, savedAt: Date.now() };
  await transaction(PREFERENCES, "readwrite", (store) => store.put(preference));
}

export async function readWorkspacePreference(ownerUserId: string): Promise<SelfServiceWorkspace | undefined> {
  const result = await transaction<StoredPreference | undefined>(PREFERENCES, "readonly", (store) => store.get(`workspace:${ownerUserId}`));
  return result?.ownerUserId === ownerUserId && ["farmer", "buyer", "transporter"].includes(String(result.value))
    ? (result.value as SelfServiceWorkspace)
    : undefined;
}

export async function enqueueOfflineAction<T>(item: OfflineOutboxItem<T>): Promise<void> {
  await transaction(OUTBOX, "readwrite", (store) => store.put(item));
}

export async function listOfflineActions(ownerUserId: string): Promise<OfflineOutboxItem[]> {
  const records = await transaction<OfflineOutboxItem[]>(OUTBOX, "readonly", (store) => store.getAll());
  return records.filter((item) => item.ownerUserId === ownerUserId && item.state !== "completed").sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateOfflineAction(item: OfflineOutboxItem): Promise<void> {
  await transaction(OUTBOX, "readwrite", (store) => store.put(item));
}

export async function removeOfflineAction(clientActionId: string): Promise<void> {
  await transaction(OUTBOX, "readwrite", (store) => store.delete(clientActionId));
}

export async function clearPwaData(ownerUserId?: string): Promise<void> {
  const database = await openDatabase();
  await Promise.all([SNAPSHOTS, OUTBOX, PREFERENCES].map(async (storeName) => {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      if (ownerUserId === undefined) store.clear();
      else {
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor === null) return;
          const value = cursor.value as { ownerUserId?: string };
          if (value.ownerUserId === ownerUserId) cursor.delete();
          cursor.continue();
        };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not clear offline data."));
    });
  }));
  database.close();
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("kuapa-")).map((key) => caches.delete(key)));
  }
}

export function getConnectivityState(backendReachable: boolean | undefined): ConnectivityState {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  return backendReachable === false ? "limited" : "online";
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export function createClientActionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function classifyOfflineError(error: unknown): "retry" | "needs_attention" {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /network|fetch|offline|timeout|disconnect|socket/.test(message) ? "retry" : "needs_attention";
}

export function authorizedSelfServiceWorkspaces(principal: CurrentPlatformPrincipal): SelfServiceWorkspace[] {
  const available = new Set<SelfServiceWorkspace>();
  if (principal.role === "farmer" || principal.role === "buyer" || principal.role === "transporter") available.add(principal.role);
  for (const profile of principal.profiles) {
    if (profile.profileType === "farmer" || profile.profileType === "buyer" || profile.profileType === "transporter") available.add(profile.profileType);
  }
  return ["farmer", "buyer", "transporter"].filter((workspace): workspace is SelfServiceWorkspace => available.has(workspace as SelfServiceWorkspace));
}

export function resolveSelfServiceWorkspace(principal: CurrentPlatformPrincipal, saved?: SelfServiceWorkspace): SelfServiceWorkspace | undefined {
  const authorized = authorizedSelfServiceWorkspaces(principal);
  if (saved !== undefined && authorized.includes(saved)) return saved;
  if ((principal.role === "farmer" || principal.role === "buyer" || principal.role === "transporter") && authorized.includes(principal.role)) return principal.role;
  return authorized[0];
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const normalized = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(normalized);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function enableWebPush(input: { apiBaseUrl: string; surface: PwaSurface; getToken: () => Promise<string> }): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Push notifications are unavailable in this browser.");
  const token = await input.getToken();
  const configResponse = await fetch(`${input.apiBaseUrl.replace(/\/$/, "")}/notifications/push/config`);
  if (!configResponse.ok) throw new Error("Could not load notification configuration.");
  const config = await configResponse.json() as { supported: boolean; publicKey?: string };
  if (!config.supported || config.publicKey === undefined) throw new Error("Push notifications are not configured yet.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(config.publicKey) });
  const json = subscription.toJSON();
  if (json.endpoint === undefined || json.keys?.p256dh === undefined || json.keys.auth === undefined) throw new Error("The browser returned an incomplete push subscription.");
  const response = await fetch(`${input.apiBaseUrl.replace(/\/$/, "")}/notifications/push/subscriptions`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ surface: input.surface, endpoint: json.endpoint, expirationTime: json.expirationTime, keys: json.keys }) });
  if (!response.ok) { await subscription.unsubscribe(); throw new Error("Could not save this notification subscription."); }
}

export async function disableWebPush(input: { apiBaseUrl: string; getToken: () => Promise<string> }): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription === null) return;
  const token = await input.getToken();
  await subscription.unsubscribe();
  await fetch(`${input.apiBaseUrl.replace(/\/$/, "")}/notifications/push/subscriptions`, { method: "DELETE", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(() => undefined);
}

export async function isWebPushEnabled(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  return (await (await navigator.serviceWorker.ready).pushManager.getSubscription()) !== null;
}
