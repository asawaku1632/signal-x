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

const DEFAULT_PUSH_PAYLOAD = {
  title: "SIGNALX",
  body: "新しいお知らせがあります",
  url: "/",
  tag: "signalx-notification",
};
const ALLOWED_NOTIFICATION_PATHS = new Set(["/", "/mypage"]);
const CANONICAL_ORIGIN = "https://signal-x-ppjg.vercel.app";

function safeNotificationText(value, fallback, maxLength) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function safeNotificationUrl(value) {
  try {
    const url = new URL(typeof value === "string" ? value : "/", self.location.origin);
    if (url.origin !== self.location.origin || !ALLOWED_NOTIFICATION_PATHS.has(url.pathname)) return "/";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}

self.addEventListener("push", (event) => {
  let received = {};
  try {
    received = event.data ? event.data.json() : {};
  } catch {
    received = {};
  }
  if (!received || typeof received !== "object" || Array.isArray(received)) received = {};

  const payload = {
    title: safeNotificationText(received.title, DEFAULT_PUSH_PAYLOAD.title, 80),
    body: safeNotificationText(received.body, DEFAULT_PUSH_PAYLOAD.body, 240),
    url: safeNotificationUrl(received.url),
    tag: safeNotificationText(received.tag, DEFAULT_PUSH_PAYLOAD.tag, 64),
  };

  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    icon: "/icons/signalx-192.png",
    data: { url: payload.url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = safeNotificationUrl(event.notification.data?.url);
  const targetUrl = new URL(targetPath, CANONICAL_ORIGIN).href;

  event.waitUntil((async () => {
    let windows = [];
    try {
      windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    } catch {
      // Continue to openWindow when existing clients cannot be inspected.
    }

    for (const client of windows) {
      try {
        if (new URL(client.url).origin !== CANONICAL_ORIGIN || !("navigate" in client)) continue;
        const navigated = await client.navigate(targetUrl);
        if (!navigated) continue;
        await navigated.focus();
        return;
      } catch {
        // Try another matching client, then fall back to openWindow.
      }
    }

    try {
      const opened = await self.clients.openWindow(targetUrl);
      if (opened && "focus" in opened) {
        try {
          await opened.focus();
        } catch {
          // The URL was opened even if the browser cannot focus it explicitly.
        }
      }
    } catch {
      // Keep the notificationclick promise fulfilled when the browser refuses to open a window.
    }
  })());
});
