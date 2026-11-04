import {
  bumpStatsVersion,
  eq,
  recomputeItemState,
  rowsOf,
  schema,
  sql,
  type Db,
  type DbOrTx,
} from "@spleen/db";
import {
  catalogSlugFrom,
  type CatalogKind,
  type CatalogMergeInput,
  type CatalogMergeTargetInput,
} from "@spleen/validators";

import { fail } from "../../trpc";
import type { CatalogMergePreview, MergeCandidate } from "../../types";
import { record } from "../moderation/decisions";

/*
 * Duplicate merges (admins only). One transaction moves everything that pointed to the
 * duplicate onto the page kept: listens, track ratings, reviews, list items, Shelves, member
 * states (recomputed), open reports; the kept page takes what it lacks from the duplicate
 * (credits, tracklist, genres, cover, date). The duplicate is never deleted: it points to the
 * page kept (`merged_into_id`), its URL redirects there and imports follow the link.
 * Conflicts (one member, list or Shelf holding both) keep a single row. Rules: docs/social.md.
 */

const { reports } = schema;

const TABLE_NAMES = { release: "releases", track: "tracks", artist: "artists" } as const;
/** Column of the target in `entries`, `reviews`, `list_items`, `user_item_state`, `reports`. */
const COLUMN = { release: "release_id", track: "track_id", artist: "artist_id" } as const;

/** A table or column name of this module (constants only, never user input). */
const ident = (name: string) => sql.raw(`"${name}"`);

interface CatalogRow {
  id: string;
  slug: string;
  title: string;
  mergedIntoId: string | null;
}

export async function findBySlug(
  db: DbOrTx,
  kind: CatalogKind,
  text: string,
  lock = false,
): Promise<CatalogRow | null> {
  const slug = catalogSlugFrom(text, kind);
  if (!slug) return null;
  const [row] = rowsOf<CatalogRow>(
    await db.execute(sql`
      select "id", "slug", ${ident(kind === "artist" ? "name" : "title")} as "title",
        "merged_into_id" as "mergedIntoId"
      from ${ident(TABLE_NAMES[kind])} where "slug" = ${slug}
      ${lock ? sql`for update` : sql``}`),
  );
  return row ?? null;
}

/** Where a merged page now lives (its slug), or null when the page was not merged. */
export async function mergedSlug(db: Db, kind: CatalogKind, slug: string): Promise<string | null> {
  const table = ident(TABLE_NAMES[kind]);
  const [row] = rowsOf<{ slug: string }>(
    await db.execute(sql`
      select "k"."slug" from ${table} "d" join ${table} "k" on "k"."id" = "d"."merged_into_id"
      where "d"."slug" = ${slug}`),
  );
  return row?.slug ?? null;
}

/**
 * Whether a catalog page can be shown, in one indexed query: `found`, `merged` into the page
 * kept (its slug), or `missing`. Pages call it before streaming starts (their `layout.tsx`),
 * so a 404 or a 308 keeps its HTTP status.
 */
export async function catalogPageStatus(
  db: Db,
  kind: CatalogKind,
  slug: string,
): Promise<{ status: "found" } | { status: "merged"; slug: string } | { status: "missing" }> {
  const table = ident(TABLE_NAMES[kind]);
  const [row] = rowsOf<{ merged: boolean; kept: string | null }>(
    await db.execute(sql`
      select "d"."merged_into_id" is not null as merged, "k"."slug" as kept
      from ${table} "d" left join ${table} "k" on "k"."id" = "d"."merged_into_id"
      where "d"."slug" = ${slug}`),
  );
  if (!row) return { status: "missing" };
  if (!row.merged) return { status: "found" };
  return row.kept ? { status: "merged", slug: row.kept } : { status: "missing" };
}

/** The two pages of a merge, checked: both exist, differ, and neither was merged. */
async function mergePair(db: DbOrTx, input: CatalogMergeTargetInput, lock = false) {
  const [keep, duplicate] = [
    await findBySlug(db, input.kind, input.keep, lock),
    await findBySlug(db, input.kind, input.duplicate, lock),
  ];
  if (!keep || !duplicate) fail("NOT_FOUND", "ITEM_NOT_FOUND");
  if (keep.id === duplicate.id) fail("BAD_REQUEST", "MERGE_SAME");
  if (keep.mergedIntoId || duplicate.mergedIntoId) fail("CONFLICT", "MERGE_ALREADY_MERGED");
  return { keep, duplicate };
}

/** What a merge would move, for the admin form. */
async function candidate(db: Db, kind: CatalogKind, row: CatalogRow): Promise<MergeCandidate> {
  const column = sql.raw(`"${COLUMN[kind]}"`);
  const count = async (table: string) => {
    const [found] = rowsOf<{ n: number }>(
      await db.execute(
        sql`select count(*)::int as n from ${sql.raw(`"${table}"`)} where ${column} = ${row.id}`,
      ),
    );
    return found?.n ?? 0;
  };
  const [listens, reviews, listItems] = await Promise.all([
    count("entries"),
    count("reviews"),
    count("list_items"),
  ]);
  const path = kind === "release" ? "album" : kind;
  return {
    slug: row.slug,
    title: row.title,
    href: `/${path}/${row.slug}`,
    listens,
    reviews,
    listItems,
  };
}

export async function previewMerge(
  db: Db,
  input: CatalogMergeTargetInput,
): Promise<CatalogMergePreview> {
  const { keep, duplicate } = await mergePair(db, input);
  const [kept, merged] = await Promise.all([
    candidate(db, input.kind, keep),
    candidate(db, input.kind, duplicate),
  ]);
  return { kind: input.kind, keep: kept, duplicate: merged };
}

/* ---------------------------------------------------------------- moving rows */

/**
 * Re-points `column` from the duplicate to the page kept. With `scope`, a row whose scope
 * (list, member, entry…) already holds the page kept is dropped instead: one row survives.
 */
async function repoint(
  tx: DbOrTx,
  table: string,
  column: string,
  keepId: string,
  dupId: string,
  scope?: string,
) {
  if (scope) {
    await tx.execute(sql`
      delete from ${ident(table)} "d"
      where "d".${ident(column)} = ${dupId}
        and exists (
          select 1 from ${ident(table)} "k"
          where "k".${ident(scope)} = "d".${ident(scope)} and "k".${ident(column)} = ${keepId}
        )`);
  }
  await tx.execute(
    sql`update ${ident(table)} set ${ident(column)} = ${keepId} where ${ident(column)} = ${dupId}`,
  );
}

/** Links of the duplicate (credits, tracklist) move only when the page kept has none. */
async function moveIfMissing(
  tx: DbOrTx,
  table: string,
  column: string,
  keepId: string,
  dupId: string,
) {
  await tx.execute(sql`
    update ${ident(table)} set ${ident(column)} = ${keepId}
    where ${ident(column)} = ${dupId}
      and not exists (select 1 from ${ident(table)} where ${ident(column)} = ${keepId})`);
  await tx.execute(sql`delete from ${ident(table)} where ${ident(column)} = ${dupId}`);
}

/**
 * Undated listens: at most one per member and target. A member with one on each page keeps
 * the most recently changed (it holds their current quick rating and heart); reviews and the
 * track ratings it did not have move over from the other one, which is deleted.
 */
async function mergeUndatedEntries(tx: DbOrTx, column: string, keepId: string, dupId: string) {
  const pairs = rowsOf<{ keep: string; drop: string }>(
    await tx.execute(sql`
      select
        case when "k"."updated_at" >= "d"."updated_at" then "k"."id" else "d"."id" end as keep,
        case when "k"."updated_at" >= "d"."updated_at" then "d"."id" else "k"."id" end as drop
      from "entries" "k"
      join "entries" "d" on "d"."user_id" = "k"."user_id"
      where "k".${ident(column)} = ${keepId} and "k"."listened_on" is null
        and "d".${ident(column)} = ${dupId} and "d"."listened_on" is null`),
  );
  for (const { keep, drop } of pairs) {
    await tx.execute(sql`update "reviews" set "entry_id" = ${keep} where "entry_id" = ${drop}`);
    await tx.execute(sql`
      update "track_ratings" set "entry_id" = ${keep}
      where "entry_id" = ${drop}
        and "track_id" not in (select "track_id" from "track_ratings" where "entry_id" = ${keep})`);
    await tx.execute(sql`delete from "entries" where "id" = ${drop}`);
  }
}

/** Members whose state for either page may change: they listened, rated or queued it. */
async function membersOf(tx: DbOrTx, kind: "release" | "track", ids: string[]) {
  const column = ident(COLUMN[kind]);
  const list = sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  const rows = rowsOf<{ userId: string }>(
    await tx.execute(sql`
      select "user_id" as "userId" from "entries" where ${column} in (${list})
      union
      select "user_id" from "user_item_state" where ${column} in (${list})
      ${
        kind === "track"
          ? sql`union
            select "e"."user_id" from "track_ratings" "r"
            join "entries" "e" on "e"."id" = "r"."entry_id"
            where "r"."track_id" in (${list})`
          : sql``
      }`),
  );
  return rows.map((r) => r.userId);
}

/**
 * Member states of a release or a track: "to listen" survives if either page had it, then
 * every state is derived again from the listens (`recomputeItemState`, which also outdates
 * the members' cached stats).
 */
async function mergeStates(
  tx: DbOrTx,
  kind: "release" | "track",
  keepId: string,
  dupId: string,
  users: string[],
) {
  const column = ident(COLUMN[kind]);
  await tx.execute(sql`
    update "user_item_state" "k" set "want_to_listen" = true
    from "user_item_state" "d"
    where "k".${column} = ${keepId} and "d".${column} = ${dupId}
      and "d"."user_id" = "k"."user_id" and "d"."want_to_listen"`);
  await repoint(tx, "user_item_state", COLUMN[kind], keepId, dupId, "user_id");
  const target = kind === "release" ? { releaseId: keepId } : { trackId: keepId };
  for (const userId of users) await recomputeItemState(tx, userId, target);
}

/**
 * Open reports: those the merge settles (duplicate reports on this pair, the report the merge
 * comes from, a reporter's second report on the same page) are resolved; the others move to the
 * page kept. Closed reports stay on the duplicate, as history.
 */
async function mergeReports(
  tx: DbOrTx,
  kind: CatalogKind,
  keepId: string,
  dupId: string,
  input: { reason: string; reportId?: string },
  moderatorId: string,
  now: Date,
) {
  const column = ident(COLUMN[kind]);
  const duplicate = ident(`duplicate_${COLUMN[kind]}`);
  const resolve = sql`
    update "reports" set "status" = 'resolved', "resolved_by_id" = ${moderatorId},
      "resolved_at" = ${now.toISOString()}::timestamptz, "resolution_note" = ${input.reason}`;
  await tx.execute(sql`${resolve}
    where "status" = 'open' and (
      (${column} in (${keepId}::uuid, ${dupId}::uuid) and ${duplicate} in (${keepId}::uuid, ${dupId}::uuid))
      ${input.reportId ? sql`or "id" = ${input.reportId}` : sql``}
      or (${column} = ${dupId} and "reporter_id" in (
        select "reporter_id" from "reports" where "status" = 'open' and ${column} = ${keepId}
      ))
    )`);
  await tx.execute(
    sql`update "reports" set ${column} = ${keepId} where "status" = 'open' and ${column} = ${dupId}`,
  );
  await tx.execute(
    sql`update "reports" set ${duplicate} = ${keepId} where "status" = 'open' and ${duplicate} = ${dupId}`,
  );
}

async function mergeRelease(tx: DbOrTx, keepId: string, dupId: string) {
  const users = await membersOf(tx, "release", [keepId, dupId]);
  await mergeUndatedEntries(tx, "release_id", keepId, dupId);
  await repoint(tx, "entries", "release_id", keepId, dupId);
  await mergeStates(tx, "release", keepId, dupId, users);
  await repoint(tx, "reviews", "release_id", keepId, dupId);
  await repoint(tx, "list_items", "release_id", keepId, dupId, "list_id");
  await repoint(tx, "favorites", "release_id", keepId, dupId, "user_id");
  await tx.execute(sql`
    update "releases" "k" set
      "cover_url" = coalesce("k"."cover_url", "d"."cover_url"),
      "language" = coalesce("k"."language", "d"."language"),
      "release_date" = coalesce("k"."release_date", "d"."release_date"),
      "release_date_precision" = case when "k"."release_date" is null
        then "d"."release_date_precision" else "k"."release_date_precision" end,
      "tracklist_imported_at" = case
        when not exists (select 1 from "release_tracks" where "release_id" = ${keepId})
          and exists (select 1 from "release_tracks" where "release_id" = ${dupId})
        then "d"."tracklist_imported_at" else "k"."tracklist_imported_at" end
    from "releases" "d"
    where "k"."id" = ${keepId} and "d"."id" = ${dupId}`);
  await moveIfMissing(tx, "release_artists", "release_id", keepId, dupId);
  await moveIfMissing(tx, "release_tracks", "release_id", keepId, dupId);
  await tx.execute(sql`
    insert into "release_genres" ("release_id", "genre_id")
    select ${keepId}, "genre_id" from "release_genres" where "release_id" = ${dupId}
    on conflict do nothing`);
  await tx.execute(sql`delete from "release_genres" where "release_id" = ${dupId}`);
}

async function mergeTrack(tx: DbOrTx, keepId: string, dupId: string) {
  const users = await membersOf(tx, "track", [keepId, dupId]);
  await mergeUndatedEntries(tx, "track_id", keepId, dupId);
  await repoint(tx, "entries", "track_id", keepId, dupId);
  await repoint(tx, "track_ratings", "track_id", keepId, dupId, "entry_id");
  await mergeStates(tx, "track", keepId, dupId, users);
  await repoint(tx, "reviews", "track_id", keepId, dupId);
  await repoint(tx, "list_items", "track_id", keepId, dupId, "list_id");
  await repoint(tx, "release_tracks", "track_id", keepId, dupId);
  await tx.execute(sql`
    update "tracks" "k" set "duration_ms" = coalesce("k"."duration_ms", "d"."duration_ms")
    from "tracks" "d" where "k"."id" = ${keepId} and "d"."id" = ${dupId}`);
  await moveIfMissing(tx, "track_artists", "track_id", keepId, dupId);
}

async function mergeArtist(tx: DbOrTx, keepId: string, dupId: string) {
  // Their stats count listens by artist: members who listened to the duplicate's records.
  const users = rowsOf<{ userId: string }>(
    await tx.execute(sql`
      select distinct "e"."user_id" as "userId" from "entries" "e"
      where "e"."artist_id" = ${dupId}
        or "e"."release_id" in (select "release_id" from "release_artists" where "artist_id" = ${dupId})
        or "e"."track_id" in (select "track_id" from "track_artists" where "artist_id" = ${dupId})`),
  );
  await repoint(tx, "entries", "artist_id", keepId, dupId);
  await repoint(tx, "user_item_state", "artist_id", keepId, dupId, "user_id");
  await repoint(tx, "reviews", "artist_id", keepId, dupId);
  await repoint(tx, "list_items", "artist_id", keepId, dupId, "list_id");
  await repoint(tx, "release_artists", "artist_id", keepId, dupId, "release_id");
  await repoint(tx, "track_artists", "artist_id", keepId, dupId, "track_id");
  await tx.execute(sql`
    update "artists" "k" set
      "sort_name" = coalesce("k"."sort_name", "d"."sort_name"),
      "disambiguation" = coalesce("k"."disambiguation", "d"."disambiguation"),
      "country" = coalesce("k"."country", "d"."country"),
      "type" = coalesce("k"."type", "d"."type"),
      "image_url" = coalesce("k"."image_url", "d"."image_url")
    from "artists" "d" where "k"."id" = ${keepId} and "d"."id" = ${dupId}`);
  for (const { userId } of users) await bumpStatsVersion(tx, userId);
}

/**
 * Merges `duplicate` into `keep` in one transaction, records the decision (subject "catalog",
 * action "resolve") and closes the reports it settles. Returns the page kept.
 */
export async function mergeCatalog(
  db: Db,
  moderatorId: string,
  input: CatalogMergeInput,
  now: Date,
): Promise<{ kind: CatalogKind; slug: string }> {
  return db.transaction(async (tx) => {
    const { keep, duplicate } = await mergePair(tx, input, true);
    let reportReason: (typeof reports.$inferSelect)["reason"] | undefined;
    if (input.reportId) {
      const [report] = await tx
        .select({ reason: reports.reason, status: reports.status })
        .from(reports)
        .where(eq(reports.id, input.reportId));
      if (!report || report.status !== "open") fail("NOT_FOUND", "REPORT_NOT_FOUND");
      reportReason = report.reason;
    }
    if (input.kind === "release") await mergeRelease(tx, keep.id, duplicate.id);
    else if (input.kind === "track") await mergeTrack(tx, keep.id, duplicate.id);
    else await mergeArtist(tx, keep.id, duplicate.id);
    await mergeReports(tx, input.kind, keep.id, duplicate.id, input, moderatorId, now);

    const table = ident(TABLE_NAMES[input.kind]);
    // One step only: pages merged into the duplicate now point to the page kept.
    await tx.execute(
      sql`update ${table} set "merged_into_id" = ${keep.id} where "merged_into_id" = ${duplicate.id}`,
    );
    await tx.execute(
      sql`update ${table} set "merged_into_id" = ${keep.id} where "id" = ${duplicate.id}`,
    );
    await record(
      tx,
      {
        action: "resolve",
        subject: "catalog",
        reason: input.reason,
        moderatorId,
        targetUserId: null,
        reportId: input.reportId,
        reportReason,
        excerpt: `${duplicate.title} (${duplicate.slug}) → ${keep.title} (${keep.slug})`,
        notify: false,
      },
      now,
    );
    return { kind: input.kind, slug: keep.slug };
  });
}
