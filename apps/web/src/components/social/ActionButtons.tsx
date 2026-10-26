"use client";

import type { ApiErrorCode } from "@spleen/api";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { markAllReadAction, setBlockAction } from "@/app/[locale]/social/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";

/** A button running one action (which refreshes the page), or showing its error. */
function ActionButton({
  run,
  label,
  variant = "outline",
}: {
  run: () => Promise<{ ok?: boolean; error?: ApiErrorCode | "unknown" }>;
  label: string;
  variant?: "outline" | "ghost";
}) {
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ApiErrorCode | "unknown" | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant={variant}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await run();
            if (!result.ok) setError(result.error ?? "unknown");
          })
        }
      >
        {label}
      </Button>
      {error && <FormMessage tone="error">{te(error)}</FormMessage>}
    </span>
  );
}

export function MarkAllReadButton() {
  const t = useTranslations("notifications");
  return <ActionButton run={markAllReadAction} label={t("markAllRead")} />;
}

export function UnblockButton({ username, name }: { username: string; name: string }) {
  const t = useTranslations("blocks");
  return (
    <ActionButton
      run={() => setBlockAction(username, false)}
      label={t("unblock", { name })}
      variant="ghost"
    />
  );
}
