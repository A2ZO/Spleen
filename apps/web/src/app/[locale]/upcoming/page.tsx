import type { UpcomingGroup } from "@spleen/api";
import { releaseTypeSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ArtistFollowButton } from "@/components/catalog/ArtistFollowButton";
import { UpcomingRow } from "@/components/upcoming/UpcomingRow";
import { Card } from "@/components/ui/Card";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { Link, redirect } from "@/i18n/navigation";
import { firstParam, hrefWith, type SearchParams } from "@/lib/search-params";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

const PATH = "/upcoming";
const GROUPS: UpcomingGroup[] = ["week", "month", "later", "tba"];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "upcoming" });
  return { title: t("title"), robots: { index: false } };
}

/** « Mes sorties à venir »: upcoming releases of the artists the member follows. */
export default async function UpcomingPage({ params, searchParams }: Props) {
  const locale = initRouteLocale((await params).locale);
  const api = await getApi();
  const me = await api.account.me();
  if (!me) return redirect({ href: "/sign-in", locale });
  if (!me.profile) return redirect({ href: "/welcome", locale });
  const parsedType = releaseTypeSchema.safeParse(firstParam((await searchParams).type));
  const type = parsedType.success ? parsedType.data : undefined;
  const [items, suggestions, t] = await Promise.all([
    api.upcoming.mine({ type }),
    api.upcoming.suggestions(),
    getTranslations("upcoming"),
  ]);

  return (
    <div className="space-y-12">
      <Card tone="accent" className="md:p-10">
        <header className="max-w-3xl">
          <p className="font-mono text-xs tracking-[0.14em] uppercase">{t("kicker")}</p>
          <h1 className="mt-5 font-display text-[44px] leading-[0.95] font-extrabold tracking-[-0.04em] text-balance md:text-[clamp(56px,6vw,80px)]">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-pretty">{t("intro")}</p>
        </header>
      </Card>

      {suggestions.following === 0 ? (
        <p className="max-w-2xl text-lg text-pretty text-fg-muted">{t("invite")}</p>
      ) : (
        <div className="space-y-10">
          <LinkTabs
            label={t("filterLabel")}
            current={type ?? "all"}
            tabs={[
              { id: "all", label: t("all"), href: hrefWith(PATH, { type: null }) },
              { id: "album", label: t("albums"), href: hrefWith(PATH, { type: "album" }) },
              { id: "ep", label: t("eps"), href: hrefWith(PATH, { type: "ep" }) },
              { id: "single", label: t("singles"), href: hrefWith(PATH, { type: "single" }) },
            ]}
          />
          {items.length === 0 && (
            <p className="text-fg-muted">{type ? t("noneOfType") : t("none")}</p>
          )}
          {GROUPS.map((group) => {
            const rows = items.filter((item) => item.group === group);
            if (rows.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`upcoming-${group}`}>
                <SectionHeading id={`upcoming-${group}`}>{t(group)}</SectionHeading>
                <ul className="divide-y divide-border">
                  {rows.map((item) => (
                    <li key={item.release.id}>
                      <UpcomingRow item={item} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {suggestions.artists.length > 0 && (
        <section aria-labelledby="upcoming-suggestions">
          <SectionHeading id="upcoming-suggestions">{t("suggestionsTitle")}</SectionHeading>
          <ul className="divide-y divide-border">
            {suggestions.artists.map((artist) => (
              <li key={artist.id} className="flex items-center justify-between gap-4 py-3">
                <Link
                  href={`/artist/${artist.slug}`}
                  className="min-w-0 truncate font-display text-lg font-bold tracking-[-0.02em] hover:text-star"
                >
                  {artist.name}
                </Link>
                <ArtistFollowButton
                  artistId={artist.id}
                  name={artist.name}
                  following={false}
                  quiet
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-fg-muted">{t("missing")}</p>
    </div>
  );
}
