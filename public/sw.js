// Minimal offline-shell service worker.
//
// Strategy: NETWORK FIRST, cache as fallback. Online, every request goes to
// the network exactly as it would without a service worker, so a new deploy
// is picked up immediately (no stale-app problem, no cache versioning to
// manage). Each successful response is also copied into the cache, and when
// the network is unreachable the last copy is served instead — that's what
// lets the app shell (and the Tajawal font) load with no connection.
//
// Only same-origin GETs and Google Fonts are handled. Firestore / Auth
// traffic goes to other origins and is deliberately left alone (Firestore
// has its own persistent cache for data).
const CACHE = "pest-crm-shell-v1";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !FONT_HOSTS.includes(url.hostname)) return;

  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    // "opaque" = cross-origin no-cors response (the Google Fonts stylesheet);
    // it can't be inspected but can be cached and replayed.
    if (res && (res.ok || res.type === "opaque")) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    if (req.mode === "navigate") {
      const shell = await cache.match(self.registration.scope);
      if (shell) return shell;
    }
    throw err;
  }
}
