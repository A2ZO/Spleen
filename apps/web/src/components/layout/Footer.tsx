import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { KeyboardHelpButton } from "./KeyboardHelp";
import { Logo } from "./Logo";
import { LocaleSwitcher } from "./LocaleSwitcher";

const LEGAL_LINKS = [
  { href: "/legal", key: "notice" },
  { href: "/terms", key: "terms" },
  { href: "/privacy", key: "privacy" },
  { href: "/legal#credits", key: "credits" },
] as const;

/**
 * Logo, legal links (notice, terms, privacy, MusicBrainz credits), the keyboard shortcut help
 * and the language switch.
 */
export function Footer() {
  const t = useTranslations("legal");
  return (
    <footer className="mt-24 border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-10 text-sm text-fg-muted sm:px-6">
        <Logo className="text-fg" />
        <nav aria-label={t("footerLabel")} className="order-last w-full sm:order-none sm:w-auto">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <li key={link.key}>
                <Link href={link.href} className="hover:text-fg">
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
    </footer>
  );
}
