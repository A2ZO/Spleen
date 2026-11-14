"use client";

import type { ApiErrorCode } from "@spleen/api";
import {
  catalogReportTypes,
  REPORT_DETAILS_MAX,
  type CatalogKind,
  type CatalogReportType,
} from "@spleen/validators";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { catalogReportAction } from "@/app/[locale]/social/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextArea, TextField } from "@/components/ui/Field";
import { FlagIcon } from "@/components/ui/icons";

const EXAMPLES: Record<CatalogKind, string> = {
  release: "/album/kind-of-blue",
  track: "/track/so-what",
  artist: "/artist/miles-davis",
};

/** "Report an error / suggest an addition" on an album, track or artist page (members). */
export function CatalogReportButton({
  target,
  className = "flex items-center gap-2 text-xs text-fg-muted hover:text-fg",
}: {
  target: { kind: CatalogKind; id: string };
  className?: string;
}) {
  const t = useTranslations("catalogReport");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={className}
      >
        <FlagIcon /> {t("button")}
      </button>
      {/* In `document.body`: it outlives a menu that hides its button. */}
      {open &&
        createPortal(
          <CatalogReportDialog target={target} onClose={() => setOpen(false)} />,
          document.body,
        )}
    </>
  );
}

function CatalogReportDialog({
  target,
  onClose,
}: {
  target: { kind: CatalogKind; id: string };
  onClose: () => void;
}) {
  const t = useTranslations("catalogReport");
  const te = useTranslations("errors");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [type, setType] = useState<CatalogReportType | null>(null);
  const [duplicate, setDuplicate] = useState("");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ApiErrorCode | "unknown" | null>(null);

  // No cleanup: closing here would fire `close` when Strict Mode replays the effect.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  const incomplete = !type || (type === "duplicate" && duplicate.trim() === "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (incomplete) return;
    startTransition(async () => {
      const result = await catalogReportAction({
        target,
        type,
        details,
        duplicate: type === "duplicate" ? duplicate : undefined,
      });
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
          {t("title")}
        </h2>
        {sent ? (
          <>
            <FormMessage tone="success">{t("thanks")}</FormMessage>
            <Button variant="secondary" onClick={() => ref.current?.close()}>
              {t("close")}
            </Button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{t("typeLegend")}</legend>
              {catalogReportTypes.map((value) => (
                <label key={value} className="flex items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="type"
                    value={value}
                    checked={type === value}
                    onChange={() => setType(value)}
                    className="size-4 accent-accent"
                    required
                  />
                  {t(`types.${value}`)}
                </label>
              ))}
            </fieldset>
            {type === "duplicate" && (
              <TextField
                label={t("duplicateLabel")}
                hint={t("duplicateHint", { example: EXAMPLES[target.kind] })}
                value={duplicate}
                onChange={(event) => setDuplicate(event.target.value)}
                maxLength={500}
                required
              />
            )}
            <TextArea
              label={t("details")}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={REPORT_DETAILS_MAX}
              rows={3}
            />
            {error && <FormMessage tone="error">{te(error)}</FormMessage>}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={pending || incomplete}>
                {t("send")}
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
