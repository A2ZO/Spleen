import type { DiaryEntry } from "@spleen/api";
import { useFormatter, useTranslations } from "next-intl";

import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { daysOfMonth } from "@/lib/calendar";
import { cn } from "@/lib/cn";

const label = "font-mono text-xs tracking-[0.14em] text-fg-muted uppercase";

/**
 * "Your month": the member's dated listens of the current month (`profile.diaryMonth`, the
 * diary calendar's own data), as a huge number and one bar per day. The bars are decorative;
 * screen readers get a short summary, the detail is the diary.
 */
export function MonthCard({
  month,
  entries,
  diaryHref,
}: {
  month: string;
  entries: DiaryEntry[];
  diaryHref: string;
}) {
  const t = useTranslations("home");
  const format = useFormatter();
  const perDay = new Map<string, number>();
  for (const entry of entries) {
    perDay.set(entry.listenedOn, (perDay.get(entry.listenedOn) ?? 0) + 1);
  }
  const days = daysOfMonth(month);
  const max = Math.max(1, ...perDay.values());
  const count = entries.length;
  const first = entries.filter((entry) => !entry.relisten).length;
  const monthName = format.dateTime(new Date(`${month}-15T12:00:00Z`), {
    month: "long",
    timeZone: "UTC",
  });

  return (
    <Card className="flex flex-col">
      <h2 className={label}>
        {t("monthTitle", { month: monthName, m: String(Number(month.slice(5))) })}
      </h2>
      <p className="mt-3 flex items-end gap-3">
        <span className="font-display text-[72px] leading-[0.8] font-extrabold tracking-[-0.04em] md:text-[88px]">
          {count}
        </span>
        <span className="pb-1 text-sm leading-snug text-fg-muted">
          {t("monthListens", { count })}
          {count > 0 && (
            <>
              ,<br />
              {t("monthFirst", { first })}
            </>
          )}
        </span>
      </p>
      {count === 0 ? (
        <p className="mt-5 text-sm text-fg-muted">{t("monthEmpty")}</p>
      ) : (
        <>
          <p className="sr-only">{t("monthSummary", { count, days: perDay.size })}</p>
          <div aria-hidden="true" className="mt-5 flex h-12 items-end gap-[3px]">
            {days.map((day) => {
              const listens = perDay.get(day) ?? 0;
              return (
                <span
                  key={day}
                  className={cn(
                    "min-w-0 flex-1 rounded-[3px]",
                    listens > 0 ? "bg-accent" : "h-[3px] bg-border-strong",
                  )}
                  style={
                    listens > 0
                      ? { height: `${Math.max(25, Math.round((listens / max) * 100))}%` }
                      : undefined
                  }
                />
              );
            })}
          </div>
        </>
      )}
      <Link
        href={diaryHref}
        className="mt-5 self-start text-sm text-link underline-offset-2 hover:underline"
      >
        {t("monthDiary")}
      </Link>
    </Card>
  );
}
