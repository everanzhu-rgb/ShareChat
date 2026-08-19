const CACHE_NAME = "qijian-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (["/api/", "/auth/", "/attachments/", "/keys/"].some((path) => url.pathname.startsWith(path))) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
    return;
  }

  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })),
    );
  }
});

self.addEventListener("push", (event) => {
  const data = event.data?.json?.() ?? {};
  event.waitUntil(
    self.registration.showNotification("栖笺", {
      body: data.type === "security" ? "有一项安全操作需要你确认。" : "你收到了一份新心意。",
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { path: "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.path || "/"));
});
