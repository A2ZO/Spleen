"use client";

import { useLinkStatus } from "next/link";
import { useEffect, useState, type ComponentProps } from "react";

import { startNavigation } from "@/lib/navigation-progress";

import { IntlLink } from "./base-navigation";

/** Reports this link's pending navigation to the top bar (`NavigationBar`). Renders nothing. */
function PendingReporter() {
  const { pending } = useLinkStatus();
  useEffect(() => (pending ? startNavigation() : undefined), [pending]);
  return null;
}

/**
 * Prefetches on intent (pointer over the link, focus, touch) rather than when the link enters
 * the viewport: a page lists dozens of links and each prefetch is a server request (a function
 * invocation in the host's quota). Pass `prefetch` to choose: the header's main links keep
 * Next's viewport prefetch (`prefetch="auto"`). See `docs/stack-et-limites.md`.
 * Every link also feeds the navigation bar while its page loads.
 */
export function Link({
  children,
  prefetch,
  onPointerEnter,
  onFocus,
  onTouchStart,
  ...props
}: ComponentProps<typeof IntlLink>) {
  const [intent, setIntent] = useState(false);
  if (prefetch !== undefined)
    return (
      <IntlLink prefetch={prefetch} {...props}>
        {children}
        <PendingReporter />
      </IntlLink>
    );
  return (
    <IntlLink
      {...props}
      prefetch={intent ? null : false}
      onPointerEnter={(event) => {
        setIntent(true);
        onPointerEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
    >
      {children}
      <PendingReporter />
    </IntlLink>
  );
}
