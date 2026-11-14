import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { UnblockButton } from "@/components/social/ActionButtons";
import { Avatar } from "@/components/ui/Avatar";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { Link, redirect } from "@/i18n/navigation";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "blocks" });
  return { title: t("title"), robots: { index: false } };
}

/** The members the signed-in member blocked, each with "unblock". */
export default async function BlocksPage({ params }: Props) {
  const locale = initRouteLocale((await params).locale);
  const api = await getApi();
  const me = await api.account.me();
  if (!me) return redirect({ href: "/sign-in", locale });
  if (!me.profile) return redirect({ href: "/welcome", locale });
  const blocked = await api.block.list();
  const t = await getTranslations("blocks");
  const format = await getFormatter();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <Link href="/settings" className="text-sm text-fg-muted hover:text-fg">
          ← {t("back")}
        </Link>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.03em]">
          {t("title")}
        </h1>
        <p className="mt-2 text-fg-muted text-pretty">{t("intro")}</p>
      </header>
      {blocked.length === 0 ? (
        <p className="py-6 text-lg text-fg-muted">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {blocked.map((member) => (
            <li key={member.username} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar
                name={member.displayName}
                seed={member.username}
                src={member.avatarUrl}
                className="size-10"
              />
              <div className="min-w-0 flex-1">
                <Link href={`/u/${member.username}`} className="font-medium hover:text-star">
                  {member.displayName}
                </Link>
                <p className="font-mono text-xs text-fg-muted">
                  @{member.username} ·{" "}
                  {t("since", {
                    date: format.dateTime(new Date(member.blockedAt), { dateStyle: "medium" }),
                  })}
                </p>
              </div>
              <UnblockButton username={member.username} name={member.displayName} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
