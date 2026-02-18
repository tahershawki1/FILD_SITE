// Service Worker for Field Site PWA
// Bump this on every release to invalidate old caches.
const CACHE_VERSION = "v1.0.0";
const CACHE_REVISION = "meta-fix-20260218";
const STATIC_CACHE = `field-site-static-${CACHE_VERSION}-${CACHE_REVISION}`;
const RUNTIME_CACHE = `field-site-runtime-${CACHE_VERSION}-${CACHE_REVISION}`;

const STATIC_ASSETS = [
  "./index.html",
  "./task.html",
  "./tasks/new-level.html",
  "./tasks/check-tbm-villa-wall.html",
  "./tasks/check-slabs.html",
  "./tasks/check-excavation-level.html",
  "./tasks/stake-demarcation.html",
  "./tasks/stake-villa-points.html",
  "./tasks/survey-for-consultant.html",
  "./tasks/natural-ground-survey.html",
  "./manifest.json",
  "./version.json",
  "./sw.js",
  "./assets/css/home.css",
  "./assets/css/task.css",
  "./assets/css/style.css",
  "./assets/css/tasks/new-level.css",
  "./assets/css/tasks/check-tbm-villa-wall.css",
  "./assets/css/tasks/check-slabs.css",
  "./assets/css/tasks/check-excavation-level.css",
  "./assets/css/tasks/stake-demarcation.css",
  "./assets/css/tasks/stake-villa-points.css",
  "./assets/css/tasks/survey-for-consultant.css",
  "./assets/css/tasks/natural-ground-survey.css",
  "./assets/JS/home.js",
  "./assets/JS/task.js",
  "./assets/JS/script.js",
  "./assets/JS/pwa-update.js",
  "./assets/JS/tasks/new-level.js",
  "./assets/JS/tasks/check-tbm-villa-wall.js",
  "./assets/JS/tasks/check-slabs.js",
  "./assets/JS/tasks/check-excavation-level.js",
  "./assets/JS/tasks/stake-demarcation.js",
  "./assets/JS/tasks/stake-villa-points.js",
  "./assets/JS/tasks/survey-for-consultant.js",
  "./assets/JS/tasks/natural-ground-survey.js",
  "./assets/icons/brand-logo.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

function isAuthOrSessionPath(pathname) {
  return (
    pathname === "/login" ||
    pathname === "/logout" ||
    pathname.startsWith("/admin")
  );
}

function hasNoStore(response) {
  const cacheControl = String(response.headers.get("Cache-Control") || "").toLowerCase();
  return cacheControl.includes("no-store");
}

function shouldCacheResponse(request, response) {
  if (!response || !response.ok) return false;
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (isAuthOrSessionPath(url.pathname)) return false;
  if (hasNoStore(response)) return false;

  return true;
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

function shouldUseNetworkFirst(request) {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;

  const path = url.pathname;
  return (
    request.mode === "navigate" ||
    path.endsWith("/") ||
    path.endsWith("/index.html") ||
    path.endsWith("/manifest.json") ||
    path.endsWith("/sw.js") ||
    path.endsWith("/version.json")
  );
}

async function networkFirst(request) {
  const url = new URL(request.url);
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (shouldCacheResponse(request, networkResponse)) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (request.mode === "navigate" && !isAuthOrSessionPath(url.pathname)) {
      const appShell = await caches.match("./index.html");
      if (appShell) return appShell;
    }

    const fallback = await caches.match(request);
    if (fallback) return fallback;

    throw _;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then(response => {
      if (shouldCacheResponse(request, response)) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || (await networkFetch) || (await caches.match(request));
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && isAuthOrSessionPath(url.pathname)) {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=UTF-8" },
          })
      )
    );
    return;
  }

  if (shouldUseNetworkFirst(event.request)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== RUNTIME_CACHE)
          .map(name => caches.delete(name))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
