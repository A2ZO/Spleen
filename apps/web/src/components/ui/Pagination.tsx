import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** Previous / next links for a paginated list (nothing when there is a single page). */
export function Pagination({
  page,
  pageCount,
  hrefFor,
  className,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  className?: string;
}) {
  const t = useTranslations("pagination");
  if (pageCount <= 1) return null;
  const linkClasses = "text-link underline-offset-2 hover:underline";
  return (
    <nav
      aria-label={t("label")}
      className={cn("flex items-center justify-between gap-4 text-sm", className)}
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={linkClasses}>
          ← {t("previous")}
        </Link>
      ) : (
        <span />
      )}
      <span className="font-mono text-xs text-fg-muted">{t("position", { page, pageCount })}</span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next" className={linkClasses}>
          {t("next")} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
