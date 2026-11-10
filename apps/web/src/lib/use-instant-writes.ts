"use client";

import type { ApiErrorCode } from "@spleen/api/errors";
import { useCallback, useId, useLayoutEffect, useSyncExternalStore } from "react";

/*
 * Member reactions shown at once (like, follow, heart, "to listen", quick rating). One store per
 * key for the whole page, so the same object shown twice (a follow button and the follower
 * count) shares its state. Rules (`docs/ecoute.md`, « Réactions instantanées ») :
 * - shown = server state + the write in flight + the waiting writes, in click order;
 * - clicks are grouped for `GROUP_MS` (timer restarted on each click), only the last value of a
 *   slot is kept, and nothing is sent when it equals the state without it (double click);
 * - one request at a time per key, so every answer is newer than the previous one;
 * - a failed write leaves the stack (back to the state before it) and its error is shown by the
 *   component that made it, until the next write;
 * - when the last component of a key unmounts (internal navigation), waiting writes leave now.
 * Closing the tab within `GROUP_MS` loses the waiting writes (accepted limit).
 */

export const GROUP_MS = 350;

export type WriteError = ApiErrorCode | "unknown";
export interface WriteResult<S> {
  /** The fresh state, when the action returns one. */
  state?: S;
  error?: WriteError;
}

interface Queued<W> {
  slot: string;
  write: W;
  run: () => Promise<WriteResult<unknown>>;
  origin: string;
}

interface Entry {
  /** Last state confirmed by an answer, and the props it was confirmed against. */
  confirmed: { state: unknown; props: unknown } | null;
  /** Props seen by the last render (the base when nothing was confirmed since). */
  props: unknown;
  apply: (state: unknown, write: unknown) => unknown;
  inflight: Queued<unknown> | null;
  pending: Queued<unknown>[];
  timer: ReturnType<typeof setTimeout> | null;
  error: { code: WriteError; origin: string } | null;
  listeners: Set<() => void>;
  version: number;
}

const entries = new Map<string, Entry>();

function entryFor(key: string, props: unknown, apply: Entry["apply"]): Entry {
  let entry = entries.get(key);
  if (!entry) {
    entry = {
      confirmed: null,
      props,
      apply,
      inflight: null,
      pending: [],
      timer: null,
      error: null,
      listeners: new Set(),
      version: 0,
    };
    entries.set(key, entry);
  }
  return entry;
}

function notify(entry: Entry) {
  entry.version += 1;
  for (const listener of entry.listeners) listener();
}

function base(entry: Entry, props: unknown) {
  return entry.confirmed && entry.confirmed.props === props ? entry.confirmed.state : props;
}

function computeShown(entry: Entry, props: unknown, skip?: string) {
  let state = base(entry, props);
  if (entry.inflight) state = entry.apply(state, entry.inflight.write);
  for (const queued of entry.pending) {
    if (queued.slot !== skip) state = entry.apply(state, queued.write);
  }
  return state;
}

function forget(key: string, entry: Entry) {
  if (!entry.listeners.size && !entry.inflight && !entry.pending.length) entries.delete(key);
}

/** Sends the next waiting write, unless one is in flight or the group timer still runs. */
function pump(key: string, entry: Entry) {
  if (entry.inflight || entry.timer || !entry.pending.length) return;
  const queued = entry.pending.shift()!;
  entry.inflight = queued;
  void (async () => {
    let result: WriteResult<unknown>;
    try {
      result = await queued.run();
    } catch {
      // A rejected action (500, network): a rollback, never a broken page.
      result = { error: "unknown" };
    }
    entry.inflight = null;
    if (result.error) {
      entry.error = { code: result.error, origin: queued.origin };
    } else if (result.state !== undefined) {
      entry.confirmed = { state: result.state, props: entry.props };
    }
    notify(entry);
    pump(key, entry);
    forget(key, entry);
  })();
}

export interface WriteOptions {
  /** Writes of the same slot replace each other while waiting. */
  slot: string;
  /** The Server Action call, made when the write leaves. */
  run: () => Promise<WriteResult<unknown>>;
  /** Sent without waiting for the group delay (a write that must not be merged). */
  now?: boolean;
}

export function useInstantWrites<S, W>({
  key,
  props,
  apply,
  same,
}: {
  key: string;
  /** The state rendered by the server. */
  props: S;
  apply: (state: S, write: W) => S;
  /** True when `write` changes nothing on `state`: the write is dropped instead of sent. */
  same?: (state: S, write: W) => boolean;
}) {
  const origin = useId();

  const subscribe = useCallback(
    (listener: () => void) => {
      const entry = entryFor(key, props, apply as Entry["apply"]);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
        if (!entry.listeners.size && entry.timer) {
          // Leaving the page: what waits leaves now.
          clearTimeout(entry.timer);
          entry.timer = null;
          pump(key, entry);
        }
        forget(key, entry);
      };
    },
    // `props` and `apply` are refreshed below; resubscribing on each render is not wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  useSyncExternalStore(
    subscribe,
    () => entries.get(key)?.version ?? -1,
    () => -1,
  );

  useLayoutEffect(() => {
    const entry = entries.get(key);
    if (entry) {
      entry.props = props;
      entry.apply = apply as Entry["apply"];
    }
  });

  const entry = entries.get(key);
  const shown = (entry ? computeShown(entry, props) : props) as S;
  const error = entry?.error?.origin === origin ? entry.error.code : null;

  const write = (value: W, options: WriteOptions) => {
    const current = entryFor(key, props, apply as Entry["apply"]);
    current.props = props;
    current.error = null;
    current.pending = current.pending.filter((queued) => queued.slot !== options.slot);
    const without = computeShown(current, props) as S;
    if (!same?.(without, value)) {
      current.pending.push({ slot: options.slot, write: value, run: options.run, origin });
    }
    if (current.timer) clearTimeout(current.timer);
    current.timer = null;
    if (!options.now) {
      current.timer = setTimeout(() => {
        current.timer = null;
        pump(key, current);
      }, GROUP_MS);
    }
    notify(current);
    pump(key, current);
  };

  /** A state confirmed elsewhere (the "log" form returns the fresh state). */
  const confirm = (state: S) => {
    const current = entryFor(key, props, apply as Entry["apply"]);
    current.confirmed = { state, props };
    notify(current);
  };

  const isPending = (slot: string) =>
    !!entry && (entry.inflight?.slot === slot || entry.pending.some((q) => q.slot === slot));

  return { shown, error, write, confirm, isPending };
}
