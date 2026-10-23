import type { AudienceLang, ListenFormat } from "@spleen/validators";

import { fixtureId as id } from "./ids";

/* Mock members, diary, reviews and lists for the static mockup. All people are fictional. */

export interface UserFixture {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  joinedOn: string;
  followerCount: number;
  followingCount: number;
  /** Release slugs on the Shelf, in position order (max 4). */
  shelf: string[];
}

export interface DiaryFixture {
  id: string;
  username: string;
  releaseSlug: string;
  /** Null for an undated listen (quick rating or heart from the album page). */
  listenedOn: string | null;
  rating: number | null;
  liked: boolean;
  relisten: boolean;
  format: ListenFormat | null;
  /** Suggested mood slugs. */
  moods: string[];
  /** Track-by-track ratings, by track position on the release (album listens only). */
  trackRatings: Record<number, number>;
}

export interface ReviewFixture {
  id: string;
  username: string;
  releaseSlug: string;
  /** Diary entry the review was written with, if any. */
  entryId: string | null;
  rating: number | null;
  body: string;
  lang: AudienceLang;
  createdAt: string;
  likeCount: number;
  commentCount: number;
}

export interface ListFixture {
  id: string;
  username: string;
  title: string;
  description: string;
  ranked: boolean;
  releaseSlugs: string[];
}

export const users: UserFixture[] = [
  {
    id: id(301),
    username: "nuitblanche",
    displayName: "Camille",
    bio: "Disques de pluie, cafés tardifs et basses rondes. J'écoute tout en entier, même les interludes.",
    joinedOn: "2026-03-02",
    followerCount: 214,
    followingCount: 87,
    shelf: [
      "nocturnes-pour-pluie-fine",
      "smoke-rings-at-1-am",
      "le-roi-d-un-pays-pluvieux",
      "cafe-creme",
    ],
  },
  {
    id: id(302),
    username: "vinylvince",
    displayName: "Vince",
    bio: "Crate digger. Soul, funk and anything with a Hammond organ.",
    joinedOn: "2026-04-11",
    followerCount: 132,
    followingCount: 150,
    shelf: ["gold-leaf-sessions", "brass-and-bone", "paper-moon-motel", "beton-velours"],
  },
  {
    id: id(303),
    username: "rainydaysam",
    displayName: "Sam",
    bio: "Je viens d'arriver. Je range mes disques.",
    joinedOn: "2026-10-12",
    followerCount: 3,
    followingCount: 12,
    shelf: [],
  },
];

const diary = (
  n: number,
  username: string,
  releaseSlug: string,
  listenedOn: string | null,
  rating: number | null,
  format: ListenFormat | null,
  options: {
    liked?: boolean;
    relisten?: boolean;
    moods?: string[];
    trackRatings?: Record<number, number>;
  } = {},
): DiaryFixture => ({
  id: id(n),
  username,
  releaseSlug,
  listenedOn,
  rating,
  format,
  liked: options.liked ?? false,
  relisten: options.relisten ?? false,
  moods: options.moods ?? [],
  trackRatings: options.trackRatings ?? {},
});

export const diaryEntries: DiaryFixture[] = [
  diary(401, "nuitblanche", "midnight-blue-avenue", "2026-10-18", 8, "streaming"),
  diary(402, "nuitblanche", "rue-des-lanternes", "2026-10-14", 9, "streaming", { liked: true }),
  diary(403, "nuitblanche", "nocturnes-pour-pluie-fine", "2026-10-11", 10, "vinyl", {
    liked: true,
    relisten: true,
    moods: ["rain", "night"],
    trackRatings: { 1: 9, 2: 10, 3: 8, 4: 10, 5: 9, 6: 8, 7: 9 },
  }),
  diary(404, "nuitblanche", "beton-velours", "2026-10-04", 7, "streaming"),
  diary(405, "nuitblanche", "brass-and-bone", "2026-09-20", 8, "cd", { liked: true }),
  diary(406, "nuitblanche", "le-roi-d-un-pays-pluvieux", "2026-09-06", 9, "vinyl", {
    relisten: true,
    moods: ["sunday-morning", "reading"],
  }),
  diary(407, "nuitblanche", "spleen-d-automne", "2026-08-29", 6, "cassette"),
  diary(408, "nuitblanche", "paper-moon-motel", "2026-07-17", 7, "streaming"),
  diary(409, "nuitblanche", "smoke-rings-at-1-am", "2026-06-02", 10, "vinyl", {
    liked: true,
    relisten: true,
    moods: ["one-am", "spleen"],
  }),
  diary(410, "nuitblanche", "gold-leaf-sessions", "2026-05-23", 8, "live"),
  diary(411, "nuitblanche", "sous-le-periph", "2026-05-02", 6, "streaming", { moods: ["commute"] }),
  diary(412, "nuitblanche", "cafe-creme", "2026-04-12", 9, "vinyl", { liked: true }),
  diary(413, "nuitblanche", "le-roi-d-un-pays-pluvieux", "2026-03-15", 8, "streaming"),
  diary(414, "nuitblanche", "smoke-rings-at-1-am", "2025-12-31", 9, "vinyl"),
  diary(415, "nuitblanche", "nocturnes-pour-pluie-fine", "2025-11-20", 9, "streaming"),
  diary(421, "vinylvince", "gold-leaf-sessions", "2026-10-17", 9, "vinyl", { liked: true }),
  diary(422, "vinylvince", "brass-and-bone", "2026-10-02", 10, "vinyl", { liked: true }),
  diary(423, "vinylvince", "beton-velours", "2026-09-30", 7, "streaming"),
  diary(424, "vinylvince", "paper-moon-motel", "2026-08-15", null, "cd"),
  // Undated listens: quick ratings / hearts given from the album page.
  diary(416, "nuitblanche", "spleen-d-automne", null, 7, null),
  diary(425, "vinylvince", "nocturnes-pour-pluie-fine", null, 8, null),
  diary(426, "vinylvince", "cafe-creme", null, null, null, { liked: true }),
];

/** "To listen" queue of the demo members (release slugs). */
export const toListen: { username: string; releaseSlugs: string[] }[] = [
  { username: "nuitblanche", releaseSlugs: ["gold-leaf-sessions"] },
  { username: "rainydaysam", releaseSlugs: ["nocturnes-pour-pluie-fine", "cafe-creme"] },
];

export const reviews: ReviewFixture[] = [
  {
    id: id(501),
    username: "nuitblanche",
    releaseSlug: "nocturnes-pour-pluie-fine",
    entryId: id(403),
    rating: 10,
    body: "Le genre de disque qu'on pose quand la ville s'endort. La contrebasse de « Une heure du matin » me suit encore dans l'escalier. Rien à jeter, tout à garder.",
    lang: "fr",
    createdAt: "2026-10-11T23:48:00Z",
    likeCount: 87,
    commentCount: 12,
  },
  {
    id: id(502),
    username: "vinylvince",
    releaseSlug: "brass-and-bone",
    entryId: id(422),
    rating: 10,
    body: "Warm, generous, a little bruised. Okafor sings like she's leaning on the piano at closing time. 'Sunday Choir' is the one that got me.",
    lang: "en",
    createdAt: "2026-10-02T21:10:00Z",
    likeCount: 64,
    commentCount: 7,
  },
  {
    id: id(503),
    username: "nuitblanche",
    releaseSlug: "le-roi-d-un-pays-pluvieux",
    entryId: id(406),
    rating: 9,
    body: "Baudelaire mis en musique sans poussière. Les cordes sont d'une douceur folle, et « Recueillement » termine la nuit comme il faut.",
    lang: "fr",
    createdAt: "2026-09-06T22:31:00Z",
    likeCount: 52,
    commentCount: 4,
  },
  {
    id: id(504),
    username: "vinylvince",
    releaseSlug: "nocturnes-pour-pluie-fine",
    entryId: id(425),
    rating: 8,
    body: "Didn't understand a word of the titles, understood every note. Perfect rainy-window record.",
    lang: "en",
    createdAt: "2026-09-28T19:05:00Z",
    likeCount: 31,
    commentCount: 2,
  },
  {
    id: id(505),
    username: "rainydaysam",
    releaseSlug: "nocturnes-pour-pluie-fine",
    entryId: null,
    rating: null,
    body: "Pas encore de note, je l'écoute depuis trois soirs et je change d'avis à chaque fois. C'est peut-être bon signe.",
    lang: "fr",
    createdAt: "2026-10-15T00:12:00Z",
    likeCount: 9,
    commentCount: 1,
  },
  {
    id: id(506),
    username: "nuitblanche",
    releaseSlug: "beton-velours",
    entryId: id(404),
    rating: 7,
    body: "Des samples de sax magnifiques, quelques couplets en trop. « Quai de Seine » tourne en boucle depuis une semaine.",
    lang: "fr",
    createdAt: "2026-10-04T20:40:00Z",
    likeCount: 28,
    commentCount: 5,
  },
  {
    id: id(507),
    username: "vinylvince",
    releaseSlug: "gold-leaf-sessions",
    entryId: id(421),
    rating: 9,
    body: "The Hammond on 'Hammond Sunrise' could warm a whole street in January.",
    lang: "en",
    createdAt: "2026-10-17T18:22:00Z",
    likeCount: 19,
    commentCount: 0,
  },
];

export const lists: ListFixture[] = [
  {
    id: id(601),
    username: "nuitblanche",
    title: "Quand il pleut sur la ville",
    description: "Pour les fenêtres embuées et les soirs où on ne sort pas.",
    ranked: false,
    releaseSlugs: [
      "nocturnes-pour-pluie-fine",
      "le-roi-d-un-pays-pluvieux",
      "spleen-d-automne",
      "paper-moon-motel",
    ],
  },
  {
    id: id(602),
    username: "nuitblanche",
    title: "Mon top 2026 (pour l'instant)",
    description: "Classement provisoire, révisé à chaque pleine lune.",
    ranked: true,
    releaseSlugs: ["brass-and-bone", "rue-des-lanternes", "beton-velours", "midnight-blue-avenue"],
  },
  {
    id: id(603),
    username: "vinylvince",
    title: "Organ grinders",
    description: "Records where the Hammond does the talking.",
    ranked: false,
    releaseSlugs: ["gold-leaf-sessions", "smoke-rings-at-1-am", "cafe-creme"],
  },
];
