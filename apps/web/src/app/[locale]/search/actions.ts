"use server";

import type { ApiErrorCode, RemoteHit } from "@spleen/api";
import { catalogImportSchema, catalogSearchSchema } from "@spleen/validators";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { errorCode } from "@/lib/api-errors";
import { getApi } from "@/server/api";

export type RemoteSearchState =
  | { status: "idle" }
  | { status: "done"; hits: RemoteHit[] }
  | { status: "error"; error: ApiErrorCode | "unknown" };

export async function searchRemoteAction(q: string, type: string): Promise<RemoteSearchState> {
  const parsed = catalogSearchSchema.safeParse({ q, type });
  if (!parsed.success) return { status: "error", error: "unknown" };
  try {
    return { status: "done", hits: await (await getApi()).catalog.searchRemote(parsed.data) };
  } catch (error) {
    return { status: "error", error: errorCode(error) };
  }
}

export interface ImportState {
  error?: ApiErrorCode | "unknown";
}

const PAGE_OF = { release_group: "album", artist: "artist", recording: "track" } as const;

/** Imports a MusicBrainz result, then opens its page. */
export async function importAction(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const parsed = catalogImportSchema.safeParse({
    kind: formData.get("kind"),
    mbid: formData.get("mbid"),
  });
  if (!parsed.success) return { error: "unknown" };
  let slug: string;
  try {
    slug = (await (await getApi()).catalog.import(parsed.data)).slug;
  } catch (error) {
    return { error: errorCode(error) };
  }
  redirect({ href: `/${PAGE_OF[parsed.data.kind]}/${slug}`, locale: await getLocale() });
  return {};
}
