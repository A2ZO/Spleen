import { rowsOf, sql, type DbOrTx } from "@spleen/db";
import { DEFAULT_TIME_ZONE, todayIn } from "@spleen/validators";

import { mainReleaseSql } from "./upcoming";

/*
 * « Sortie aujourd'hui » (milestone 11, docs/sorties.md): the nightly `pnpm releases:notify`
 * gives each member one in-site notification per record of a followed artist out today in
 * their own zone. Only day-precise dates (a month or a year never names a day), main releases
 * not merged, members with `notify_releases` on and not suspended. One row per member and
 * record (`notifications_release_once_uidx`): running it again adds nothing. Rows of one day
 * share `release:day:<day>` and show as one group. No email, no push.
 */

/** The member's today, or the site's when their zone is empty or unknown to `Intl`. */
export function todayOf(timeZone: string | null, now: Date): string {
  try {
    if (timeZone) return todayIn(timeZone, now);
  } catch {
    // An unknown zone falls back like the upcoming reads do.
  }
  return todayIn(DEFAULT_TIME_ZONE, now);
}

/**
 * Creates today's release notifications at `now` and returns how many were created.
 * `userIds` limits the run to these members (end-to-end tests).
 */
export async function notifyReleasesOfDay(
  db: DbOrTx,
  now: Date,
  options: { userIds?: string[] } = {},
): Promise<number> {
  const only = options.userIds
    ? options.userIds.length
      ? sql`and p.user_id in (${sql.join(
          options.userIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`
      : sql`and false`
    : sql``;
  // Zones of the members who may get one: today is computed per zone, here, with the rule
  // the rest of the site uses (`todayIn`); a zone Postgres ignores cannot break the run.
  const zones = rowsOf<{ zone: string | null }>(
    await db.execute(sql`
      select distinct p.time_zone as zone
      from profiles p
      where p.notify_releases and p.suspended_at is null ${only}
        and exists (select 1 from artist_follows af where af.user_id = p.user_id)
    `),
  );
  if (zones.length === 0) return 0;
  const days = sql.join(
    zones.map(({ zone }) => sql`(${zone ?? ""}::text, ${todayOf(zone, now)}::date)`),
    sql`, `,
  );
  const inserted = rowsOf<{ id: string }>(
    await db.execute(sql`
      insert into notifications (user_id, type, release_id, group_key, created_at)
      select distinct p.user_id, 'release'::notification_type, r.id,
        'release:day:' || z.day::text, ${now.toISOString()}::timestamptz
      from (values ${days}) as z(zone, day)
      join profiles p on coalesce(p.time_zone, '') = z.zone
      join artist_follows af on af.user_id = p.user_id
      join release_artists ra on ra.artist_id = af.artist_id
      join releases r on r.id = ra.release_id
      where p.notify_releases and p.suspended_at is null ${only}
        and r.release_date_precision = 'day'
        and r.release_date = z.day
        and ${mainReleaseSql()}
      on conflict do nothing
      returning id
    `),
  );
  return inserted.length;
}
