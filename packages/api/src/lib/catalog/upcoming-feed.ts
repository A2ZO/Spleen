import type { CatalogProvider, FreshRelease, ListenBrainzClient } from "@spleen/catalog";
import { rowsOf, sql, type Db } from "@spleen/db";
import { DEFAULT_TIME_ZONE, todayIn } from "@spleen/validators";

import { importReleaseGroup, refreshReleaseDate } from "./import";
import { utcDay } from "./release-dates";
import { upcomingSql } from "./upcoming";

/*
 * Nightly feed of upcoming releases (docs/catalogue.md « Sorties annoncées »), before the
 * discography re-read of `pnpm catalog:refresh`:
 * 1. ListenBrainz "fresh releases" for the next 90 days; only the release groups credited to
 *    an artist someone follows (matched by `artists.mbid`) are kept, the rest is ignored;
 * 2. unknown group → imported from MusicBrainz; known stub → completed; known complete group
 *    whose ListenBrainz date differs → its date re-read on MusicBrainz (the only source of
 *    dates: ListenBrainz gives the date of one edition);
 * 3. incomplete upcoming releases of followed artists → completed (cover, tracklist).
 * Steps 2 and 3 share a budget of UPCOMING_FEED_BUDGET re-reads a night. A ListenBrainz
 * failure is reported and step 3 still runs; one failed re-read never stops the others.
 */

/** Re-reads (imports or date checks) on MusicBrainz per night, at most. */
export const UPCOMING_FEED_BUDGET = 40;
/** Incomplete upcoming releases read at once (only to count what the budget leaves out). */
const INCOMPLETE_READ_MAX = 500;

export interface UpcomingFeedResult {
  listenBrainz: "ok" | "failed";
  /** ListenBrainz release groups credited to a followed artist. */
  matched: number;
  imported: number;
  datesChecked: number;
  completed: number;
  failed: number;
  /** Re-reads left out because the budget was spent. */
  skipped: number;
}

interface KnownRow {
  mbid: string;
  date: string | null;
  precision: string | null;
  complete: boolean;
  /** MusicBrainz id of the row kept when this one was merged (null: not merged or none). */
  keptMbid: string | null;
  merged: boolean;
}

async function followedArtistMbids(db: Db): Promise<Set<string>> {
  const rows = rowsOf<{ mbid: string }>(
    await db.execute(sql`
      select distinct a.mbid::text as mbid
      from artist_follows af join artists a on a.id = af.artist_id
      where a.mbid is not null
    `),
  );
  return new Set(rows.map((r) => r.mbid));
}

async function knownRows(db: Db, mbids: string[]): Promise<Map<string, KnownRow>> {
  if (mbids.length === 0) return new Map();
  const rows = rowsOf<KnownRow>(
    await db.execute(sql`
      select r.mbid::text as mbid, to_char(r.release_date, 'YYYY-MM-DD') as date,
        r.release_date_precision as precision, r.tracklist_imported_at is not null as complete,
        r.merged_into_id is not null as merged, kept.mbid::text as "keptMbid"
      from releases r left join releases kept on kept.id = r.merged_into_id
      where r.mbid in (${sql.join(
        mbids.map((m) => sql`${m}::uuid`),
        sql`, `,
      )})
    `),
  );
  return new Map(rows.map((r) => [r.mbid, r]));
}

/** Incomplete upcoming releases of followed artists, soonest first. */
async function incompleteUpcoming(db: Db, now: Date): Promise<string[]> {
  const rows = rowsOf<{ mbid: string }>(
    await db.execute(sql`
      select r.mbid::text as mbid
      from releases r
      where ${upcomingSql(todayIn(DEFAULT_TIME_ZONE, now))}
        and r.tracklist_imported_at is null
        and r.mbid is not null
        and exists (
          select 1 from release_artists ra join artist_follows af on af.artist_id = ra.artist_id
          where ra.release_id = r.id
        )
      order by r.release_date, r.id
      limit ${INCOMPLETE_READ_MAX}
    `),
  );
  return rows.map((r) => r.mbid);
}

type Task = { kind: "import" | "complete" | "date"; mbid: string; later?: boolean };

/** What to do for one ListenBrainz release group already matched to a followed artist. */
function taskFor(fresh: FreshRelease, known: KnownRow | undefined): Task | null {
  if (!known) return { kind: "import", mbid: fresh.releaseGroupMbid };
  if (known.merged) {
    // The row kept carries the date; it is checked when it has its own MusicBrainz id.
    return known.keptMbid ? { kind: "date", mbid: known.keptMbid } : null;
  }
  if (!known.complete) return { kind: "complete", mbid: known.mbid };
  if (known.precision !== "day" || known.date === null || fresh.releaseDate < known.date) {
    return { kind: "date", mbid: known.mbid };
  }
  // A later ListenBrainz date is often one edition's date (MusicBrainz keeps the first), but it
  // may be a postponement: checked only with what the budget leaves.
  return fresh.releaseDate === known.date ? null : { kind: "date", mbid: known.mbid, later: true };
}

/** Imports, then completions, then date checks, later dates last: new data gets the budget first. */
const TASK_ORDER: Record<Task["kind"], number> = { import: 0, complete: 1, date: 2 };
const rank = (task: Task) => TASK_ORDER[task.kind] + (task.later ? 1 : 0);

export async function runUpcomingFeed(
  db: Db,
  provider: CatalogProvider,
  listenBrainz: ListenBrainzClient,
  now: Date,
  log: (line: string) => void = () => {},
  budget = UPCOMING_FEED_BUDGET,
): Promise<UpcomingFeedResult> {
  const result: UpcomingFeedResult = {
    listenBrainz: "ok",
    matched: 0,
    imported: 0,
    datesChecked: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  };
  let fresh: FreshRelease[] = [];
  try {
    fresh = await listenBrainz.freshReleases(utcDay(now));
  } catch (error) {
    result.listenBrainz = "failed";
    log(`upcoming: ListenBrainz failed (${(error as Error).message})`);
  }

  const followed = await followedArtistMbids(db);
  const byGroup = new Map<string, FreshRelease>();
  for (const release of fresh) {
    if (release.artistMbids.some((m) => followed.has(m))) {
      byGroup.set(release.releaseGroupMbid, release);
    }
  }
  result.matched = byGroup.size;
  const known = await knownRows(db, [...byGroup.keys()]);
  const tasks: Task[] = [];
  const seen = new Set<string>();
  const add = (task: Task | null) => {
    if (!task || seen.has(task.mbid)) return;
    seen.add(task.mbid);
    tasks.push(task);
  };
  for (const release of byGroup.values())
    add(taskFor(release, known.get(release.releaseGroupMbid)));
  for (const mbid of await incompleteUpcoming(db, now)) {
    add({ kind: "complete", mbid });
  }

  tasks.sort((a, b) => rank(a) - rank(b));
  result.skipped = Math.max(0, tasks.length - budget);
  for (const task of tasks.slice(0, budget)) {
    try {
      if (task.kind === "date") {
        await refreshReleaseDate(db, provider, task.mbid, { now });
        result.datesChecked++;
      } else {
        await importReleaseGroup(db, provider, task.mbid, { now });
        result[task.kind === "import" ? "imported" : "completed"]++;
      }
    } catch (error) {
      result.failed++;
      log(`upcoming: ${task.kind} ${task.mbid} failed (${(error as Error).name})`);
    }
  }
  return result;
}
