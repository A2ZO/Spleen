import { SITEMAP_KINDS, sitemapIndex, xmlResponse } from "@/lib/sitemap";
import { getPublicApi } from "@/server/api";

// Read from the database at each request (cached an hour by s-maxage): without this, Next
// prerenders it at build time and the index would stay frozen with the build's content.
export const dynamic = "force-dynamic";

/** Sitemap index: the static pages, then each kind of page split into files. */
export async function GET() {
  const files = await getPublicApi().seo.sitemapFiles();
  return xmlResponse(
    sitemapIndex([
      "static.xml",
      ...SITEMAP_KINDS.flatMap((kind) =>
        Array.from({ length: files[kind] }, (_, i) => `${kind}-${i + 1}.xml`),
      ),
    ]),
  );
}
