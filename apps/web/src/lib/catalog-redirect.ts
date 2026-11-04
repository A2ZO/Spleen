import "server-only";

import type { CatalogKind } from "@spleen/validators";
import { notFound, permanentRedirect } from "next/navigation";

import { getApi } from "@/server/api";

const PATHS: Record<CatalogKind, string> = { release: "album", track: "track", artist: "artist" };

/**
 * A catalog page that does not exist: if it was merged into another one, a permanent redirect
 * to the page kept (308, which search engines treat as a 301); otherwise the 404 page.
 */
export async function missingCatalogPage(
  kind: CatalogKind,
  slug: string,
  locale: string,
): Promise<never> {
  const kept = await (await getApi()).catalog.mergedInto({ kind, slug });
  if (kept) permanentRedirect(`/${locale}/${PATHS[kind]}/${kept}`);
  notFound();
}
