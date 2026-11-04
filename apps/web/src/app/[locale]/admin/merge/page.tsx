import type { CatalogMergePreview, MergeCandidate } from "@spleen/api";
import {
  catalogKinds,
  catalogMergeSchema,
  catalogMergeTargetSchema,
  slugSchema,
  type CatalogKind,
} from "@spleen/validators";
import { getTranslations } from "next-intl/server";

import { MergeForm } from "@/components/admin/ModerationForms";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { initRouteLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { errorCode } from "@/lib/api-errors";
import { firstParam, hrefWith, type SearchParams } from "@/lib/search-params";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

const linkClasses = "text-link underline-offset-2 hover:underline";
const PATHS: Record<CatalogKind, string> = { release: "album", track: "track", artist: "artist" };

/**
 * Duplicate merges: two pages are named (address or slug), checked with what each carries,
 * then merged with a reason. Opened from a duplicate report with both pages filled in.
 */
export default async function MergePage({ params, searchParams }: Props) {
  initRouteLocale((await params).locale);
  const raw = await searchParams;
  const t = await getTranslations("admin.merge");
  const te = await getTranslations("errors");
  const kindSchema = catalogMergeTargetSchema.shape.kind;
  const kindParam = kindSchema.safeParse(firstParam(raw.kind));
  const kind: CatalogKind = kindParam.success ? kindParam.data : "release";
  const keep = firstParam(raw.keep) ?? "";
  const duplicate = firstParam(raw.duplicate) ?? "";
  const report = catalogMergeSchema.shape.reportId.safeParse(firstParam(raw.report));
  const reportId = report.success ? report.data : undefined;
  const mergedKind = kindSchema.safeParse(firstParam(raw.merged));
  const mergedSlug = slugSchema.safeParse(firstParam(raw.slug));

  let preview: CatalogMergePreview | null = null;
  let error: string | null = null;
  const target = catalogMergeTargetSchema.safeParse({ kind, keep, duplicate });
  if (target.success) {
    try {
      preview = await (await getApi()).admin.mergePreview(target.data);
    } catch (caught) {
      error = te(errorCode(caught));
    }
  }

  return (
    <section aria-labelledby="merge-title" className="max-w-3xl space-y-6">
      <h2 id="merge-title" className="text-2xl font-semibold">
        {t("title")}
      </h2>
      <p className="text-pretty text-fg-muted">{t("intro")}</p>
      {mergedKind.success && mergedSlug.success && (
        <FormMessage tone="success">
          {t("done")}{" "}
          <Link href={`/${PATHS[mergedKind.data]}/${mergedSlug.data}`} className={linkClasses}>
            {t("openKept")}
          </Link>
        </FormMessage>
      )}

      <form method="get" className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("kindLegend")}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {catalogKinds.map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  defaultChecked={kind === value}
                  className="accent-accent"
                />
                {t(`kinds.${value}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("keepLabel")}
            hint={t("pageHint")}
            name="keep"
            defaultValue={keep}
            autoComplete="off"
            spellCheck={false}
            required
          />
          <TextField
            label={t("duplicateLabel")}
            hint={t("pageHint")}
            name="duplicate"
            defaultValue={duplicate}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </div>
        {reportId && <input type="hidden" name="report" value={reportId} />}
        <Button type="submit" variant="outline">
          {t("check")}
        </Button>
      </form>

      {error && <FormMessage tone="error">{error}</FormMessage>}
      {preview && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <CandidateCard title={t("keepTitle")} candidate={preview.keep} />
            <CandidateCard title={t("duplicateTitle")} candidate={preview.duplicate} />
          </div>
          <p>
            <Link
              href={hrefWith("/admin/merge", {
                kind,
                keep: preview.duplicate.slug,
                duplicate: preview.keep.slug,
                report: reportId ?? null,
              })}
              className={linkClasses}
            >
              ⇄ {t("swap")}
            </Link>
          </p>
          {reportId && <p className="text-sm text-fg-muted">{t("fromReport")}</p>}
          <MergeForm
            merge={{ kind, keep: preview.keep.slug, duplicate: preview.duplicate.slug, reportId }}
          />
        </div>
      )}
    </section>
  );
}

async function CandidateCard({ title, candidate }: { title: string; candidate: MergeCandidate }) {
  const t = await getTranslations("admin.merge");
  return (
    <article className="space-y-2 rounded-md border border-border bg-surface p-4 shadow-card">
      <p className="font-mono text-xs tracking-[0.2em] text-star uppercase">{title}</p>
      <h3 className="font-serif text-lg break-words">
        <Link href={candidate.href} className={linkClasses}>
          {candidate.title}
        </Link>
      </h3>
      <p className="font-mono text-xs break-all text-fg-muted">{candidate.slug}</p>
      <p className="text-sm text-fg-muted">
        {t("counts", {
          listens: candidate.listens,
          reviews: candidate.reviews,
          listItems: candidate.listItems,
        })}
      </p>
    </article>
  );
}
