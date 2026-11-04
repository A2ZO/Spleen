/**
 * Pending link navigations, counted for the top navigation bar (`NavigationBar`). Each `Link`
 * reports its `useLinkStatus()` here (`i18n/link.tsx`); the bar subscribes with
 * `useSyncExternalStore`. Module state on purpose: it lives in the browser only.
 */
let pending = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

/** Marks one navigation as pending; call the returned function when it is no longer. */
export function startNavigation(): () => void {
  pending++;
  emit();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    pending--;
    emit();
  };
}

export function subscribeNavigation(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const navigationPending = () => pending > 0;
