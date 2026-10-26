import { and, asc, desc, eq, isNull, schema, sql, type Db, type DbOrTx } from "@spleen/db";
import {
  LIST_ITEMS_MAX,
  type ListCreateInput,
  type ListTargetInput,
  type ListUpdateInput,
} from "@spleen/validators";

import { fail } from "../trpc";
import type { ListDetail, ListItem, MyList } from "../types";
import { loadArtistCards, loadReleaseCards, loadTrackCards, toReleaseCard } from "./catalog/cards";
import { maskRelease, ratedReleaseIds } from "./listening/blind";
import { requireListener } from "./listening/targets";
import { moderationHold } from "./moderation/holds";
import { isBlockedBetween, memberRefs, notBlockedWith } from "./social/relations";
import { visibleTo } from "./social/reviews";
import type { Viewer } from "./viewer";

/*
 * Lists: a title, a description, ranked or not, and up to LIST_ITEMS_MAX items mixing
 * releases, tracks and artists, each at most once. Only the owner edits a list; anyone
 * reads it. Likes and comments go through the social API (subject `{ kind: "list" }`).
 */

const { artists, listItems, lists, profiles, releases, tracks } = schema;

export const LIST_PAGE_SIZE = 50;

type ListTarget = { releaseId: string } | { trackId: string } | { artistId: string };

function toListTarget(input: ListTargetInput): ListTarget {
  if (input.kind === "release") return { releaseId: input.id };
  if (input.kind === "track") return { trackId: input.id };
  return { artistId: input.id };
}

/** `list_items` column holding this kind of target. */
function itemColumn(input: ListTargetInput) {
  if (input.kind === "release") return listItems.releaseId;
  if (input.kind === "track") return listItems.trackId;
  return listItems.artistId;
}

async function requireListTarget(db: DbOrTx, input: ListTargetInput): Promise<ListTarget> {
  const table = input.kind === "release" ? releases : input.kind === "track" ? tracks : artists;
  const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, input.id));
  if (!row) fail("NOT_FOUND", "ITEM_NOT_FOUND");
  return toListTarget(input);
}

/**
 * The caller's list, locked for the rest of the transaction so that concurrent additions
 * cannot both take the last slot or the same position. Someone else's list is "not found".
 */
async function lockOwnList(tx: DbOrTx, userId: string, listId: string) {
  const [row] = await tx
    .select({ id: lists.id, userId: lists.userId })
    .from(lists)
    .where(eq(lists.id, listId))
    .for("update");
  if (!row || row.userId !== userId) fail("NOT_FOUND", "LIST_NOT_FOUND");
  return row;
}

const touch = (tx: DbOrTx, listId: string) =>
  tx.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, listId));

/** Appends a target at the end of a locked list. */
async function appendItem(tx: DbOrTx, listId: string, input: ListTargetInput): Promise<string> {
  const target = await requireListTarget(tx, input);
  const [stats] = await tx
    .select({
      total: sql<number>`count(*)::int`,
      last: sql<number | null>`max(${listItems.position})`,
      present: sql<number>`count(*) filter (where ${itemColumn(input)} = ${input.id})::int`,
    })
    .from(listItems)
    .where(eq(listItems.listId, listId));
  if (stats!.present > 0) fail("CONFLICT", "LIST_ITEM_EXISTS");
  if (stats!.total >= LIST_ITEMS_MAX) fail("BAD_REQUEST", "LIST_FULL");
  const [item] = await tx
    .insert(listItems)
    .values({ listId, ...target, position: (stats!.last ?? 0) + 1 })
    .returning({ id: listItems.id });
  return item!.id;
}

export async function createList(
  db: Db,
  userId: string,
  input: ListCreateInput,
): Promise<{ id: string }> {
  await requireListener(db, userId);
  return db.transaction(async (tx) => {
    const [list] = await tx
      .insert(lists)
      .values({
        userId,
        title: input.title,
        description: input.description,
        ranked: input.ranked,
      })
      .returning({ id: lists.id });
    if (input.item) await appendItem(tx, list!.id, input.item);
    return { id: list!.id };
  });
}

export async function updateList(db: Db, userId: string, input: ListUpdateInput): Promise<void> {
  await db.transaction(async (tx) => {
    await lockOwnList(tx, userId, input.id);
    await tx
      .update(lists)
      .set({ title: input.title, description: input.description, ranked: input.ranked })
      .where(eq(lists.id, input.id));
  });
}

/** Deletes the list with its items, likes, comments and their notifications (cascade). */
export async function deleteList(db: Db, userId: string, listId: string): Promise<void> {
  const deleted = await db
    .delete(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)))
    .returning({ id: lists.id });
  if (deleted.length === 0) fail("NOT_FOUND", "LIST_NOT_FOUND");
}

export async function addListItem(
  db: Db,
  userId: string,
  listId: string,
  target: ListTargetInput,
): Promise<{ itemId: string }> {
  return db.transaction(async (tx) => {
    await lockOwnList(tx, userId, listId);
    const itemId = await appendItem(tx, listId, target);
    await touch(tx, listId);
    return { itemId };
  });
}

/** Removing an item already gone is a no-op: the member sees the same result. */
export async function removeListItem(
  db: Db,
  userId: string,
  listId: string,
  itemId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockOwnList(tx, userId, listId);
    const removed = await tx
      .delete(listItems)
      .where(and(eq(listItems.id, itemId), eq(listItems.listId, listId)))
      .returning({ id: listItems.id });
    if (removed.length > 0) await touch(tx, listId);
  });
}

/** New order of the same items (first one first); adding or dropping one is refused. */
export async function reorderList(
  db: Db,
  userId: string,
  listId: string,
  itemIds: string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockOwnList(tx, userId, listId);
    const current = await tx
      .select({ id: listItems.id })
      .from(listItems)
      .where(eq(listItems.listId, listId));
    const wanted = new Set(itemIds);
    const same =
      wanted.size === itemIds.length &&
      itemIds.length === current.length &&
      current.every((r) => wanted.has(r.id));
    if (!same) fail("CONFLICT", "LIST_MISMATCH");
    if (itemIds.length === 0) return;
    const ids = sql`array[${sql.join(
      itemIds.map((id) => sql`${id}`),
      sql`, `,
    )}]::uuid[]`;
    await tx.execute(
      sql`update "list_items" set "position" = array_position(${ids}, "id") where "list_id" = ${listId}`,
    );
    await touch(tx, listId);
  });
}

/** Cards of one page of items, in order; ratings follow the viewer's blind listening. */
async function loadListItems(
  db: Db,
  rows: { id: string; releaseId: string | null; trackId: string | null; artistId: string | null }[],
  offset: number,
  viewer: Viewer,
): Promise<ListItem[]> {
  const releaseIds = rows.flatMap((r) => r.releaseId ?? []);
  const trackIds = rows.flatMap((r) => r.trackId ?? []);
  const [releaseCards, trackCards, artistCards, rated] = await Promise.all([
    loadReleaseCards(db, releaseIds),
    loadTrackCards(db, trackIds),
    loadArtistCards(
      db,
      rows.flatMap((r) => r.artistId ?? []),
    ),
    viewer.blind ? ratedReleaseIds(db, viewer.blind.userId, releaseIds, trackIds) : null,
  ]);
  const mask = <T extends Parameters<typeof maskRelease>[1]>(card: T) =>
    rated ? maskRelease(rated, card) : card;
  const releaseById = new Map(releaseCards.map((c) => [c.id, mask(toReleaseCard(c))]));
  const trackById = new Map(
    trackCards.map((t) => [t.id, { ...t, release: t.release ? mask(t.release) : null }]),
  );
  const artistById = new Map(artistCards.map((a) => [a.id, a]));
  return rows.flatMap((row, index): ListItem[] => {
    const position = offset + index + 1;
    const release = row.releaseId ? releaseById.get(row.releaseId) : undefined;
    if (release) return [{ id: row.id, position, kind: "release", release }];
    const track = row.trackId ? trackById.get(row.trackId) : undefined;
    if (track) return [{ id: row.id, position, kind: "track", track }];
    const artist = row.artistId ? artistById.get(row.artistId) : undefined;
    return artist ? [{ id: row.id, position, kind: "artist", artist }] : [];
  });
}

/**
 * A list page (null when it does not exist). Blocks either way leave the list readable but
 * remove the like and comment buttons, and hide the blocked members' comments from the
 * count (except on the viewer's own list, where they can still delete them). A list hidden by
 * moderation is shown to its owner alone, with the reason and no likes nor comments.
 */
export async function getListDetail(
  db: Db,
  id: string,
  viewer: Viewer,
  page: number,
  contactEmail: string | null,
): Promise<ListDetail | null> {
  // Spelled with table names: drizzle drops the qualifiers on single-table selects.
  const hiddenComments = viewer.id
    ? sql`and ("lists"."user_id" = ${viewer.id} or ${notBlockedWith(viewer.id, sql`"comments"."user_id"`)})`
    : sql``;
  const [list] = await db
    .select({
      id: lists.id,
      userId: lists.userId,
      title: lists.title,
      description: lists.description,
      ranked: lists.ranked,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt,
      hiddenAt: lists.hiddenAt,
      total: sql<number>`(select count(*)::int from "list_items" where "list_items"."list_id" = "lists"."id")`,
      likeCount: sql<number>`(select count(*)::int from "likes" where "likes"."list_id" = "lists"."id")`,
      commentCount: sql<number>`(select count(*)::int from "comments" where "comments"."list_id" = "lists"."id" and "comments"."deleted_at" is null and "comments"."hidden_at" is null ${hiddenComments})`,
      viewerLiked: viewer.id
        ? sql<boolean>`exists (select 1 from "likes" where "likes"."list_id" = "lists"."id" and "likes"."user_id" = ${viewer.id})`
        : sql<boolean>`false`,
    })
    .from(lists)
    .where(and(eq(lists.id, id), visibleTo(lists, viewer.id)));
  if (!list) return null;
  const isOwner = viewer.id === list.userId;
  const offset = (page - 1) * LIST_PAGE_SIZE;
  const [owners, rows, hasProfile, blocked, hidden] = await Promise.all([
    memberRefs(db, [list.userId]),
    db
      .select({
        id: listItems.id,
        releaseId: listItems.releaseId,
        trackId: listItems.trackId,
        artistId: listItems.artistId,
      })
      .from(listItems)
      .where(eq(listItems.listId, id))
      .orderBy(asc(listItems.position), asc(listItems.id))
      .limit(LIST_PAGE_SIZE)
      .offset(offset),
    viewer.id
      ? db
          .select({ id: profiles.userId })
          .from(profiles)
          .where(eq(profiles.userId, viewer.id))
          .then((r) => r.length > 0)
      : false,
    viewer.id && !isOwner ? isBlockedBetween(db, viewer.id, list.userId) : false,
    moderationHold(db, "listId", id, !!list.hiddenAt, contactEmail),
  ]);
  const owner = owners.get(list.userId);
  if (!owner) return null;
  const items = await loadListItems(db, rows, offset, viewer);
  const canComment = hasProfile && !blocked && !hidden;
  return {
    id: list.id,
    title: list.title,
    description: list.description,
    ranked: list.ranked,
    owner,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    items: {
      items,
      page,
      pageCount: Math.max(1, Math.ceil(list.total / LIST_PAGE_SIZE)),
      total: list.total,
    },
    likeCount: list.likeCount,
    commentCount: list.commentCount,
    viewerLiked: list.viewerLiked,
    isOwner,
    canLike: canComment && !isOwner,
    canComment,
    hidden,
  };
}

/** The caller's lists, last edited first; with a target, whether each one holds it. */
export async function getMyLists(
  db: Db,
  userId: string,
  target?: ListTargetInput,
): Promise<MyList[]> {
  const itemId = target
    ? sql<
        string | null
      >`(array_agg(${listItems.id}) filter (where ${itemColumn(target)} = ${target.id}))[1]`
    : sql<string | null>`null`;
  const rows = await db
    .select({
      id: lists.id,
      title: lists.title,
      ranked: lists.ranked,
      itemCount: sql<number>`count(${listItems.id})::int`,
      itemId,
    })
    .from(lists)
    .leftJoin(listItems, eq(listItems.listId, lists.id))
    .where(and(eq(lists.userId, userId), isNull(lists.hiddenAt)))
    .groupBy(lists.id)
    .orderBy(desc(lists.updatedAt));
  return rows;
}
