"use client";

import { defaultTheme } from "@spleen/design-tokens";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { applyTheme, readTheme } from "@/lib/theme";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const t = useTranslations("theme");
  const theme = useSyncExternalStore(subscribe, readTheme, () => defaultTheme);
  const isDark = theme === "dark";
  const label = isDark ? t("toLight") : t("toDark");

  return (
    <button
      type="button"
      onClick={() => applyTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className="inline-flex size-9 items-center justify-center rounded-md text-lg text-fg-muted transition-colors hover:bg-surface hover:text-star"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
