import "server-only";

import { slugSchema, type CatalogKind } from "@spleen/validators";
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

/**
 * Called by the `layout.tsx` of a catalog page, before its `loading.tsx` starts streaming:
 * once streaming has started, a 404 or a 308 can no longer change the HTTP status (it would
 * answer 200). One indexed query; the page itself keeps `missingCatalogPage` as a fallback.
 */
export async function ensureCatalogPage(
  kind: CatalogKind,
  slug: string,
  locale: string,
): Promise<void> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) notFound();
  const page = await (await getApi()).catalog.pageStatus({ kind, slug: parsed.data });
  if (page.status === "merged") permanentRedirect(`/${locale}/${PATHS[kind]}/${page.slug}`);
  if (page.status === "missing") notFound();
}
