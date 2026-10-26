"use client";

import type { ApiErrorCode } from "@spleen/api";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { setFollowAction } from "@/app/[locale]/social/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { useRouter } from "@/i18n/navigation";

/** Follow / unfollow a member; the counts on the page refresh afterwards. */
export function FollowButton({
  username,
  name,
  following,
  className,
}: {
  username: string;
  /** Display name, for the accessible label. */
  name: string;
  following: boolean;
  className?: string;
}) {
  const t = useTranslations("social");
  const te = useTranslations("errors");
  const router = useRouter();
  const [state, setState] = useState(following);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ApiErrorCode | "unknown" | null>(null);

  const toggle = () =>
    startTransition(async () => {
      const next = !state;
      setState(next);
      setError(null);
      const result = await setFollowAction(username, next);
      if (result.ok) router.refresh();
      else {
        setState(!next);
        setError(result.error ?? "unknown");
      }
    });

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant={state ? "outline" : "primary"}
        aria-pressed={state}
        disabled={pending}
        onClick={toggle}
        className={className}
      >
        {state ? t("unfollow") : t("follow")}
        <span className="sr-only"> {name}</span>
      </Button>
      {error && <FormMessage tone="error">{te(error)}</FormMessage>}
    </span>
  );
}
