/* global self, caches */
const VERSION = "admin-v1";
const STATIC_CACHE = `kuapa-${VERSION}-static`;
const PAGE_CACHE = `kuapa-${VERSION}-pages`;
const OWNED_PREFIX = "kuapa-admin-";
const OFFLINE_URL = "/offline";
const NOTIFICATION_PATHS = [/^\/$/, /^\/(?:notifications|dispatch|disputes|inventory|orders|reports|warehouses)(?:\/|$)/];
self.addEventListener("install", (event) => event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/pwa/icon-192.png", "/pwa/icon-512.png"]))));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(OWNED_PREFIX) && ![STATIC_CACHE, PAGE_CACHE].includes(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("message", (event) => { if (event.data?.type === "SKIP_WAITING") void self.skipWaiting(); });
async function cacheFirst(request) { const cached = await caches.match(request); if (cached) return cached; const response = await fetch(request); if (response.ok) void caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone())); return response; }
async function navigation(request) { const url = new URL(request.url); if (url.pathname.startsWith("/auth") || url.searchParams.has("_rsc")) return fetch(request); const cacheable = url.pathname === OFFLINE_URL; const cache = await caches.open(PAGE_CACHE); try { const response = await fetch(request); if (response.ok && cacheable) void cache.put(request, response.clone()); return response; } catch { return (cacheable ? await cache.match(request) : undefined) || (await caches.match(OFFLINE_URL)); } }
self.addEventListener("fetch", (event) => { if (event.request.method !== "GET") return; const url = new URL(event.request.url); if (event.request.mode === "navigate") return event.respondWith(navigation(event.request)); if (url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa/"))) return event.respondWith(cacheFirst(event.request)); });
self.addEventListener("push", (event) => { const payload = event.data?.json?.() || {}; const actionUrl = typeof payload.actionUrl === "string" && NOTIFICATION_PATHS.some((pattern) => pattern.test(payload.actionUrl)) ? payload.actionUrl : "/"; event.waitUntil(self.registration.showNotification("Kuapa Dwaso Admin", { body: "You have a new Kuapa Dwaso update.", icon: "/pwa/icon-192.png", badge: "/pwa/badge-96.png", data: { actionUrl } })); });
self.addEventListener("notificationclick", (event) => { event.notification.close(); const url = event.notification.data?.actionUrl || "/"; event.waitUntil(self.clients.openWindow(url)); });
