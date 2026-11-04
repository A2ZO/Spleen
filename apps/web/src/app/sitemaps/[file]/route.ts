import { SITEMAP_KINDS, STATIC_PATHS, urlSet, xmlResponse, type SitemapKind } from "@/lib/sitemap";
import { getPublicApi } from "@/server/api";

/** One sitemap file: `static.xml`, or `<kind>-<n>.xml` (releases, artists, lists, profiles). */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (file === "static.xml") return xmlResponse(urlSet(STATIC_PATHS.map((path) => ({ path }))));
  const match = /^([a-z]+)-([1-9][0-9]{0,3})\.xml$/.exec(file);
  const kind = SITEMAP_KINDS.find((k) => k === match?.[1]) as SitemapKind | undefined;
  if (!match || !kind) return new Response("Not found", { status: 404 });
  const entries = await getPublicApi().seo.sitemap({ kind, page: Number(match[2]) });
  if (entries.length === 0 && match[2] !== "1") return new Response("Not found", { status: 404 });
  return xmlResponse(urlSet(entries));
}
