import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ListForm } from "@/components/lists/ListForm";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "list" });
  return { title: t("newTitle"), robots: { index: false } };
}

/** A new list: title, description and ranking; items are added from record pages. */
export default async function NewListPage({ params }: Props) {
  const locale = initRouteLocale((await params).locale);
  const me = await (await getApi()).account.me();
  if (!me) return redirect({ href: "/sign-in", locale });
  if (!me.profile) return redirect({ href: "/welcome", locale });
  const t = await getTranslations("list");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-4xl font-semibold text-balance">{t("newTitle")}</h1>
      <ListForm />
    </div>
  );
}
