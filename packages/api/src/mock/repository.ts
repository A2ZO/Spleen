import {
  artists,
  diaryEntries,
  lists,
  releases,
  reviews,
  users,
  type DiaryFixture,
  type ListFixture,
  type ReleaseFixture,
  type ReviewFixture,
  type UserFixture,
} from "@spleen/db/fixtures";

import { buildListenLinks } from "../lib/listen-links";
import { averageFromDistribution, countRatings } from "../lib/ratings";
import { computeBaseStats } from "../lib/stats";
import type {
  DiaryEntry,
  HomeFeed,
  ListCard,
  MemberRef,
  ProfileDetail,
  ReleaseCard,
  ReleaseDetail,
  ReviewCard,
} from "../types";

/*
 * Read-only data access backed by in-memory fixtures (static mockup).
 * Routers only talk to this module, so swapping it for Drizzle queries leaves pages untouched.
 */

const SHELF_SIZE = 4;
const HOME_TRENDING_SIZE = 6;
const HOME_RECENT_SIZE = 6;
const HOME_REVIEWS_SIZE = 3;
const RECENT_ACTIVITY_SIZE = 5;
const LIST_PREVIEW_SIZE = 4;

const releaseBySlug = new Map(releases.map((r) => [r.slug, r]));
const artistBySlug = new Map(artists.map((a) => [a.slug, a]));
const userByUsername = new Map(users.map((u) => [u.username, u]));

function mustGet<K, V>(map: Map<K, V>, key: K, kind: string): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Fixture error: unknown ${kind} "${String(key)}"`);
  return value;
}

function artistRefs(release: ReleaseFixture) {
  return release.artistSlugs.map((slug) => {
    const artist = mustGet(artistBySlug, slug, "artist");
    return { slug: artist.slug, name: artist.name };
  });
}

function toReleaseCard(release: ReleaseFixture): ReleaseCard {
  return {
    id: release.id,
    slug: release.slug,
    title: release.title,
    type: release.type,
    year: Number(release.releaseDate.slice(0, 4)),
    coverUrl: null,
    artists: artistRefs(release),
    averageRating: averageFromDistribution(release.ratingCounts),
    ratingCount: countRatings(release.ratingCounts),
  };
}

const cardOf = (slug: string) => toReleaseCard(mustGet(releaseBySlug, slug, "release"));

function toMemberRef(user: UserFixture): MemberRef {
  return { username: user.username, displayName: user.displayName };
}

function toReviewCard(review: ReviewFixture): ReviewCard {
  return {
    id: review.id,
    author: toMemberRef(mustGet(userByUsername, review.username, "user")),
    release: cardOf(review.releaseSlug),
    rating: review.rating,
    body: review.body,
    lang: review.lang,
    createdAt: review.createdAt,
    likeCount: review.likeCount,
    commentCount: review.commentCount,
  };
}

function toListCard(list: ListFixture): ListCard {
  return {
    id: list.id,
    title: list.title,
    description: list.description,
    ranked: list.ranked,
    owner: toMemberRef(mustGet(userByUsername, list.username, "user")),
    itemCount: list.releaseSlugs.length,
    preview: list.releaseSlugs.slice(0, LIST_PREVIEW_SIZE).map(cardOf),
  };
}

function toDiaryEntry(entry: DiaryFixture): DiaryEntry {
  return {
    id: entry.id,
    listenedOn: entry.listenedOn,
    release: cardOf(entry.releaseSlug),
    rating: entry.rating,
    liked: entry.liked,
    relisten: entry.relisten,
    format: entry.format,
  };
}

const byPopularity = (a: ReviewFixture, b: ReviewFixture) => b.likeCount - a.likeCount;

export function getHomeFeed(): HomeFeed {
  const trendingFor = (lang: ReleaseFixture["lang"]) =>
    releases
      .filter((r) => r.lang === lang)
      .sort((a, b) => b.weeklyListens - a.weeklyListens)
      .slice(0, HOME_TRENDING_SIZE)
      .map(toReleaseCard);

  return {
    trending: { fr: trendingFor("fr"), en: trendingFor("en") },
    recent: [...releases]
      .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
      .slice(0, HOME_RECENT_SIZE)
      .map(toReleaseCard),
    popularReviews: [...reviews].sort(byPopularity).slice(0, HOME_REVIEWS_SIZE).map(toReviewCard),
  };
}

export function getReleaseBySlug(slug: string): ReleaseDetail | null {
  const release = releaseBySlug.get(slug);
  if (!release) return null;

  const card = toReleaseCard(release);
  const tracks = release.tracks.map(([title, seconds], index) => ({
    position: index + 1,
    title,
    durationMs: seconds * 1000,
  }));

  return {
    ...card,
    releaseDate: release.releaseDate,
    genres: release.genres,
    tracks,
    totalDurationMs: tracks.reduce((acc, t) => acc + t.durationMs, 0),
    ratingDistribution: [...release.ratingCounts],
    reviews: reviews
      .filter((r) => r.releaseSlug === slug)
      .sort(byPopularity)
      .map(toReviewCard),
    lists: lists.filter((l) => l.releaseSlugs.includes(slug)).map(toListCard),
    listenLinks: buildListenLinks(
      release.title,
      card.artists.map((a) => a.name),
    ),
  };
}

export function getProfileByUsername(username: string, now: Date): ProfileDetail | null {
  const user = userByUsername.get(username);
  if (!user) return null;

  const entries = diaryEntries
    .filter((e) => e.username === username)
    .sort((a, b) => b.listenedOn.localeCompare(a.listenedOn));
  const diary = entries.map(toDiaryEntry);

  const shelf: (ReleaseCard | null)[] = Array.from({ length: SHELF_SIZE }, (_, i) => {
    const slug = user.shelf[i];
    return slug ? cardOf(slug) : null;
  });

  const stats = computeBaseStats(
    entries.map((e) => {
      const release = mustGet(releaseBySlug, e.releaseSlug, "release");
      return {
        listenedOn: e.listenedOn,
        rating: e.rating,
        release: {
          id: release.id,
          type: release.type,
          releaseYear: Number(release.releaseDate.slice(0, 4)),
          genres: release.genres,
          artists: artistRefs(release),
        },
      };
    }),
    now.getUTCFullYear(),
  );

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    joinedOn: user.joinedOn,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    shelf,
    recent: diary.slice(0, RECENT_ACTIVITY_SIZE),
    diary,
    reviews: reviews
      .filter((r) => r.username === username)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toReviewCard),
    lists: lists.filter((l) => l.username === username).map(toListCard),
    stats,
  };
}
