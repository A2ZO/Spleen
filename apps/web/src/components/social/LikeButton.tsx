"use client";

import type { ApiErrorCode } from "@spleen/api";
import type { SocialSubjectInput } from "@spleen/validators";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { setLikeAction } from "@/app/[locale]/social/actions";
import { FormMessage } from "@/components/ui/Field";
import { HeartIcon } from "@/components/ui/icons";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** "I like" on a review (or a list): optimistic, the server's count wins. */
export function LikeButton({
  subject,
  liked,
  count,
}: {
  subject: SocialSubjectInput;
  liked: boolean;
  count: number;
}) {
  const t = useTranslations();
  const te = useTranslations("errors");
  const router = useRouter();
  const [state, setState] = useState({ liked, count });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ApiErrorCode | "unknown" | null>(null);

  const toggle = () =>
    startTransition(async () => {
      const previous = state;
      const next = !state.liked;
      setState({ liked: next, count: state.count + (next ? 1 : -1) });
      setError(null);
      const result = await setLikeAction({ subject, liked: next });
      if (result.data) {
        setState({ liked: result.data.liked, count: result.data.likeCount });
        router.refresh();
      } else {
        setState(previous);
        setError(result.error ?? "unknown");
      }
    });

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        aria-pressed={state.liked}
        disabled={pending}
        onClick={toggle}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-60",
          state.liked
            ? "border-accent bg-accent/15 text-fg"
            : "border-border text-fg-muted hover:border-star hover:text-star",
        )}
      >
        <HeartIcon filled={state.liked} className={state.liked ? "text-star" : undefined} />
        {t("social.like")}
        <span aria-hidden="true" className="font-mono text-xs tabular">
          · {state.count}
        </span>
        <span className="sr-only">({t("review.likes", { count: state.count })})</span>
      </button>
      {error && <FormMessage tone="error">{te(error)}</FormMessage>}
    </span>
  );
}
