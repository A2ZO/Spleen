"use client";

import type { ApiErrorCode, ReleaseCard } from "@spleen/api";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { removeShelfAction, setShelfAction } from "@/app/[locale]/shelf/actions";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Cover } from "@/components/ui/Cover";
import { FormMessage } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

/**
 * "Put on my Shelf": opens a dialog with the 4 slots; picking one puts the record there
 * (replacing what was in it, or moving the record if it already sits on the Shelf).
 */
export function ShelfPicker({
  release,
  shelf,
  variant = "outline",
  className,
}: {
  release: { id: string; title: string };
  /** The member's current Shelf (4 slots). */
  shelf: (ReleaseCard | null)[];
  variant?: "outline" | "ghost";
  className?: string;
}) {
  const t = useTranslations("shelf");
  const [open, setOpen] = useState(false);
  // The page refreshes after a save; until then, show the Shelf the action returned.
  const [saved, setSaved] = useState<(ReleaseCard | null)[] | null>(null);
  const slots = saved ?? shelf;
  const onShelf = slots.some((s) => s?.id === release.id);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses(variant, cn("w-full", className))}
        aria-haspopup="dialog"
      >
        {onShelf ? t("onShelf") : t("put")}
      </button>
      {open && (
        <PickerDialog
          release={release}
          slots={slots}
          onClose={() => setOpen(false)}
          onSaved={(next) => {
            setSaved(next);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function PickerDialog({
  release,
  slots,
  onClose,
  onSaved,
}: {
  release: { id: string; title: string };
  slots: (ReleaseCard | null)[];
  onClose: () => void;
  onSaved: (shelf: (ReleaseCard | null)[]) => void;
}) {
  const t = useTranslations("shelf");
  const te = useTranslations("errors");
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ApiErrorCode | "unknown" | null>(null);
  const current = slots.findIndex((s) => s?.id === release.id);

  // No cleanup: closing here would fire `close` when Strict Mode replays the effect.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  const save = (write: () => ReturnType<typeof setShelfAction>) =>
    startTransition(async () => {
      const result = await write();
      if (result.shelf) {
        onSaved(result.shelf);
      } else setError(result.error ?? "unknown");
    });

  return (
    <dialog
      ref={ref}
      aria-labelledby="shelf-picker-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close();
      }}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-card border border-border bg-surface p-0 text-fg shadow-card backdrop:bg-bg/80"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <header>
          <h2 id="shelf-picker-title" className="text-2xl font-semibold text-balance">
            {t("pickTitle", { title: release.title })}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">{t("pickHint")}</p>
        </header>
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {slots.map((slot, index) => {
            const here = index === current;
            return (
              <li key={index}>
                <button
                  type="button"
                  disabled={pending || here}
                  onClick={() => save(() => setShelfAction(release.id, index + 1))}
                  className={cn(
                    "group block w-full rounded-thumb text-left focus-visible:outline-offset-4 disabled:cursor-default",
                    here && "ring-2 ring-star ring-offset-2 ring-offset-bg",
                  )}
                >
                  {slot ? (
                    <Cover
                      slug={slot.slug}
                      title={slot.title}
                      coverUrl={slot.coverUrl}
                      showText={false}
                      sizes="120px"
                      className="rounded-thumb transition-opacity group-enabled:group-hover:opacity-70"
                    />
                  ) : (
                    <span className="flex aspect-square items-center justify-center rounded-thumb border-2 border-dashed border-border-field font-mono text-2xl text-fg-muted">
                      {index + 1}
                    </span>
                  )}
                  <span className="mt-1.5 block truncate text-xs text-fg-muted">
                    {here
                      ? t("slotHere")
                      : slot
                        ? t("slotReplace", { title: slot.title })
                        : t("slotFree", { position: index + 1 })}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {error && <FormMessage tone="error">{te(error)}</FormMessage>}
        <div className="flex flex-wrap gap-3">
          {current >= 0 && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => save(() => removeShelfAction(current + 1))}
            >
              {t("remove")}
            </Button>
          )}
          <Button variant="ghost" onClick={() => ref.current?.close()}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
