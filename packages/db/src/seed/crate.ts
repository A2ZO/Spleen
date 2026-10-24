import type { DbOrTx } from "../listening-state";
import { recomputeItemState } from "../listening-state";
import * as s from "../schema";
import { fixtureId } from "./fixtures";
import { slugify } from "./slugify";

/*
 * "Crate digger" demo member: 30 fictional records, each listened to once and given a heart,
 * so the paged profile sections (Hearts: 24 per page) always have a second page.
 * Ids live in their own range (40_000+) to stay clear of the mockup fixtures.
 */

const ARTIST_ID = fixtureId(40_000);
const USER_ID = fixtureId(40_001);
const releaseId = (i: number) => fixtureId(40_101 + i);
const entryId = (i: number) => fixtureId(40_201 + i);

export const CRATE_USERNAME = "fouilleuse";

const titles = [
  "Brume sur le canal",
  "Néons de novembre",
  "Le Zinc à minuit",
  "Velours côtelé",
  "Tram 3, dernier passage",
  "Ardoise et cendres",
  "Les Lanternes du port",
  "Dimanche en sourdine",
  "Pluie oblique",
  "Café des Insomnies",
  "Halo de réverbère",
  "Contrebasse et parapluie",
  "Quai des Brumes, face B",
  "Saxophone de location",
  "Fenêtre sur cour",
  "La Ville sans sommeil",
  "Tabac fermé",
  "Hôtel du Nord, chambre 12",
  "Feuilles mortes en mineur",
  "Swing de la gare",
  "Lumière de juke-box",
  "Banquette de moleskine",
  "Pianiste du troisième",
  "Ciel de traîne",
  "Ruelle aux chats",
  "Dernier métro",
  "Fumée bleue",
  "Accordéon électrique",
  "Les Heures creuses",
  "Bonsoir Paris",
];

/**
 * Seeds the crate member inside the main seed transaction. `genreIds` are the seeded genres
 * (cycled over the records). Idempotent like the rest of the seed.
 */
export async function seedCrate(tx: DbOrTx, genreIds: string[]): Promise<void> {
  const joinedAt = new Date("2026-01-03T12:00:00Z");

  await tx
    .insert(s.artists)
    .values({ id: ARTIST_ID, slug: "les-fouilleurs", name: "Les Fouilleurs" })
    .onConflictDoNothing();
  await tx
    .insert(s.releases)
    .values(
      titles.map((title, i) => ({
        id: releaseId(i),
        slug: slugify(title),
        title,
        type: "album" as const,
        // One record every ~2 years since 1958: every decade gets a few.
        releaseDate: `${1958 + i * 2}-0${(i % 9) + 1}-15`,
        releaseDatePrecision: "day" as const,
        language: "fr",
      })),
    )
    .onConflictDoNothing();
  await tx
    .insert(s.releaseArtists)
    .values(titles.map((_, i) => ({ releaseId: releaseId(i), artistId: ARTIST_ID, position: 1 })))
    .onConflictDoNothing();
  if (genreIds.length > 0) {
    await tx
      .insert(s.releaseGenres)
      .values(
        titles.map((_, i) => ({
          releaseId: releaseId(i),
          genreId: genreIds[i % genreIds.length]!,
        })),
      )
      .onConflictDoNothing();
  }

  await tx
    .insert(s.user)
    .values({
      id: USER_ID,
      name: "Margot",
      email: `${CRATE_USERNAME}@example.test`,
      emailVerified: true,
      createdAt: joinedAt,
    })
    .onConflictDoNothing();
  await tx
    .insert(s.profiles)
    .values({
      userId: USER_ID,
      username: CRATE_USERNAME,
      displayName: "Margot",
      bio: "Je fouille les bacs des brocantes le dimanche. Trente coups de cœur et ça ne fait que commencer.",
      ageConfirmedAt: joinedAt,
      createdAt: joinedAt,
    })
    .onConflictDoNothing();
  await tx
    .insert(s.favorites)
    .values(
      [0, 1, 2, 3].map((i) => ({ userId: USER_ID, position: i + 1, releaseId: releaseId(i) })),
    )
    .onConflictDoNothing();

  // One dated, liked listen per record, every 9 days from January 2026 (edit time = listening
  // evening, so the Hearts tab lists the most recent ones first).
  await tx
    .insert(s.entries)
    .values(
      titles.map((_, i) => {
        const day = new Date(Date.UTC(2026, 0, 5 + i * 9));
        const listenedOn = day.toISOString().slice(0, 10);
        const editedAt = new Date(`${listenedOn}T21:00:00Z`);
        return {
          id: entryId(i),
          userId: USER_ID,
          releaseId: releaseId(i),
          listenedOn,
          rating: 6 + (i % 5),
          liked: true,
          format: i % 3 === 0 ? ("vinyl" as const) : null,
          createdAt: editedAt,
          updatedAt: editedAt,
        };
      }),
    )
    .onConflictDoNothing();
  for (let i = 0; i < titles.length; i++) {
    await recomputeItemState(tx, USER_ID, { releaseId: releaseId(i) });
  }
}
