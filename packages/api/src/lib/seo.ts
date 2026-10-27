import { rowsOf, sql, type Db, type SQL } from "@spleen/db";

import type { OgCard, SeoPage, SitemapEntry } from "../types";

/*
 * Search engines and link previews. One rule decides what is worth indexing, used both by the
 * sitemap and by each page's robots meta, so they never disagree:
 * - releases: complete ones (not a stub waiting for its tracklist), not merged;
 * - artists: not merged, with at least one complete release;
 * - lists: not hidden, owner not suspended, at least one item;
 * - profiles: not suspended, with some public activity (a visible review, a non-empty visible
 *   list, or a listen in a public diary);
 * - reviews: not hidden, author not suspended (never in the sitemap: they are reached from
 *   their record).
 * Open Graph images exist for releases, profiles (public diary only), reviews and lists that
 * anyone may see; their version changes when what the image shows changes.
 */

export type SitemapKind = "releases" | "artists" | "lists" | "profiles";
export type SeoKind = "release" | "artist" | "list" | "profile" | "review";

/** URLs per sitemap file and per locale (well under the 50 000 limit, both locales included). */
export const SITEMAP_CHUNK = 5_000;

const completeRelease = (r: string) =>
  sql.raw(
    `${r}.merged_into_id is null and (${r}.mbid is null or ${r}.tracklist_imported_at is not null)`,
  );
const notSuspended = (userId: string) =>
  sql.raw(
    `not exists (select 1 from profiles sp where sp.user_id = ${userId} and sp.suspended_at is not null)`,
  );

const SOURCES: Record<
  SitemapKind,
  { from: SQL; where: SQL; path: SQL; lastModified: SQL; order: SQL }
> = {
  releases: {
    from: sql`releases r`,
    where: completeRelease("r"),
    path: sql`'/album/' || r.slug`,
    lastModified: sql`r.updated_at`,
    order: sql`r.id`,
  },
  artists: {
    from: sql`artists a`,
    where: sql`a.merged_into_id is null and exists (
      select 1 from release_artists ra join releases r on r.id = ra.release_id
      where ra.artist_id = a.id and ${completeRelease("r")})`,
    path: sql`'/artist/' || a.slug`,
    lastModified: sql`a.updated_at`,
    order: sql`a.id`,
  },
  lists: {
    from: sql`lists l`,
    where: sql`l.hidden_at is null and ${notSuspended("l.user_id")}
      and exists (select 1 from list_items li where li.list_id = l.id)`,
    path: sql`'/list/' || l.id`,
    lastModified: sql`l.updated_at`,
    order: sql`l.id`,
  },
  profiles: {
    from: sql`profiles p`,
    where: sql`p.suspended_at is null and (
      exists (select 1 from reviews rv where rv.user_id = p.user_id and rv.hidden_at is null)
      or exists (select 1 from lists l where l.user_id = p.user_id and l.hidden_at is null
        and exists (select 1 from list_items li where li.list_id = l.id))
      or (not p.diary_private and exists (
        select 1 from entries e where e.user_id = p.user_id and e.listened_on is not null)))`,
    path: sql`'/u/' || p.username`,
    lastModified: sql`greatest(
      p.updated_at,
      (select max(rv.updated_at) from reviews rv where rv.user_id = p.user_id and rv.hidden_at is null),
      (select max(l.updated_at) from lists l where l.user_id = p.user_id and l.hidden_at is null),
      case when p.diary_private then null
        else (select max(e.created_at) from entries e where e.user_id = p.user_id) end)`,
    order: sql`p.user_id`,
  },
};

/** How many sitemap files each kind needs (at least one, possibly empty). */
export async function sitemapFiles(db: Db): Promise<Record<SitemapKind, number>> {
  const counts = await Promise.all(
    (Object.keys(SOURCES) as SitemapKind[]).map(async (kind) => {
      const { from, where } = SOURCES[kind];
      const [row] = rowsOf<{ n: number }>(
        await db.execute(sql`select count(*)::int as n from ${from} where ${where}`),
      );
      return [kind, Math.max(1, Math.ceil((row?.n ?? 0) / SITEMAP_CHUNK))] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<SitemapKind, number>;
}

/** One sitemap file: paths without the locale, with their last change. */
export async function sitemapEntries(
  db: Db,
  kind: SitemapKind,
  page: number,
): Promise<SitemapEntry[]> {
  const { from, where, path, lastModified, order } = SOURCES[kind];
  const rows = rowsOf<{ path: string; last_modified: string | Date }>(
    await db.execute(sql`
      select ${path} as path, ${lastModified} as last_modified
      from ${from} where ${where}
      order by ${order}
      limit ${SITEMAP_CHUNK} offset ${(page - 1) * SITEMAP_CHUNK}`),
  );
  return rows.map((r) => ({ path: r.path, lastModified: new Date(r.last_modified).toISOString() }));
}

const version = (at: string | Date) => new Date(at).getTime().toString(36);

/**
 * Whether a page may be indexed, and the version of its Open Graph image (null: no image,
 * e.g. hidden content, suspended member, private diary). Null when the page does not exist
 * for visitors.
 */
export async function seoPage(db: Db, kind: SeoKind, key: string): Promise<SeoPage | null> {
  switch (kind) {
    case "release": {
      const [row] = rowsOf<{ indexable: boolean; at: string }>(
        await db.execute(sql`
          select ${completeRelease("r")} as indexable, r.updated_at as at
          from releases r where r.slug = ${key} and r.merged_into_id is null`),
      );
      return row ? { indexable: row.indexable, og: version(row.at) } : null;
    }
    case "artist": {
      const [row] = rowsOf<{ indexable: boolean }>(
        await db.execute(sql`
          select ${SOURCES.artists.where} as indexable
          from artists a where a.slug = ${key} and a.merged_into_id is null`),
      );
      return row ? { indexable: row.indexable, og: null } : null;
    }
    case "list": {
      const [row] = rowsOf<{ indexable: boolean; at: string }>(
        await db.execute(sql`
          select ${SOURCES.lists.where} as indexable, l.updated_at as at
          from lists l
          where l.id = ${key}::uuid and l.hidden_at is null and ${notSuspended("l.user_id")}`),
      );
      return row ? { indexable: row.indexable, og: version(row.at) } : null;
    }
    case "profile": {
      const [row] = rowsOf<{ indexable: boolean; at: string; private: boolean }>(
        await db.execute(sql`
          select ${SOURCES.profiles.where} as indexable, ${SOURCES.profiles.lastModified} as at,
            p.diary_private as private
          from profiles p
          where lower(p.username) = ${key.toLowerCase()} and p.suspended_at is null`),
      );
      return row ? { indexable: row.indexable, og: row.private ? null : version(row.at) } : null;
    }
    case "review": {
      const [row] = rowsOf<{ at: string }>(
        await db.execute(sql`
          select rv.updated_at as at from reviews rv
          where rv.id = ${key}::uuid and rv.hidden_at is null and ${notSuspended("rv.user_id")}`),
      );
      return row ? { indexable: true, og: version(row.at) } : null;
    }
  }
}

/** What an Open Graph image shows; null when nobody but its owner may see it. */
export async function ogCard(db: Db, kind: SeoKind, key: string): Promise<OgCard | null> {
  const page = await seoPage(db, kind, key);
  if (!page?.og) return null;
  const artistsOf = (release: string) =>
    sql.raw(`(select string_agg(coalesce(ra.credit_name, a.name), ', ' order by ra.position)
      from release_artists ra join artists a on a.id = ra.artist_id where ra.release_id = ${release})`);
  switch (kind) {
    case "release": {
      const [row] = rowsOf<{
        title: string;
        artists: string | null;
        year: string | null;
        cover: string | null;
      }>(
        await db.execute(sql`
          select r.title, ${artistsOf("r.id")} as artists,
            extract(year from r.release_date)::int::text as year, r.cover_url as cover
          from releases r where r.slug = ${key}`),
      );
      return row
        ? {
            kind,
            version: page.og,
            title: row.title,
            subtitle: row.artists ?? "",
            year: row.year,
            covers: row.cover ? [row.cover] : [],
          }
        : null;
    }
    case "review": {
      const [row] = rowsOf<{
        title: string;
        artists: string | null;
        cover: string | null;
        author: string;
        rating: number | null;
        body: string;
      }>(
        await db.execute(sql`
          select coalesce(t.title, r.title) as title,
            ${artistsOf("r.id")} as artists, r.cover_url as cover,
            p.display_name as author, rv.rating, rv.body
          from reviews rv
          join profiles p on p.user_id = rv.user_id
          left join tracks t on t.id = rv.track_id
          left join releases r on r.id = coalesce(rv.release_id,
            (select rt.release_id from release_tracks rt where rt.track_id = rv.track_id limit 1))
          where rv.id = ${key}::uuid`),
      );
      return row
        ? {
            kind,
            version: page.og,
            title: row.title,
            subtitle: row.artists ?? "",
            author: row.author,
            rating: row.rating,
            excerpt: row.body.replace(/\s+/g, " ").trim().slice(0, 220),
            covers: row.cover ? [row.cover] : [],
          }
        : null;
    }
    case "list": {
      const [row] = rowsOf<{
        title: string;
        owner: string;
        items: number;
        covers: string[] | null;
      }>(
        await db.execute(sql`
          select l.title, p.display_name as owner,
            (select count(*)::int from list_items li where li.list_id = l.id) as items,
            (select array_agg(c.cover_url) from (
              select r.cover_url from list_items li join releases r on r.id = li.release_id
              where li.list_id = l.id and r.cover_url is not null
              order by li.position limit 4) c) as covers
          from lists l join profiles p on p.user_id = l.user_id
          where l.id = ${key}::uuid`),
      );
      return row
        ? {
            kind,
            version: page.og,
            title: row.title,
            subtitle: row.owner,
            items: row.items,
            covers: row.covers ?? [],
          }
        : null;
    }
    case "profile": {
      const [row] = rowsOf<{ name: string; username: string; avatar: string | null; bio: string }>(
        await db.execute(sql`
          select p.display_name as name, p.username, p.avatar_url as avatar, p.bio
          from profiles p where lower(p.username) = ${key.toLowerCase()}`),
      );
      return row
        ? {
            kind,
            version: page.og,
            title: row.name,
            subtitle: `@${row.username}`,
            excerpt: row.bio.replace(/\s+/g, " ").trim().slice(0, 160),
            covers: row.avatar ? [row.avatar] : [],
          }
        : null;
    }
    case "artist":
      return null;
  }
}
