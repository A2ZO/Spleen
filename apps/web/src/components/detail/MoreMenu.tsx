"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { buttonClasses } from "@/components/ui/Button";
import { MoreIcon } from "@/components/ui/icons";

/** Class of an entry of the menu (a button or a link). */
export const moreMenuItem =
  "flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm text-fg hover:bg-surface-raised";

/**
 * "⋯" of the mobile detail bar. The entries stay mounted while the menu is closed (only hidden):
 * a dialog opened from one of them lives on (it renders in `document.body`). Closes on Escape,
 * outside click or a click on an entry.
 */
export function MoreMenu({ children }: { children: ReactNode }) {
  const t = useTranslations("detail");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={buttonClasses("secondary", "text-xl", "icon")}
      >
        <MoreIcon />
        <span className="sr-only">{t("more")}</span>
      </button>
      <div
        id={menuId}
        hidden={!open}
        onClick={() => setOpen(false)}
        className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-border bg-surface p-1.5 shadow-card"
      >
        {children}
      </div>
    </div>
  );
}
