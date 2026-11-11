"use client";

import type { ApiErrorCode } from "@spleen/api/errors";
import { useSyncExternalStore } from "react";

/*
 * Deletions of the member's own content (list, review, comment, listen) with "Undo" instead of
 * a confirmation (`docs/social.md`, « Supprimer avec Annuler »). Rules:
 * - the item is hidden at once; nothing is sent before `UNDO_MS` (the banner's delay);
 * - Undo shows it again; a failure shows it again with a message in the banner area;
 * - a deleted item stays hidden for the rest of the session (the page may still hold it);
 * - one module-wide store: an internal navigation keeps the banner and its delay running;
 *   closing or reloading the tab deletes nothing (the safe side, accepted);
 * - hovering or focusing the banners pauses every delay;
 * - a new write on the same record (`scope`) first sends the waiting deletion and waits for it
 *   (`flushScope`), or the late deletion would erase the new rating or review;
 * - at most `MAX_BANNERS` waiting: one more sends the oldest now.
 */

export const UNDO_MS = 8_000;
export const MAX_BANNERS = 3;

export type DeletionKind = "list" | "review" | "comment" | "entry";
type DeleteError = ApiErrorCode | "unknown";
export interface DeleteResult {
  error?: DeleteError;
}

export interface DeletionRequest<R extends DeleteResult> {
  id: string;
  kind: DeletionKind;
  /** Named in the banner (a list's title). */
  label?: string;
  /** The record a later write would touch (`release:<id>`, `track:<id>`), see `flushScope`. */
  scope?: string;
  run: () => Promise<R>;
  /** Called with a successful answer (before `flushScope` resolves). */
  onDone?: (result: R) => void;
  /** Started from the keyboard: the focus goes to the banner's Undo button. */
  focusUndo?: boolean;
}

export interface Waiting {
  id: string;
  kind: DeletionKind;
  label?: string;
  focusUndo: boolean;
}

interface Item extends Waiting {
  scope?: string;
  run: () => Promise<DeleteResult>;
  onDone?: (result: DeleteResult) => void;
  remaining: number;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const waiting: Item[] = [];
const sending = new Map<string, { scope?: string; done: Promise<void> }>();
const deleted = new Set<string>();
export interface DeleteFailure {
  kind: DeletionKind;
  code: DeleteError;
}
let failure: DeleteFailure | null = null;
let failureTimer: ReturnType<typeof setTimeout> | null = null;
let paused = false;
let version = 0;
let snapshot: { waiting: Waiting[]; failure: DeleteFailure | null } = {
  waiting: [],
  failure: null,
};
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  snapshot = {
    waiting: waiting.map(({ id, kind, label, focusUndo }) => ({ id, kind, label, focusUndo })),
    failure,
  };
  for (const listener of listeners) listener();
}

function start(item: Item) {
  item.startedAt = Date.now();
  item.timer = setTimeout(() => commitNow(item.id), item.remaining);
}

function setFailure(next: DeleteFailure | null) {
  failure = next;
  if (failureTimer) clearTimeout(failureTimer);
  failureTimer = next
    ? setTimeout(() => {
        failure = null;
        failureTimer = null;
        notify();
      }, UNDO_MS)
    : null;
}

/** The `scope` of a release or a track (a listen, a review, the quick reactions of its page). */
export const scopeOf = (target: { kind: string; id: string }) => `${target.kind}:${target.id}`;

export function scheduleDelete<R extends DeleteResult>(request: DeletionRequest<R>) {
  if (waiting.some((item) => item.id === request.id) || sending.has(request.id)) return;
  while (waiting.length >= MAX_BANNERS) commitNow(waiting[0]!.id);
  const item: Item = {
    id: request.id,
    kind: request.kind,
    label: request.label,
    focusUndo: !!request.focusUndo,
    scope: request.scope,
    run: request.run,
    onDone: request.onDone as Item["onDone"],
    remaining: UNDO_MS,
    startedAt: 0,
    timer: null,
  };
  waiting.push(item);
  setFailure(null);
  if (!paused) start(item);
  notify();
}

function take(id: string) {
  const index = waiting.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const [item] = waiting.splice(index, 1);
  if (item!.timer) clearTimeout(item!.timer);
  return item!;
}

/** Undo: nothing was sent, the item shows again. */
export function undo(id: string) {
  if (take(id)) notify();
}

/** Sends the deletion now (end of the delay, Escape, a write on the same record). */
export function commitNow(id: string) {
  const item = take(id);
  if (!item) return;
  const done = (async () => {
    let result: DeleteResult;
    try {
      result = await item.run();
    } catch {
      // A rejected action (500, network): the item comes back, never a broken page.
      result = { error: "unknown" };
    }
    sending.delete(item.id);
    if (result.error) {
      setFailure({ kind: item.kind, code: result.error });
    } else {
      deleted.add(item.id);
      item.onDone?.(result);
    }
    notify();
  })();
  sending.set(item.id, { scope: item.scope, done });
  notify();
}

/** Sends the deletions waiting on `scope` and resolves once every one of them was answered. */
export async function flushScope(scope: string) {
  for (const item of waiting.filter((w) => w.scope === scope)) commitNow(item.id);
  await Promise.all([...sending.values()].filter((s) => s.scope === scope).map((s) => s.done));
}

/** A deletion of `scope` waits or is being sent. */
export function scopeBusy(scope: string) {
  return (
    waiting.some((item) => item.scope === scope) ||
    [...sending.values()].some((s) => s.scope === scope)
  );
}

/** Hover or focus on the banners: every delay stops, and starts again where it was. */
export function setPaused(next: boolean) {
  if (paused === next) return;
  paused = next;
  for (const item of waiting) {
    if (next && item.timer) {
      clearTimeout(item.timer);
      item.timer = null;
      item.remaining = Math.max(0, item.remaining - (Date.now() - item.startedAt));
    } else if (!next) start(item);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const isHidden = (id: string) =>
  deleted.has(id) || sending.has(id) || waiting.some((item) => item.id === id);
const visible = () => false;

/** `(id) => true` when the item is being deleted or was deleted (nothing hidden on the server). */
export function useUndoHidden(): (id: string) => boolean {
  const current = useSyncExternalStore(
    subscribe,
    () => version,
    () => -1,
  );
  return current < 0 ? visible : isHidden;
}

/** The waiting deletions (one banner each) and the last failure. */
export function useUndoBanners() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}
const EMPTY: typeof snapshot = { waiting: [], failure: null };
