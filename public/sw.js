const CACHE_VERSION = "signalx-shell-v1";
const APP_SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/signalx-192.png",
  "/icons/signalx-512.png",
  "/icons/signalx-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

const NETWORK_ONLY_PREFIXES = [
  "/api/", "/admin", "/dashboard", "/today-market", "/scan", "/ai-analysis",
  "/analysis", "/chart", "/favorites", "/ranking", "/alerts", "/history",
  "/performance", "/result", "/top-signals", "/learning",
];
const CACHEABLE_STATIC_PATH = /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (NETWORK_ONLY_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(fetch(request).catch(() => {
      if (request.mode === "navigate") return caches.match("/offline.html");
      throw new Error("Network unavailable");
    }));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || CACHEABLE_STATIC_PATH.test(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    })));
  }
});
