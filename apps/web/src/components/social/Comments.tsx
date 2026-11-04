"use client";

import type { ApiErrorCode, CommentView } from "@spleen/api";
import { COMMENT_BODY_MAX, type SocialSubjectInput } from "@spleen/validators";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";

import {
  createCommentAction,
  deleteCommentAction,
  updateCommentAction,
} from "@/app/[locale]/social/actions";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextArea } from "@/components/ui/Field";
import { Link } from "@/i18n/navigation";

import { ModerationBanner } from "./ModerationBanner";
import { ReportButton } from "./ReportDialog";

type ErrorCode = ApiErrorCode | "unknown";

/** Writes a comment; the page refreshes to show it in the thread. */
export function CommentForm({ subject }: { subject: SocialSubjectInput }) {
  const t = useTranslations("comments");
  const te = useTranslations("errors");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorCode | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await createCommentAction({ subject, body });
      if (result.ok) {
        setBody("");
        setError(null);
      } else setError(result.error ?? "unknown");
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <TextArea
        label={t("label")}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={COMMENT_BODY_MAX}
        hint={t("remaining", { count: COMMENT_BODY_MAX - body.length })}
        rows={3}
        required
      />
      {error && <FormMessage tone="error">{te(error)}</FormMessage>}
      <Button type="submit" disabled={pending || body.trim() === ""}>
        {pending ? t("sending") : t("send")}
      </Button>
    </form>
  );
}

/** One comment, with edit / delete (asked twice, no browser dialog) / report. */
export function CommentItem({
  comment,
  canReport,
}: {
  comment: CommentView;
  /** Signed in and not the author. */
  canReport: boolean;
}) {
  const t = useTranslations("comments");
  const te = useTranslations("errors");
  const format = useFormatter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorCode | null>(null);

  const finish = (result: { ok?: boolean; error?: ErrorCode }) => {
    if (result.ok) {
      setEditing(false);
      setConfirmDelete(false);
      setError(null);
    } else setError(result.error ?? "unknown");
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => finish(await updateCommentAction({ id: comment.id, body })));
  };

  return (
    <article className="flex gap-3">
      <Link href={`/u/${comment.author.username}`} tabIndex={-1} className="shrink-0">
        <Avatar
          name={comment.author.displayName}
          seed={comment.author.username}
          src={comment.author.avatarUrl}
          className="size-8 text-xs"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <Link href={`/u/${comment.author.username}`} className="font-medium hover:text-star">
            {comment.author.displayName}
          </Link>
          <time dateTime={comment.createdAt} className="font-mono text-xs text-fg-muted">
            {format.dateTime(new Date(comment.createdAt), { dateStyle: "medium" })}
          </time>
          {comment.edited && <span className="text-xs text-fg-muted italic">{t("edited")}</span>}
        </p>
        {editing ? (
          <form onSubmit={save} className="mt-2 space-y-2">
            <TextArea
              label={t("editLabel")}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={COMMENT_BODY_MAX}
              rows={3}
              required
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={pending || body.trim() === ""}>
                {t("save")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setBody(comment.body);
                }}
              >
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-1 leading-relaxed break-words whitespace-pre-line text-pretty">
            {comment.body}
          </p>
        )}
        {comment.hidden && (
          <ModerationBanner hold={comment.hidden} subject="comment" className="mt-2" />
        )}
        {error && <FormMessage tone="error">{te(error)}</FormMessage>}
        {!editing && (
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
            {comment.canEdit && (
              <button
                type="button"
                className="text-fg-muted hover:text-fg"
                onClick={() => setEditing(true)}
              >
                {t("edit")}
              </button>
            )}
            {comment.canDelete &&
              (confirmDelete ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-fg-muted">{t("deleteConfirm")}</span>
                  <button
                    type="button"
                    disabled={pending}
                    className="text-danger hover:underline"
                    onClick={() =>
                      startTransition(async () => finish(await deleteCommentAction(comment.id)))
                    }
                  >
                    {t("deleteYes")}
                  </button>
                  <button
                    type="button"
                    className="text-fg-muted hover:text-fg"
                    onClick={() => setConfirmDelete(false)}
                  >
                    {t("deleteNo")}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="text-fg-muted hover:text-fg"
                  onClick={() => setConfirmDelete(true)}
                >
                  {t("delete")}
                </button>
              ))}
            {canReport && !comment.canEdit && !comment.hidden && (
              <ReportButton subject={{ kind: "comment", id: comment.id }} />
            )}
          </div>
        )}
      </div>
    </article>
  );
}
