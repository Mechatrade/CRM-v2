/* ============================================================
   Mechatrade CRM — offline shell
   Keeps a copy of the app so it opens with no signal. Business data
   is handled separately by Firestore's own offline cache.
   Bump CACHE_VERSION whenever you upload a new index.html.
   ============================================================ */
const CACHE_VERSION = "mechatrade-v9";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json"
];

/* Third-party code the app needs to start: the Firebase library and the
   fonts. Cached on first use rather than up front, since the URLs carry
   version numbers we shouldn't hard-code here. */
const RUNTIME_HOSTS = [
  "www.gstatic.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn("shell cache failed", err))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never touch Firestore or Auth traffic — the SDK manages its own
  // offline queue and caching a live data channel would break it.
  if (url.hostname.includes("firestore.googleapis.com")
   || url.hostname.includes("firebaseio.com")
   || url.hostname.includes("identitytoolkit.googleapis.com")
   || url.hostname.includes("googleapis.com") && url.pathname.includes("/google.firestore")) {
    return;
  }

  // The page itself: serve from the network when we can so updates land,
  // fall back to the cached copy when there's no signal.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Libraries and fonts: use the cached copy first, and quietly refresh it.
  if (RUNTIME_HOSTS.some(h => url.hostname.endsWith(h)) || url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then(hit => {
        const live = fetch(req).then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => hit);
        return hit || live;
      })
    );
  }
});

/* Lets the page trigger an immediate update instead of waiting for a reload. */
self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
