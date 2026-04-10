const CACHE_NAME = "mindraft-v1";

self.addEventListener("install", () => {
  // Don't skipWaiting — let the client decide when to activate the new SW
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  // Network-first strategy — let Firebase handle offline via IndexedDB
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
