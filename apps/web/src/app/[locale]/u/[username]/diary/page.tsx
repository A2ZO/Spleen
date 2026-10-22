import { usernameSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";

import { DiaryList } from "@/components/profile/DiaryList";
import { initRouteLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string; username: string }> };

const getProfile = cache(async (username: string) => {
  const parsed = usernameSchema.safeParse(decodeURIComponent(username));
  if (!parsed.success) return null;
  return (await getApi()).profile.byUsername({ username: parsed.data });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return {};
  const t = await getTranslations();
  return { title: t("profile.diaryTitle", { name: profile.displayName }) };
}

/** Full diary, list view (the calendar view comes with milestone 6). */
export default async function DiaryPage({ params }: Props) {
  const { locale, username } = await params;
  initRouteLocale(locale);
  const profile = await getProfile(username);
  if (!profile) notFound();
  const t = await getTranslations();

  return (
    <div className="space-y-10">
      <header>
        <Link
          href={`/u/${profile.username}`}
          className="text-sm text-link underline-offset-2 hover:underline"
        >
          {t("profile.diaryBack")}
        </Link>
        <h1 className="mt-2 text-4xl font-semibold">
          {t("profile.diaryTitle", { name: profile.displayName })}
        </h1>
      </header>
      {profile.diaryHidden ? (
        <p className="font-serif text-lg text-fg-muted italic">
          {t("profile.diaryPrivate", { name: profile.displayName })}
        </p>
      ) : profile.diary.length > 0 ? (
        <DiaryList entries={profile.diary} />
      ) : (
        <p className="font-serif text-lg text-fg-muted italic">{t("profile.diaryEmpty")}</p>
      )}
    </div>
  );
}
