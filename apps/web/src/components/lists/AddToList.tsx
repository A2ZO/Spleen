"use client";

import type { ApiErrorCode, MyList } from "@spleen/api";
import { LIST_TITLE_MAX, type ListTargetInput } from "@spleen/validators";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";

import {
  addListItemAction,
  createListAction,
  myListsAction,
  removeListItemAction,
} from "@/app/[locale]/list/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { Link } from "@/i18n/navigation";

type ErrorCode = ApiErrorCode | "unknown";

/** "Add to a list" on a record, track or artist page: opens a dialog of the member's lists. */
export function AddToListButton({ target, title }: { target: ListTargetInput; title: string }) {
  const t = useTranslations("list.addTo");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {t("button")}
      </Button>
      {open && <AddToListDialog target={target} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddToListDialog({
  target,
  title,
  onClose,
}: {
  target: ListTargetInput;
  title: string;
  onClose: () => void;
}) {
  const t = useTranslations("list.addTo");
  const tl = useTranslations("list");
  const te = useTranslations("errors");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [lists, setLists] = useState<MyList[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  // No cleanup: closing here would fire `close` when Strict Mode replays the effect.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  useEffect(() => {
    let live = true;
    void myListsAction({ target }).then((result) => {
      if (!live) return;
      if (result.data) setLists(result.data);
      else setError(result.error ?? "unknown");
    });
    return () => {
      live = false;
    };
  }, [target]);

  const reload = async () => {
    const result = await myListsAction({ target });
    if (result.data) setLists(result.data);
  };

  const toggle = (list: MyList) => {
    // Ticked at once (outside the transition, which would defer it); the reload below
    // brings the real item id, or the previous state after a failure.
    setLists(
      (current) =>
        current?.map((l) =>
          l.id === list.id ? { ...l, itemId: list.itemId ? null : "pending" } : l,
        ) ?? null,
    );
    startTransition(async () => {
      setError(null);
      const result = list.itemId
        ? await removeListItemAction({ listId: list.id, itemId: list.itemId })
        : await addListItemAction({ listId: list.id, target });
      if (result.ok) {
        setStatus(t(list.itemId ? "removed" : "added", { title: list.title }));
      } else setError(result.error ?? "unknown");
      await reload();
    });
  };

  const create = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      const result = await createListAction({ title: newTitle, item: target });
      if (result.ok) {
        setStatus(t("added", { title: newTitle.trim() }));
        setNewTitle("");
        await reload();
      } else setError(result.error ?? "unknown");
    });
  };

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
        <div>
          <h2 id={titleId} className="text-2xl font-semibold text-balance">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">{t("intro", { title })}</p>
        </div>

        {lists === null && !error ? (
          <p className="text-sm text-fg-muted">{t("loading")}</p>
        ) : lists && lists.length === 0 ? (
          <p className="font-serif text-fg-muted italic">{t("empty")}</p>
        ) : (
          <ul className="max-h-72 divide-y divide-border/50 overflow-y-auto rounded-md border border-border/60">
            {lists?.map((list) => (
              <li key={list.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={list.itemId !== null}
                    disabled={pending}
                    onChange={() => toggle(list)}
                    className="size-4 shrink-0 accent-accent"
                  />
                  <span className="min-w-0 flex-1 truncate">{list.title}</span>
                  <span className="font-mono text-xs text-fg-muted">
                    {tl("itemCount", { count: list.itemCount })}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={create} className="space-y-2">
          <label htmlFor={`${titleId}-new`} className="block text-sm font-medium">
            {t("newLabel")}
          </label>
          <div className="flex gap-2">
            <input
              id={`${titleId}-new`}
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder={t("newPlaceholder")}
              maxLength={LIST_TITLE_MAX}
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted/70 focus:border-star focus:outline-none"
            />
            <Button type="submit" disabled={pending || newTitle.trim() === ""}>
              {t("createAndAdd")}
            </Button>
          </div>
        </form>

        <p aria-live="polite" className="text-sm text-fg-muted">
          {status}
        </p>
        {error && <FormMessage tone="error">{te(error)}</FormMessage>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/list/new" className="text-sm text-link underline-offset-2 hover:underline">
            {tl("create")}
          </Link>
          <Button variant="ghost" onClick={() => ref.current?.close()}>
            {t("close")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
