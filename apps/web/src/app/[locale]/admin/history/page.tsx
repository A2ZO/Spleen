import { getFormatter, getTranslations } from "next-intl/server";

import { RestoreForm } from "@/components/admin/ModerationForms";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { initRouteLocale } from "@/i18n/locale";
import { hrefWith, pageParam, type SearchParams } from "@/lib/search-params";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

/** Every decision with its reason and author; anonymised a year after (links and excerpt). */
export default async function HistoryPage({ params, searchParams }: Props) {
  initRouteLocale((await params).locale);
  const page = pageParam((await searchParams).page);
  const history = await (await getApi()).admin.history({ page });
  const t = await getTranslations("admin");
  const format = await getFormatter();

  return (
    <section aria-labelledby="history-title" className="space-y-6">
      <h2 id="history-title" className="font-display text-2xl font-bold tracking-[-0.02em]">
        {t("tabs.history")}
      </h2>
      <p className="text-sm text-fg-muted">{t("historyHint")}</p>
      {history.items.length === 0 ? (
        <p className="py-6 text-lg text-fg-muted">{t("historyEmpty")}</p>
      ) : (
        <ol className="space-y-4">
          {history.items.map((action) => (
            <li
              key={action.id}
              className="space-y-3 rounded-md border border-border bg-surface p-4 shadow-card"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{t(`action.${action.action}`)}</Badge>
                <Badge>{t(`kind.${action.subject}`)}</Badge>
                {action.reportReason && <Badge>{t(`reasons.${action.reportReason}`)}</Badge>}
                {action.anonymized && <Badge>{t("anonymizedBadge")}</Badge>}
                <time
                  dateTime={action.createdAt}
                  className="ml-auto font-mono text-xs text-fg-muted"
                >
                  {format.dateTime(new Date(action.createdAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </div>
              <p className="whitespace-pre-line">{action.reason}</p>
              {action.excerpt && (
                <p className="border-l-2 border-border-strong pl-3 text-sm text-fg-muted">
                  {action.excerpt}
                </p>
              )}
              <p className="text-sm text-fg-muted">
                {t("historyBy", {
                  moderator: action.moderator?.displayName ?? t("moderatorGone"),
                  member: action.target ? `@${action.target.username}` : "—",
                })}
              </p>
              {action.restorable && (
                <details className="rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-sm">{t("restoreTitle")}</summary>
                  <div className="mt-3">
                    <RestoreForm subject={action.restorable} />
                  </div>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
      <Pagination
        page={history.page}
        pageCount={history.pageCount}
        hrefFor={(n) => hrefWith("/admin/history", { page: n })}
      />
    </section>
  );
}
