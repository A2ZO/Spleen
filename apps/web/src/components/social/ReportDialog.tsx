"use client";

import type { ApiErrorCode } from "@spleen/api";
import {
  memberReportReasons,
  REPORT_DETAILS_MAX,
  type MemberReportReason,
  type ReportCreateInput,
} from "@spleen/validators";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { reportAction } from "@/app/[locale]/social/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextArea } from "@/components/ui/Field";
import { FlagIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

type Subject = ReportCreateInput["subject"];

/** "Report" button opening a dialog: a reason from the list and optional details. */
export function ReportButton({
  subject,
  className,
  variant = "link",
}: {
  subject: Subject;
  className?: string;
  /** "link": small text button (comments, review); "menu": an item of a menu. */
  variant?: "link" | "menu";
}) {
  const t = useTranslations("social");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          variant === "link"
            ? "inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
            : "flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm text-fg hover:bg-surface-raised",
          className,
        )}
      >
        {variant === "link" && <FlagIcon />}
        {t(`reportTitle.${subject.kind}`)}
      </button>
      {/* In `document.body`: it outlives a menu that hides its button. */}
      {open &&
        createPortal(
          <ReportDialog subject={subject} onClose={() => setOpen(false)} />,
          document.body,
        )}
    </>
  );
}

function ReportDialog({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const t = useTranslations("social");
  const te = useTranslations("errors");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [reason, setReason] = useState<MemberReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ApiErrorCode | "unknown" | null>(null);

  // No cleanup: closing here would fire `close` when Strict Mode replays the effect.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!reason) return;
    startTransition(async () => {
      const result = await reportAction({ subject, reason, details });
      if (result.ok) setSent(true);
      else setError(result.error ?? "unknown");
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
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-card-sm border border-border bg-surface p-0 text-fg shadow-card backdrop:bg-bg/80 md:rounded-card"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <h2
          id={titleId}
          className="font-display text-2xl font-bold tracking-[-0.02em] text-balance"
        >
          {t(`reportTitle.${subject.kind}`)}
        </h2>
        {sent ? (
          <>
            <FormMessage tone="success">{t("reportThanks")}</FormMessage>
            <Button variant="secondary" onClick={() => ref.current?.close()}>
              {t("close")}
            </Button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{t("reportReason")}</legend>
              {memberReportReasons.map((value) => (
                <label key={value} className="flex items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="size-4 accent-accent"
                    required
                  />
                  {t(`reasons.${value}`)}
                </label>
              ))}
            </fieldset>
            <TextArea
              label={t("reportDetails")}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={REPORT_DETAILS_MAX}
              rows={3}
            />
            {error && <FormMessage tone="error">{te(error)}</FormMessage>}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={pending || !reason}>
                {t("reportSend")}
              </Button>
              <Button variant="ghost" onClick={() => ref.current?.close()}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
