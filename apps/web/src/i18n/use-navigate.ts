"use client";

import { useCallback, useEffect, useMemo, useTransition } from "react";

import { startNavigation } from "@/lib/navigation-progress";

import { useRouter } from "./base-navigation";

type Router = ReturnType<typeof useRouter>;

/** A full page load that never arrives (stopped by the member) must not leave the bar up. */
const FULL_LOAD_GIVE_UP_MS = 10_000;

/** Feeds the navigation bar while `pending` is true (ends on unmount too: never stuck). */
export function useNavigationWhile(pending: boolean) {
  useEffect(() => (pending ? startNavigation() : undefined), [pending]);
}

/**
 * The only way to navigate from code (ESLint forbids `useRouter` elsewhere): `push` and
 * `replace` run in a transition whose pending state feeds the top bar (`NavigationBar`), like a
 * clicked `Link`. The transition ends when the page arrives, fails or is replaced by another
 * navigation, so the bar always goes. `refresh` and `prefetch` are not page changes: no bar. `assign` is a
 * full page load (after signing in with a code).
 */
export function useNavigate() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useNavigationWhile(pending);

  const push = useCallback<Router["push"]>(
    (...args) => startTransition(() => router.push(...args)),
    [router],
  );
  const replace = useCallback<Router["replace"]>(
    (...args) => startTransition(() => router.replace(...args)),
    [router],
  );

  return useMemo(
    () => ({
      push,
      replace,
      refresh: () => router.refresh(),
      prefetch: ((...args) => router.prefetch(...args)) as Router["prefetch"],
      assign: (href: string) => {
        const done = startNavigation();
        const timer = setTimeout(done, FULL_LOAD_GIVE_UP_MS);
        // Back to this page from the browser's cache: the load is over.
        window.addEventListener(
          "pageshow",
          () => {
            clearTimeout(timer);
            done();
          },
          { once: true },
        );
        window.location.assign(href);
      },
      pending,
    }),
    [push, replace, router, pending],
  );
}
