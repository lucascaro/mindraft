export const dynamic = "force-static";

const SW_CONTENT = `// BUILD_ID: ${process.env.BUILD_ID}
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
`;

export function GET() {
  return new Response(SW_CONTENT, {
    headers: {
      "Content-Type": "application/javascript",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-cache",
    },
  });
}
