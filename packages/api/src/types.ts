import type { AudienceLang, ListenFormat, ReleaseType } from "@spleen/validators";

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
  year: number;
  coverUrl: string | null;
  artists: ArtistRef[];
  /** Community average on the 1..10 scale, null when nobody rated it yet. */
  averageRating: number | null;
  ratingCount: number;
}

export interface Track {
  position: number;
  title: string;
  durationMs: number;
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
  releaseDate: string;
  genres: string[];
  tracks: Track[];
  totalDurationMs: number;
  /** Number of ratings for each value 1..10 (index 0 = rating 1). */
  ratingDistribution: number[];
  reviews: ReviewCard[];
  lists: ListCard[];
  listenLinks: ListenLink[];
}

export interface DiaryEntry {
  id: string;
  listenedOn: string;
  release: ReleaseCard;
  rating: number | null;
  liked: boolean;
  relisten: boolean;
  format: ListenFormat;
}

export interface CountByType {
  album: number;
  ep: number;
  single: number;
}

export interface ProfileStats {
  year: number;
  listenedThisYear: CountByType;
  listenedTotal: CountByType;
  ratingDistribution: number[];
  topArtists: { slug: string; name: string; count: number }[];
  topGenres: { name: string; count: number }[];
  decades: { decade: number; count: number }[];
  /** 12 values, January first, for `year`. */
  activityByMonth: number[];
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
  /** Always 4 slots; null means an empty slot on the Shelf. */
  shelf: (ReleaseCard | null)[];
  recent: DiaryEntry[];
  diary: DiaryEntry[];
  reviews: ReviewCard[];
  lists: ListCard[];
  stats: ProfileStats;
}

export interface HomeFeed {
  trending: Record<AudienceLang, ReleaseCard[]>;
  recent: ReleaseCard[];
  popularReviews: ReviewCard[];
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
