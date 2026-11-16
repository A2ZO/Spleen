"use client";

import type { MyItemState } from "@spleen/api";
import { useTranslations } from "next-intl";

import { wantToListenAction } from "@/app/[locale]/listening/actions";
import { useListen } from "@/components/release/use-listen";
import { buttonClasses } from "@/components/ui/Button";
import { ClockIcon } from "@/components/ui/icons";
import { ReactionStatus } from "@/components/ui/ReactionStatus";

/**
 * « À écouter » on an upcoming release, outside its page: the same instant store as the
 * album page (`useListen`, same key), started from the only field this row knows. Rating,
 * heart and listens are not shown here, and a record not out yet takes none of them.
 */
export function WantToListenButton({
  releaseId,
  title,
  wantToListen,
}: {
  releaseId: string;
  /** Release title, for the accessible label. */
  title: string;
  wantToListen: boolean;
}) {
  const t = useTranslations("album.actions");
  const target = { kind: "release", id: releaseId } as const;
  const initial: MyItemState = {
    rating: null,
    liked: false,
    listened: false,
    wantToListen,
    entries: [],
    today: "",
    quickFallback: { rating: null, listened: false },
    releaseNotOut: true,
  };
  const listen = useListen(target, initial);
  const shown = listen.shown.wantToListen;
  const toggle = () => {
    const next = !shown;
    listen.write(
      { kind: "wantToListen", wantToListen: next },
      { slot: "wantToListen", run: () => wantToListenAction(target, next) },
    );
  };
  return (
    <div className="shrink-0">
      <button
        type="button"
        aria-pressed={shown}
        aria-label={`${t("wantToListen")} · ${title}`}
        onClick={toggle}
        className={buttonClasses(
          "secondary",
          "aria-pressed:border-accent aria-pressed:text-accent max-sm:size-11 max-sm:px-0",
          "sm",
        )}
      >
        <ClockIcon className="text-lg" />
        <span className="max-sm:sr-only" aria-hidden="true">
          {t("wantToListen")}
        </span>
      </button>
      <ReactionStatus error={listen.error} className="max-w-40 text-right" />
    </div>
  );
}
