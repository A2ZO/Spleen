import type { DbOrTx } from "../listening-state";
import { TERMS_VERSION } from "@spleen/validators";
import * as s from "../schema";
import { fixtureId } from "./fixtures";

/*
 * Social demo data: follows, likes, comments and their notifications between the demo
 * members, plus one member blocked by Camille. Times are relative to the seed's `now`, so a
 * fresh seed (`pnpm db:reset`) always has a lively week (the Popular tab counts 7 days).
 * Ids live in their own range (41_000+). Idempotent like the rest of the seed.
 */

const NUIT = fixtureId(301);
const VINCE = fixtureId(302);
const SAM = fixtureId(303);
const CRATE = fixtureId(40_001);
const NOISE = fixtureId(41_000);

const review = (n: number) => fixtureId(n);
const likeId = (i: number) => fixtureId(41_100 + i);
const commentId = (i: number) => fixtureId(41_200 + i);
const notificationId = (i: number) => fixtureId(41_300 + i);

const follows: [from: string, to: string, daysAgo: number][] = [
  [NUIT, VINCE, 120],
  [VINCE, NUIT, 110],
  [SAM, NUIT, 9],
  [SAM, VINCE, 8],
  [NUIT, CRATE, 6],
  [CRATE, NUIT, 5],
  [VINCE, CRATE, 0.5],
];

/** [liker, review fixture number, hours ago] */
const likes: [string, number, number][] = [
  [VINCE, 501, 70],
  [SAM, 501, 30],
  [CRATE, 501, 5],
  [VINCE, 506, 50],
  [NUIT, 502, 60],
  [CRATE, 502, 20],
  [NUIT, 507, 40],
  [SAM, 507, 26],
  [CRATE, 507, 3],
  [NUIT, 505, 48],
  [CRATE, 504, 12],
];

/** [author, review fixture number, review author, hours ago, body] */
const comments: [string, number, string, number, string][] = [
  [VINCE, 501, NUIT, 69, "That rain on the fourth track gets me every single time."],
  [
    CRATE,
    501,
    NUIT,
    6,
    "Trouvé en vinyle à la brocante grâce à toi. Il craque juste comme il faut.",
  ],
  [NUIT, 501, NUIT, 4, "Il sonne encore mieux un soir d'averse, tu verras."],
  [NUIT, 507, VINCE, 39, "Ce Hammond… je l'ai réécouté trois fois d'affilée."],
  [SAM, 507, VINCE, 25, "Merci pour la découverte, je ne connaissais pas."],
  [NUIT, 505, SAM, 47, "Bienvenue sur Spleen, Sam ! Belle première critique."],
];

const reviewAuthor: Record<number, string> = {
  501: NUIT,
  502: VINCE,
  504: VINCE,
  505: SAM,
  506: NUIT,
  507: VINCE,
};

/** Same grouping as the API (`lib/social/notifications.ts`); demo members live in Paris. */
const parisDay = (at: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(at);

/** Notifications older than this many hours are already read. */
const READ_AFTER_HOURS = 24;

export async function seedSocial(tx: DbOrTx, now: Date): Promise<void> {
  const ago = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);
  const joinedAt = ago(24 * 20);

  // A member Camille blocked (the blocks settings page is not empty).
  await tx
    .insert(s.user)
    .values({
      id: NOISE,
      name: "Bruit de fond",
      email: "bruitdefond@example.test",
      emailVerified: true,
      createdAt: joinedAt,
    })
    .onConflictDoNothing();
  await tx
    .insert(s.profiles)
    .values({
      userId: NOISE,
      username: "bruitdefond",
      displayName: "Bruit de fond",
      bio: "Je partage des liens. Beaucoup de liens.",
      ageConfirmedAt: joinedAt,
      termsAcceptedAt: joinedAt,
      termsVersion: TERMS_VERSION,
      createdAt: joinedAt,
    })
    .onConflictDoNothing();
  await tx
    .insert(s.blocks)
    .values({ blockerId: NUIT, blockedId: NOISE, createdAt: ago(24 * 3) })
    .onConflictDoNothing();

  await tx
    .insert(s.follows)
    .values(
      follows.map(([followerId, followeeId, days]) => ({
        followerId,
        followeeId,
        createdAt: ago(days * 24),
      })),
    )
    .onConflictDoNothing();

  await tx
    .insert(s.likes)
    .values(
      likes.map(([userId, n, hours], i) => ({
        id: likeId(i),
        userId,
        reviewId: review(n),
        createdAt: ago(hours),
      })),
    )
    .onConflictDoNothing();

  await tx
    .insert(s.comments)
    .values(
      comments.map(([userId, n, , hours, body], i) => ({
        id: commentId(i),
        userId,
        reviewId: review(n),
        body,
        createdAt: ago(hours),
        updatedAt: ago(hours),
      })),
    )
    .onConflictDoNothing();

  type Row = typeof s.notifications.$inferInsert;
  const notification = (
    userId: string,
    actorId: string,
    type: Row["type"],
    hours: number,
    subject: { reviewId?: string; commentId?: string } = {},
  ): Omit<Row, "id"> => {
    const at = ago(hours);
    const key = subject.reviewId ? `review:${subject.reviewId}` : `day:${parisDay(at)}`;
    return {
      userId,
      actorId,
      type,
      reviewId: subject.reviewId ?? null,
      commentId: subject.commentId ?? null,
      groupKey: `${type}:${key}`,
      readAt: hours > READ_AFTER_HOURS ? at : null,
      createdAt: at,
    };
  };
  const rows = [
    ...follows
      .filter(([, , days]) => days < 30)
      .map(([from, to, days]) => notification(to, from, "follow", days * 24)),
    ...likes.map(([userId, n, hours]) =>
      notification(reviewAuthor[n]!, userId, "like", hours, { reviewId: review(n) }),
    ),
    ...comments.flatMap(([userId, n, author, hours], i) =>
      userId === author
        ? []
        : [
            notification(author, userId, "comment", hours, {
              reviewId: review(n),
              commentId: commentId(i),
            }),
          ],
    ),
  ];
  await tx
    .insert(s.notifications)
    .values(rows.map((row, i) => ({ id: notificationId(i), ...row })))
    .onConflictDoNothing();
}
