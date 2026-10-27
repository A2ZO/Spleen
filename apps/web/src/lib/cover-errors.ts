/*
 * Covers that fail before React takes over. `error` events do not bubble and the ones fired
 * before hydration are lost to React, so one capturing listener, inline in <head> (it runs
 * before the first image is parsed), records every failed `<img data-cover>`. `CoverImage`
 * reads the set once mounted, then listens itself. No retry, no `complete` guess: a lazy image
 * out of view fires nothing until it is actually fetched.
 */

declare global {
  interface Window {
    __spleenFailedCovers?: WeakSet<EventTarget>;
  }
}

/** Allowed by its hash in the Content Security Policy (`security.ts`): no nonce needed. */
export const COVER_ERROR_SCRIPT =
  '(function(){var f=window.__spleenFailedCovers=new WeakSet();addEventListener("error",function(e){var t=e.target;if(t instanceof HTMLImageElement&&t.hasAttribute("data-cover"))f.add(t)},true)})()';
