"use client";

import type { ApiErrorCode } from "@spleen/api";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { setBlockAction } from "@/app/[locale]/social/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { MoreIcon } from "@/components/ui/icons";

import { ReportButton } from "./ReportDialog";

const item = "block w-full rounded-sm px-3 py-2 text-left text-sm text-fg hover:bg-surface-raised";

/** "…" menu on someone's profile: block / unblock and report. */
export function MemberMenu({
  username,
  name,
  blocked,
}: {
  username: string;
  name: string;
  /** The viewer blocked this member. */
  blocked: boolean;
}) {
  const t = useTranslations("social");
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-border p-2 text-fg-muted hover:border-star hover:text-star"
      >
        <MoreIcon className="size-5" />
        <span className="sr-only">{t("memberMenu", { name })}</span>
      </button>
      {open && (
        <ul
          id={menuId}
          className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-border bg-surface p-1 shadow-card"
        >
          <li>
            <button
              type="button"
              className={item}
              onClick={() => {
                setOpen(false);
                setConfirm(true);
              }}
            >
              {blocked ? t("unblock") : t("block")}
            </button>
          </li>
          <li>
            <ReportButton subject={{ kind: "member", username }} variant="menu" />
          </li>
        </ul>
      )}
      {confirm && (
        <BlockDialog
          username={username}
          name={name}
          blocked={blocked}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

function BlockDialog({
  username,
  name,
  blocked,
  onClose,
}: {
  username: string;
  name: string;
  blocked: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("social");
  const te = useTranslations("errors");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ApiErrorCode | "unknown" | null>(null);

  // No cleanup: closing here would fire `close` when Strict Mode replays the effect.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  const confirm = () =>
    startTransition(async () => {
      const result = await setBlockAction(username, !blocked);
      if (result.ok) {
        ref.current?.close();
      } else setError(result.error ?? "unknown");
    });

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
      <div className="space-y-4 p-5 sm:p-6">
        <h2 id={titleId} className="text-2xl font-semibold text-balance">
          {blocked ? t("unblockTitle", { name }) : t("blockTitle", { name })}
        </h2>
        <p className="text-fg-muted text-pretty">
          {blocked ? t("unblockBody", { name }) : t("blockBody", { name })}
        </p>
        {error && <FormMessage tone="error">{te(error)}</FormMessage>}
        <div className="flex flex-wrap gap-3">
          <Button disabled={pending} onClick={confirm}>
            {blocked ? t("unblock") : t("block")}
          </Button>
          <Button variant="ghost" onClick={() => ref.current?.close()}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
