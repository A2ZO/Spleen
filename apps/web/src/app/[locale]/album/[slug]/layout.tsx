import type { ReactNode } from "react";

import { ensureCatalogPage } from "@/lib/catalog-redirect";

/** Checks the page exists before `loading.tsx` streams, so a 404 or a 308 keeps its status. */
export default async function AlbumLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string; slug: string }>;
  children: ReactNode;
}) {
  const { locale, slug } = await params;
  await ensureCatalogPage("release", slug, locale);
  return children;
}
