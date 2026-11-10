"use client";

import type { ApiErrorCode } from "@spleen/api";
import { REVIEW_BODY_MAX, type AudienceLang } from "@spleen/validators";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";

import { deleteReviewAction, updateReviewAction } from "@/app/[locale]/review/actions";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormMessage, SelectField, TextArea } from "@/components/ui/Field";
import { useNavigate } from "@/i18n/navigation";

/** Edits a review's text and language, or deletes it (asked twice, no browser dialog). */
export function ReviewEditForm({
  review,
  backHref,
}: {
  review: { id: string; body: string; lang: AudienceLang };
  /** Where to go after saving or deleting (the member's reviews). */
  backHref: string;
}) {
  const t = useTranslations("reviewEdit");
  const tl = useTranslations("locale");
  const te = useTranslations("errors");
  const router = useNavigate();
  const [body, setBody] = useState(review.body);
  const [lang, setLang] = useState<AudienceLang>(review.lang);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ApiErrorCode | "unknown" | null>(null);

  const finish = (result: { ok?: boolean; error?: ApiErrorCode | "unknown" }) => {
    if (result.ok) {
      router.push(backHref);
      router.refresh();
    } else setError(result.error ?? "unknown");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => finish(await updateReviewAction({ id: review.id, body, lang })));
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <TextArea
        label={t("body")}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={REVIEW_BODY_MAX}
        required
        rows={10}
        lang={lang}
      />
      <SelectField
        label={t("lang")}
        value={lang}
        onChange={(event) => setLang(event.target.value as AudienceLang)}
      >
        <option value="fr">{tl("fr")}</option>
        <option value="en">{tl("en")}</option>
      </SelectField>
      {error && <FormMessage tone="error">{te(error)}</FormMessage>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || body.trim() === ""}>
          {pending ? t("saving") : t("save")}
        </Button>
        <ButtonLink href={backHref} variant="ghost">
          {t("cancel")}
        </ButtonLink>
        <span className="ml-auto">
          {confirmDelete ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-fg-muted">{t("deleteConfirm")}</span>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => finish(await deleteReviewAction(review.id)))
                }
              >
                {t("deleteYes")}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                {t("deleteNo")}
              </Button>
            </span>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              {t("delete")}
            </Button>
          )}
        </span>
      </div>
    </form>
  );
}
