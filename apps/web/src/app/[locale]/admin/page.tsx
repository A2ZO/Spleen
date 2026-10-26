import type { ReportView } from "@spleen/api";
import { reportKinds, reportQueueSchema, reportStatuses } from "@spleen/validators";
import { getFormatter, getTranslations } from "next-intl/server";

import { DecisionForm } from "@/components/admin/ModerationForms";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { Pagination } from "@/components/ui/Pagination";
import { initRouteLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { firstParam, hrefWith, pageParam, type SearchParams } from "@/lib/search-params";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

const STATUSES = [...reportStatuses, "all"] as const;
const KINDS = ["all", ...reportKinds] as const;

/** The report queue: filters by status and kind, one card per report with its decisions. */
export default async function ReportsPage({ params, searchParams }: Props) {
  initRouteLocale((await params).locale);
  const raw = await searchParams;
  const parsed = reportQueueSchema.safeParse({
    status: firstParam(raw.status) ?? "open",
    kind: firstParam(raw.kind) ?? "all",
    page: pageParam(raw.page),
  });
  const query = parsed.success ? parsed.data : reportQueueSchema.parse({});
  const reports = await (await getApi()).admin.reports(query);
  const t = await getTranslations("admin");
  const href = (changes: Partial<typeof query>) => {
    const next = { ...query, page: 1, ...changes };
    return hrefWith("/admin", {
      status: next.status === "open" ? null : next.status,
      kind: next.kind === "all" ? null : next.kind,
      page: next.page,
    });
  };

  return (
    <section aria-labelledby="queue-title" className="space-y-6">
      <h2 id="queue-title" className="sr-only">
        {t("tabs.reports")}
      </h2>
      <LinkTabs
        label={t("statusFilter")}
        current={query.status}
        tabs={STATUSES.map((status) => ({
          id: status,
          label: t(`status.${status}`),
          href: href({ status }),
        }))}
      />
      <LinkTabs
        label={t("kindFilter")}
        current={query.kind}
        tabs={KINDS.map((kind) => ({ id: kind, label: t(`kind.${kind}`), href: href({ kind }) }))}
      />
      <p className="text-sm text-fg-muted">{t("count", { count: reports.total })}</p>
      {reports.items.length === 0 ? (
        <p className="py-6 font-serif text-lg text-fg-muted italic">{t("empty")}</p>
      ) : (
        <ul className="space-y-4">
          {reports.items.map((report) => (
            <li key={report.id}>
              <ReportCard report={report} />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={reports.page}
        pageCount={reports.pageCount}
        hrefFor={(page) => href({ page })}
      />
    </section>
  );
}

async function ReportCard({ report }: { report: ReportView }) {
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const { subject } = report;
  const titleId = `report-${report.id}`;
  return (
    <article
      aria-labelledby={titleId}
      className="space-y-4 rounded-md border border-border bg-surface p-4 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2">
        <Badge>{t(`kind.${subject.kind}`)}</Badge>
        <h3 id={titleId} className="font-serif text-lg">
          {t(`reasons.${report.reason}`)}
        </h3>
        {subject.hidden && <Badge>{t("hiddenBadge")}</Badge>}
        {subject.member?.suspended && <Badge>{t("suspendedBadge")}</Badge>}
        <time dateTime={report.createdAt} className="ml-auto font-mono text-xs text-fg-muted">
          {format.dateTime(new Date(report.createdAt), { dateStyle: "medium", timeStyle: "short" })}
        </time>
      </header>
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-fg-muted">{t("subjectLabel")}</dt>
        <dd className="min-w-0 break-words">
          {subject.href ? (
            <Link href={subject.href} className="text-link underline-offset-2 hover:underline">
              {subject.label || t("untitled")}
            </Link>
          ) : (
            subject.label || t("contentGone")
          )}
        </dd>
        {subject.member && (
          <>
            <dt className="text-fg-muted">
              {subject.kind === "member" ? t("memberLabel") : t("authorLabel")}
            </dt>
            <dd>
              {subject.member.displayName} (@{subject.member.username})
              {subject.member.admin && ` · ${t("adminBadge")}`}
            </dd>
          </>
        )}
        <dt className="text-fg-muted">{t("reporterLabel")}</dt>
        <dd>
          {report.reporter
            ? `${report.reporter.displayName} (@${report.reporter.username})`
            : t("reporterGone")}
        </dd>
        {report.details && (
          <>
            <dt className="text-fg-muted">{t("detailsLabel")}</dt>
            <dd className="whitespace-pre-line">{report.details}</dd>
          </>
        )}
        {subject.duplicate && (
          <>
            <dt className="text-fg-muted">{t("duplicateLabel")}</dt>
            <dd className="min-w-0 break-words">
              <Link
                href={subject.duplicate.href}
                className="text-link underline-offset-2 hover:underline"
              >
                {subject.duplicate.label || t("untitled")}
              </Link>
            </dd>
          </>
        )}
        {report.sameSubjectOpen > 0 && (
          <>
            <dt className="text-fg-muted">{t("othersLabel")}</dt>
            <dd>{t("others", { count: report.sameSubjectOpen })}</dd>
          </>
        )}
        {report.resolution && (
          <>
            <dt className="text-fg-muted">{t("resolutionLabel")}</dt>
            <dd>
              {t("resolution", {
                status: report.status,
                name: report.resolution.by?.displayName ?? t("moderatorGone"),
                date: format.dateTime(new Date(report.resolution.at), { dateStyle: "medium" }),
              })}
              {report.resolution.note && (
                <span className="mt-1 block text-fg-muted italic">{report.resolution.note}</span>
              )}
            </dd>
          </>
        )}
      </dl>
      {report.status === "open" && subject.duplicate && (
        <ButtonLink
          variant="outline"
          href={hrefWith("/admin/merge", { ...subject.duplicate.merge, report: report.id })}
        >
          {t("mergeLink")}
        </ButtonLink>
      )}
      {report.decisions.length > 0 && (
        <DecisionForm reportId={report.id} decisions={report.decisions} />
      )}
    </article>
  );
}
