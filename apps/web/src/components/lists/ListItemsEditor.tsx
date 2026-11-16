"use client";

import type { ApiErrorCode, ListItem } from "@spleen/api";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { removeListItemAction, reorderListAction } from "@/app/[locale]/list/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";

import { ListItemRow, listItemView } from "./ListItemRow";

type ErrorCode = ApiErrorCode | "unknown";

/**
 * The owner's list items with buttons to move and remove them (keyboard friendly, like the
 * Shelf). The order changes at once on screen; saves go out one after the other, so a burst
 * of moves can never reach the server out of order. Focus follows the moved item.
 */
export function ListItemsEditor({
  listId,
  ranked,
  items: initial,
}: {
  listId: string;
  ranked: boolean;
  items: ListItem[];
}) {
  const t = useTranslations("list");
  const te = useTranslations("errors");
  const [items, setItems] = useState(initial);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<ErrorCode | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  // The server's latest order (props change on refresh), to come back to after a failure.
  const serverItems = useRef(initial);
  useEffect(() => {
    serverItems.current = initial;
  }, [initial]);
  const buttons = useRef(new Map<string, HTMLButtonElement | null>());

  /**
   * Sends `write` after the previous save (the action re-renders the page in its response);
   * on failure, shows the server's order again.
   */
  const save = (write: () => Promise<{ ok?: boolean; error?: ErrorCode }>) => {
    queue.current = queue.current.then(async () => {
      const result = await write();
      if (result.ok) {
        setError(null);
      } else {
        setError(result.error ?? "unknown");
        setItems(serverItems.current);
      }
    });
  };

  const move = (index: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved!);
    const renumbered = next.map((item, i) => ({ ...item, position: i + 1 }));
    setItems(renumbered);
    setStatus(t("moved", { title: listItemView(moved!).title, position: to + 1 }));
    const [same, opposite] = to < index ? ["up", "down"] : ["down", "up"];
    // Keep the focus on the same button of the moved item (it re-rendered elsewhere); at
    // either end that button is disabled, so the other arrow takes it (never "remove").
    requestAnimationFrame(() => {
      const button = buttons.current.get(`${moved!.id}:${same}`);
      (button && !button.disabled
        ? button
        : buttons.current.get(`${moved!.id}:${opposite}`)
      )?.focus();
    });
    save(() => reorderListAction({ listId, itemIds: renumbered.map((i) => i.id) }));
  };

  const remove = (index: number) => {
    const item = items[index]!;
    const next = items.filter((i) => i.id !== item.id).map((i, n) => ({ ...i, position: n + 1 }));
    setItems(next);
    setStatus(t("removed", { title: listItemView(item).title }));
    const neighbour = next[Math.min(index, next.length - 1)];
    requestAnimationFrame(() => {
      if (neighbour) buttons.current.get(`${neighbour.id}:remove`)?.focus();
    });
    save(() => removeListItemAction({ listId, itemId: item.id }));
  };

  const ref = (key: string) => (element: HTMLButtonElement | null) => {
    buttons.current.set(key, element);
  };

  if (items.length === 0) {
    return <p className="text-lg text-fg-muted">{t("emptyOwnList")}</p>;
  }

  return (
    <div>
      <ol aria-label={t("orderLabel")}>
        {items.map((item, index) => {
          const { title } = listItemView(item);
          return (
            <li key={item.id} className="rounded-[14px] odd:bg-surface-alt">
              <ListItemRow
                item={item}
                ranked={ranked}
                actions={
                  <>
                    <Button
                      ref={ref(`${item.id}:up`)}
                      variant="ghost"
                      className="px-2"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                      aria-label={t("moveUp", { title })}
                    >
                      ↑
                    </Button>
                    <Button
                      ref={ref(`${item.id}:down`)}
                      variant="ghost"
                      className="px-2"
                      disabled={index === items.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label={t("moveDown", { title })}
                    >
                      ↓
                    </Button>
                    <Button
                      ref={ref(`${item.id}:remove`)}
                      variant="ghost"
                      className="px-2"
                      onClick={() => remove(index)}
                      aria-label={t("remove", { title })}
                    >
                      ✕
                    </Button>
                  </>
                }
              />
            </li>
          );
        })}
      </ol>
      <p role="status" className="sr-only">
        {status}
      </p>
      {error && (
        <div className="mt-3">
          <FormMessage tone="error">{te(error)}</FormMessage>
        </div>
      )}
    </div>
  );
}
