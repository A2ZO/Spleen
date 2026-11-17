import { rowsOf, sql, type Db } from "@spleen/db";
import { todayIn } from "@spleen/validators";

import type { ReleaseFriends } from "../../types";
import { upcomingSql } from "../catalog/upcoming";
import { notBlockedWith } from "./relations";

/*
 * « Tes amis sur ce disque » (milestone 13, step 4): the members the viewer follows with a
 * rating or a heart on a record, in their current state. Read apart from `release.bySlug`
 * (the same for everyone), by slug, in the same wave. Left out, like the Friends feed:
 * blocks either way, suspended members, private diaries. Nothing at all (null) when no friend
 * has an opinion, on a record not out yet in the viewer's zone, and in blind listening until
 * the viewer has rated it.
 */

export const RELEASE_FRIENDS_SHOWN = 5;
export const RELEASE_FRIENDS_ALL = 100;

export interface ReleaseFriendsViewer {
  id: string;
  timeZone: string;
  /** Blind listening on. */
  blind: boolean;
}

interface FriendRow {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  rating: number | null;
  liked: boolean;
  total: number;
}

export async function releaseFriends(
  db: Db,
  viewer: ReleaseFriendsViewer,
  slug: string,
  now: Date,
  all = false,
): Promise<ReleaseFriends | null> {
  const today = todayIn(viewer.timeZone, now);
  // One query for the rows and the total (counted before the limit).
  const rows = rowsOf<FriendRow>(
    await db.execute(sql`
      select p.username, p.display_name as "displayName", p.avatar_url as "avatarUrl",
        s.rating, s.liked, (count(*) over ())::int as total
      from releases r
      join user_item_state s on s.release_id = r.id
      join follows f on f.follower_id = ${viewer.id} and f.followee_id = s.user_id
      join profiles p on p.user_id = s.user_id
      where r.slug = ${slug}
        and r.merged_into_id is null
        and (s.rating is not null or s.liked)
        and s.user_id <> ${viewer.id}
        and p.suspended_at is null
        and not p.diary_private
        and ${notBlockedWith(viewer.id, sql`s.user_id`)}
        and not coalesce(${upcomingSql(today, false)}, false)
        ${
          viewer.blind
            ? sql`and exists (select 1 from user_item_state m where m.user_id = ${viewer.id} and m.release_id = r.id and m.rating is not null)`
            : sql``
        }
      order by s.updated_at desc, p.username
      limit ${all ? RELEASE_FRIENDS_ALL : RELEASE_FRIENDS_SHOWN}
    `),
  );
  const first = rows[0];
  if (!first) return null;
  return {
    items: rows.map((r) => ({
      member: { username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl },
      rating: r.rating,
      liked: r.liked,
    })),
    total: Number(first.total),
  };
}
