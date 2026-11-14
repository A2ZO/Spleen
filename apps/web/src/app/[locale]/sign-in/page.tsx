import { googleConfigured, isProduction } from "@spleen/infra/config";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SignInForm } from "@/components/account/SignInForm";
import { redirect } from "@/i18n/navigation";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { getApi } from "@/server/api";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function SignInPage({ params, searchParams }: Props) {
  const locale = initRouteLocale((await params).locale);
  const me = await (await getApi()).account.me();
  if (me) redirect({ href: "/welcome", locale });
  const t = await getTranslations({ locale, namespace: "auth" });
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
      <p className="mt-3 text-fg-muted">{t("subtitle")}</p>
      <SignInForm
        className="mt-8"
        locale={locale}
        googleEnabled={googleConfigured()}
        devHint={!isProduction()}
        linkError={!!error}
      />
    </div>
  );
}
