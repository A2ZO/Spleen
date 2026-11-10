import type { MyItemState } from "./types";

/*
 * Client-safe (no database): what a quick write from an item page does to the member's state,
 * so the page can show it before the server answers. It mirrors the server rules in
 * `lib/listening/entries.ts` (`quickUpdate`, `markListened`, `updateWantToListen`) and
 * `recomputeItemState()`; `instant.test.ts` runs the same click sequences through both and
 * compares the states, so a rule changed on one side only fails the tests.
 */

/** One quick write of the "I listened" panel. */
export type ListenWrite =
  | { kind: "rating"; rating: number | null }
  | { kind: "liked"; liked: boolean }
  | { kind: "wantToListen"; wantToListen: boolean }
  | { kind: "listened" };

export function applyListenWrite(state: MyItemState, write: ListenWrite): MyItemState {
  switch (write.kind) {
    case "wantToListen":
      return { ...state, wantToListen: write.wantToListen };
    case "listened":
      // A dated listen today, without a rating, keeping the heart: only these change.
      return {
        ...state,
        listened: true,
        wantToListen: false,
        quickFallback: { ...state.quickFallback, listened: true },
      };
    case "rating":
    case "liked":
      return quickUpdate(state, write.kind === "rating" ? { rating: write.rating } : write);
  }
}

/**
 * Quick rating or heart: the undated listen mirrors the current state, takes the change and
 * becomes the most recent listen; it is deleted when nothing is left on it. Removing the heart
 * removes it from every listen. Any quick write clears "to listen".
 */
function quickUpdate(
  state: MyItemState,
  change: { rating: number | null } | { liked: boolean },
): MyItemState {
  const undated = state.entries.find((e) => e.listenedOn === null);
  const next = { rating: state.rating, liked: state.liked, ...change };
  const kept = !!undated && (undated.review !== null || undated.trackRatings.length > 0);
  const remains = next.rating !== null || next.liked || kept;
  const unliked = "liked" in change && !change.liked;

  const entries = state.entries.map((e) =>
    e === undated ? { ...e, ...next } : unliked ? { ...e, liked: false } : e,
  );
  if (remains) {
    return {
      ...state,
      entries,
      rating: next.rating ?? state.quickFallback.rating,
      liked: next.liked,
      listened: true,
      wantToListen: false,
    };
  }
  return {
    ...state,
    entries: undated ? entries.filter((e) => e.id !== undated.id) : entries,
    rating: state.quickFallback.rating,
    liked: false,
    listened: state.quickFallback.listened,
    wantToListen: false,
  };
}
