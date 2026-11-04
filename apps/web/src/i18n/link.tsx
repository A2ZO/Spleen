"use client";

import { useState, type ComponentProps } from "react";

import { IntlLink } from "./base-navigation";

/**
 * Prefetches on intent (pointer over the link, focus, touch) rather than when the link enters
 * the viewport: a page lists dozens of links and each prefetch is a server request (a function
 * invocation in the host's quota). Pass `prefetch` to choose: the header's main links keep
 * Next's viewport prefetch (`prefetch="auto"`). See `docs/stack-et-limites.md`.
 */
export function Link({
  prefetch,
  onPointerEnter,
  onFocus,
  onTouchStart,
  ...props
}: ComponentProps<typeof IntlLink>) {
  const [intent, setIntent] = useState(false);
  if (prefetch !== undefined) return <IntlLink prefetch={prefetch} {...props} />;
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
    />
  );
}
