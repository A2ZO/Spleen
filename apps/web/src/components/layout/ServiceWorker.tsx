"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (`/sw.js`), or removes it when the emergency switch is on. An
 * update is installed in the background and used at the next launch: never a forced reload.
 */
export function ServiceWorker({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (enabled) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => undefined);
    } else {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())));
    }
  }, [enabled]);
  return null;
}
