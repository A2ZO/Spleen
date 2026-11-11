"use client";

import type { ApiErrorCode } from "@spleen/api";
import { LIST_DESCRIPTION_MAX, LIST_TITLE_MAX } from "@spleen/validators";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";

import { createListAction, deleteListAction, updateListAction } from "@/app/[locale]/list/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormMessage, TextArea, TextField } from "@/components/ui/Field";
import { useNavigate } from "@/i18n/navigation";
import { scheduleDelete } from "@/lib/use-undoable-delete";

type ErrorCode = ApiErrorCode | "unknown";

/** Creates a list (then opens it) or edits one in place. */
export function ListForm({
  list,
}: {
  list?: { id: string; title: string; description: string; ranked: boolean };
}) {
  const t = useTranslations("list");
  const te = useTranslations("errors");
  const router = useNavigate();
  const [title, setTitle] = useState(list?.title ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [ranked, setRanked] = useState(list?.ranked ?? false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorCode | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      setSaved(false);
      const fields = { title, description, ranked };
      if (list) {
        const result = await updateListAction({ id: list.id, ...fields });
        if (result.ok) {
          setError(null);
          setSaved(true);
        } else setError(result.error ?? "unknown");
        return;
      }
      const result = await createListAction(fields);
      if (result.data) router.push(`/list/${result.data.id}/edit`);
      else setError(result.error ?? "unknown");
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <TextField
        label={t("titleLabel")}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={LIST_TITLE_MAX}
        required
      />
      <TextArea
        label={t("descriptionLabel")}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={LIST_DESCRIPTION_MAX}
        hint={t("descriptionHint", { count: LIST_DESCRIPTION_MAX - description.length })}
        rows={4}
      />
      <Checkbox
        label={t("rankedLabel")}
        hint={t("rankedHint")}
        checked={ranked}
        onChange={(event) => setRanked(event.target.checked)}
      />
      {error && <FormMessage tone="error">{te(error)}</FormMessage>}
      {saved && <FormMessage tone="success">{t("saved")}</FormMessage>}
      <Button type="submit" disabled={pending || title.trim() === ""}>
        {pending ? t("saving") : list ? t("save") : t("createSubmit")}
      </Button>
    </form>
  );
}

/**
 * "Delete list": back to the owner's lists at once, the list hidden there, with "Undo" for a few
 * seconds before anything is sent (`lib/use-undoable-delete.ts`).
 */
export function DeleteListButton({
  list,
  ownerUsername,
}: {
  list: { id: string; title: string };
  ownerUsername: string;
}) {
  const t = useTranslations("list");
  const router = useNavigate();
  return (
    <Button
      variant="ghost"
      onClick={(event) => {
        scheduleDelete({
          id: list.id,
          kind: "list",
          label: list.title,
          // `detail` is 0 for a click made with the keyboard.
          focusUndo: event.detail === 0,
          run: () => deleteListAction(list.id),
        });
        router.push(`/u/${ownerUsername}?tab=lists`);
      }}
    >
      {t("delete")}
    </Button>
  );
}
