import type { DbOrTx } from "../listening-state";
import { TERMS_VERSION } from "@spleen/validators";
import * as s from "../schema";
import { fixtureId, releases } from "./fixtures";

/*
 * Moderation demo data: an admin account (`lacontrebasse@example.test`, the role is set here
 * because the seed never runs in production; elsewhere only `pnpm admin:grant` sets it), a
 * spam comment, open reports of every kind for the queue, and one dismissed report with its
 * decision in the history. Ids live in their own range (44_000+). Idempotent.
 */

const NUIT = fixtureId(301);
const VINCE = fixtureId(302);
const SAM = fixtureId(303);
const CRATE = fixtureId(40_001);
const NOISE = fixtureId(41_000);
const ADMIN = fixtureId(44_000);
const SPAM_COMMENT = fixtureId(44_100);
const LINKS_LIST = fixtureId(43_002);

const reportId = (i: number) => fixtureId(44_200 + i);
const actionId = (i: number) => fixtureId(44_300 + i);

export async function seedModeration(tx: DbOrTx, now: Date): Promise<void> {
  const ago = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);
  const joinedAt = ago(24 * 200);

  await tx
    .insert(s.user)
    .values({
      id: ADMIN,
      name: "La Contrebasse",
      email: "lacontrebasse@example.test",
      emailVerified: true,
      createdAt: joinedAt,
    })
    .onConflictDoNothing();
  await tx
    .insert(s.profiles)
    .values({
      userId: ADMIN,
      username: "lacontrebasse",
      displayName: "La Contrebasse",
      bio: "Je tiens le rythme au fond de la salle. Modération de Spleen.",
      role: "admin",
      ageConfirmedAt: joinedAt,
      termsAcceptedAt: joinedAt,
      termsVersion: TERMS_VERSION,
      createdAt: joinedAt,
    })
    .onConflictDoNothing();

  await tx
    .insert(s.comments)
    .values({
      id: SPAM_COMMENT,
      userId: NOISE,
      reviewId: fixtureId(502),
      body: "Mes playlists sont bien meilleures !!! Lien dans ma bio, abonnez-vous 🔥🔥",
      createdAt: ago(30),
      updatedAt: ago(30),
    })
    .onConflictDoNothing();

  type Report = typeof s.reports.$inferInsert;
  const open: Omit<Report, "id">[] = [
    {
      reporterId: NUIT,
      reportedUserId: NOISE,
      reason: "spam",
      details: "Il poste des liens partout, en commentaire comme en liste.",
      createdAt: ago(50),
    },
    {
      reporterId: VINCE,
      commentId: SPAM_COMMENT,
      reason: "spam",
      details: "",
      createdAt: ago(28),
    },
    {
      reporterId: CRATE,
      listId: LINKS_LIST,
      reason: "spam",
      details: "Une liste qui sert juste de vitrine à ses liens.",
      createdAt: ago(20),
    },
    {
      reporterId: SAM,
      reviewId: fixtureId(506),
      reason: "spoiler",
      details: "Elle raconte la surprise du dernier morceau.",
      createdAt: ago(10),
    },
    {
      reporterId: SAM,
      releaseId: releases[0]!.id,
      reason: "catalog_error",
      details: "La date de sortie est fausse, il est sorti un an plus tôt.",
      createdAt: ago(6),
    },
    {
      reporterId: VINCE,
      reason: "catalog_addition",
      details: "Il manque « Moanin' » d'Art Blakey & The Jazz Messengers (1958).",
      createdAt: ago(3),
    },
  ];
  const dismissedAt = ago(24 * 6);
  await tx
    .insert(s.reports)
    .values([
      ...open.map((report, i) => ({ id: reportId(i), ...report, updatedAt: report.createdAt })),
      {
        id: reportId(open.length),
        reporterId: SAM,
        reviewId: fixtureId(507),
        reason: "other" as const,
        details: "Je ne suis pas d'accord avec cette critique.",
        status: "dismissed" as const,
        resolvedById: ADMIN,
        resolvedAt: dismissedAt,
        resolutionNote: "Un désaccord n'est pas un motif : la critique respecte les règles.",
        createdAt: ago(24 * 7),
        updatedAt: dismissedAt,
      },
    ])
    .onConflictDoNothing();
  await tx
    .insert(s.moderationActions)
    .values({
      id: actionId(0),
      action: "dismiss",
      subject: "review",
      reason: "Un désaccord n'est pas un motif : la critique respecte les règles.",
      reportReason: "other",
      moderatorId: ADMIN,
      targetUserId: VINCE,
      reviewId: fixtureId(507),
      reportId: reportId(open.length),
      excerpt: "",
      createdAt: dismissedAt,
    })
    .onConflictDoNothing();
}
