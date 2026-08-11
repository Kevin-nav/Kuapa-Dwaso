/* global self, caches */
const VERSION = "app-v1";
const STATIC_CACHE = `kuapa-${VERSION}-static`;
const PAGE_CACHE = `kuapa-${VERSION}-pages`;
const IMAGE_CACHE = `kuapa-${VERSION}-images`;
const OWNED_PREFIX = "kuapa-app-";
const OFFLINE_URL = "/offline";
const MAX_PAGES = 20;
const MAX_IMAGES = 30;
const BLOCKED_PATHS = [/^\/auth/, /^\/signup/, /^\/invites/, /^\/buyer\/payments/, /^\/.*\/login/, /^\/api/];
const NOTIFICATION_PATHS = [/^\/$/, /^\/farmer(?:\/|$)/, /^\/buyer(?:\/|$)/, /^\/transporter(?:\/|$)/];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/pwa/icon-192.png", "/pwa/icon-512.png"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(OWNED_PREFIX) && ![STATIC_CACHE, PAGE_CACHE, IMAGE_CACHE].includes(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

function isBlocked(url) {
  return url.searchParams.has("_rsc") || BLOCKED_PATHS.some((pattern) => pattern.test(url.pathname));
}

async function trim(cacheName, maximum) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maximum)).map((key) => cache.delete(key)));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) void caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()));
  return response;
}

async function staleImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response.ok || response.type === "opaque") void cache.put(request, response.clone()).then(() => trim(IMAGE_CACHE, MAX_IMAGES));
    return response;
  }).catch(() => cached);
  return cached || network;
}

async function navigation(request) {
  const url = new URL(request.url);
  if (isBlocked(url)) return fetch(request);
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3500)),
    ]);
    if (response.ok) void cache.put(request, response.clone()).then(() => trim(PAGE_CACHE, MAX_PAGES));
    return response;
  } catch {
    return (await cache.match(request)) || (await caches.match(OFFLINE_URL));
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (event.request.mode === "navigate") return event.respondWith(navigation(event.request));
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) return event.respondWith(cacheFirst(event.request));
  if ((url.origin === self.location.origin && url.pathname.startsWith("/pwa/")) || (url.hostname === "images.kuapadwaso.com" && url.pathname.startsWith("/produce/"))) return event.respondWith(staleImage(event.request));
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() || {};
  const actionUrl = typeof payload.actionUrl === "string" && NOTIFICATION_PATHS.some((pattern) => pattern.test(payload.actionUrl)) ? payload.actionUrl : "/";
  event.waitUntil(self.registration.showNotification("Kuapa Dwaso", {
    body: "You have a new Kuapa Dwaso update.",
    icon: "/pwa/icon-192.png",
    badge: "/pwa/badge-96.png",
    data: { actionUrl },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const actionUrl = event.notification.data?.actionUrl || "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    return existing ? existing.navigate(actionUrl).then(() => existing.focus()) : self.clients.openWindow(actionUrl);
  }));
});
