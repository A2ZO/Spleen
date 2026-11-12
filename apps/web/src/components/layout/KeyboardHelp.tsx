"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { buttonClasses } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { OPEN_HELP_EVENT, openKeyboardHelp, shortcutAllowed } from "@/lib/keyboard-shortcuts";

import { ShortcutsToggle } from "./ShortcutsToggle";

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-7 justify-center rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-xs text-fg shadow-card">
      {children}
    </kbd>
  );
}

function Row({ keys, children }: { keys: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-4">
      <dt className="flex w-20 shrink-0 flex-wrap gap-1">{keys}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function HelpDialog({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
  const t = useTranslations("shortcuts");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // No cleanup: closing here would fire `close` when Strict Mode replays the effect.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close();
      }}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-md border border-border bg-bg p-0 text-fg shadow-card backdrop:bg-bg/80"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <h2 id={titleId} className="text-2xl font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-fg-muted">{t("intro")}</p>
        <dl className="space-y-2">
          <Row keys={<Key>/</Key>}>{t("search")}</Row>
          <Row keys={<Key>?</Key>}>{t("help")}</Row>
          <Row keys={<Key>{t("escKey")}</Key>}>{t("closeKey")}</Row>
        </dl>
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t("pageTitle")}</h3>
          {!signedIn && <p className="text-sm text-fg-muted">{t("signInToRate")}</p>}
          <dl className="space-y-2">
            <Row
              keys={
                <>
                  <Key>1</Key>…<Key>5</Key>
                </>
              }
            >
              {t("rate")}
            </Row>
            <Row keys={<Key>0</Key>}>{t("clear")}</Row>
            <Row keys={<Key>L</Key>}>{t("like")}</Row>
            <Row
              keys={
                <>
                  <Key>←</Key>
                  <Key>→</Key>
                </>
              }
            >
              {t("halfStars")}
            </Row>
          </dl>
        </section>
        <div className="space-y-2 border-t border-border/60 pt-4">
          <ShortcutsToggle />
          {signedIn && (
            <p className="text-sm text-fg-muted">
              {t.rich("settingsNote", {
                link: (chunks) => (
                  <Link
                    href="/settings#shortcuts"
                    onClick={() => ref.current?.close()}
                    className="text-link underline"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className={buttonClasses("outline")}
        >
          {t("close")}
        </button>
      </div>
    </dialog>
  );
}

/**
 * Shortcut help: "?" opens it from anywhere but a field or a window (`shortcutAllowed`), and
 * the footer button opens it even with shortcuts turned off.
 */
export function KeyboardHelp({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "?" || !shortcutAllowed(event)) return;
      event.preventDefault();
      setOpen(true);
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_HELP_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_HELP_EVENT, onOpen);
    };
  }, []);

  return open ? <HelpDialog signedIn={signedIn} onClose={() => setOpen(false)} /> : null;
}

const noSubscribe = () => () => {};

/** Footer button; not rendered before hydration (it needs JavaScript, like the shortcuts). */
export function KeyboardHelpButton() {
  const t = useTranslations("shortcuts");
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  if (!hydrated) return null;
  return (
    <button
      type="button"
      onClick={openKeyboardHelp}
      className="inline-flex min-h-11 items-center underline hover:text-fg"
    >
      {t("open")}
    </button>
  );
}
