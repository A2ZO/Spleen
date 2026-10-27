"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * The real cover over the generated sleeve, removed when it fails to load (archive.org storage
 * nodes sometimes answer 500). The failure belongs to one URL: a new `src` gets its own try.
 */
export function CoverImage({ src, sizes }: { src: string; sizes: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = image.current;
    if (el?.complete && el.naturalWidth === 0) setFailedSrc(src);
  }, [src]);

  if (failedSrc === src) return null;
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
      onError={() => setFailedSrc(src)}
    />
  );
}
