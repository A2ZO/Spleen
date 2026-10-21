import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { OnboardingForm } from "@/components/account/OnboardingForm";
import { redirect } from "@/i18n/navigation";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "welcome" });
  return { title: t("metaTitle"), robots: { index: false } };
}

/** Landing page after sign-in: onboarding for new members, their shelf for the others. */
export default async function WelcomePage({ params }: Props) {
  const locale = initRouteLocale((await params).locale);
  const me = await (await getApi()).account.me();
  if (!me) return redirect({ href: "/sign-in", locale });
  if (me.profile) return redirect({ href: `/u/${me.profile.username}`, locale });

  const t = await getTranslations({ locale, namespace: "welcome" });
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-3 text-fg-muted">{t("subtitle")}</p>
      <div className="mt-8">
        <OnboardingForm locale={locale} theme={theme} defaultDisplayName="" />
      </div>
    </div>
  );
}
