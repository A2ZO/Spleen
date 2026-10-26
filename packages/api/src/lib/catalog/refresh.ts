import { rowsOf, sql, type Db } from "@spleen/db";

/*
 * Nightly discography refresh ("Recent releases"): which artists to re-read on MusicBrainz.
 * Each one costs a request or two at 1 request/s, so only artists members care about: the
 * ones they listened to in the last 30 days and the ones on their Shelves, most followed
 * first, each at most once a week.
 */

/** Artists re-read per run (about 5 minutes at 1 request/s). */
export const REFRESH_BATCH = 150;
/** An artist is re-read at most once in this many days. */
export const REFRESH_AFTER_DAYS = 7;
/** Listens that make an artist worth re-reading. */
export const REFRESH_ACTIVITY_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ArtistToRefresh {
  id: string;
  mbid: string;
  name: string;
  /** Distinct members who listened to them in the last 30 days. */
  listeners: number;
  /** Distinct members with one of their records on the Shelf. */
  shelves: number;
}

export async function artistsToRefresh(
  db: Db,
  now: Date,
  limit = REFRESH_BATCH,
): Promise<ArtistToRefresh[]> {
  const since = new Date(now.getTime() - REFRESH_ACTIVITY_DAYS * DAY_MS).toISOString();
  const staleBefore = new Date(now.getTime() - REFRESH_AFTER_DAYS * DAY_MS).toISOString();
  const until = now.toISOString();
  const result = await db.execute(sql`
    with recent as (
      select e.user_id, e.release_id, e.track_id, e.artist_id
      from entries e
      where (e.created_at between ${since}::timestamptz and ${until}::timestamptz)
         or (e.listened_on is null
             and e.updated_at between ${since}::timestamptz and ${until}::timestamptz)
    ),
    listened as (
      select ra.artist_id, r.user_id from recent r
        join release_artists ra on ra.release_id = r.release_id
      union
      select ta.artist_id, r.user_id from recent r
        join track_artists ta on ta.track_id = r.track_id
      union
      select r.artist_id, r.user_id from recent r where r.artist_id is not null
    ),
    shelved as (
      select ra.artist_id, f.user_id from favorites f
        join release_artists ra on ra.release_id = f.release_id
    ),
    scores as (
      select artist_id,
        count(distinct user_id) filter (where source = 'listen')::int as listeners,
        count(distinct user_id) filter (where source = 'shelf')::int as shelves
      from (
        select artist_id, user_id, 'listen' as source from listened
        union all
        select artist_id, user_id, 'shelf' as source from shelved
      ) activity
      group by artist_id
    )
    select a.id, a.mbid, a.name, s.listeners, s.shelves
    from scores s
    join artists a on a.id = s.artist_id
    where a.mbid is not null
      and (a.discography_refreshed_at is null
           or a.discography_refreshed_at < ${staleBefore}::timestamptz)
    order by s.listeners + s.shelves desc, s.listeners desc,
      a.discography_refreshed_at asc nulls first, a.id
    limit ${limit}
  `);
  return rowsOf<ArtistToRefresh>(result);
}
