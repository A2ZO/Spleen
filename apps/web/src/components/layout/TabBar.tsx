import { getTranslations } from "next-intl/server";

import { loadShell } from "@/server/shell";

import { TabBarItems, type Tab } from "./TabBarItems";

/**
 * Floating tab bar on phones (hidden from `md`). Members: Home, Discover, "+" (rate a
 * record: opens the search), Notifications, Profile. Visitors: Home, Discover, Search,
 * Sign in. The page keeps room for it below (`globals.css`, `#tab-bar`).
 */
export async function TabBar() {
  const t = await getTranslations("nav");
  const { me, unread } = await loadShell();
  const profile = me?.profile;

  const tabs: Tab[] = me
    ? [
        { kind: "link", icon: "home", href: "/", label: t("home") },
        { kind: "link", icon: "discover", href: "/discover", label: t("discover") },
        { kind: "rate", label: t("rate") },
        ...(profile
          ? [
              {
                kind: "link" as const,
                icon: "notifications" as const,
                href: "/notifications",
                label:
                  unread > 0
                    ? `${t("notifications")} (${t("unread", { count: unread })})`
                    : t("notifications"),
                unread,
              },
            ]
          : []),
        {
          kind: "link",
          icon: "profile",
          href: profile ? `/u/${profile.username}` : "/welcome",
          label: t("profile"),
        },
      ]
    : [
        { kind: "link", icon: "home", href: "/", label: t("home") },
        { kind: "link", icon: "discover", href: "/discover", label: t("discover") },
        { kind: "search", label: t("searchLabel") },
        { kind: "link", icon: "signIn", href: "/sign-in", label: t("signIn") },
      ];

  return <TabBarItems label={t("label")} tabs={tabs} />;
}
