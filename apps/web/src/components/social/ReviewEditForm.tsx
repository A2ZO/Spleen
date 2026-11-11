"use client";

import type { ApiErrorCode } from "@spleen/api";
import { REVIEW_BODY_MAX, type AudienceLang, type ListenTargetInput } from "@spleen/validators";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";

import { deleteReviewAction, updateReviewAction } from "@/app/[locale]/review/actions";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormMessage, SelectField, TextArea } from "@/components/ui/Field";
import { useNavigate } from "@/i18n/navigation";
import { scheduleDelete, scopeOf } from "@/lib/use-undoable-delete";

/**
 * Edits a review's text and language, or deletes it: back to the member's reviews at once, with
 * "Undo" for a few seconds before anything is sent (`lib/use-undoable-delete.ts`).
 */
export function ReviewEditForm({
  review,
  backHref,
}: {
  review: { id: string; body: string; lang: AudienceLang; target: ListenTargetInput };
  /** Where to go after saving or deleting (the member's reviews). */
  backHref: string;
}) {
  const t = useTranslations("reviewEdit");
  const tl = useTranslations("locale");
  const te = useTranslations("errors");
  const router = useNavigate();
  const [body, setBody] = useState(review.body);
  const [lang, setLang] = useState<AudienceLang>(review.lang);
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
        <Button
          variant="ghost"
          className="ml-auto"
          disabled={pending}
          onClick={(event) => {
            scheduleDelete({
              id: review.id,
              kind: "review",
              scope: scopeOf(review.target),
              // `detail` is 0 for a click made with the keyboard.
              focusUndo: event.detail === 0,
              run: () => deleteReviewAction(review.id),
            });
            router.push(backHref);
          }}
        >
          {t("delete")}
        </Button>
      </div>
    </form>
  );
}
