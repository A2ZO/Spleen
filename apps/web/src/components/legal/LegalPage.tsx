import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { getApi } from "@/server/api";

/** Date of the last change to each legal text (shown at the top of its page). */
export const LEGAL_UPDATED = {
  notice: "2026-10-27",
  terms: "2026-10-27",
  // Theme cookie removed (milestone 17).
  privacy: "2026-11-12",
} as const;

const NOTICE = ["publisher", "hosting", "credits", "property"] as const;
const TERMS = [
  "service",
  "account",
  "content",
  "rules",
  "moderation",
  "catalog",
  "liability",
  "changes",
] as const;
const PRIVACY = [
  "controller",
  "data",
  "purposes",
  "visibility",
  "retention",
  "rights",
  "processors",
  "cookies",
  "minors",
  "changes",
] as const;

const linkClasses = "text-link underline underline-offset-2";

const external = (href: string) =>
  function ExternalLink(chunks: ReactNode) {
    return (
      <a href={href} className={linkClasses} rel="noopener">
        {chunks}
      </a>
    );
  };

const internal = (href: string) =>
  function InternalLink(chunks: ReactNode) {
    return (
      <Link href={href} className={linkClasses}>
        {chunks}
      </Link>
    );
  };

/** Tags the legal texts may use (`packages/i18n`, namespace `legal`). */
function richTags(contact: string) {
  const mailto = contact.includes("@") ? `mailto:${contact}` : null;
  return {
    p: (chunks: ReactNode) => <p>{chunks}</p>,
    ul: (chunks: ReactNode) => <ul className="list-disc space-y-1.5 pl-5">{chunks}</ul>,
    li: (chunks: ReactNode) => <li>{chunks}</li>,
    strong: (chunks: ReactNode) => <strong className="font-semibold">{chunks}</strong>,
    contact: () =>
      mailto ? (
        <a href={mailto} className={linkClasses}>
          {contact}
        </a>
      ) : (
        <span>{contact}</span>
      ),
    musicbrainz: external("https://musicbrainz.org"),
    cc0: external("https://creativecommons.org/publicdomain/zero/1.0/"),
    ccbyncsa: external("https://creativecommons.org/licenses/by-nc-sa/3.0/"),
    mblicense: external("https://musicbrainz.org/doc/About/Data_License"),
    caa: external("https://coverartarchive.org"),
    cnil: external("https://www.cnil.fr"),
    settings: internal("/settings"),
    terms: internal("/terms"),
    credits: internal("/legal#credits"),
  };
}

/**
 * A legal page (notice, terms, privacy): a title, the update date, an optional intro and its
 * sections, all from `legal.<page>` in `packages/i18n`. Each section has an anchor.
 */
export async function LegalPage({ page }: { page: "notice" | "terms" | "privacy" }) {
  const t = await getTranslations("legal");
  const format = await getFormatter();
  const tags = richTags(await (await getApi()).system.contact());
  const updated = t("updated", {
    date: format.dateTime(new Date(`${LEGAL_UPDATED[page]}T12:00:00Z`), { dateStyle: "long" }),
  });

  let intro: string | null = null;
  let sections: { id: string; title: string; body: ReactNode }[];
  if (page === "notice") {
    sections = NOTICE.map((id) => ({
      id,
      title: t(`notice.sections.${id}.title`),
      body: t.rich(`notice.sections.${id}.body`, tags),
    }));
  } else if (page === "terms") {
    intro = t("terms.intro");
    sections = TERMS.map((id) => ({
      id,
      title: t(`terms.sections.${id}.title`),
      body: t.rich(`terms.sections.${id}.body`, tags),
    }));
  } else {
    intro = t("privacy.intro");
    sections = PRIVACY.map((id) => ({
      id,
      title: t(`privacy.sections.${id}.title`),
      body: t.rich(`privacy.sections.${id}.body`, tags),
    }));
  }

  return (
    <article className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-3">
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] text-balance sm:text-5xl">
          {t(`${page}.title`)}
        </h1>
        <p className="font-mono text-xs text-fg-muted">{updated}</p>
        {intro && <p className="text-lg text-pretty text-fg-muted">{intro}</p>}
      </header>
      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          aria-labelledby={`${section.id}-title`}
          className="scroll-mt-24 space-y-3 leading-relaxed text-pretty"
        >
          <h2
            id={`${section.id}-title`}
            className="font-display text-2xl font-bold tracking-[-0.02em]"
          >
            {section.title}
          </h2>
          {section.body}
        </section>
      ))}
    </article>
  );
}
