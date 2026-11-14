import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { KeyboardHelpButton } from "./KeyboardHelp";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "./Logo";

const LEGAL_LINKS = [
  { href: "/legal", key: "notice" },
  { href: "/terms", key: "terms" },
  { href: "/privacy", key: "privacy" },
  { href: "/legal#credits", key: "credits" },
] as const;

/**
 * Logo on the left; on the right the legal links (notice, terms, privacy, MusicBrainz
 * credits), the keyboard shortcut help and the language switch (its only place).
 */
export function Footer() {
  const t = useTranslations("legal");
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-6 text-sm text-fg-muted sm:px-6">
        <Logo className="text-xl text-fg" />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <nav aria-label={t("footerLabel")}>
            <ul className="flex flex-wrap items-center gap-x-5">
              {LEGAL_LINKS.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center underline hover:text-fg"
                  >
                    {t(`links.${link.key}`)}
                  </Link>
                </li>
              ))}
              <li className="empty:hidden">
                <KeyboardHelpButton />
              </li>
            </ul>
          </nav>
          <LocaleSwitcher />
        </div>
      </div>
    </footer>
  );
}
