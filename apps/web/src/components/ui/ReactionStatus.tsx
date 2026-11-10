"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";
import type { WriteError } from "@/lib/use-instant-writes";

/**
 * Why a reaction was rolled back. Always mounted (empty, no height) so screen readers announce
 * the text when it appears; polite, since the button already shows the state before the click.
 */
export function ReactionStatus({
  error,
  className,
}: {
  error: WriteError | null;
  className?: string;
}) {
  const te = useTranslations("errors");
  return (
    // Not `hidden` when empty: a live region must stay in the accessibility tree.
    <p aria-live="polite" className={cn("mt-1 text-xs text-danger empty:mt-0", className)}>
      {error ? te(error) : null}
    </p>
  );
}
