import { catalogSearchSchema, searchKinds, type SearchKind } from "@spleen/validators";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ArtistLinks } from "@/components/catalog/ArtistLinks";
import { ReleaseTile } from "@/components/release/ReleaseTile";
import { RemoteSearch } from "@/components/search/RemoteSearch";
import { SearchCombobox } from "@/components/search/SearchCombobox";
import { Cover } from "@/components/ui/Cover";
import { pillClasses } from "@/components/ui/Pill";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/release-date";
import { getApi } from "@/server/api";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string | string[];
    type?: string | string[];
    remote?: string | string[];
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: metadataLocale(locale), namespace: "search" });
  // Search result pages are not worth indexing.
  return { title: t("metaTitle"), robots: { index: false } };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  initRouteLocale(locale);
  const t = await getTranslations();
  const raw = await searchParams;
  const type: SearchKind = searchKinds.find((k) => k === first(raw.type)) ?? "all";
  const parsed = catalogSearchSchema.safeParse({ q: first(raw.q) ?? "", type });
  const query = parsed.success ? parsed.data : null;

  const api = await getApi();
  const [results, me] = await Promise.all([
    query ? api.catalog.search(query) : null,
    api.account.me(),
  ]);
  const empty =
    results && results.releases.length + results.artists.length + results.tracks.length === 0;
  const href = (kind: SearchKind) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query.q);
    if (kind !== "all") params.set("type", kind);
    const search = params.toString();
    return search ? `/search?${search}` : "/search";
  };

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">
          {t("search.title")}
        </h1>
        <SearchCombobox
          id="search-q"
          label={t("search.fieldLabel")}
          variant="page"
          signedIn={Boolean(me)}
          initialQuery={query?.q ?? ""}
          type={type}
          autoFocus
        />
        <nav aria-label={t("search.filtersLabel")}>
          <ul className="flex flex-wrap gap-2">
            {searchKinds.map((kind) => (
              <li key={kind}>
                <Link
                  href={href(kind)}
                  aria-current={kind === type ? "page" : undefined}
                  className={pillClasses(
                    kind === type ? "raised" : "outline",
                    cn(
                      "min-h-11",
                      kind === type
                        ? "text-fg"
                        : "text-fg-muted hover:border-fg-muted hover:text-fg",
                    ),
                  )}
                >
                  {t(`search.filter.${kind}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {!query && <p className="text-lg text-fg-muted">{t("search.prompt")}</p>}

      {query && results && (
        <div className="space-y-12">
          <h2 className="sr-only">{t("search.resultsFor", { q: query.q })}</h2>
          {empty && <p className="text-lg text-fg-muted">{t("search.empty")}</p>}

          {results.artists.length > 0 && (
            <section aria-labelledby="artists">
              <SectionHeading id="artists">{t("search.artists")}</SectionHeading>
              <ul className="flex flex-wrap gap-3">
                {results.artists.map((artist) => (
                  <li key={artist.id}>
                    <Link
                      href={`/artist/${artist.slug}`}
                      className="flex min-h-11 flex-col justify-center rounded-card-sm border border-border bg-surface px-4 py-2 shadow-card hover:border-fg-muted"
                    >
                      <span className="font-display text-lg font-bold tracking-[-0.02em]">
                        {artist.name}
                      </span>
                      {artist.disambiguation && (
                        <span className="block text-xs text-fg-muted">{artist.disambiguation}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.releases.length > 0 && (
            <section aria-labelledby="releases">
              <SectionHeading id="releases">{t("search.releases")}</SectionHeading>
              <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
                {results.releases.map((release) => (
                  <li key={release.id}>
                    <ReleaseTile release={release} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.tracks.length > 0 && (
            <section aria-labelledby="tracks">
              <SectionHeading id="tracks">{t("search.tracks")}</SectionHeading>
              <ul>
                {results.tracks.map((track) => (
                  <li
                    key={track.id}
                    className="flex items-center gap-4 rounded-[14px] px-3 py-2.5 odd:bg-surface-alt"
                  >
                    {track.release && (
                      <Cover
                        slug={track.release.slug}
                        title={track.release.title}
                        coverUrl={track.release.coverUrl}
                        showText={false}
                        sizes="40px"
                        className="w-10 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <Link href={`/track/${track.slug}`} className="hover:text-star">
                        {track.title}
                      </Link>
                      <p className="truncate text-sm text-fg-muted">
                        <ArtistLinks artists={track.artists} />
                        {track.release && ` · ${track.release.title}`}
                      </p>
                    </div>
                    {track.durationMs !== null && (
                      <span className="font-mono text-xs text-fg-muted tabular">
                        {formatDuration(track.durationMs)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="remote" className="max-w-3xl">
            <SectionHeading id="remote">{t("search.remoteTitle")}</SectionHeading>
            <p className="mb-4 text-sm text-fg-muted">{t("search.remoteHint")}</p>
            {me ? (
              <RemoteSearch
                key={`${query.q}|${type}`}
                q={query.q}
                type={type}
                autoStart={first(raw.remote) === "1"}
              />
            ) : (
              <p>
                <Link href="/sign-in" className="text-link underline-offset-4 hover:underline">
                  {t("search.signInToAdd")}
                </Link>
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
