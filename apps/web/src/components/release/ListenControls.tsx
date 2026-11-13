"use client";

import type { MoodRef, MyItemState } from "@spleen/api";
import type { ListenTargetInput } from "@spleen/validators";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";

import {
  markListenedAction,
  quickLikeAction,
  quickRateAction,
  wantToListenAction,
} from "@/app/[locale]/listening/actions";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckIcon, ClockIcon, HeartIcon } from "@/components/ui/icons";
import { ReactionStatus } from "@/components/ui/ReactionStatus";
import { StarRating } from "@/components/ui/StarRating";
import { Stars } from "@/components/ui/Stars";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { digitOf, shortcutAllowed } from "@/lib/keyboard-shortcuts";
import { flushScope, scopeOf } from "@/lib/use-undoable-delete";

import type { LogTrack } from "./LogDialog";
import { useListen, useLogEditor } from "./use-listen";

export interface ListenControlsProps {
  target: ListenTargetInput;
  title: string;
  /** Null when signed out (the card then invites to sign in). */
  initial: MyItemState | null;
  moods: MoodRef[];
  /** Album tracklist, for track-by-track ratings (empty for a track page). */
  tracks: LogTrack[];
  /** More buttons on the main row ("Add to a list"). */
  actions?: ReactNode;
  /** More quiet buttons on the second row (the Shelf). */
  extra?: ReactNode;
}

const label = "font-mono text-xs tracking-[0.06em] text-fg-muted uppercase";
/** Secondary buttons of the card: 52 px, round and icon-only on phones. */
const roundOnPhones = "md:min-h-13 max-md:size-13 max-md:px-0";
const pressed = "aria-pressed:border-accent aria-pressed:text-accent";

/**
 * "Your rating" card: quick rating, one-click listen, heart, "to listen" queue, and the full
 * "log" form. Every quick write is shown at once (`applyListenWrite`, the server's rules) and
 * goes through one queue (`useInstantWrites`): grouped, one request at a time, rolled back with
 * a message on failure. Quick ratings keep their number (`order`), so the server still drops an
 * older one arriving late. The member's listens are in `MyListensCard`, sharing this state.
 *
 * Keyboard shortcuts for the page's subject (never the tracklist): 1..5 rate in whole stars
 * (key position, `event.code`, so AZERTY works with or without Shift), 0 clears the rating,
 * L toggles the heart. Same writes as the mouse; the result is announced in the live region.
 */
export function ListenControls(props: ListenControlsProps) {
  if (!props.initial) return <SignedOut />;
  return <Panel {...props} initial={props.initial} />;
}

/** Same card for visitors: the empty stars and the main button lead to the sign-in page. */
function SignedOut() {
  const t = useTranslations();
  return (
    <Card className="flex flex-wrap items-end gap-x-8 gap-y-4">
      <div className="max-md:w-full">
        <p className={label}>{t("listening.rating")}</p>
        <Link
          href="/sign-in"
          className="mt-1 inline-flex rounded-lg py-1 text-[44px] leading-none [&_svg]:px-[0.1em]"
        >
          <Stars rating={null} />
          <span className="sr-only">{t("detail.signInToRate")}</span>
        </Link>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-fg-muted">{t("album.actions.signIn")}</p>
        <Link href="/sign-in" className={buttonClasses("primary", "max-md:w-full")}>
          {t("album.actions.signInLink")}
        </Link>
      </div>
    </Card>
  );
}

function Panel({
  target,
  title,
  initial,
  moods,
  tracks,
  actions,
  extra,
}: ListenControlsProps & { initial: MyItemState }) {
  const t = useTranslations("album.actions");
  const tl = useTranslations("listening");
  const ts = useTranslations("shortcuts");
  const rateOrder = useRef({ clientId: "", seq: 0 });
  const listen = useListen(target, initial);
  const shown = listen.shown;
  const log = useLogEditor({ target, title, moods, tracks, listen });
  // Listens deleted with "Undo" wait in their scope; every write of this record first sends a
  // deletion still waiting (`flushScope`), or that late deletion would erase it.
  const scope = scopeOf(target);
  // What the last keyboard shortcut did, for screen readers; cleared by a pointer write.
  const [announce, setAnnounce] = useState<string | null>(null);

  const after =
    <R,>(action: () => Promise<R>) =>
    async () => {
      await flushScope(scope);
      return action();
    };

  const rate = (rating: number | null, said: string | null = null) => {
    setAnnounce(said);
    listen.write(
      { kind: "rating", rating },
      {
        slot: "rating",
        run: async () => {
          await flushScope(scope);
          // Numbered when it leaves: the server keeps the highest number of this page.
          const order = rateOrder.current;
          order.clientId ||= crypto.randomUUID();
          return quickRateAction(target, rating, { clientId: order.clientId, seq: ++order.seq });
        },
      },
    );
  };
  const like = (keyboard = false) => {
    const liked = !shown.liked;
    setAnnounce(keyboard ? ts(liked ? "liked" : "unliked") : null);
    listen.write(
      { kind: "liked", liked },
      { slot: "liked", run: after(() => quickLikeAction(target, liked)) },
    );
  };
  const queue = () => {
    const wantToListen = !shown.wantToListen;
    listen.write(
      { kind: "wantToListen", wantToListen },
      { slot: "wantToListen", run: after(() => wantToListenAction(target, wantToListen)) },
    );
  };
  // An effect event: it reads the latest `shown` without re-adding the listener.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (!shortcutAllowed(event)) return;
    const digit = digitOf(event.code);
    if (digit !== null) {
      event.preventDefault();
      if (digit === 0) rate(null, ts("unrated"));
      else rate(digit * 2, ts("rated", { stars: String(digit) }));
    } else if (event.key.toLowerCase() === "l") {
      event.preventDefault();
      like(true);
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  // Every click creates a listen: never merged, and locked while its request runs.
  const listening = listen.isPending("listened");
  const markListened = () =>
    listen.write(
      { kind: "listened" },
      { slot: "listened", now: true, run: after(() => markListenedAction(target)) },
    );

  return (
    <Card role="region" aria-labelledby="listen-title">
      <h2 id="listen-title" className="sr-only">
        {t("title")}
      </h2>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="max-md:w-full">
          <p aria-hidden="true" className={label}>
            {tl("rating")}
          </p>
          <StarRating
            size="lg"
            value={shown.rating}
            onChange={(rating) => rate(rating)}
            className="mt-1"
          />
        </div>
        <div className="flex min-w-0 flex-wrap gap-2.5 max-md:w-full">
          <button
            type="button"
            aria-pressed={shown.listened}
            disabled={listening}
            onClick={markListened}
            className={buttonClasses("primary", "max-md:flex-1")}
          >
            {shown.listened && <CheckIcon />}
            {shown.listened ? t("listenedDone") : t("listened")}
          </button>
          <button
            type="button"
            aria-pressed={shown.liked}
            onClick={() => like()}
            className={buttonClasses("secondary", cn("text-[22px]", pressed), "icon-lg")}
          >
            <HeartIcon filled={shown.liked} />
            <span className="sr-only">{t("like")}</span>
          </button>
          <button
            type="button"
            aria-pressed={shown.wantToListen}
            onClick={queue}
            className={buttonClasses("secondary", cn(roundOnPhones, pressed))}
          >
            <ClockIcon className="text-[22px] md:text-lg" />
            <span className="max-md:sr-only">{t("wantToListen")}</span>
          </button>
          {actions}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="button"
          disabled={log.opening}
          onClick={() => void log.openLog("new")}
          className={buttonClasses("ghost", undefined, "sm")}
        >
          {t("log")}
        </button>
        {extra}
      </div>

      <ReactionStatus error={listen.error} announce={announce} className="mt-3 text-center" />
      {log.dialog}
    </Card>
  );
}
