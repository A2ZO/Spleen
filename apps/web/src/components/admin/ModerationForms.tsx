"use client";

import type { ReportView } from "@spleen/api";
import type { CatalogKind } from "@spleen/validators";
import { MODERATION_REASON_MAX, MODERATION_REASON_MIN } from "@spleen/validators";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";

import {
  decideReportAction,
  mergeCatalogAction,
  restoreContentAction,
  suspendMemberAction,
  unsuspendMemberAction,
  type ModerationResult,
} from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextArea, TextField } from "@/components/ui/Field";

type Decision = ReportView["decisions"][number];

/** A reason (always required: kept in the history, sent to the member) and a submit button. */
function ReasonForm({
  submitLabel,
  reasonLabel,
  reasonHint,
  send,
  children,
  danger = false,
}: {
  submitLabel: string;
  reasonLabel: string;
  /** Replaces the default hint (the reason is sent to the member concerned). */
  reasonHint?: string;
  send: (reason: string) => Promise<ModerationResult>;
  children?: ReactNode;
  danger?: boolean;
}) {
  const t = useTranslations("admin");
  const te = useTranslations("errors");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ModerationResult | null>(null);
  const [pending, startTransition] = useTransition();
  const tooShort = reason.trim().length < MODERATION_REASON_MIN;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (tooShort) return;
    startTransition(async () => {
      const outcome = await send(reason.trim());
      setResult(outcome);
      if (outcome.ok) setReason("");
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {children}
      <TextArea
        label={reasonLabel}
        hint={reasonHint ?? t("reasonHint")}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={MODERATION_REASON_MAX}
        required
        rows={2}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant={danger ? "primary" : "outline"}
          disabled={pending || tooShort}
        >
          {submitLabel}
        </Button>
        <span role="status" className="text-sm">
          {result?.ok &&
            (result.emailSent === false ? (
              <FormMessage tone="error">{t("doneEmailFailed")}</FormMessage>
            ) : (
              <FormMessage tone="success">{t("done")}</FormMessage>
            ))}
          {result?.error && <FormMessage tone="error">{te(result.error)}</FormMessage>}
        </span>
      </div>
    </form>
  );
}

/** Decisions on an open report: one choice, one reason. */
export function DecisionForm({ reportId, decisions }: { reportId: string; decisions: Decision[] }) {
  const t = useTranslations("admin");
  const name = useId();
  const [decision, setDecision] = useState<Decision>(decisions[0]!);
  return (
    <ReasonForm
      reasonLabel={t("reasonLabel")}
      submitLabel={t(`decisionSubmit.${decision}`)}
      danger={decision === "delete" || decision === "suspend"}
      send={(reason) => decideReportAction({ reportId, decision, reason })}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("decisionLabel")}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {decisions.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={name}
                value={value}
                checked={decision === value}
                onChange={() => setDecision(value)}
                className="accent-accent"
              />
              {t(`decision.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>
    </ReasonForm>
  );
}

/** Suspends a member by @username (no report needed). */
export function SuspendForm() {
  const t = useTranslations("admin");
  const [username, setUsername] = useState("");
  return (
    <ReasonForm
      reasonLabel={t("reasonLabel")}
      submitLabel={t("suspendSubmit")}
      danger
      send={(reason) =>
        suspendMemberAction({ username: username.trim().replace(/^@/, ""), reason })
      }
    >
      <TextField
        label={t("usernameLabel")}
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        required
      />
    </ReasonForm>
  );
}

/** Lifts a member's suspension. */
export function UnsuspendForm({ username }: { username: string }) {
  const t = useTranslations("admin");
  return (
    <ReasonForm
      reasonLabel={t("unsuspendReasonLabel")}
      submitLabel={t("unsuspendSubmit")}
      send={(reason) => unsuspendMemberAction({ username, reason })}
    />
  );
}

/** Shows again content hidden by a decision. */
export function RestoreForm({
  subject,
}: {
  subject: { kind: "review" | "list" | "comment"; id: string };
}) {
  const t = useTranslations("admin");
  return (
    <ReasonForm
      reasonLabel={t("restoreReasonLabel")}
      submitLabel={t("restoreSubmit")}
      send={(reason) => restoreContentAction({ subject, reason })}
    />
  );
}

/** Confirms a duplicate merge checked on the merge page. */
export function MergeForm({
  merge,
}: {
  merge: { kind: CatalogKind; keep: string; duplicate: string; reportId?: string };
}) {
  const t = useTranslations("admin.merge");
  return (
    <ReasonForm
      reasonLabel={t("reasonLabel")}
      reasonHint={t("reasonHint")}
      submitLabel={t("submit")}
      danger
      send={(reason) => mergeCatalogAction({ ...merge, reason })}
    />
  );
}
