"use client";

import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/ui/Field";
import { setShortcutsEnabled, useShortcutsEnabled } from "@/lib/keyboard-shortcuts";

/** Turns single-key shortcuts on or off in this browser, at once (no form, nothing sent). */
export function ShortcutsToggle({ className }: { className?: string }) {
  const t = useTranslations("shortcuts");
  const enabled = useShortcutsEnabled();
  return (
    <Checkbox
      label={t("toggleLabel")}
      hint={t("toggleHint")}
      checked={enabled}
      onChange={(event) => setShortcutsEnabled(event.target.checked)}
      className={className}
    />
  );
}
