"use client";

import { useTranslations } from "next-intl";

import { setFollowAction } from "@/app/[locale]/social/actions";
import { Button } from "@/components/ui/Button";
import { ReactionStatus } from "@/components/ui/ReactionStatus";
import { Link } from "@/i18n/navigation";
import { useInstantWrites } from "@/lib/use-instant-writes";

const set = (_: boolean, following: boolean) => following;
const same = (following: boolean, write: boolean) => following === write;

/** The viewer's follow of `username`, shared by every button and count of the page. */
function useFollow(username: string, following: boolean) {
  return useInstantWrites({ key: `follow:${username}`, props: following, apply: set, same });
}

/** Follow / unfollow a member: shown at once, rapid clicks grouped (`useInstantWrites`). */
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
  const follow = useFollow(username, following);

  const toggle = () => {
    const next = !follow.shown;
    follow.write(next, {
      slot: "following",
      run: async () => {
        const result = await setFollowAction(username, next);
        return result.ok ? { state: next } : { error: result.error ?? "unknown" };
      },
    });
  };

  return (
    <span className="inline-flex flex-col items-start">
      <Button
        variant={follow.shown ? "outline" : "primary"}
        aria-pressed={follow.shown}
        onClick={toggle}
        className={className}
      >
        {follow.shown ? t("unfollow") : t("follow")}
        <span className="sr-only"> {name}</span>
      </Button>
      <ReactionStatus error={follow.error} />
    </span>
  );
}

/** The follower count of a profile, moved at once by the viewer's follow button. */
export function FollowerCountLink({
  href,
  username,
  followerCount,
  viewerFollows,
  className,
}: {
  href: string;
  username: string;
  followerCount: number;
  viewerFollows: boolean;
  className?: string;
}) {
  const t = useTranslations("profile");
  const { shown } = useFollow(username, viewerFollows);
  return (
    <Link href={href} className={className}>
      {t("followers", { count: followerCount + Number(shown) - Number(viewerFollows) })}
    </Link>
  );
}
