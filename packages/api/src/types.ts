import type { AudienceLang, ImportKind, ListenFormat, ReleaseType } from "@spleen/validators";

/* Output shapes of the API. Stable contract for the web app and the future Expo app. */

export interface ArtistRef {
  slug: string;
  name: string;
}

export interface ReleaseCard {
  id: string;
  slug: string;
  title: string;
  type: ReleaseType;
  /** Null when the release date is unknown. */
  year: number | null;
  coverUrl: string | null;
  artists: ArtistRef[];
  /** Community average on the 1..10 scale, null when nobody rated it yet. */
  averageRating: number | null;
  ratingCount: number;
  /** Blind listening: the viewer has not rated it yet, so the community ratings are hidden. */
  ratingsHidden?: boolean;
}

export interface Track {
  /** Null for mockup tracks that have no page. */
  id: string | null;
  slug: string | null;
  disc: number;
  position: number;
  title: string;
  /** Null when the catalog does not know the length. */
  durationMs: number | null;
}

export interface ListenLink {
  service: "spotify" | "deezer" | "appleMusic" | "youtube";
  url: string;
}

export interface MemberRef {
  username: string;
  displayName: string;
}

export interface ReviewCard {
  id: string;
  author: MemberRef;
  release: ReleaseCard;
  rating: number | null;
  body: string;
  lang: AudienceLang;
  createdAt: string;
  likeCount: number;
  commentCount: number;
}

/** One of the member's own reviews, as edited on the review edit screen. */
export interface MyReview {
  id: string;
  /** The release reviewed, or the release of the track reviewed. */
  release: ReleaseCard;
  rating: number | null;
  body: string;
  lang: AudienceLang;
  createdAt: string;
}

export interface ListCard {
  id: string;
  title: string;
  description: string;
  ranked: boolean;
  owner: MemberRef;
  itemCount: number;
  preview: ReleaseCard[];
}

export interface ReleaseDetail extends ReleaseCard {
  /** ISO date padded from `releaseDatePrecision` ("1959" → "1959-01-01"). */
  releaseDate: string | null;
  releaseDatePrecision: "year" | "month" | "day" | null;
  /** "live", "compilation"… */
  secondaryTypes: string[];
  /** Known from an artist's discography only: tracklist, genres and cover still to import. */
  isStub: boolean;
  genres: string[];
  tracks: Track[];
  totalDurationMs: number;
  /** Number of ratings for each value 1..10 (index 0 = rating 1). */
  ratingDistribution: number[];
  reviews: ReviewCard[];
  lists: ListCard[];
  listenLinks: ListenLink[];
}

export interface MoodRef {
  id: string;
  slug: string;
  labelFr: string;
  labelEn: string;
  /** Created by the member (labels are the same in both languages). */
  personal: boolean;
}

/** A dated listen in a member's public diary. */
export interface DiaryEntry {
  id: string;
  listenedOn: string;
  /** The release listened to, or the release of the track listened to. */
  release: ReleaseCard;
  /** Set when the listen is about a single track. */
  track: { slug: string; title: string } | null;
  rating: number | null;
  liked: boolean;
  relisten: boolean;
  format: ListenFormat | null;
  moods: MoodRef[];
  hasReview: boolean;
}

/** One of the member's own listens, as edited in the "log" form. */
export interface MyEntry {
  id: string;
  /** Null for the undated listen (quick rating or heart). */
  listenedOn: string | null;
  rating: number | null;
  liked: boolean;
  relisten: boolean;
  format: ListenFormat | null;
  moodIds: string[];
  trackRatings: { trackId: string; rating: number }[];
  review: { id: string; body: string; lang: AudienceLang } | null;
}

/** The member's state for an item page, with their listens (newest first). */
export interface MyItemState {
  rating: number | null;
  liked: boolean;
  listened: boolean;
  wantToListen: boolean;
  entries: MyEntry[];
  /** Today in the member's time zone: the default listening date. */
  today: string;
}

/** Distinct items listened to; `track` = tracks logged on their own (not inside an album). */
export interface ListenedCounts {
  album: number;
  ep: number;
  single: number;
  track: number;
}

/** Free-tier stats (rules in `lib/stats/source.ts`). */
export interface BaseStats {
  /** The member's current year, in their time zone. */
  year: number;
  listenedThisYear: ListenedCounts;
  listenedTotal: ListenedCounts;
  /** Current rating per release, for each value 1..10 (index 0 = rating 1). */
  ratingDistribution: number[];
  /** Top 5 of `year`, in listens (relistens included). */
  topArtists: { slug: string; name: string; count: number }[];
  topGenres: { name: string; count: number }[];
  /** All-time release listens by decade of release, oldest first. */
  decades: { decade: number; count: number }[];
  /** 12 listen counts, January first, for `year`. */
  activityByMonth: number[];
}

/** Stats shown on a profile. `plus` is reserved for Spleen+ advanced stats (not built yet). */
export interface MemberStats {
  tier: "free";
  base: BaseStats;
  plus: null;
  computedAt: string;
}

/** One page of a paginated list (pages start at 1). */
export interface Page<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
}

/** A release the member hearted, with when (most recent first in the Hearts tab). */
export interface LikedRelease {
  release: ReleaseCard;
  likedAt: string;
}

export interface ProfileDetail {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  joinedOn: string;
  followerCount: number;
  followingCount: number;
  /** Always 4 slots (positions 1..4); null means an empty slot on the Shelf. */
  shelf: (ReleaseCard | null)[];
  /** Latest dated listens (empty when the diary is hidden). */
  recent: DiaryEntry[];
  /** The viewer is this member. */
  isOwner: boolean;
  /** Private diary seen by someone else: diary, recent activity, hearts and queue are empty. */
  diaryHidden: boolean;
  statsHidden: boolean;
}

export interface HomeFeed {
  trending: Record<AudienceLang, ReleaseCard[]>;
  recent: ReleaseCard[];
  popularReviews: ReviewCard[];
}

export interface ArtistCard {
  id: string;
  slug: string;
  name: string;
  disambiguation: string | null;
  country: string | null;
  imageUrl: string | null;
}

export interface ArtistDetail extends ArtistCard {
  /** "person", "group"… */
  type: string | null;
  /** The discography has not been imported yet (only releases already known are listed). */
  discographyPending: boolean;
  discography: {
    albums: ReleaseCard[];
    eps: ReleaseCard[];
    singles: ReleaseCard[];
    /** Live albums, compilations, soundtracks, remixes… (mixtapes count as main releases). */
    other: ReleaseCard[];
  };
  listenLinks: ListenLink[];
}

export interface TrackCard {
  id: string;
  slug: string;
  title: string;
  durationMs: number | null;
  artists: ArtistRef[];
  /** First release the track appears on, for its cover. */
  release: ReleaseCard | null;
}

export interface TrackDetail extends TrackCard {
  appearsOn: ReleaseCard[];
  averageRating: number | null;
  ratingCount: number;
  /** Blind listening: the viewer has not rated it yet. */
  ratingsHidden?: boolean;
  listenLinks: ListenLink[];
}

export interface CatalogSearchResults {
  releases: ReleaseCard[];
  artists: ArtistCard[];
  tracks: TrackCard[];
}

/** A catalog provider (MusicBrainz) result that can be imported. */
export interface RemoteHit {
  kind: ImportKind;
  mbid: string;
  title: string;
  /** Artist names, or the disambiguation for an artist. */
  subtitle: string | null;
  type: ReleaseType | null;
  secondaryTypes: string[];
  year: number | null;
  /** Already in Spleen: link to it instead of importing. */
  localSlug: string | null;
}

export interface ImportResult {
  kind: ImportKind;
  slug: string;
}

/** The signed-in member's own profile (settings). */
export interface MyProfile {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  locale: "fr" | "en";
  theme: "dark" | "light";
  statsPrivate: boolean;
  diaryPrivate: boolean;
  blindMode: boolean;
  /** IANA time zone used for "today" (default listening date). */
  timeZone: string;
  /** ISO date from which the @username can change again; null when it can now. */
  usernameChangeAvailableAt: string | null;
}

/** Who is calling. `profile` is null until the member picks a @username (onboarding). */
export interface Me {
  userId: string;
  email: string;
  profile: MyProfile | null;
}

/** Data export (JSON download). Versioned so the format can evolve. */
export interface AccountExport {
  format: "spleen-export/1";
  exportedAt: string;
  [section: string]: unknown;
}
