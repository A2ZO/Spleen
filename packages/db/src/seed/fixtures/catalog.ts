import type { AudienceLang, ReleaseType } from "@spleen/validators";
import { fixtureId } from "./ids";

/*
 * Mock catalog for the static mockup (milestone 1). Every artist and album here is fictional.
 * Replaced by Postgres + MusicBrainz imports in milestones 2 and 4.
 */

export interface ArtistFixture {
  id: string;
  slug: string;
  name: string;
}

export interface ReleaseFixture {
  id: string;
  slug: string;
  title: string;
  type: ReleaseType;
  artistSlugs: string[];
  releaseDate: string;
  genres: string[];
  lang: AudienceLang;
  /** [title, duration in seconds] */
  tracks: [string, number][];
  /** Number of ratings for each value 1..10 (index 0 = rating 1). */
  ratingCounts: number[];
  /** Listens logged this week, drives the trending charts. */
  weeklyListens: number;
}

const id = fixtureId;

export const artists: ArtistFixture[] = [
  { id: id(101), slug: "lune-basse", name: "Lune Basse" },
  { id: id(102), slug: "odette-marchal", name: "Odette Marchal" },
  { id: id(103), slug: "the-velvet-hours", name: "The Velvet Hours" },
  { id: id(104), slug: "mira-okafor", name: "Mira Okafor" },
  { id: id(105), slug: "kassim", name: "Kassim" },
  { id: id(106), slug: "juniper-hale", name: "Juniper Hale" },
  { id: id(107), slug: "quartet-sepia", name: "Quartet Sépia" },
  { id: id(108), slug: "dee-marlowe", name: "Dee Marlowe" },
  { id: id(109), slug: "les-insomniaques", name: "Les Insomniaques" },
  { id: id(110), slug: "theo-brightwater", name: "Theo Brightwater" },
  { id: id(111), slug: "nora-vidal", name: "Nora Vidal" },
];

export const releases: ReleaseFixture[] = [
  {
    id: id(201),
    slug: "nocturnes-pour-pluie-fine",
    title: "Nocturnes pour pluie fine",
    type: "album",
    artistSlugs: ["lune-basse"],
    releaseDate: "2024-11-15",
    genres: ["Jazz", "Ambient"],
    lang: "fr",
    tracks: [
      ["Vitre embuée", 252],
      ["Une heure du matin", 318],
      ["Le métro ne passe plus", 274],
      ["Contrebasse et réverbères", 401],
      ["Pluie fine", 233],
      ["Les cafés ferment", 296],
      ["Aube grise", 365],
    ],
    ratingCounts: [1, 2, 3, 6, 14, 28, 61, 88, 52, 31],
    weeklyListens: 184,
  },
  {
    id: id(202),
    slug: "le-roi-d-un-pays-pluvieux",
    title: "Le Roi d'un pays pluvieux",
    type: "album",
    artistSlugs: ["odette-marchal"],
    releaseDate: "2025-10-03",
    genres: ["Chanson", "Baroque pop"],
    lang: "fr",
    tracks: [
      ["Ouverture en mineur", 104],
      ["Le Roi d'un pays pluvieux", 247],
      ["Spleen (Paris IV)", 219],
      ["Les chats sérieux", 186],
      ["Correspondances", 263],
      ["L'invitation au voyage", 301],
      ["Recueillement", 238],
      ["Brumes et pluies", 275],
    ],
    ratingCounts: [0, 1, 2, 3, 9, 17, 40, 77, 69, 48],
    weeklyListens: 152,
  },
  {
    id: id(203),
    slug: "smoke-rings-at-1-am",
    title: "Smoke Rings at 1 A.M.",
    type: "album",
    artistSlugs: ["the-velvet-hours"],
    releaseDate: "2023-02-24",
    genres: ["Jazz", "Soul jazz"],
    lang: "en",
    tracks: [
      ["Last Call", 211],
      ["Smoke Rings", 342],
      ["Velvet Booth", 288],
      ["Brass in the Rain", 305],
      ["The Bartender Knows", 259],
      ["Taxi on Fifth", 236],
      ["Closing Time Waltz", 410],
    ],
    ratingCounts: [0, 1, 1, 4, 8, 22, 47, 90, 74, 39],
    weeklyListens: 201,
  },
  {
    id: id(204),
    slug: "brass-and-bone",
    title: "Brass & Bone",
    type: "album",
    artistSlugs: ["mira-okafor"],
    releaseDate: "2026-09-12",
    genres: ["Soul", "R&B"],
    lang: "en",
    tracks: [
      ["Brass & Bone", 236],
      ["Honey, Hold On", 201],
      ["Sunday Choir", 274],
      ["Lagos to Leeds", 222],
      ["Gold Teeth", 189],
      ["Mama's Radio", 247],
      ["Undertow", 301],
      ["Home Is a Song", 268],
    ],
    ratingCounts: [0, 0, 1, 2, 5, 11, 23, 41, 37, 19],
    weeklyListens: 236,
  },
  {
    id: id(205),
    slug: "beton-velours",
    title: "Béton velours",
    type: "album",
    artistSlugs: ["kassim"],
    releaseDate: "2026-09-26",
    genres: ["Rap", "Jazz rap"],
    lang: "fr",
    tracks: [
      ["Intro (sous la pluie)", 98],
      ["Béton velours", 214],
      ["Quai de Seine", 197],
      ["Mélancolie de banlieue", 231],
      ["Saxophone à crédit", 186],
      ["Néons", 203],
      ["Fumée blanche", 245],
      ["Outro (le jour se lève)", 162],
    ],
    ratingCounts: [2, 1, 3, 5, 12, 20, 35, 44, 26, 15],
    weeklyListens: 248,
  },
  {
    id: id(206),
    slug: "sous-le-periph",
    title: "Sous le périph",
    type: "ep",
    artistSlugs: ["kassim"],
    releaseDate: "2025-04-18",
    genres: ["Rap"],
    lang: "fr",
    tracks: [
      ["Sous le périph", 188],
      ["Porte de la Chapelle", 201],
      ["Minuit pile", 176],
      ["Cassette usée", 214],
    ],
    ratingCounts: [1, 1, 2, 6, 10, 15, 19, 17, 8, 4],
    weeklyListens: 61,
  },
  {
    id: id(207),
    slug: "paper-moon-motel",
    title: "Paper Moon Motel",
    type: "album",
    artistSlugs: ["juniper-hale"],
    releaseDate: "2024-06-07",
    genres: ["Folk", "Indie"],
    lang: "en",
    tracks: [
      ["Vacancy", 192],
      ["Paper Moon Motel", 254],
      ["Route 9 Lullaby", 231],
      ["Ice Machine Hum", 177],
      ["Postcards I Never Sent", 266],
      ["Checkout at Noon", 289],
    ],
    ratingCounts: [0, 1, 2, 3, 8, 16, 33, 45, 30, 12],
    weeklyListens: 97,
  },
  {
    id: id(208),
    slug: "cafe-creme",
    title: "Café crème",
    type: "album",
    artistSlugs: ["quartet-sepia"],
    releaseDate: "2022-01-21",
    genres: ["Jazz", "Bossa nova"],
    lang: "fr",
    tracks: [
      ["Café crème", 274],
      ["Terrasse en hiver", 312],
      ["Saint-Germain, 6 h", 288],
      ["Bossa du dimanche", 245],
      ["Croissant et contrebasse", 199],
      ["L'addition", 331],
    ],
    ratingCounts: [0, 0, 1, 3, 7, 18, 39, 56, 34, 16],
    weeklyListens: 88,
  },
  {
    id: id(209),
    slug: "midnight-blue-avenue",
    title: "Midnight Blue Avenue",
    type: "single",
    artistSlugs: ["dee-marlowe"],
    releaseDate: "2026-10-09",
    genres: ["Neo soul"],
    lang: "en",
    tracks: [
      ["Midnight Blue Avenue", 243],
      ["Midnight Blue Avenue (Late Version)", 318],
    ],
    ratingCounts: [0, 0, 1, 1, 4, 7, 12, 15, 9, 5],
    weeklyListens: 173,
  },
  {
    id: id(210),
    slug: "spleen-d-automne",
    title: "Spleen d'automne",
    type: "album",
    artistSlugs: ["les-insomniaques"],
    releaseDate: "2023-10-27",
    genres: ["Rock", "Post-punk"],
    lang: "fr",
    tracks: [
      ["Feuilles mortes", 221],
      ["Insomnie n° 3", 248],
      ["Novembre", 276],
      ["Les phares", 302],
      ["Ciel bas et lourd", 335],
      ["Dernière cigarette", 207],
    ],
    ratingCounts: [1, 2, 3, 7, 14, 21, 30, 32, 18, 8],
    weeklyListens: 74,
  },
  {
    id: id(211),
    slug: "gold-leaf-sessions",
    title: "Gold Leaf Sessions",
    type: "album",
    artistSlugs: ["theo-brightwater"],
    releaseDate: "2025-03-14",
    genres: ["Soul jazz", "Funk"],
    lang: "en",
    tracks: [
      ["Gold Leaf", 287],
      ["Hammond Sunrise", 334],
      ["Slow Burn", 298],
      ["Corner Booth", 263],
      ["After Hours Strut", 312],
      ["Leaving the Club", 359],
    ],
    ratingCounts: [0, 1, 1, 3, 9, 19, 41, 52, 37, 18],
    weeklyListens: 119,
  },
  {
    id: id(212),
    slug: "rue-des-lanternes",
    title: "Rue des lanternes",
    type: "single",
    artistSlugs: ["nora-vidal", "lune-basse"],
    releaseDate: "2026-10-02",
    genres: ["Chanson", "Jazz"],
    lang: "fr",
    tracks: [
      ["Rue des lanternes", 226],
      ["Rue des lanternes (instrumental)", 226],
    ],
    ratingCounts: [0, 0, 0, 1, 3, 6, 10, 14, 8, 6],
    weeklyListens: 131,
  },
];
