"use client";

import type { ApiErrorCode, ReleaseCard } from "@spleen/api";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import {
  removeShelfAction,
  reorderShelfAction,
  type ShelfResult,
} from "@/app/[locale]/shelf/actions";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { VinylShelf } from "@/components/ui/VinylShelf";

/**
 * The member's own Shelf on their profile: the vinyl display, plus an edit mode to move
 * records between slots (buttons, so it works with the keyboard) and take them off.
 */
export function ShelfEditor({ shelf }: { shelf: (ReleaseCard | null)[] }) {
  const t = useTranslations("shelf");
  const te = useTranslations("errors");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<(ReleaseCard | null)[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ApiErrorCode | "unknown" | null>(null);
  const [status, setStatus] = useState("");
  const slots = saved ?? shelf;
  const isEmpty = slots.every((s) => s === null);

  const save = (write: () => Promise<ShelfResult>, done: string) =>
    startTransition(async () => {
      const result = await write();
      if (result.shelf) {
        setSaved(result.shelf);
        setError(null);
        setStatus(done);
      } else setError(result.error ?? "unknown");
    });

  const move = (from: number, to: number) => {
    const next = slots.map((s) => s?.id ?? null);
    [next[from], next[to]] = [next[to]!, next[from]!];
    const title = slots[from]?.title ?? "";
    save(() => reorderShelfAction(next), t("moved", { title, position: to + 1 }));
  };

  return (
    <div>
      <VinylShelf items={slots} emptyMessage={t("emptyOwn")} className="pt-4" />
      {isEmpty ? (
        <div className="mt-3 flex flex-col items-center gap-2 text-center">
          <p className="max-w-md text-sm text-fg-muted">{t("emptyHint")}</p>
          <ButtonLink href="/search" variant="outline">
            {t("findRecord")}
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" aria-expanded={editing} onClick={() => setEditing((e) => !e)}>
            {editing ? t("done") : t("edit")}
          </Button>
        </div>
      )}
      {editing && !isEmpty && (
        <ol
          aria-label={t("editLabel")}
          className="mt-2 divide-y divide-border/50 rounded-md border border-border/60 bg-surface"
        >
          {slots.map((slot, index) => (
            <li
              key={slot?.id ?? `empty-${index}`}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <span className="w-5 font-mono text-fg-muted">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                {slot ? slot.title : <span className="text-fg-muted italic">{t("free")}</span>}
              </span>
              {slot && (
                <span className="flex gap-1">
                  <Button
                    variant="ghost"
                    className="px-2"
                    disabled={pending || index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label={t("moveLeft", { title: slot.title })}
                  >
                    ←
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2"
                    disabled={pending || index === slots.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label={t("moveRight", { title: slot.title })}
                  >
                    →
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2"
                    disabled={pending}
                    onClick={() =>
                      save(() => removeShelfAction(index + 1), t("removed", { title: slot.title }))
                    }
                    aria-label={t("removeOne", { title: slot.title })}
                  >
                    {t("removeShort")}
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      <p role="status" className="sr-only">
        {status}
      </p>
      {error && (
        <div className="mt-2">
          <FormMessage tone="error">{te(error)}</FormMessage>
        </div>
      )}
    </div>
  );
}
