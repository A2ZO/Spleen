import { pickDurationSchema, pickSchema, releaseTypeSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AnotherPick } from "@/components/pick/AnotherPick";
import { PickCard } from "@/components/pick/PickCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { Link, redirect } from "@/i18n/navigation";
import { firstParam, hrefWith, type SearchParams } from "@/lib/search-params";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

const PATH = "/pick";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "pick" });
  return { title: t("title"), robots: { index: false } };
}

/** « Tire un disque »: a record drawn at random from the member's « À écouter » list. */
export default async function PickPage({ params, searchParams }: Props) {
  const locale = initRouteLocale((await params).locale);
  const api = await getApi();
  const me = await api.account.me();
  if (!me) return redirect({ href: "/sign-in", locale });
  if (!me.profile) return redirect({ href: "/welcome", locale });
  const query = await searchParams;
  // An invalid value is left out, like a missing one.
  const parsedType = releaseTypeSchema.safeParse(firstParam(query.type));
  const type = parsedType.success ? parsedType.data : undefined;
  const parsedDuration = pickDurationSchema.safeParse(firstParam(query.duration));
  const duration = parsedDuration.success ? parsedDuration.data : undefined;
  const parsedNot = pickSchema.shape.not.safeParse(firstParam(query.not));
  const not = parsedNot.success ? parsedNot.data : undefined;
  const [result, t] = await Promise.all([
    api.toListen.pick({ type, duration, not }),
    getTranslations("pick"),
  ]);
  const listHref = `/u/${me.profile.username}?tab=to-listen`;
  const filtered = type !== undefined || duration !== undefined;
  const filters = { type: type ?? null, duration: duration ?? null };

  return (
    <div className="space-y-10">
      <Card tone="accent" className="md:p-10">
        <header className="max-w-3xl">
          <p className="font-mono text-xs tracking-[0.14em] uppercase">{t("kicker")}</p>
          <h1 className="mt-5 font-display text-[44px] leading-[0.95] font-extrabold tracking-[-0.04em] text-balance md:text-[clamp(56px,6vw,80px)]">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-pretty">{t("intro")}</p>
        </header>
      </Card>

      {result.listTotal === 0 ? (
        <div className="space-y-5">
          <p className="max-w-2xl text-lg text-pretty text-fg-muted">{t("empty")}</p>
          <ButtonLink href="/discover" variant="secondary">
            {t("discover")}
          </ButtonLink>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-4">
            <LinkTabs
              label={t("typeLabel")}
              current={type ?? "all"}
              tabs={[
                { id: "all", label: t("all"), href: hrefWith(PATH, { ...filters, type: null }) },
                {
                  id: "album",
                  label: t("albums"),
                  href: hrefWith(PATH, { ...filters, type: "album" }),
                },
                { id: "ep", label: t("eps"), href: hrefWith(PATH, { ...filters, type: "ep" }) },
                {
                  id: "single",
                  label: t("singles"),
                  href: hrefWith(PATH, { ...filters, type: "single" }),
                },
              ]}
            />
            <LinkTabs
              label={t("durationLabel")}
              current={duration ?? "any"}
              tabs={[
                {
                  id: "any",
                  label: t("anyLength"),
                  href: hrefWith(PATH, { ...filters, duration: null }),
                },
                ...pickDurationSchema.options.map((id) => ({
                  id,
                  label: t(id),
                  href: hrefWith(PATH, { ...filters, duration: id }),
                })),
              ]}
            />
          </div>

          {result.pick ? (
            <PickCard
              pick={result.pick}
              actions={
                <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                  {result.matching > 1 ? (
                    <AnotherPick
                      href={hrefWith(PATH, { ...filters, not: result.pick.id })}
                      fields={{
                        ...(type ? { type } : {}),
                        ...(duration ? { duration } : {}),
                        not: result.pick.id,
                      }}
                    />
                  ) : (
                    <p className="text-pretty text-fg-muted">{t("only")}</p>
                  )}
                  <Link
                    href={listHref}
                    className="inline-flex min-h-11 items-center underline-offset-4 hover:text-link hover:underline"
                  >
                    {t("seeList")}
                  </Link>
                </div>
              }
            />
          ) : filtered ? (
            <div className="space-y-5">
              <p className="max-w-2xl text-lg text-pretty text-fg-muted">{t("noMatch")}</p>
              <ButtonLink href={PATH} variant="secondary">
                {t("clearFilters")}
              </ButtonLink>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="max-w-2xl text-lg text-pretty text-fg-muted">{t("notOut")}</p>
              <ButtonLink href={listHref} variant="secondary">
                {t("seeList")}
              </ButtonLink>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
