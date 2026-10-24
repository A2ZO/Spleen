import type { MemberCard } from "@spleen/api";
import { useTranslations } from "next-intl";

import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";

import { FollowButton } from "./FollowButton";

/** A member in a list (followers, following, suggestions), with a follow button. */
export function MemberRow({ member, signedIn }: { member: MemberCard; signedIn: boolean }) {
  const t = useTranslations("social");
  return (
    <div className="flex items-center gap-3 py-3">
      <Link href={`/u/${member.username}`} tabIndex={-1} className="shrink-0">
        <Avatar
          name={member.displayName}
          seed={member.username}
          src={member.avatarUrl}
          className="size-11"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${member.username}`} className="font-medium hover:text-star">
          {member.displayName}
        </Link>
        <p className="font-mono text-xs text-fg-muted">@{member.username}</p>
        {member.bio && <p className="mt-1 truncate text-sm text-fg-muted">{member.bio}</p>}
      </div>
      {member.isViewer ? (
        <span className="text-xs text-fg-muted italic">{t("you")}</span>
      ) : signedIn ? (
        <FollowButton
          username={member.username}
          name={member.displayName}
          following={member.viewerFollows}
          className="px-3 py-1.5"
        />
      ) : (
        <Link href="/sign-in" className={buttonClasses("outline", "px-3 py-1.5")}>
          {t("follow")}
          <span className="sr-only"> {member.displayName}</span>
        </Link>
      )}
    </div>
  );
}
