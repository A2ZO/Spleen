"use client";

import type { MoodRef, MyEntry, MyItemState } from "@spleen/api";
import { applyListenWrite, type ListenWrite } from "@spleen/api/instant";
import type { ListenTargetInput } from "@spleen/validators";
import { useEffect, useRef, useState } from "react";

import { deleteEntryAction } from "@/app/[locale]/listening/actions";
import { useInstantWrites } from "@/lib/use-instant-writes";
import { flushScope, scheduleDelete, scopeBusy, scopeOf } from "@/lib/use-undoable-delete";

import { LogDialog, type LogTrack } from "./LogDialog";

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
 * The member's state on the page's subject, shared by every component that shows it (the
 * "Your rating" card and the "Your listens" card): one `useInstantWrites` store per subject.
 */
export function useListen(target: ListenTargetInput, initial: MyItemState) {
  return useInstantWrites({
    key: `listen:${target.kind}:${target.id}`,
    props: initial,
    apply: applyListenWrite,
    same,
  });
}

/**
 * The "log" form of the subject: a new listen or one to edit, opened from the state after a
 * deletion still waiting for "Undo" (`flushScope`); deleting from the form is undoable.
 */
export function useLogEditor({
  target,
  title,
  moods,
  tracks,
  listen,
}: {
  target: ListenTargetInput;
  title: string;
  moods: MoodRef[];
  tracks: LogTrack[];
  listen: ReturnType<typeof useListen>;
}) {
  const [editing, setEditing] = useState<MyEntry | "new" | null>(null);
  const [opening, setOpening] = useState(false);
  const scope = scopeOf(target);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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

  const dialog = editing && (
    <LogDialog
      target={target}
      title={title}
      entry={editing === "new" ? null : editing}
      state={listen.shown}
      moods={moods}
      tracks={tracks}
      onClose={() => setEditing(null)}
      onSaved={(next) => {
        setEditing(null);
        listen.confirm(next);
      }}
      onDelete={removeEntry}
    />
  );

  return { openLog, opening, dialog };
}
