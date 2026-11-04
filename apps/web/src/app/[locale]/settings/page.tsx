import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { AvatarForm } from "@/components/account/AvatarForm";
import { DeleteAccountForm } from "@/components/account/DeleteAccountForm";
import { ProfileForm } from "@/components/account/ProfileForm";
import { SignOutButton } from "@/components/account/SignOutButton";
import { UsernameForm } from "@/components/account/UsernameForm";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Link, redirect } from "@/i18n/navigation";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "settings" });
  return { title: t("metaTitle"), robots: { index: false } };
}

/** IANA zones of the runtime, plus the member's own if the runtime no longer lists it. */
function timeZoneList(current: string): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes(current) ? zones : [current, ...zones];
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-4 font-serif text-2xl">
        {title}
      </h2>
      <Card className="p-5 sm:p-6">{children}</Card>
    </section>
  );
}

export default async function SettingsPage({ params }: Props) {
  const locale = initRouteLocale((await params).locale);
  const api = await getApi();
  const me = await api.account.me();
  if (!me) return redirect({ href: "/sign-in", locale });
  if (!me.profile) return redirect({ href: "/welcome", locale });
  const { profile } = me;
  const [t, renameAt] = await Promise.all([
    getTranslations({ locale, namespace: "settings" }),
    api.account.usernameChangeAvailableAt(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-12 pb-8">
      <h1 className="text-4xl font-semibold">{t("title")}</h1>

      <Section id="avatar" title={t("avatarTitle")}>
        <AvatarForm
          avatarUrl={profile.avatarUrl}
          displayName={profile.displayName}
          seed={profile.username}
        />
      </Section>

      <Section id="profile" title={t("profileTitle")}>
        <ProfileForm profile={profile} locale={locale} timeZones={timeZoneList(profile.timeZone)} />
      </Section>

      <Section id="username" title={t("usernameTitle")}>
        <UsernameForm username={profile.username} availableAt={renameAt} />
      </Section>

      <Section id="account" title={t("accountTitle")}>
        <dl className="space-y-1">
          <dt className="text-sm text-fg-muted">{t("emailLabel")}</dt>
          <dd className="font-mono">{me.email}</dd>
        </dl>
        <SignOutButton href={`/${locale}`} className="mt-5">
          {t("signOut")}
        </SignOutButton>
      </Section>

      <Section id="blocks" title={t("blocksTitle")}>
        <p className="text-fg-muted">{t("blocksBody")}</p>
        <Link href="/settings/blocks" className={buttonClasses("outline", "mt-4")}>
          {t("blocksLink")}
        </Link>
      </Section>

      <Section id="export" title={t("exportTitle")}>
        <p className="text-fg-muted">{t("exportBody")}</p>
        <a href="/api/account/export" download className={buttonClasses("outline", "mt-4")}>
          {t("exportButton")}
        </a>
      </Section>

      <Section id="delete" title={t("deleteTitle")}>
        <p className="mb-5 text-fg-muted">{t("deleteBody")}</p>
        <DeleteAccountForm username={profile.username} locale={locale} />
      </Section>
    </div>
  );
}
