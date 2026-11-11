"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, type KeyboardEvent } from "react";

import {
  commitNow,
  setPaused,
  undo,
  useUndoBanners,
  type Waiting,
} from "@/lib/use-undoable-delete";

/** Where the focus goes when it would be lost (a hidden item, a closed banner). */
function focusMain() {
  document.getElementById("main")?.focus({ preventScroll: true });
}

const focusLost = () => !document.activeElement || document.activeElement === document.body;

/**
 * "Deleted · Undo" banners (`lib/use-undoable-delete.ts`), in the `[locale]` layout so they stay
 * through internal navigations. Announced politely; hovering or focusing them pauses the delays;
 * Escape closes a banner without undoing (the deletion leaves now).
 */
export function UndoBanners() {
  const t = useTranslations("undo");
  const te = useTranslations("errors");
  const { waiting, failure } = useUndoBanners();
  const region = useRef<HTMLDivElement>(null);
  const hover = useRef(false);
  const focus = useRef(false);
  const count = useRef(0);
  const sync = () => setPaused(hover.current || focus.current);

  useEffect(() => {
    // A banner removed with the focus or the pointer on it fires no `blur` / `pointerleave`.
    focus.current = !!region.current?.contains(document.activeElement);
    if (!waiting.length) hover.current = false;
    setPaused(hover.current || focus.current);
    // A new deletion: the hidden item took the focus with it (a pointer click), keep it here.
    if (waiting.length > count.current && focusLost()) focusMain();
    count.current = waiting.length;
  }, [waiting]);

  const leave = (action: () => void) => {
    action();
    focusMain();
  };

  return (
    <div
      ref={region}
      role="region"
      aria-label={t("region")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-4"
      onPointerEnter={() => {
        hover.current = true;
        sync();
      }}
      onPointerLeave={() => {
        hover.current = false;
        sync();
      }}
      onFocus={() => {
        focus.current = true;
        sync();
      }}
      onBlur={(event) => {
        focus.current = !!region.current?.contains(event.relatedTarget as Node | null);
        sync();
      }}
    >
      {/* Always mounted (an empty live region): what appears in it is announced. */}
      <div aria-live="polite" className="flex w-full flex-col items-center gap-2">
        {waiting.map((item) => (
          <Banner
            key={item.id}
            item={item}
            message={
              item.kind === "list"
                ? t("deleted.list", { title: item.label ?? "" })
                : t(`deleted.${item.kind}`)
            }
            undoLabel={t("undo")}
            onUndo={() => leave(() => undo(item.id))}
            onEscape={() => leave(() => commitNow(item.id))}
          />
        ))}
      </div>
      <p aria-live="polite" className="text-sm empty:hidden">
        {failure ? (
          <span className="pointer-events-auto block rounded-md border border-border bg-surface px-4 py-2 text-danger shadow-card">
            {t("failed", { reason: te(failure.code) })}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function Banner({
  item,
  message,
  undoLabel,
  onUndo,
  onEscape,
}: {
  item: Waiting;
  message: string;
  undoLabel: string;
  onUndo: () => void;
  onEscape: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const textId = `undo-${item.id}`;

  useEffect(() => {
    if (item.focusUndo) button.current?.focus();
  }, [item.focusUndo]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onEscape();
  };

  return (
    <div
      onKeyDown={onKeyDown}
      className="pointer-events-auto flex w-full max-w-md animate-rise items-center gap-4 rounded-md border border-border bg-surface py-2 pr-2 pl-4 text-sm shadow-card"
    >
      <span id={textId} className="min-w-0 flex-1 truncate">
        {message}
      </span>
      <button
        ref={button}
        type="button"
        aria-describedby={textId}
        onClick={onUndo}
        className="shrink-0 rounded-md px-3 py-1.5 font-medium text-link hover:bg-bg"
      >
        {undoLabel}
      </button>
    </div>
  );
}
