"use client";

import { useTranslations } from "next-intl";
import { useActionState, type FormEvent } from "react";

import {
  artistFollowFormAction,
  setArtistFollowAction,
  type ArtistFollowResult,
} from "@/app/[locale]/artist/actions";
import { Button } from "@/components/ui/Button";
import { ReactionStatus } from "@/components/ui/ReactionStatus";
import { useInstantWrites } from "@/lib/use-instant-writes";

const set = (_: boolean, following: boolean) => following;
const same = (following: boolean, write: boolean) => following === write;

/**
 * Follow / unfollow an artist. A form so it works without JavaScript (the page re-renders);
 * with JavaScript the change shows at once and rapid clicks are grouped (`useInstantWrites`).
 * No `aria-pressed`: the label itself says the state (« Suivre » / « Ne plus suivre »).
 */
export function ArtistFollowButton({
  artistId,
  name,
  following,
  quiet = false,
  className,
}: {
  artistId: string;
  /** Artist name, for the accessible label. */
  name: string;
  following: boolean;
  /** Small secondary button in both states, for lists (the artist page keeps the primary). */
  quiet?: boolean;
  className?: string;
}) {
  const t = useTranslations("artist");
  // Without JavaScript the form posts to the action; its answer carries the error to show.
  const [posted, formAction] = useActionState<ArtistFollowResult, FormData>(
    artistFollowFormAction,
    {},
  );
  const follow = useInstantWrites({
    key: `artist-follow:${artistId}`,
    props: following,
    apply: set,
    same,
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = !follow.shown;
    follow.write(next, {
      slot: "following",
      run: async () => {
        const result = await setArtistFollowAction(artistId, next);
        return result.ok ? { state: next } : { error: result.error ?? "unknown" };
      },
    });
  };

  return (
    <form action={formAction} onSubmit={submit} className="inline-flex flex-col">
      <input type="hidden" name="artistId" value={artistId} />
      <input type="hidden" name="follow" value={String(!follow.shown)} />
      <Button
        type="submit"
        variant={follow.shown || quiet ? "secondary" : "primary"}
        size={quiet ? "sm" : undefined}
        className={className}
      >
        {follow.shown ? t("unfollow") : t("follow")}
        <span className="sr-only"> {name}</span>
      </Button>
      <ReactionStatus error={follow.error ?? posted.error ?? null} />
    </form>
  );
}
