"use server";

import type { ApiErrorCode } from "@spleen/api";
import { reviewUpdateSchema } from "@spleen/validators";

import { errorCode } from "@/lib/api-errors";
import { getApi } from "@/server/api";

/* Review Server Actions: validate the input shape and call `packages/api`. */

export interface ReviewResult {
  ok?: boolean;
  error?: ApiErrorCode | "unknown";
}

export async function updateReviewAction(input: {
  id: string;
  body: string;
  lang: string;
}): Promise<ReviewResult> {
  const parsed = reviewUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  try {
    await (await getApi()).review.update(parsed.data);
    return { ok: true };
  } catch (error) {
    return { error: errorCode(error) };
  }
}

export async function deleteReviewAction(id: string): Promise<ReviewResult> {
  if (!reviewUpdateSchema.shape.id.safeParse(id).success) return { error: "unknown" };
  try {
    await (await getApi()).review.delete({ id });
    return { ok: true };
  } catch (error) {
    return { error: errorCode(error) };
  }
}
