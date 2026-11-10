"use client";

import type { MoodRef, MyEntry, MyItemState } from "@spleen/api";
import { applyListenWrite, type ListenWrite } from "@spleen/api/instant";
import type { ListenTargetInput } from "@spleen/validators";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import {
  deleteEntryAction,
  markListenedAction,
  quickLikeAction,
  quickRateAction,
  wantToListenAction,
} from "@/app/[locale]/listening/actions";
import { buttonClasses } from "@/components/ui/Button";
import { CheckIcon, ClockIcon, HeartIcon } from "@/components/ui/icons";
import { ReactionStatus } from "@/components/ui/ReactionStatus";
import { StarRating } from "@/components/ui/StarRating";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { useInstantWrites } from "@/lib/use-instant-writes";
import {
  flushScope,
  scheduleDelete,
  scopeBusy,
  scopeOf,
  useUndoHidden,
} from "@/lib/use-undoable-delete";

import { LogDialog, type LogTrack } from "./LogDialog";
import { MyListens } from "./MyListens";
import { Turntable } from "./Turntable";

export interface ListenControlsProps {
  target: ListenTargetInput;
  title: string;
  /** Null when signed out (the panel then invites to sign in). */
  initial: MyItemState | null;
  moods: MoodRef[];
  /** Album tracklist, for track-by-track ratings (empty for a track page). */
  tracks: LogTrack[];
}

/** A write that changes nothing on the shown state is dropped (double click: no request). */
function same(state: MyItemState, write: ListenWrite) {
  switch (write.kind) {
    case "rating":
      return state.rating === write.rating;
    case "liked":
      return state.liked === write.liked;
    case "wantToListen":
      return state.wantToListen === write.wantToListen;
    case "listened":
      return false;
  }
}

/**
 * "I listened" panel: one-click listen, quick rating and heart (kept on the member's undated
 * listen), "to listen" queue, and the full "log" form. Every quick write is shown at once
 * (`applyListenWrite`, the server's rules) and goes through one queue (`useInstantWrites`):
 * grouped, one request at a time, rolled back with a message on failure. Quick ratings keep
 * their number (`order`), so the server still drops an older one arriving late.
 */
export function ListenControls({ target, title, initial, moods, tracks }: ListenControlsProps) {
  if (!initial) return <SignedOut />;
  return <Panel target={target} title={title} initial={initial} moods={moods} tracks={tracks} />;
}

function SignedOut() {
  const t = useTranslations("album.actions");
  return (
    <section className="rounded-md border border-border/60 bg-surface p-4 text-center shadow-card">
      <p className="font-serif text-lg">{t("signIn")}</p>
      <Link href="/sign-in" className={buttonClasses("primary", "mt-3")}>
        {t("signInLink")}
      </Link>
    </section>
  );
}

function Panel({
  target,
  title,
  initial,
  moods,
  tracks,
}: ListenControlsProps & { initial: MyItemState }) {
  const t = useTranslations("album.actions");
  const [editing, setEditing] = useState<MyEntry | "new" | null>(null);
  const rateOrder = useRef({ clientId: "", seq: 0 });
  const listen = useInstantWrites({
    key: `listen:${target.kind}:${target.id}`,
    props: initial,
    apply: applyListenWrite,
    same,
  });
  const shown = listen.shown;
  // Listens deleted with "Undo" are hidden at once; every write of this record first sends a
  // deletion still waiting (`flushScope`), or that late deletion would erase it.
  const scope = scopeOf(target);
  const hidden = useUndoHidden();
  const [opening, setOpening] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const after =
    <R,>(action: () => Promise<R>) =>
    async () => {
      await flushScope(scope);
      return action();
    };

  /** The "log" form starts from the state after a waiting deletion of this record. */
  const openLog = async (what: MyEntry | "new") => {
    if (scopeBusy(scope)) {
      setOpening(true);
      await flushScope(scope);
      setOpening(false);
    }
    setEditing(what);
  };

  const removeEntry = (entry: MyEntry, keyboard: boolean) => {
    setEditing(null);
    scheduleDelete({
      id: entry.id,
      kind: "entry",
      scope,
      focusUndo: keyboard,
      run: () => deleteEntryAction(target, entry.id),
      onDone: (result) => {
        if (mounted.current && result.state) listen.confirm(result.state);
      },
    });
  };

  const rate = (rating: number | null) =>
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
  const like = () => {
    const liked = !shown.liked;
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
  // Every click creates a listen: never merged, and locked while its request runs.
  const listening = listen.isPending("listened");
  const markListened = () =>
    listen.write(
      { kind: "listened" },
      { slot: "listened", now: true, run: after(() => markListenedAction(target)) },
    );

  const toggleClasses = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs transition-colors",
      active
        ? "border-star bg-star/10 text-star"
        : "border-border text-fg-muted hover:border-star/60 hover:text-fg",
    );

  return (
    <section
      aria-labelledby="listen-title"
      className="rounded-md border border-border/60 bg-surface p-4 shadow-card"
    >
      <h2 id="listen-title" className="sr-only">
        {t("title")}
      </h2>
      <div className="flex items-center gap-3">
        <Turntable playing={shown.listened} className="h-12 w-16 shrink-0" />
        <button
          type="button"
          aria-pressed={shown.listened}
          disabled={listening}
          onClick={markListened}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-3 font-medium transition-colors",
            shown.listened
              ? "border border-star text-star"
              : "bg-accent text-accent-fg shadow-card hover:bg-accent-hover",
          )}
        >
          {shown.listened && <CheckIcon />}
          {shown.listened ? t("listenedDone") : t("listened")}
        </button>
      </div>

      <div className="mt-4 flex justify-center">
        <StarRating value={shown.rating} onChange={rate} />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          aria-pressed={shown.liked}
          onClick={like}
          className={toggleClasses(shown.liked)}
        >
          <HeartIcon filled={shown.liked} className="text-lg" />
          {t("like")}
        </button>
        <button
          type="button"
          aria-pressed={shown.wantToListen}
          onClick={queue}
          className={toggleClasses(shown.wantToListen)}
        >
          <ClockIcon className="text-lg" />
          {t("wantToListen")}
        </button>
      </div>

      <button
        type="button"
        disabled={opening}
        onClick={() => void openLog("new")}
        className={buttonClasses("outline", "mt-4 w-full")}
      >
        {t("log")}
      </button>

      <ReactionStatus error={listen.error} className="mt-3 text-center empty:mt-0" />

      <MyListens
        entries={shown.entries.filter((entry) => !hidden(entry.id))}
        moods={moods}
        onEdit={(entry) => void openLog(entry)}
      />

      {editing && (
        <LogDialog
          target={target}
          title={title}
          entry={editing === "new" ? null : editing}
          state={shown}
          moods={moods}
          tracks={tracks}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            setEditing(null);
            listen.confirm(next);
          }}
          onDelete={removeEntry}
        />
      )}
    </section>
  );
}
