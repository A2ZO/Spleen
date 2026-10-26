"use server";

import type { ApiErrorCode } from "@spleen/api";
import {
  memberModerationSchema,
  reportDecisionSchema,
  restoreContentSchema,
} from "@spleen/validators";
import { refresh } from "next/cache";

import { errorCode } from "@/lib/api-errors";
import { getApi } from "@/server/api";

/* Moderation Server Actions: validate the input shape and call `packages/api` (which checks
 * the admin role on every call), then re-render the page in the same response. */

export interface ModerationResult {
  ok?: boolean;
  /** Suspensions: whether the email with the reason left (null when none was due). */
  emailSent?: boolean | null;
  error?: ApiErrorCode | "unknown";
}

type Api = Awaited<ReturnType<typeof getApi>>;

async function run(
  write: (api: Api) => Promise<{ emailSent?: boolean | null } | void>,
): Promise<ModerationResult> {
  try {
    const result = await write(await getApi());
    refresh();
    return { ok: true, emailSent: result?.emailSent ?? null };
  } catch (error) {
    return { error: errorCode(error) };
  }
}

export async function decideReportAction(input: unknown): Promise<ModerationResult> {
  const parsed = reportDecisionSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.admin.decide(parsed.data));
}

export async function suspendMemberAction(input: unknown): Promise<ModerationResult> {
  const parsed = memberModerationSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.admin.suspend(parsed.data));
}

export async function unsuspendMemberAction(input: unknown): Promise<ModerationResult> {
  const parsed = memberModerationSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.admin.unsuspend(parsed.data));
}

export async function restoreContentAction(input: unknown): Promise<ModerationResult> {
  const parsed = restoreContentSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.admin.restore(parsed.data));
}
