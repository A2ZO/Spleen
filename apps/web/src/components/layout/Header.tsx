import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { DEMO_USERNAME } from "@/lib/demo";

import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-sm text-fg hover:text-star">
          <Logo />
          <span className="sr-only">{t("home")}</span>
        </Link>
        <nav aria-label={t("label")} className="ml-auto sm:ml-6">
          <ul className="flex items-center gap-1 text-sm">
            <li className="hidden sm:block">
              <Link href="/" className="rounded-md px-3 py-2 text-fg-muted hover:text-fg">
                {t("home")}
              </Link>
            </li>
            <li>
              <Link
                href={`/u/${DEMO_USERNAME}`}
                className="rounded-md px-3 py-2 text-fg-muted hover:text-fg"
              >
                {t("myShelf")}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="flex items-center gap-2 sm:ml-auto">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
