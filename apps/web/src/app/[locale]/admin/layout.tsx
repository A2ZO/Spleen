import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { AdminTabs } from "@/components/admin/AdminTabs";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { getApi } from "@/server/api";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Moderation area. The role is checked here on the server (anyone else gets the 404 page, as
 * if nothing were there) and again by every `admin.*` procedure.
 */
export default async function AdminLayout({ children, params }: Props) {
  initRouteLocale((await params).locale);
  const me = await (await getApi()).account.me();
  if (!me?.isAdmin) notFound();
  const t = await getTranslations("admin");
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-semibold">{t("title")}</h1>
        <p className="text-fg-muted">{t("subtitle")}</p>
      </header>
      <AdminTabs />
      {children}
    </div>
  );
}
