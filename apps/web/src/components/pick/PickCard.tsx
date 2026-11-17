import type { ToListenPick } from "@spleen/api";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { ListenOn } from "@/components/catalog/ListenOn";
import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { Link } from "@/i18n/navigation";

type Picked = NonNullable<ToListenPick["pick"]>;

/**
 * The record drawn by « Tire un disque »: big cover, linked title and artists, « Album · 1959 ·
 * 42 min », the listen links, then the actions (« Un autre » or the « only one » sentence). Not
 * one whole link: the title, the artists and the links each lead somewhere.
 */
export async function PickCard({ pick, actions }: { pick: Picked; actions: ReactNode }) {
  const t = await getTranslations();
  const details = [
    t(`releaseType.${pick.type}`),
    pick.year === null ? null : String(pick.year),
    pick.durationMs === null
      ? null
      : t("album.duration", { minutes: Math.round(pick.durationMs / 60_000) }),
  ].filter((part) => part !== null);

  return (
    <Card className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,360px)_1fr] md:items-center md:gap-10 md:p-8">
      <Cover
        slug={pick.slug}
        title={pick.title}
        artistName={pick.artists[0]?.name}
        coverUrl={pick.coverUrl}
        alt={t("album.coverAlt", { title: pick.title })}
        sizes="(min-width: 768px) 360px, 300px"
        className="mx-auto w-full max-w-[300px] rounded-card-sm! md:max-w-none"
      />
      <div className="min-w-0 space-y-5">
        <div className="space-y-2">
          <h2 className="font-display text-[32px] leading-[1.02] font-extrabold tracking-[-0.03em] text-balance break-words md:text-[clamp(36px,4vw,52px)]">
            <Link href={`/album/${pick.slug}`} className="hover:text-link">
              {pick.title}
            </Link>
          </h2>
          {pick.artists.length > 0 && (
            <p className="text-lg text-balance break-words">
              {pick.artists.map((artist, i) => (
                <span key={artist.slug}>
                  {i > 0 && ", "}
                  <Link href={`/artist/${artist.slug}`} className="hover:text-link">
                    {artist.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
          <p className="font-mono text-xs tracking-[0.14em] text-fg-muted uppercase">
            {details.join(" · ")}
          </p>
        </div>
        <ListenOn links={pick.listenLinks} />
        {actions}
      </div>
    </Card>
  );
}
