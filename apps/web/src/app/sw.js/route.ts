import { serviceWorkerDisabled } from "@spleen/infra/config";

/*
 * The service worker, served with `Cache-Control: no-cache` so a faulty version never sticks
 * in browsers. It caches only the offline page, the versioned static files (/_next/static)
 * and the icons: never a member's page, never /api (above all /api/auth: a sign-in link must
 * always reach the server). The cache name carries the build: older caches are deleted when a
 * new worker activates. A new worker waits for every Spleen tab to close and takes over at the
 * next launch (no skipWaiting, no reload loop). Emergency switch: SERVICE_WORKER_DISABLED=1
 * (docs/environnement.md) serves a worker that empties the caches and unregisters itself.
 */

const BUILD = process.env.SPLEEN_BUILD_ID ?? "dev";

const worker = (build: string) => `"use strict";
const BUILD = ${JSON.stringify(build)};
const CACHE = "spleen-" + BUILD;
const OFFLINE = { fr: "/offline.html?lang=fr", en: "/offline.html?lang=en" };
const ICONS = ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"];
// In development, /_next/static files are not versioned: never cache them there.
const STATIC_CACHE = BUILD !== "dev";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(
        [...Object.values(OFFLINE), ...ICONS].map(
          (url) => new Request(url, { credentials: "omit", cache: "reload" }),
        ),
      ),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("spleen-") && key !== CACHE).map((key) => caches.delete(key)),
        ),
      ),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never in the way of the API: sign-in links, uploads, tRPC, exports.
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    // Pages always come from the network; the offline page only when it fails.
    const offline = url.pathname.startsWith("/en") ? OFFLINE.en : OFFLINE.fr;
    event.respondWith(fetch(request).catch(() => caches.match(offline)));
    return;
  }
  if (url.pathname.startsWith("/icons/") || (STATIC_CACHE && url.pathname.startsWith("/_next/static/"))) {
    event.respondWith(cacheFirst(request));
  }
});
`;

const killSwitch = `"use strict";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
    })(),
  );
});
`;

export function GET() {
  return new Response(serviceWorkerDisabled() ? killSwitch : worker(BUILD), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}
