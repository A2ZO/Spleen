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
import { Card } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/Field";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { ShelfGrid } from "./ShelfGrid";

/**
 * The member's own Shelf on their profile: its section heading, the grid with its free slots,
 * plus an edit mode to move records between slots (buttons, so it works with the keyboard) and
 * take them off.
 */
export function ShelfEditor({
  shelf,
  headingId,
  title,
}: {
  shelf: (ReleaseCard | null)[];
  headingId: string;
  title: string;
}) {
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
      <SectionHeading
        id={headingId}
        className="mb-1"
        action={
          !isEmpty && (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={editing}
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? t("done") : t("edit")}
            </Button>
          )
        }
      >
        {title}
      </SectionHeading>
      <p className="mb-4 font-mono text-xs tracking-[0.14em] text-fg-muted uppercase">
        {t("subtitleOwn")}
      </p>
      {isEmpty ? (
        <Card className="flex flex-col items-center gap-3 text-center">
          <p className="font-display text-xl font-bold">{t("emptyOwn")}</p>
          <p className="max-w-md text-sm text-fg-muted">{t("emptyHint")}</p>
          <ButtonLink href="/search" variant="secondary">
            {t("findRecord")}
          </ButtonLink>
        </Card>
      ) : (
        <ShelfGrid items={slots} showEmpty />
      )}
      {editing && !isEmpty && (
        <Card className="mt-4 p-2 md:p-3">
          <ol aria-label={t("editLabel")} className="space-y-1">
            {slots.map((slot, index) => (
              <li
                key={slot?.id ?? `empty-${index}`}
                className="flex min-h-11 items-center gap-3 rounded-thumb px-3 py-1 text-sm odd:bg-surface-alt"
              >
                <span className="w-5 font-mono text-fg-muted">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  {slot ? slot.title : <span className="text-fg-muted">{t("free")}</span>}
                </span>
                {slot && (
                  <span className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending || index === 0}
                      onClick={() => move(index, index - 1)}
                      aria-label={t("moveLeft", { title: slot.title })}
                    >
                      ←
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending || index === slots.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label={t("moveRight", { title: slot.title })}
                    >
                      →
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        save(
                          () => removeShelfAction(index + 1),
                          t("removed", { title: slot.title }),
                        )
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
        </Card>
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
