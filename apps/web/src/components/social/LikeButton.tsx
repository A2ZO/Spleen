"use client";

import type { SocialSubjectInput } from "@spleen/validators";
import { useTranslations } from "next-intl";

import { setLikeAction } from "@/app/[locale]/social/actions";
import { HeartIcon } from "@/components/ui/icons";
import { ReactionStatus } from "@/components/ui/ReactionStatus";
import { cn } from "@/lib/cn";
import { useInstantWrites } from "@/lib/use-instant-writes";

const set = (_: boolean, liked: boolean) => liked;
const same = (liked: boolean, write: boolean) => liked === write;

/** "I like" on a review (or a list): shown at once, rapid clicks grouped (`useInstantWrites`). */
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
  const like = useInstantWrites({
    key: `like:${subject.kind}:${subject.id}`,
    props: liked,
    apply: set,
    same,
  });
  // The server's count, moved by the difference between what is shown and what it knows.
  const shownCount = count + Number(like.shown) - Number(liked);

  const toggle = () => {
    const next = !like.shown;
    like.write(next, {
      slot: "liked",
      run: async () => {
        const result = await setLikeAction({ subject, liked: next });
        return { state: result.data?.liked, error: result.error };
      },
    });
  };

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        aria-pressed={like.shown}
        onClick={toggle}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
          like.shown
            ? "border-accent text-fg"
            : "border-border text-fg-muted hover:border-accent hover:text-fg",
        )}
      >
        <HeartIcon filled={like.shown} className={like.shown ? "text-accent" : undefined} />
        {t("social.like")}
        <span aria-hidden="true" className="font-mono text-xs tabular">
          · {shownCount}
        </span>
        <span className="sr-only">({t("review.likes", { count: shownCount })})</span>
      </button>
      <ReactionStatus error={like.error} />
    </span>
  );
}
