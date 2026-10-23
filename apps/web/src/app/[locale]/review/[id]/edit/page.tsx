import { reviewUpdateSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ReviewEditForm } from "@/components/social/ReviewEditForm";
import { Cover } from "@/components/ui/Cover";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { Link, redirect } from "@/i18n/navigation";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "reviewEdit" });
  return { title: t("metaTitle"), robots: { index: false } };
}

/** Edit screen of one of the member's own reviews (text, language, deletion). */
export default async function ReviewEditPage({ params }: Props) {
  const { locale: rawLocale, id } = await params;
  const locale = initRouteLocale(rawLocale);
  const api = await getApi();
  const me = await api.account.me();
  if (!me) return redirect({ href: "/sign-in", locale });
  if (!me.profile) return redirect({ href: "/welcome", locale });
  if (!reviewUpdateSchema.shape.id.safeParse(id).success) notFound();
  const review = await api.review.mine({ id });
  if (!review) notFound();
  const t = await getTranslations("reviewEdit");
  const { release } = review;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="flex items-center gap-4">
        <Link href={`/album/${release.slug}`} className="w-20 shrink-0" tabIndex={-1}>
          <Cover
            slug={release.slug}
            title={release.title}
            coverUrl={release.coverUrl}
            showText={false}
            sizes="80px"
          />
        </Link>
        <div className="min-w-0">
          <p className="font-serif text-sm text-fg-muted italic">{t("kicker")}</p>
          <h1 className="text-3xl font-semibold text-balance">
            <Link href={`/album/${release.slug}`} className="hover:text-star">
              {release.title}
            </Link>
          </h1>
          <p className="text-sm text-fg-muted">{release.artists.map((a) => a.name).join(", ")}</p>
        </div>
      </header>
      <ReviewEditForm
        review={{ id: review.id, body: review.body, lang: review.lang }}
        backHref={`/u/${me.profile.username}?tab=reviews`}
      />
    </div>
  );
}
