"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";
import type { WriteError } from "@/lib/use-instant-writes";

/**
 * Why a reaction was rolled back. Always mounted so screen readers announce the text when it
 * appears; polite, since the button already shows the state before the click. Without an error
 * it is visually hidden and may carry `announce` (the result of a keyboard shortcut, which
 * gives no visual focus on the changed control).
 */
export function ReactionStatus({
  error,
  announce = null,
  className,
}: {
  error: WriteError | null;
  announce?: string | null;
  className?: string;
}) {
  const te = useTranslations("errors");
  return (
    // Never `hidden`: a live region must stay in the accessibility tree.
    <p aria-live="polite" className={error ? cn("mt-1 text-xs text-danger", className) : "sr-only"}>
      {error ? te(error) : announce}
    </p>
  );
}
