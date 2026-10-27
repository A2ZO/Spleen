import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalPage } from "@/components/legal/LegalPage";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { seoMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "legal" });
  const title = t("privacy.title");
  return { title, ...(await seoMetadata(locale, "/privacy", { title })) };
}

export default async function PrivacyPage({ params }: Props) {
  initRouteLocale((await params).locale);
  return <LegalPage page="privacy" />;
}
