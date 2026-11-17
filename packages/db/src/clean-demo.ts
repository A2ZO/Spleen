import { sql } from "drizzle-orm";

import type { Db } from "./client";
import { unsafeE2eDatabase } from "./e2e";
import { isVitrine } from "./env";
import { bumpStatsVersion } from "./listening-state";
import { rowsOf } from "./rows";

/*
 * `pnpm db:clean-demo`: empties the vitrine (`docs/environnement.md`) of what the demo seed
 * and the e2e suite wrote, so that it shows real data only.
 * - Accounts: every `@example.test` email (demo members and e2e accounts; `.test` is a
 *   reserved domain, no real member can sign in with one), with their data.
 * - Catalog: the seed's fixtures (`fixtureId()`, ids `00000000-0000-4000-8000-…`) and the
 *   e2e throwaway rows (slug `e2e-…`), in both cases without a MusicBrainz id. Imported
 *   records always have one, so they are never touched.
 * - With `withMemberRows` only: what members outside `@example.test` logged on those
 *   fictional records (listens, reviews, hearts, list items, follows); their accounts stay.
 * - Genres of the seed that no remaining release uses. The suggested moods stay: the app
 *   offers them to every member.
 */

const demoUsers = sql`select "id" from "user" where lower("email") like '%@example.test'`;
const fictive = (table: "releases" | "artists" | "tracks") =>
  sql`select "id" from ${sql.identifier(table)}
      where "mbid" is null and ("id"::text like '00000000-0000-4000-8000-%' or "slug" ~ '^e2e-')`;
const R = fictive("releases");
const A = fictive("artists");
const T = fictive("tracks");

/** Rows of members outside `@example.test` that point at a fictional record. */
const realMemberRowsQuery = sql`
  select
    (select count(*) from "entries" where "user_id" not in (${demoUsers})
       and ("release_id" in (${R}) or "artist_id" in (${A}) or "track_id" in (${T})))
  + (select count(*) from "favorites" where "user_id" not in (${demoUsers}) and "release_id" in (${R}))
  + (select count(*) from "reviews" where "user_id" not in (${demoUsers})
       and ("release_id" in (${R}) or "artist_id" in (${A}) or "track_id" in (${T})))
  + (select count(*) from "list_items" i join "lists" l on l."id" = i."list_id"
       where l."user_id" not in (${demoUsers})
       and (i."release_id" in (${R}) or i."artist_id" in (${A}) or i."track_id" in (${T})))
  + (select count(*) from "artist_follows" where "user_id" not in (${demoUsers}) and "artist_id" in (${A}))
  as "n"`;

/** Rows that must survive: real accounts and records imported from MusicBrainz. */
const keptQuery = sql`
  select
    (select count(*) from "user" where lower("email") not like '%@example.test') as "users",
    (select count(*) from "releases" where "mbid" is not null) as "releases",
    (select count(*) from "artists" where "mbid" is not null) as "artists",
    (select count(*) from "tracks" where "mbid" is not null) as "tracks"`;

export interface CleanDemoResult {
  /** Rows deleted (or that would be) per table, cascades included; tables at 0 left out. */
  deleted: Record<string, number>;
  /** Rows of real members on fictional records: refused while not 0, unless `withMemberRows`. */
  realMemberRows: number;
  applied: boolean;
}

class DryRun extends Error {}

async function tableCounts(tx: Db): Promise<Map<string, number>> {
  const tables = rowsOf<{ name: string }>(
    await tx.execute(
      sql`select "tablename" as "name" from pg_tables where "schemaname" = 'public' order by 1`,
    ),
  ).filter((t) => !t.name.startsWith("__drizzle"));
  const counts = new Map<string, number>();
  for (const { name } of tables) {
    const [row] = rowsOf<{ n: string | number }>(
      await tx.execute(sql`select count(*) as "n" from ${sql.identifier(name)}`),
    );
    counts.set(name, Number(row!.n));
  }
  return counts;
}

/** Deletes what real members logged on fictional records; their stats are recomputed. */
async function deleteMemberRows(tx: Db): Promise<void> {
  const affected = rowsOf<{ user_id: string }>(
    await tx.execute(sql`
      select distinct "user_id" from "entries" where "user_id" not in (${demoUsers})
        and ("release_id" in (${R}) or "artist_id" in (${A}) or "track_id" in (${T}))
      union select distinct "user_id" from "user_item_state" where "user_id" not in (${demoUsers})
        and ("release_id" in (${R}) or "artist_id" in (${A}) or "track_id" in (${T}))`),
  );
  for (const table of ["reviews", "entries", "user_item_state"]) {
    await tx.execute(sql`
      delete from ${sql.identifier(table)} where "user_id" not in (${demoUsers})
        and ("release_id" in (${R}) or "artist_id" in (${A}) or "track_id" in (${T}))`);
  }
  await tx.execute(sql`delete from "track_ratings" where "track_id" in (${T})`);
  await tx.execute(sql`delete from "favorites" where "release_id" in (${R})`);
  await tx.execute(sql`
    delete from "list_items"
    where "release_id" in (${R}) or "artist_id" in (${A}) or "track_id" in (${T})`);
  await tx.execute(sql`delete from "artist_follows" where "artist_id" in (${A})`);
  for (const { user_id } of affected) await bumpStatsVersion(tx, user_id);
}

async function deleteDemo(tx: Db): Promise<void> {
  // Reports and decisions outlive their author (`set null`), so they go first.
  await tx.execute(sql`
    delete from "moderation_actions"
    where "moderator_id" in (${demoUsers}) or "target_user_id" in (${demoUsers})`);
  await tx.execute(sql`
    delete from "reports"
    where "reporter_id" in (${demoUsers}) or "reported_user_id" in (${demoUsers})
      or "release_id" in (${R}) or "duplicate_release_id" in (${R})
      or "artist_id" in (${A}) or "duplicate_artist_id" in (${A})
      or "track_id" in (${T}) or "duplicate_track_id" in (${T})`);
  await tx.execute(sql`delete from "notifications" where "release_id" in (${R})`);
  await tx.execute(sql`delete from "username_history" where "user_id" in (${demoUsers})`);
  // The accounts: their member data cascades (entries, lists, reviews, follows…).
  await tx.execute(sql`delete from "user" where "id" in (${demoUsers})`);
  await tx.execute(sql`
    delete from "listen_links"
    where "release_id" in (${R}) or "artist_id" in (${A}) or "track_id" in (${T})`);
  // Records point at their merge target with `restrict`: merged ones first.
  for (const [table, ids] of [
    ["releases", R],
    ["tracks", T],
    ["artists", A],
  ] as const) {
    await tx.execute(sql`
      delete from ${sql.identifier(table)}
      where "id" in (${ids}) and "merged_into_id" is not null`);
    await tx.execute(sql`delete from ${sql.identifier(table)} where "id" in (${ids})`);
  }
  await tx.execute(sql`
    delete from "genres" g
    where g."id"::text like '00000000-0000-4000-8000-%'
      and not exists (select 1 from "release_genres" rg where rg."genre_id" = g."id")`);
}

/**
 * Deletes the demo and e2e data in one transaction, and counts what goes table by table.
 * Without `apply`, the same transaction is rolled back: the counts are exact, nothing
 * changes. When a real member has data on a fictional record and `withMemberRows` is not
 * set, counts nothing and, with `apply`, throws; it also throws (and changes nothing) when a real account or an imported
 * record would go.
 */
export async function cleanDemo(
  db: Db,
  { apply, withMemberRows = false }: { apply: boolean; withMemberRows?: boolean },
): Promise<CleanDemoResult> {
  let result: CleanDemoResult | undefined;
  try {
    await db.transaction(async (tx) => {
      const [real] = rowsOf<{ n: string | number }>(await tx.execute(realMemberRowsQuery));
      const realMemberRows = Number(real!.n);
      if (realMemberRows > 0 && !withMemberRows) {
        if (apply) {
          throw new Error(
            `${realMemberRows} row(s) of members outside @example.test point at fictional ` +
              "records: nothing deleted. Add --with-member-rows to delete those rows too.",
          );
        }
        // Their records cannot go (`restrict`): nothing to count until they are dealt with.
        result = { deleted: {}, realMemberRows, applied: false };
        throw new DryRun();
      }
      const [keptBefore] = rowsOf(await tx.execute(keptQuery));
      const before = await tableCounts(tx);
      if (withMemberRows) await deleteMemberRows(tx);
      await deleteDemo(tx);
      const after = await tableCounts(tx);
      const [keptAfter] = rowsOf(await tx.execute(keptQuery));
      if (JSON.stringify(keptBefore) !== JSON.stringify(keptAfter)) {
        throw new Error("A real account or an imported record would be deleted: nothing deleted.");
      }
      const deleted: Record<string, number> = {};
      for (const [table, n] of before) {
        const gone = n - (after.get(table) ?? 0);
        if (gone > 0) deleted[table] = gone;
      }
      result = { deleted, realMemberRows, applied: apply };
      if (!apply) throw new DryRun();
    });
  } catch (error) {
    if (!(error instanceof DryRun)) throw error;
  }
  return result!;
}

/**
 * Why `pnpm db:clean-demo` must not run on the database at `url`, or null when it may: only
 * in the vitrine (`SPLEEN_VITRINE=1`), never in production (`NODE_ENV`) nor on the Neon
 * branch named by `NEON_MAIN_HOST` (and not on Neon while that variable is missing).
 */
export function cleanDemoRefusal(
  url: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!isVitrine(env)) return "db:clean-demo only runs in the vitrine (SPLEEN_VITRINE=1)";
  if (env.NODE_ENV === "production") return "NODE_ENV is production";
  if (!url?.startsWith("postgres")) return null;
  return unsafeE2eDatabase(url, env);
}
