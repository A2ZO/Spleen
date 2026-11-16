"use server";

import type { ApiErrorCode } from "@spleen/api";
import { artistFollowSchema } from "@spleen/validators";

import { refresh } from "next/cache";

import { errorCode } from "@/lib/api-errors";
import { getApi } from "@/server/api";

/* Artist follows: validate the input shape and call `packages/api`. */

export interface ArtistFollowResult {
  ok?: boolean;
  error?: ApiErrorCode | "unknown";
}

/** Follows or unfollows an artist (instant button, with JavaScript). */
export async function setArtistFollowAction(
  artistId: string,
  follow: boolean,
): Promise<ArtistFollowResult> {
  const parsed = artistFollowSchema.safeParse({ artistId });
  if (!parsed.success) return { error: "unknown" };
  try {
    const api = await getApi();
    const input = parsed.data;
    await (follow ? api.artistFollow.follow(input) : api.artistFollow.unfollow(input));
    refresh();
    return { ok: true };
  } catch (error) {
    return { error: errorCode(error) };
  }
}

/**
 * The same write from the button's form, sent without JavaScript; the page re-renders and the
 * button shows the error, if any (`useActionState`).
 */
export async function artistFollowFormAction(
  _previous: ArtistFollowResult,
  formData: FormData,
): Promise<ArtistFollowResult> {
  return setArtistFollowAction(
    String(formData.get("artistId") ?? ""),
    formData.get("follow") === "true",
  );
}

/** Release-day notifications on or off (settings form, works without JavaScript). */
export async function setNotifyReleasesAction(
  _previous: ArtistFollowResult,
  formData: FormData,
): Promise<ArtistFollowResult> {
  try {
    await (
      await getApi()
    ).account.setNotifyReleases({
      enabled: formData.get("notifyReleases") === "on",
    });
    refresh();
    return { ok: true };
  } catch (error) {
    return { error: errorCode(error) };
  }
}
