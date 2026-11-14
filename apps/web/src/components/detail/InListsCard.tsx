import type { ListCard } from "@spleen/api";
import { getTranslations } from "next-intl/server";

import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** Mosaic card: how many lists hold the record, the first titles, a link to the lists below. */
export async function InListsCard({ lists, className }: { lists: ListCard[]; className?: string }) {
  const t = await getTranslations();
  return (
    <Card
      role="region"
      aria-labelledby="in-lists-title"
      className={cn("flex flex-col gap-3", className)}
    >
      <h2
        id="in-lists-title"
        className="font-mono text-[11px] font-normal tracking-[0.06em] text-fg-muted uppercase md:text-xs"
      >
        {t("album.listsTitle")}
      </h2>
      <p className="font-display text-4xl leading-none font-extrabold tracking-[-0.03em] md:text-[52px]">
        {t("detail.listCount", { count: lists.length })}
      </p>
      <ul className="space-y-1 text-[15px] max-md:hidden">
        {lists.slice(0, 3).map((list) => (
          <li key={list.id} className="truncate">
            <Link href={`/list/${list.id}`} className="hover:text-link">
              {list.title}
            </Link>
          </li>
        ))}
      </ul>
      <a href="#lists" className="mt-auto font-medium text-link underline underline-offset-4">
        {t("detail.seeLists")}
      </a>
    </Card>
  );
}
