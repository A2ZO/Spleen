"use server";

import type { ApiErrorCode, CommentView } from "@spleen/api";
import {
  catalogReportSchema,
  commentCreateSchema,
  commentUpdateSchema,
  likeSetSchema,
  memberSchema,
  reportCreateSchema,
} from "@spleen/validators";

import { refresh } from "next/cache";

import { errorCode } from "@/lib/api-errors";
import { getApi } from "@/server/api";

/* Social Server Actions: validate the input shape and call `packages/api`. */

export interface SocialResult<T = undefined> {
  ok?: boolean;
  data?: T;
  error?: ApiErrorCode | "unknown";
}

type Api = Awaited<ReturnType<typeof getApi>>;

/**
 * Runs a write. With `refreshPage`, the page is re-rendered in the same response (`refresh()`)
 * instead of a client `router.refresh()`, a second request the router could cancel mid-render.
 */
async function run<T>(
  write: (api: Api) => Promise<T>,
  { refreshPage = false } = {},
): Promise<SocialResult<T>> {
  try {
    const data = await write(await getApi());
    if (refreshPage) refresh();
    return { ok: true, data };
  } catch (error) {
    return { error: errorCode(error) };
  }
}

export async function setFollowAction(username: string, follow: boolean): Promise<SocialResult> {
  const parsed = memberSchema.safeParse({ username });
  if (!parsed.success) return { error: "unknown" };
  return run(
    async (api) => {
      await (follow ? api.social.follow(parsed.data) : api.social.unfollow(parsed.data));
      return undefined;
    },
    { refreshPage: true },
  );
}

export async function setBlockAction(username: string, blocked: boolean): Promise<SocialResult> {
  const parsed = memberSchema.safeParse({ username });
  if (!parsed.success) return { error: "unknown" };
  return run(
    async (api) => {
      await (blocked ? api.block.add(parsed.data) : api.block.remove(parsed.data));
      return undefined;
    },
    { refreshPage: true },
  );
}

export async function setLikeAction(
  input: unknown,
): Promise<SocialResult<{ liked: boolean; likeCount: number }>> {
  const parsed = likeSetSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.like.set(parsed.data), { refreshPage: true });
}

export async function createCommentAction(input: unknown): Promise<SocialResult<CommentView>> {
  const parsed = commentCreateSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.comment.create(parsed.data), { refreshPage: true });
}

export async function updateCommentAction(input: unknown): Promise<SocialResult<CommentView>> {
  const parsed = commentUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.comment.update(parsed.data), { refreshPage: true });
}

export async function deleteCommentAction(id: string): Promise<SocialResult> {
  const parsed = commentUpdateSchema.shape.id.safeParse(id);
  if (!parsed.success) return { error: "unknown" };
  return run(
    async (api) => {
      await api.comment.delete({ id: parsed.data });
      return undefined;
    },
    { refreshPage: true },
  );
}

export async function reportAction(input: unknown): Promise<SocialResult> {
  const parsed = reportCreateSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run(async (api) => {
    await api.report.create(parsed.data);
    return undefined;
  });
}

/** "Report an error / suggest an addition" on an album, track or artist page. */
export async function catalogReportAction(input: unknown): Promise<SocialResult> {
  const parsed = catalogReportSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run(async (api) => {
    await api.report.catalog(parsed.data);
    return undefined;
  });
}

export async function markAllReadAction(): Promise<SocialResult> {
  return run(
    async (api) => {
      await api.notification.markAllRead();
      return undefined;
    },
    { refreshPage: true },
  );
}
