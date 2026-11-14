import type { MySuspension } from "@spleen/api";
import { getFormatter, getTranslations } from "next-intl/server";

import { DeleteAccountForm } from "@/components/account/DeleteAccountForm";
import { SignOutButton } from "@/components/account/SignOutButton";
import { buttonClasses } from "@/components/ui/Button";

/**
 * What a suspended member sees on every page once signed in (identity proven by the magic
 * link or Google): the reason, how to contest it, and their data rights (export, deletion).
 */
export async function SuspendedNotice({
  suspension,
  locale,
}: {
  suspension: MySuspension;
  locale: string;
}) {
  const t = await getTranslations("suspended");
  const format = await getFormatter();
  const contact = suspension.contactEmail;
  const mailto = contact.includes("@") ? `mailto:${contact}` : null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-3">
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        <p className="text-fg-muted">
          {t("since", {
            date: format.dateTime(new Date(suspension.suspendedAt), { dateStyle: "long" }),
          })}
        </p>
      </header>
      <section aria-labelledby="suspension-reason" className="space-y-2">
        <h2 id="suspension-reason" className="font-display text-xl font-bold tracking-[-0.02em]">
          {t("reasonTitle")}
        </h2>
        <blockquote className="border-l-2 border-accent pl-4 whitespace-pre-line">
          {suspension.reason}
        </blockquote>
        <p className="text-fg-muted">{t("effects")}</p>
      </section>
      <section aria-labelledby="suspension-contest" className="space-y-2">
        <h2 id="suspension-contest" className="font-display text-xl font-bold tracking-[-0.02em]">
          {t("contestTitle")}
        </h2>
        <p>
          {t.rich("contestBody", {
            email: () =>
              mailto ? (
                <a href={mailto} className="text-link underline underline-offset-2">
                  {contact}
                </a>
              ) : (
                <span>{contact}</span>
              ),
          })}
        </p>
      </section>
      <section aria-labelledby="suspension-data" className="space-y-4">
        <h2 id="suspension-data" className="font-display text-xl font-bold tracking-[-0.02em]">
          {t("dataTitle")}
        </h2>
        <p className="text-fg-muted">{t("dataBody")}</p>
        <div className="flex flex-wrap gap-3">
          <a href="/api/account/export" download className={buttonClasses("outline")}>
            {t("export")}
          </a>
          <SignOutButton href="/">{t("signOut")}</SignOutButton>
        </div>
        <details className="rounded-card-sm border border-border bg-surface p-4">
          <summary className="cursor-pointer">{t("deleteTitle")}</summary>
          <div className="mt-4">
            <DeleteAccountForm username={suspension.username} locale={locale} />
          </div>
        </details>
      </section>
    </div>
  );
}
