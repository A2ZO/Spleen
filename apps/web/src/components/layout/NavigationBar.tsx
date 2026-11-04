"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { navigationPending, subscribeNavigation } from "@/lib/navigation-progress";

/** Below this, a click feels instant: no bar (it would only flicker). */
const SHOW_AFTER_MS = 150;

/**
 * Thin bar at the top of the page while a clicked link waits for the server. No Suspense and
 * no fallback (React would hold fast pages back by 300 ms, `docs/pieges.md`); nothing without
 * JavaScript, where navigations are full page loads. Static under reduced motion.
 */
export function NavigationBar() {
  const pending = useSyncExternalStore(subscribeNavigation, navigationPending, () => false);
  const [late, setLate] = useState(false);
  const shown = pending && late;

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setLate(true), SHOW_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setLate(false);
    };
  }, [pending]);

  return (
    <div
      aria-hidden
      data-navigation-bar={shown ? "shown" : "hidden"}
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden transition-opacity duration-200 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
    >
      {shown ? <div className="animate-navigation h-full w-1/3 rounded-full bg-star" /> : null}
    </div>
  );
}
