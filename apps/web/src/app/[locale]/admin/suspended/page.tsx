import { getFormatter, getTranslations } from "next-intl/server";

import { SuspendForm, UnsuspendForm } from "@/components/admin/ModerationForms";
import { initRouteLocale } from "@/i18n/locale";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string }> };

/** Suspended members (lift a suspension) and a form to suspend a member directly. */
export default async function SuspendedPage({ params }: Props) {
  initRouteLocale((await params).locale);
  const members = await (await getApi()).admin.suspended();
  const t = await getTranslations("admin");
  const format = await getFormatter();

  return (
    <div className="space-y-10">
      <section aria-labelledby="suspended-title" className="space-y-4">
        <h2 id="suspended-title" className="font-display text-2xl font-bold tracking-[-0.02em]">
          {t("tabs.suspended")}
        </h2>
        {members.length === 0 ? (
          <p className="text-lg text-fg-muted">{t("suspendedEmpty")}</p>
        ) : (
          <ul className="space-y-4">
            {members.map((member) => (
              <li
                key={member.username}
                className="space-y-3 rounded-md border border-border bg-surface p-4 shadow-card"
              >
                <p>
                  <span className="font-display text-lg font-bold tracking-[-0.02em]">
                    {member.displayName}
                  </span>{" "}
                  <span className="text-fg-muted">@{member.username}</span>
                </p>
                <p className="text-sm text-fg-muted">
                  {t("suspendedSince", {
                    date: format.dateTime(new Date(member.suspendedAt), { dateStyle: "medium" }),
                  })}
                </p>
                <p className="border-l-2 border-accent pl-3 whitespace-pre-line">{member.reason}</p>
                <details className="rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-sm">{t("unsuspendTitle")}</summary>
                  <div className="mt-3">
                    <UnsuspendForm username={member.username} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="suspend-title" className="max-w-xl space-y-4">
        <h2 id="suspend-title" className="font-display text-2xl font-bold tracking-[-0.02em]">
          {t("suspendTitle")}
        </h2>
        <p className="text-sm text-fg-muted">{t("suspendHint")}</p>
        <SuspendForm />
      </section>
    </div>
  );
}
