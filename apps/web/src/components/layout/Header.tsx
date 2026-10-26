import { getLocale, getTranslations } from "next-intl/server";

import { buttonClasses } from "@/components/ui/Button";
import { BellIcon } from "@/components/ui/icons";
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
  const api = await getApi();
  const me = await api.account.me();
  const profile = me?.profile;
  const unread = profile ? await api.notification.unreadCount() : 0;

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
            <li className="hidden sm:block">
              <Link href="/discover" className="rounded-md px-3 py-2 text-fg-muted hover:text-fg">
                {t("discover")}
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
          {profile && (
            <Link
              href="/notifications"
              className="relative rounded-md p-2 text-fg-muted hover:text-fg"
            >
              <BellIcon className="size-5" />
              <span className="sr-only">
                {t("notifications")}
                {unread > 0 && ` (${t("unread", { count: unread })})`}
              </span>
              {unread > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 font-mono text-[0.65rem] leading-none text-accent-fg"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          )}
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
