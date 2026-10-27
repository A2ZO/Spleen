import { SITEMAP_KINDS, sitemapIndex, xmlResponse } from "@/lib/sitemap";
import { getPublicApi } from "@/server/api";

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
