import { getLocale, getTranslations } from "next-intl/server";

import { buttonClasses } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { getApi } from "@/server/api";

import { HeaderSearch } from "./HeaderSearch";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

export async function Header() {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  const me = await (await getApi()).account.me();
  const profile = me?.profile;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="rounded-sm text-fg hover:text-star">
          {/* Wordmark hidden on very narrow phones: the header needs the room. */}
          <Logo className="max-[400px]:[&>span]:sr-only" />
          <span className="sr-only">{t("home")}</span>
        </Link>
        <nav aria-label={t("label")} className="hidden sm:ml-6 sm:block">
          <ul className="flex items-center gap-1 text-sm">
            <li className="hidden sm:block">
              <Link href="/" className="rounded-md px-3 py-2 text-fg-muted hover:text-fg">
                {t("home")}
              </Link>
            </li>
            {profile && (
              <li className="hidden sm:block">
                <Link
                  href={`/u/${profile.username}`}
                  className="rounded-md px-3 py-2 text-fg-muted hover:text-fg"
                >
                  {t("myShelf")}
                </Link>
              </li>
            )}
          </ul>
        </nav>
        <HeaderSearch />
        <div className="flex items-center gap-1 sm:gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          {me ? (
            <UserMenu
              locale={locale}
              username={profile?.username ?? null}
              displayName={profile?.displayName ?? me.email}
              avatarUrl={profile?.avatarUrl ?? null}
            />
          ) : (
            <Link href="/sign-in" className={buttonClasses("outline", "px-3 whitespace-nowrap")}>
              {t("signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
