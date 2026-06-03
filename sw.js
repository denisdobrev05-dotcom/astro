/* sw.js — service worker за offline работа.
 * Стратегия: „network-first“ за съдържание от същия източник (винаги показва
 * най-новата версия, когато има интернет) с връщане към кеша при offline. */
const CACHE = "zvezdna-karta-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/cities.js",
  "./js/timezone.js",
  "./js/astro.js",
  "./js/interpretations.js",
  "./js/daily.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const sameOrigin = req.url.startsWith(self.location.origin);

  // network-first за съдържание от същия източник → винаги най-новата версия онлайн
  if (sameOrigin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) =>
            cached || (req.mode === "navigate" ? caches.match("./index.html") : Promise.reject("offline"))
          )
        )
    );
    return;
  }

  // други (външни) заявки — cache-first
  e.respondWith(caches.match(req).then((c) => c || fetch(req)));
});
