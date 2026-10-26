import type { DbOrTx } from "../listening-state";
import * as s from "../schema";
import { artists, fixtureId, releases } from "./fixtures";

/*
 * Demo lists beyond the mockup ones (601-603): a mixed list (releases, tracks, artists), a
 * ranked crate-digger list, and one by the member Camille blocked; plus likes and comments on
 * lists with their notifications. Ids live in their own range (43_000+). Runs after the
 * catalog, the crate and the social seeds.
 */

const NUIT = fixtureId(301);
const VINCE = fixtureId(302);
const SAM = fixtureId(303);
const BRUME = fixtureId(42_001);
const CRATE = fixtureId(40_001);
const NOISE = fixtureId(41_000);
const LOU = fixtureId(42_000);

const MIXTAPE = fixtureId(43_000);
const TROUVAILLES = fixtureId(43_001);
const LINKS = fixtureId(43_002);
const RAIN = fixtureId(601);
const TOP = fixtureId(602);
const ORGAN = fixtureId(603);

const itemId = (i: number) => fixtureId(43_100 + i);
const likeId = (i: number) => fixtureId(43_300 + i);
const commentId = (i: number) => fixtureId(43_400 + i);
const notificationId = (i: number) => fixtureId(43_500 + i);

/** Same ids as the main seed: track `n` (1-based) of a fixture release. */
const trackOf = (releaseSlug: string, n: number) =>
  fixtureId(10_000 + releases.findIndex((r) => r.slug === releaseSlug) * 100 + n);
const releaseOf = (slug: string) => releases.find((r) => r.slug === slug)!.id;
const artistOf = (slug: string) => artists.find((a) => a.slug === slug)!.id;
/** Crate digger records (`seed/crate.ts`). */
const crateRecord = (i: number) => fixtureId(40_101 + i);

type Item = { releaseId: string } | { trackId: string } | { artistId: string };

const lists: {
  id: string;
  userId: string;
  title: string;
  description: string;
  ranked: boolean;
  items: Item[];
}[] = [
  {
    id: MIXTAPE,
    userId: VINCE,
    title: "Late-night mixtape",
    description: "Whole records, single tracks and a few people worth following, in playing order.",
    ranked: false,
    items: [
      { releaseId: releaseOf("smoke-rings-at-1-am") },
      { trackId: trackOf("paper-moon-motel", 1) },
      { artistId: artistOf("dee-marlowe") },
      { trackId: trackOf("gold-leaf-sessions", 2) },
      { releaseId: releaseOf("midnight-blue-avenue") },
      { artistId: artistOf("mira-okafor") },
    ],
  },
  {
    id: TROUVAILLES,
    userId: CRATE,
    title: "Mes plus belles trouvailles de brocante",
    description: "Classées par coup de cœur, du plus fort au plus tendre.",
    ranked: true,
    items: [0, 4, 9, 2, 13, 7].map((i) => ({ releaseId: crateRecord(i) })),
  },
  {
    id: LINKS,
    userId: NOISE,
    title: "Écoutez ça, vraiment",
    description: "Une sélection. Il y en aura d'autres.",
    ranked: false,
    items: [{ releaseId: releaseOf("sous-le-periph") }, { releaseId: releaseOf("beton-velours") }],
  },
];

/** [liker, list, hours ago] */
const likes: [string, string, number][] = [
  [LOU, RAIN, 40],
  [SAM, RAIN, 22],
  [CRATE, RAIN, 8],
  [BRUME, ORGAN, 30],
  [LOU, ORGAN, 12],
  [BRUME, MIXTAPE, 18],
  [LOU, MIXTAPE, 5],
  [BRUME, TROUVAILLES, 26],
];

/** [author, list, list owner, hours ago, body] */
const comments: [string, string, string, number, string][] = [
  [LOU, RAIN, NUIT, 39, "Adding Paper Moon Motel to my rainy-day pile right now."],
  [NUIT, RAIN, NUIT, 30, "Il lui va si bien, ce disque, un jour de pluie."],
  [BRUME, MIXTAPE, VINCE, 17, "Le passage du morceau à Dee Marlowe, quelle idée parfaite."],
  // Hidden from Camille (she blocked this member) and left out of her comment count.
  [NOISE, MIXTAPE, VINCE, 9, "Pas mal. J'ai une liste bien meilleure sur mon profil."],
  [SAM, TROUVAILLES, CRATE, 20, "Tu me prêtes le numéro 3 ?"],
];

export async function seedLists(tx: DbOrTx, now: Date): Promise<void> {
  const ago = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

  await tx
    .insert(s.lists)
    .values(
      lists.map(({ items: _items, ...list }, i) => ({
        ...list,
        createdAt: ago(24 * (10 - i)),
        updatedAt: ago(24 * (2 + i)),
      })),
    )
    .onConflictDoNothing();
  await tx
    .insert(s.listItems)
    .values(
      lists.flatMap((list, li) =>
        list.items.map((item, i) => ({
          id: itemId(li * 50 + i),
          listId: list.id,
          ...item,
          position: i + 1,
        })),
      ),
    )
    .onConflictDoNothing();

  await tx
    .insert(s.likes)
    .values(
      likes.map(([userId, listId, hours], i) => ({
        id: likeId(i),
        userId,
        listId,
        createdAt: ago(hours),
      })),
    )
    .onConflictDoNothing();
  await tx
    .insert(s.comments)
    .values(
      comments.map(([userId, listId, , hours, body], i) => ({
        id: commentId(i),
        userId,
        listId,
        body,
        createdAt: ago(hours),
        updatedAt: ago(hours),
      })),
    )
    .onConflictDoNothing();

  const owners = new Map<string, string>([
    [RAIN, NUIT],
    [TOP, NUIT],
    [ORGAN, VINCE],
    ...lists.map((l): [string, string] => [l.id, l.userId]),
  ]);
  type Row = typeof s.notifications.$inferInsert;
  const notification = (
    type: "like" | "comment",
    actorId: string,
    listId: string,
    hours: number,
    commentRef: string | null = null,
  ): Omit<Row, "id"> => {
    const at = ago(hours);
    return {
      userId: owners.get(listId)!,
      actorId,
      type,
      listId,
      commentId: commentRef,
      groupKey: `${type}:list:${listId}`,
      readAt: hours > 24 ? at : null,
      createdAt: at,
    };
  };
  const rows = [
    ...likes.map(([userId, listId, hours]) => notification("like", userId, listId, hours)),
    ...comments.flatMap(([userId, listId, owner, hours], i) =>
      userId === owner ? [] : [notification("comment", userId, listId, hours, commentId(i))],
    ),
  ];
  await tx
    .insert(s.notifications)
    .values(rows.map((row, i) => ({ id: notificationId(i), ...row })))
    .onConflictDoNothing();
}
