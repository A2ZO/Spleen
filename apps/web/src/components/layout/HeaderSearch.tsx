"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { SearchCombobox } from "@/components/search/SearchCombobox";
import { SearchIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { shortcutAllowed } from "@/lib/keyboard-shortcuts";

/** Full-screen search on small screens. */
function SearchDialog({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
  const t = useTranslations();
  const ref = useRef<HTMLDialogElement>(null);
  // No cleanup: closing here would fire `close` when Strict Mode replays the effect.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={t("nav.searchLabel")}
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-bg p-0 text-fg backdrop:bg-bg"
    >
      <div className="flex items-start gap-2 p-4">
        <div className="min-w-0 flex-1">
          <SearchCombobox
            id="dialog-search"
            label={t("nav.searchLabel")}
            variant="dialog"
            signedIn={signedIn}
            autoFocus
            onNavigate={() => ref.current?.close()}
          />
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="rounded-md px-2 py-3 text-sm text-fg-muted hover:text-fg"
        >
          {t("search.suggest.close")}
        </button>
      </div>
    </dialog>
  );
}

/**
 * Header search with instant suggestions. Without JavaScript: a GET form to /search, and on
 * small screens an icon linking to it. With JavaScript the icon opens a full-screen search,
 * and "/" opens the search from anywhere but a field (`shortcutAllowed`).
 */
export function HeaderSearch({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations();
  const [dialog, setDialog] = useState(false);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || !shortcutAllowed(event)) return;
      event.preventDefault();
      // The search page's own field first, then the header's when it shows.
      const field = ["search-q", "header-search"]
        .map((id) => document.getElementById(id))
        .find((node) => node instanceof HTMLInputElement && node.offsetParent !== null);
      if (field) field.focus();
      else setDialog(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Link
        href="/search"
        aria-haspopup="dialog"
        onClick={(event) => {
          event.preventDefault();
          setDialog(true);
        }}
        className="ml-auto rounded-md p-2 text-lg text-fg-muted hover:text-fg sm:hidden"
      >
        <SearchIcon />
        <span className="sr-only">{t("nav.searchLabel")}</span>
      </Link>
      <div className="hidden min-w-0 flex-1 sm:ml-auto sm:block sm:max-w-xs">
        <SearchCombobox
          id="header-search"
          label={t("nav.searchLabel")}
          variant="header"
          signedIn={signedIn}
        />
      </div>
      {dialog && <SearchDialog signedIn={signedIn} onClose={() => setDialog(false)} />}
    </>
  );
}
