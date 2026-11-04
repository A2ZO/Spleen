"use client";

import "@/lib/cover-errors";
import Image from "next/image";
import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * The real cover, replaced by `fallback` (the generated sleeve, rendered on the server) when it
 * fails to load: archive.org storage nodes sometimes answer 500. The failure belongs to one
 * URL: a new `src` gets its own try.
 */
export function CoverImage({
  src,
  sizes,
  fallback,
}: {
  src: string;
  sizes: string;
  fallback: ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // No `onError` on next/image: it would reset `img.src` at hydration, restarting every
    // download. Failures before this effect are in the set kept by `COVER_ERROR_SCRIPT`.
    const el = image.current;
    if (!el) return;
    const fail = () => setFailedSrc(src);
    el.addEventListener("error", fail);
    if (window.__spleenFailedCovers?.has(el)) fail();
    return () => el.removeEventListener("error", fail);
  }, [src]);

  if (failedSrc === src) return fallback;
  return (
    // Covers come from Cover Art Archive in ready-made sizes: no image optimisation
    // (no host-specific service, no quota), the browser follows the redirect itself.
    // Empty alt: a broken image with a text alternative would show its icon and text.
    <Image
      key={src}
      ref={image}
      src={src}
      alt=""
      fill
      unoptimized
      sizes={sizes}
      className="object-cover text-transparent"
      data-cover=""
    />
  );
}
