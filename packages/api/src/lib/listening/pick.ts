import { eq, rowsOf, schema, sql, type Db } from "@spleen/db";
import { todayIn, type PickInput } from "@spleen/validators";

import type { ToListenPick } from "../../types";
import { upcomingSql } from "../catalog/upcoming";
import { loadReleaseCards, toReleaseCard } from "../catalog/cards";
import { buildListenLinks } from "../listen-links";
import { maskRelease } from "./blind";

/*
 * « Tire un disque » (milestone 13, step 5): a record drawn at random from the member's « À
 * écouter » list. Records only (tracks are not in the profile tab), not merged, out in the
 * member's zone (the rule of `requireReleased()`). Two waves: the light candidates, then the
 * card of the one drawn. A read: nothing is written (no history, no counter).
 */

const MINUTE = 60_000;

export interface PickViewer {
  id: string;
  timeZone: string;
  /** Blind listening on. */
  blind: boolean;
}

interface CandidateRow {
  id: string;
  type: string;
  out: boolean;
  rated: boolean;
  /** Sum of the tracks when there is at least one and all have a length, else null. */
  durationMs: number | null;
}

/** Whether a known length fits the filter (`medium`: 30 to 60 minutes, both included). */
function fitsDuration(durationMs: number | null, duration: PickInput["duration"]): boolean {
  if (!duration) return true;
  if (durationMs === null) return false;
  switch (duration) {
    case "short":
      return durationMs < 30 * MINUTE;
    case "medium":
      return durationMs >= 30 * MINUTE && durationMs <= 60 * MINUTE;
    case "long":
      return durationMs > 60 * MINUTE;
  }
}

export async function pickToListen(
  db: Db,
  viewer: PickViewer,
  input: PickInput,
  now: Date,
  random: () => number = Math.random,
): Promise<ToListenPick> {
  const today = todayIn(viewer.timeZone, now);
  const rows = rowsOf<CandidateRow>(
    await db.execute(sql`
      select r.id, r.type,
        not coalesce(${upcomingSql(today, false)}, false) as out,
        s.rating is not null as rated,
        (select case when count(*) > 0 and count(t.duration_ms) = count(*)
            then sum(t.duration_ms)::int end
          from release_tracks rt join tracks t on t.id = rt.track_id
          where rt.release_id = r.id) as "durationMs"
      from user_item_state s
      join releases r on r.id = s.release_id
      where s.user_id = ${viewer.id}
        and s.want_to_listen
        and r.merged_into_id is null
    `),
  );
  const matching = rows.filter(
    (r) =>
      r.out && (!input.type || r.type === input.type) && fitsDuration(r.durationMs, input.duration),
  );
  const result = { listTotal: rows.length, matching: matching.length };
  // The record shown is left out when another one remains.
  const others = matching.filter((r) => r.id !== input.not);
  const pool = others.length > 0 ? others : matching;
  if (pool.length === 0) return { ...result, pick: null };
  const drawn = pool[Math.min(Math.floor(random() * pool.length), pool.length - 1)]!;

  const [[card], links] = await Promise.all([
    loadReleaseCards(db, [drawn.id]),
    db
      .select({ service: schema.listenLinks.service, url: schema.listenLinks.url })
      .from(schema.listenLinks)
      .where(eq(schema.listenLinks.releaseId, drawn.id)),
  ]);
  if (!card) return { ...result, pick: null };
  const shown = toReleaseCard(card);
  const masked = viewer.blind ? maskRelease(new Set(drawn.rated ? [drawn.id] : []), shown) : shown;
  return {
    ...result,
    pick: {
      ...masked,
      durationMs: drawn.durationMs,
      listenLinks: buildListenLinks(links, "release", card.title, card.artists[0]?.name),
    },
  };
}
