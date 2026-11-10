"use client";

import type { ApiErrorCode } from "@spleen/api";
import { LIST_DESCRIPTION_MAX, LIST_TITLE_MAX } from "@spleen/validators";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";

import { createListAction, deleteListAction, updateListAction } from "@/app/[locale]/list/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormMessage, TextArea, TextField } from "@/components/ui/Field";
import { useNavigate } from "@/i18n/navigation";

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

/** "Delete list" with a confirmation dialog; goes back to the owner's profile. */
export function DeleteListButton({
  list,
  ownerUsername,
}: {
  list: { id: string; title: string };
  ownerUsername: string;
}) {
  const t = useTranslations("list");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {t("delete")}
      </Button>
      {open && (
        <DeleteListDialog
          list={list}
          ownerUsername={ownerUsername}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DeleteListDialog({
  list,
  ownerUsername,
  onClose,
}: {
  list: { id: string; title: string };
  ownerUsername: string;
  onClose: () => void;
}) {
  const t = useTranslations("list");
  const te = useTranslations("errors");
  const router = useNavigate();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorCode | null>(null);

  // No cleanup: closing here would fire `close` when Strict Mode replays the effect.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  const confirm = () =>
    startTransition(async () => {
      const result = await deleteListAction(list.id);
      if (result.ok) router.push(`/u/${ownerUsername}?tab=lists`);
      else setError(result.error ?? "unknown");
    });

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-md border border-border bg-bg p-0 text-fg shadow-card backdrop:bg-bg/80"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <h2 id={titleId} className="text-xl font-semibold text-balance">
          {t("deleteConfirm", { title: list.title })}
        </h2>
        {error && <FormMessage tone="error">{te(error)}</FormMessage>}
        <div className="flex flex-wrap gap-3">
          <Button onClick={confirm} disabled={pending}>
            {t("deleteConfirmButton")}
          </Button>
          <Button variant="ghost" onClick={() => ref.current?.close()}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
