import type { ListCard as List } from "@spleen/api";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { Link } from "@/i18n/navigation";

/** List preview: fanned covers, title, owner. Lists get their own page in milestone 8. */
export function ListCard({ list }: { list: List }) {
  const t = useTranslations();

  return (
    <Card className="flex flex-col gap-3">
      <div aria-hidden="true" className="flex">
        {list.preview.map((release, index) => (
          <div
            key={release.id}
            className="relative -mr-3 w-1/4 min-w-0 last:mr-0"
            style={{ zIndex: list.preview.length - index }}
          >
            <Cover
              slug={release.slug}
              title={release.title}
              coverUrl={release.coverUrl}
              sizes="80px"
              showText={false}
            />
          </div>
        ))}
      </div>
      <div>
        <h3 className="font-serif text-lg leading-tight">{list.title}</h3>
        <p className="mt-1 text-sm text-fg-muted">{list.description}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
          <Link href={`/u/${list.owner.username}`} className="hover:text-fg">
            {t("list.byline", { name: list.owner.displayName })}
          </Link>
          <span aria-hidden="true">·</span>
          <span>{t("list.itemCount", { count: list.itemCount })}</span>
          {list.ranked && <Badge>{t("list.ranked")}</Badge>}
        </p>
      </div>
    </Card>
  );
}
