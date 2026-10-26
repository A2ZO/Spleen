import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  schema,
  sql,
  type Db,
  type DbOrTx,
  type SQL,
} from "@spleen/db";
import type { ReportKind, ReportQueueInput } from "@spleen/validators";

import type {
  MemberRef,
  ModeratedMember,
  ModerationSubject,
  Page,
  ReportSubjectView,
  ReportView,
} from "../../types";

const { artists, comments, lists, profiles, releases, reports, reviews, tracks } = schema;

export const REPORTS_PAGE_SIZE = 20;
/** Excerpts kept in the history and shown in the queue and notifications. */
export const EXCERPT_MAX = 280;

export type ReportRow = typeof reports.$inferSelect;

export function excerpt(text: string, max = EXCERPT_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

export function subjectKind(report: ReportRow): ModerationSubject {
  if (report.reportedUserId) return "member";
  if (report.reviewId) return "review";
  if (report.listId) return "list";
  if (report.commentId) return "comment";
  return "catalog";
}

const KIND_CONDITION: Record<ReportKind, SQL | undefined> = {
  member: isNotNull(reports.reportedUserId),
  review: isNotNull(reports.reviewId),
  list: isNotNull(reports.listId),
  comment: isNotNull(reports.commentId),
  catalog: and(
    isNull(reports.reportedUserId),
    isNull(reports.reviewId),
    isNull(reports.listId),
    isNull(reports.commentId),
  ),
};

/** The report's subject column, as one value (null for a catalog addition with no subject). */
const subjectKey = sql<
  string | null
>`coalesce(${reports.reportedUserId}, ${reports.reviewId}, ${reports.listId}, ${reports.commentId}, ${reports.releaseId}, ${reports.trackId}, ${reports.artistId})`;

export function keyOf(report: ReportRow): string | null {
  return (
    report.reportedUserId ??
    report.reviewId ??
    report.listId ??
    report.commentId ??
    report.releaseId ??
    report.trackId ??
    report.artistId
  );
}

/** Open reports about the same thing as `report` (only itself for a bare catalog addition). */
export function sameSubjectOpen(report: ReportRow): SQL {
  const key = keyOf(report);
  return and(
    eq(reports.status, "open"),
    key ? sql`${subjectKey} = ${key}` : eq(reports.id, report.id),
  )!;
}

/** What admins need to know about a report's subject, ids included (server side only). */
export interface SubjectInfo extends ReportSubjectView {
  /** Author of the content, or the reported member. */
  memberId: string | null;
  contentId: string | null;
}

interface MemberRow extends ModeratedMember {
  userId: string;
}

/** Members by id, suspended ones included (unlike `memberRefs`), with their role. */
async function moderatedMembers(db: DbOrTx, ids: string[]): Promise<Map<string, MemberRow>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({
      userId: profiles.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      suspendedAt: profiles.suspendedAt,
      role: profiles.role,
    })
    .from(profiles)
    .where(inArray(profiles.userId, unique));
  return new Map(
    rows.map((r) => [
      r.userId,
      {
        userId: r.userId,
        username: r.username,
        displayName: r.displayName,
        suspended: r.suspendedAt !== null,
        admin: r.role === "admin",
      },
    ]),
  );
}

const toRef = (member: MemberRow | undefined): MemberRef | null =>
  member ? { username: member.username, displayName: member.displayName } : null;
const toModerated = (member: MemberRow | undefined): ModeratedMember | null =>
  member
    ? {
        username: member.username,
        displayName: member.displayName,
        suspended: member.suspended,
        admin: member.admin,
      }
    : null;

/** Subjects of `rows`, in their order, with three rounds of queries at most. */
export async function describeSubjects(
  db: DbOrTx,
  rows: ReportRow[],
): Promise<{ subjects: SubjectInfo[]; members: Map<string, MemberRow> }> {
  const ids = (pick: (r: ReportRow) => string | null) => [
    ...new Set(rows.flatMap((r) => pick(r) ?? [])),
  ];
  const reviewIds = ids((r) => r.reviewId);
  const listIds = ids((r) => r.listId);
  const commentIds = ids((r) => r.commentId);
  const releaseIds = [...ids((r) => r.releaseId), ...ids((r) => r.duplicateReleaseId)];
  const trackIds = [...ids((r) => r.trackId), ...ids((r) => r.duplicateTrackId)];
  const artistIds = [...ids((r) => r.artistId), ...ids((r) => r.duplicateArtistId)];
  const [reviewRows, listRows, commentRows, releaseRows, trackRows, artistRows] = await Promise.all(
    [
      reviewIds.length
        ? db
            .select({
              id: reviews.id,
              userId: reviews.userId,
              body: reviews.body,
              hiddenAt: reviews.hiddenAt,
            })
            .from(reviews)
            .where(inArray(reviews.id, reviewIds))
        : [],
      listIds.length
        ? db
            .select({
              id: lists.id,
              userId: lists.userId,
              title: lists.title,
              description: lists.description,
              hiddenAt: lists.hiddenAt,
            })
            .from(lists)
            .where(inArray(lists.id, listIds))
        : [],
      commentIds.length
        ? db
            .select({
              id: comments.id,
              userId: comments.userId,
              body: comments.body,
              reviewId: comments.reviewId,
              listId: comments.listId,
              hiddenAt: comments.hiddenAt,
              deletedAt: comments.deletedAt,
            })
            .from(comments)
            .where(inArray(comments.id, commentIds))
        : [],
      releaseIds.length
        ? db
            .select({ id: releases.id, title: releases.title, slug: releases.slug })
            .from(releases)
            .where(inArray(releases.id, releaseIds))
        : [],
      trackIds.length
        ? db
            .select({ id: tracks.id, title: tracks.title, slug: tracks.slug })
            .from(tracks)
            .where(inArray(tracks.id, trackIds))
        : [],
      artistIds.length
        ? db
            .select({ id: artists.id, title: artists.name, slug: artists.slug })
            .from(artists)
            .where(inArray(artists.id, artistIds))
        : [],
    ],
  );
  const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((i) => [i.id, i]));
  const reviewById = byId(reviewRows);
  const listById = byId(listRows);
  const commentById = byId(commentRows);
  const releaseById = byId(releaseRows);
  const trackById = byId(trackRows);
  const artistById = byId(artistRows);
  const members = await moderatedMembers(
    db,
    [
      ...rows.flatMap((r) => [r.reportedUserId ?? [], r.reporterId ?? [], r.resolvedById ?? []]),
      ...reviewRows.map((r) => r.userId),
      ...listRows.map((l) => l.userId),
      ...commentRows.map((c) => c.userId),
    ].flat(),
  );

  const subjects = rows.map((report): SubjectInfo => {
    const kind = subjectKind(report);
    const withMember = (memberId: string | null) => ({
      memberId,
      member: memberId ? toModerated(members.get(memberId)) : null,
      duplicate: null,
    });
    switch (kind) {
      case "member": {
        const member = members.get(report.reportedUserId!);
        return {
          kind,
          contentId: null,
          ...withMember(report.reportedUserId),
          href: member && !member.suspended ? `/u/${member.username}` : null,
          label: member ? `@${member.username} · ${member.displayName}` : "",
          hidden: member?.suspended ?? false,
        };
      }
      case "review": {
        const row = reviewById.get(report.reviewId!);
        return {
          kind,
          contentId: report.reviewId,
          ...withMember(row?.userId ?? null),
          href: row ? `/review/${row.id}` : null,
          label: row ? excerpt(row.body) : "",
          hidden: row?.hiddenAt != null,
        };
      }
      case "list": {
        const row = listById.get(report.listId!);
        return {
          kind,
          contentId: report.listId,
          ...withMember(row?.userId ?? null),
          href: row ? `/list/${row.id}` : null,
          label: row
            ? excerpt(row.description ? `${row.title} — ${row.description}` : row.title)
            : "",
          hidden: row?.hiddenAt != null,
        };
      }
      case "comment": {
        const row = commentById.get(report.commentId!);
        return {
          kind,
          contentId: report.commentId,
          ...withMember(row?.userId ?? null),
          href: row ? (row.reviewId ? `/review/${row.reviewId}` : `/list/${row.listId}`) : null,
          label: row ? excerpt(row.body) : "",
          hidden: row ? row.hiddenAt !== null || row.deletedAt !== null : false,
        };
      }
      case "catalog": {
        const release = report.releaseId ? releaseById.get(report.releaseId) : undefined;
        const track = report.trackId ? trackById.get(report.trackId) : undefined;
        const artist = report.artistId ? artistById.get(report.artistId) : undefined;
        const page = release
          ? { kind: "release" as const, path: "album", row: release }
          : track
            ? { kind: "track" as const, path: "track", row: track }
            : artist
              ? { kind: "artist" as const, path: "artist", row: artist }
              : null;
        const other = report.duplicateReleaseId
          ? releaseById.get(report.duplicateReleaseId)
          : report.duplicateTrackId
            ? trackById.get(report.duplicateTrackId)
            : report.duplicateArtistId
              ? artistById.get(report.duplicateArtistId)
              : undefined;
        return {
          kind,
          contentId: null,
          memberId: null,
          member: null,
          href: page ? `/${page.path}/${page.row.slug}` : null,
          label: page?.row.title ?? excerpt(report.details),
          hidden: false,
          duplicate:
            page && other
              ? {
                  href: `/${page.path}/${other.slug}`,
                  label: other.title,
                  merge: { kind: page.kind, keep: other.slug, duplicate: page.row.slug },
                }
              : null,
        };
      }
    }
  });
  return { subjects, members };
}

/** Decisions that make sense for a report now. Admins are never suspended from the site. */
export function allowedDecisions(report: ReportRow, subject: SubjectInfo): ReportView["decisions"] {
  if (report.status !== "open") return [];
  if (subject.kind === "catalog") return ["dismiss", "resolve"];
  const canSuspend = subject.member !== null && !subject.member.suspended && !subject.member.admin;
  if (subject.kind === "member") return canSuspend ? ["dismiss", "suspend"] : ["dismiss"];
  // Content already gone (deleted comment): only closing remains.
  if (!subject.href) return ["dismiss"];
  return [
    "dismiss",
    ...(subject.hidden ? [] : (["hide"] as const)),
    "delete",
    ...(canSuspend ? (["suspend"] as const) : []),
  ];
}

/** Reports by status and kind: open ones oldest first (a queue), closed ones latest first. */
export async function listReports(db: Db, input: ReportQueueInput): Promise<Page<ReportView>> {
  const where = and(
    input.status === "all" ? undefined : eq(reports.status, input.status),
    input.kind === "all" ? undefined : KIND_CONDITION[input.kind],
  );
  const order =
    input.status === "open"
      ? [asc(reports.createdAt), asc(reports.id)]
      : [desc(sql`coalesce(${reports.resolvedAt}, ${reports.createdAt})`), desc(reports.id)];
  const [rows, total] = await Promise.all([
    db
      .select()
      .from(reports)
      .where(where)
      .orderBy(...order)
      .limit(REPORTS_PAGE_SIZE)
      .offset((input.page - 1) * REPORTS_PAGE_SIZE),
    db.$count(reports, where),
  ]);
  const { subjects, members } = await describeSubjects(db, rows);
  const keys = [...new Set(rows.flatMap((r) => keyOf(r) ?? []))];
  const counts = keys.length
    ? await db
        .select({ key: subjectKey, count: sql<number>`count(*)::int` })
        .from(reports)
        .where(and(eq(reports.status, "open"), inArray(subjectKey, keys)))
        .groupBy(subjectKey)
    : [];
  const openByKey = new Map(counts.map((c) => [c.key, c.count]));
  const items = rows.map((report, index): ReportView => {
    const { memberId: _memberId, contentId: _contentId, ...subject } = subjects[index]!;
    const key = keyOf(report);
    const open = key ? (openByKey.get(key) ?? 0) : 0;
    return {
      id: report.id,
      reason: report.reason,
      details: report.details,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      reporter: report.reporterId ? toRef(members.get(report.reporterId)) : null,
      subject,
      sameSubjectOpen: Math.max(0, open - (report.status === "open" ? 1 : 0)),
      resolution: report.resolvedAt
        ? {
            by: report.resolvedById ? toRef(members.get(report.resolvedById)) : null,
            at: report.resolvedAt.toISOString(),
            note: report.resolutionNote,
          }
        : null,
      decisions: allowedDecisions(report, subjects[index]!),
    };
  });
  return {
    items,
    page: input.page,
    pageCount: Math.max(1, Math.ceil(total / REPORTS_PAGE_SIZE)),
    total,
  };
}

/** Members currently suspended, latest first. */
export async function listSuspended(db: Db) {
  const rows = await db
    .select({
      username: profiles.username,
      displayName: profiles.displayName,
      suspendedAt: profiles.suspendedAt,
      reason: profiles.suspensionReason,
    })
    .from(profiles)
    .where(isNotNull(profiles.suspendedAt))
    .orderBy(desc(profiles.suspendedAt));
  return rows.map((r) => ({
    username: r.username,
    displayName: r.displayName,
    suspendedAt: r.suspendedAt!.toISOString(),
    reason: r.reason ?? "",
  }));
}

export type { MemberRow };
