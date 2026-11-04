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
  /** Uploaded avatar, when the source loads it (initials are shown otherwise). */
  avatarUrl?: string | null;
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
  /** Comments not deleted. */
  commentCount: number;
  /** Set when the review is about a single track (`release` is then the track's release). */
  track?: { slug: string; title: string } | null;
  /** The signed-in viewer liked it (only filled by social sources: feed, review page). */
  viewerLiked?: boolean;
  /** Hidden by moderation: only its author still sees it (own profile, review page). */
  hidden?: boolean;
}

/**
 * Shown to the author alone on their content hidden by moderation: the reason of the decision
 * (null once the history was anonymised) and where to contest it.
 */
export interface ModerationHold {
  reason: string | null;
  contactEmail: string;
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
  /** Hidden by moderation: only its owner still sees it (own profile). */
  hidden?: boolean;
}

/** A record of the week's trends. */
export interface TrendItem {
  release: ReleaseCard;
  /** Distinct members who listened to it in the window. */
  listeners: number;
  /**
   * "lang": members of the requested interface language, this week; "all": every member this
   * week, and "month": every member in the last 30 days (fallbacks for a short chart).
   */
  source: "lang" | "all" | "month";
}

/** A place in a top rated chart. */
export interface TopRatedItem {
  rank: number;
  release: ReleaseCard;
  /** Bayesian score on the 1..10 scale; null when blind listening hides it. */
  score: number | null;
}

export interface TopRatedPage extends Page<TopRatedItem> {
  /** Ratings a record needs to enter the chart. */
  minRatings: number;
}

export interface GenreOption {
  slug: string;
  name: string;
}

/** One entry of a list: a release (album, EP, single), a track or an artist. */
export type ListItem = { id: string; position: number } & (
  | { kind: "release"; release: ReleaseCard }
  | { kind: "track"; track: TrackCard }
  | { kind: "artist"; artist: ArtistCard }
);

/** A list page: the list, one page of its items and what the viewer may do. */
export interface ListDetail {
  id: string;
  title: string;
  description: string;
  ranked: boolean;
  owner: MemberRef;
  createdAt: string;
  updatedAt: string;
  items: Page<ListItem>;
  likeCount: number;
  /** Comments not deleted, without those hidden from the viewer by a block. */
  commentCount: number;
  viewerLiked: boolean;
  isOwner: boolean;
  /** Signed in with a profile, not the owner, no block either way. */
  canLike: boolean;
  /** Signed in with a profile, no block either way (owners may answer). */
  canComment: boolean;
  /** Hidden by moderation (only the owner gets here): no likes nor comments. */
  hidden: ModerationHold | null;
}

/** One of the caller's lists, in the "Add to a list" dialog. */
export interface MyList {
  id: string;
  title: string;
  ranked: boolean;
  itemCount: number;
  /** The target asked about, when it is in the list (its item id); null otherwise. */
  itemId: string | null;
}

export interface ReleaseDetail extends ReleaseCard {
  /** Search metadata of the page (`seo.page`), read with it. */
  seo: SeoPage | null;
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

/** One page of a cursor-paginated list; `nextCursor` is null on the last page. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** A member in a followers / following list or a suggestion. */
export interface MemberCard {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  /** The signed-in viewer follows them. */
  viewerFollows: boolean;
  /** This is the viewer. */
  isViewer: boolean;
}

/** Friends feed: a listen (with its review, if any), or a review written apart from a listen. */
export type FeedItem =
  | {
      kind: "listen";
      id: string;
      at: string;
      author: MemberRef;
      release: ReleaseCard;
      track: { slug: string; title: string } | null;
      /** Null for an undated listen (quick rating or heart). */
      listenedOn: string | null;
      /** Hidden (null) by blind listening while the viewer has not rated the item. */
      rating: number | null;
      liked: boolean;
      relisten: boolean;
      review: ReviewCard | null;
    }
  | { kind: "review"; id: string; at: string; review: ReviewCard };

/** A review page: the review, and what the viewer may do with it. */
export interface ReviewDetail {
  review: ReviewCard;
  isOwner: boolean;
  viewerLiked: boolean;
  /** Signed in, not the author, no block either way. */
  canLike: boolean;
  /** Signed in with a profile, no block either way (authors may answer). */
  canComment: boolean;
  /** Hidden by moderation (only the author gets here): no likes nor comments. */
  hidden: ModerationHold | null;
}

export interface CommentView {
  id: string;
  author: MemberRef;
  body: string;
  createdAt: string;
  edited: boolean;
  /** The viewer wrote it. */
  canEdit: boolean;
  /** The viewer wrote it, or owns the review / list it is on. */
  canDelete: boolean;
  /** Hidden by moderation: only its author sees it, and may no longer edit it. */
  hidden: ModerationHold | null;
}

/** Similar notifications shown as one ("Camille and 3 others liked your review"). */
export interface NotificationGroup {
  key: string;
  type: "follow" | "like" | "comment" | "moderation";
  latestAt: string;
  unread: boolean;
  /** Most recent first, at most 3. */
  actors: MemberRef[];
  actorCount: number;
  review: { id: string; releaseTitle: string } | null;
  list: { id: string; title: string } | null;
  /** Latest comment of a comment group (shortened). */
  commentExcerpt: string | null;
  /** A moderation decision about the recipient or their content, with its reason. */
  moderation: ModerationNotice | null;
}

export interface ModerationNotice {
  action: ModerationActionKind;
  subject: ModerationSubject;
  reason: string;
  /** What was judged, as it was (shortened). */
  excerpt: string;
  /** Where to contest the decision (placeholder until configured). */
  contactEmail: string;
}

export interface BlockedMember {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  blockedAt: string;
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
  /** The signed-in viewer follows this member. */
  viewerFollows: boolean;
  /** The viewer blocked this member (to offer "unblock"). */
  viewerBlocked: boolean;
  /** Signed in, not the owner, no block either way: follow and other interactions. */
  canInteract: boolean;
  /** Search metadata of the page (`seo.page`), read with it. */
  seo: SeoPage | null;
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
  /** Search metadata of the page (`seo.page`), read with it. */
  seo: SeoPage | null;
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
}

/** Who is calling. `profile` is null until the member picks a @username (onboarding). */
export interface Me {
  userId: string;
  email: string;
  profile: MyProfile | null;
  /** Admins see the moderation link (every admin page checks the role on the server). */
  isAdmin: boolean;
}

/** Data export (JSON download). Versioned so the format can evolve. */
export interface AccountExport {
  format: "spleen-export/1";
  exportedAt: string;
  [section: string]: unknown;
}

export type ModerationActionKind =
  "dismiss" | "resolve" | "hide" | "restore" | "delete" | "suspend" | "unsuspend";
export type ModerationSubject = "member" | "review" | "list" | "comment" | "catalog";

/** Who a report or a decision is about, as admins see it (suspended members included). */
export interface ModeratedMember {
  username: string;
  displayName: string;
  suspended: boolean;
  admin: boolean;
}

/** What a report points to, for the moderation queue. */
export interface ReportSubjectView {
  kind: ModerationSubject;
  /** Path of the page without the locale (null for a catalog addition or deleted content). */
  href: string | null;
  /** Title, name or text excerpt. */
  label: string;
  /** Author of the content, or the reported member. */
  member: ModeratedMember | null;
  hidden: boolean;
  /**
   * Duplicate report: the other page, and the merge it suggests (the reported page as the
   * duplicate, the other one kept; the admin may swap them).
   */
  duplicate: {
    href: string;
    label: string;
    merge: { kind: "release" | "track" | "artist"; keep: string; duplicate: string };
  } | null;
}

export type ReportReason =
  | "spam"
  | "harassment"
  | "hate"
  | "spoiler"
  | "inappropriate"
  | "catalog_error"
  | "catalog_addition"
  | "catalog_cover"
  | "catalog_duplicate"
  | "other";

export interface ReportView {
  id: string;
  reason: ReportReason;
  details: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
  /** Null once the reporter deleted their account. */
  reporter: MemberRef | null;
  subject: ReportSubjectView;
  /** Other open reports on the same subject. */
  sameSubjectOpen: number;
  resolution: { by: MemberRef | null; at: string; note: string | null } | null;
  /** Decisions available now (none once the report is closed). */
  decisions: ("dismiss" | "resolve" | "hide" | "delete" | "suspend")[];
}

export interface ModerationActionView {
  id: string;
  action: ModerationActionKind;
  subject: ModerationSubject;
  reason: string;
  reportReason: ReportReason | null;
  moderator: MemberRef | null;
  target: MemberRef | null;
  excerpt: string;
  createdAt: string;
  /** Older than a year: links to people and the excerpt are gone. */
  anonymized: boolean;
  /** Content hidden by this decision that is still hidden, so it can be shown again. */
  restorable: { kind: "review" | "list" | "comment"; id: string } | null;
}

export interface SuspendedMemberView {
  username: string;
  displayName: string;
  suspendedAt: string;
  reason: string;
}

/** What a suspended member sees once signed in. */
export interface MySuspension {
  /** To confirm an account deletion, which stays possible. */
  username: string;
  suspendedAt: string;
  reason: string;
  /** Where to contest the decision (placeholder until configured). */
  contactEmail: string;
}

/** One side of a duplicate merge, with what it carries. */
export interface MergeCandidate {
  slug: string;
  title: string;
  /** Path of the page without the locale. */
  href: string;
  listens: number;
  reviews: number;
  listItems: number;
}

/** A merge checked before it runs: `duplicate` will point to `keep`. */
export interface CatalogMergePreview {
  kind: "release" | "track" | "artist";
  keep: MergeCandidate;
  duplicate: MergeCandidate;
}

/** One URL of a sitemap file: a path without the locale, and its last change. */
export interface SitemapEntry {
  path: string;
  lastModified: string;
}

/** Search and sharing facts about a page (`seo.page`). */
export interface SeoPage {
  /** Worth indexing (same rule as the sitemap); otherwise the page says noindex. */
  indexable: boolean;
  /** Version of its Open Graph image, part of the image URL; null when it has none. */
  og: string | null;
}

/** What an Open Graph image shows (`seo.og`), for a page anyone may see. */
export interface OgCard {
  kind: "release" | "review" | "list" | "profile";
  version: string;
  title: string;
  /** Artists (release, review), owner (list) or @username (profile). */
  subtitle: string;
  /** Cover URLs (release, review: one; list: up to four), or the avatar (profile). */
  covers: string[];
  year?: string | null;
  author?: string;
  /** 1..10, reviews only. */
  rating?: number | null;
  /** Review text or profile bio, shortened. */
  excerpt?: string;
  /** Items in a list. */
  items?: number;
}
