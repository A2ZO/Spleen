"use client";

import { useEffect } from "react";

/**
 * Sets `data-hydrated` on <html> once React has taken over the page. Controlled fields typed
 * into before that lose their text (issue #24): e2e tests wait for it before typing.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "";
  }, []);
  return null;
}
