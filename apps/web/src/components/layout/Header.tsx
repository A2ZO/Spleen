import { getLocale, getTranslations } from "next-intl/server";

import { buttonClasses } from "@/components/ui/Button";
import { BellIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { loadShell } from "@/server/shell";

import { HeaderSearch } from "./HeaderSearch";
import { KeyboardHelp } from "./KeyboardHelp";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { NotificationBadge } from "./NotificationBadge";
import { UserMenu } from "./UserMenu";

/**
 * Site header. From `md`: a floating pill (logo, links, instant search, bell, avatar) that
 * sticks to the top. Below: a plain row that scrolls away (logo, then search and avatar for
 * members); navigation lives in the floating tab bar (`TabBar`). `minimal`: the logo only
 * (suspended account screen).
 */
export async function Header({ minimal = false }: { minimal?: boolean }) {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  const { me, unread } = minimal ? { me: null, unread: 0 } : await loadShell();
  const profile = me?.profile;

  const links = [
    { href: "/", label: t("home") },
    { href: "/discover", label: t("discover") },
    ...(profile ? [{ href: `/u/${profile.username}`, label: t("myShelf") }] : []),
  ];

  return (
    <header className="z-40 px-4 md:sticky md:top-4 md:mt-4 md:px-6">
      <div
        data-header-row
        className="mx-auto flex h-16 max-w-6xl items-center gap-3 md:gap-4 md:rounded-full md:border md:border-border md:bg-surface md:pr-2.5 md:pl-6 md:shadow-card"
      >
        <Link prefetch="auto" href="/" className="shrink-0 rounded-full text-fg">
          <Logo />
          <span className="sr-only">{t("home")}</span>
        </Link>
        {!minimal && (
          <nav aria-label={t("label")} className="hidden md:block">
            <NavLinks items={links} />
          </nav>
        )}
        {minimal ? <span className="flex-1" /> : <HeaderSearch signedIn={Boolean(me)} />}
        {!minimal && (
          <div className="flex shrink-0 items-center gap-2">
            {profile && (
              <Link
                href="/notifications"
                className={buttonClasses("secondary", "relative max-md:hidden", "icon")}
              >
                <BellIcon className="size-5" />
                <span className="sr-only">
                  {t("notifications")}
                  {unread > 0 && ` (${t("unread", { count: unread })})`}
                </span>
                <NotificationBadge unread={unread} />
              </Link>
            )}
            {me ? (
              <UserMenu
                locale={locale}
                username={profile?.username ?? null}
                displayName={profile?.displayName ?? me.email}
                avatarUrl={profile?.avatarUrl ?? null}
                isAdmin={me.isAdmin}
              />
            ) : (
              <Link href="/sign-in" className={buttonClasses("secondary", "max-md:hidden", "sm")}>
                {t("signIn")}
              </Link>
            )}
          </div>
        )}
      </div>
      <KeyboardHelp signedIn={Boolean(profile)} />
    </header>
  );
}
