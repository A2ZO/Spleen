import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalPage } from "@/components/legal/LegalPage";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("notice.title") };
}

export default async function LegalNoticePage({ params }: Props) {
  initRouteLocale((await params).locale);
  return <LegalPage page="notice" />;
}
