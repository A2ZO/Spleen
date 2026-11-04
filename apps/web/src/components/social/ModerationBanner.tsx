import type { ModerationHold } from "@spleen/api";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";

/**
 * Shown to the author alone on their content hidden by moderation: why, and how to contest.
 * Works in server and client components (no async translation).
 */
export function ModerationBanner({
  hold,
  subject,
  className,
}: {
  hold: ModerationHold;
  subject: "review" | "list" | "comment";
  className?: string;
}) {
  const t = useTranslations("moderationHold");
  const mailto = hold.contactEmail.includes("@") ? `mailto:${hold.contactEmail}` : null;
  return (
    <div
      role="note"
      className={cn("space-y-1 rounded-sm border border-star/60 bg-surface px-4 py-3", className)}
    >
      <p className="font-medium text-star">{t("title")}</p>
      <p className="text-sm text-pretty">{t("body", { subject })}</p>
      {hold.reason && <p className="text-sm">{t("reason", { reason: hold.reason })}</p>}
      <p className="text-sm text-fg-muted">
        {t.rich("contest", {
          email: () =>
            mailto ? (
              <a href={mailto} className="text-link underline underline-offset-2">
                {hold.contactEmail}
              </a>
            ) : (
              <span>{hold.contactEmail}</span>
            ),
        })}
      </p>
    </div>
  );
}
