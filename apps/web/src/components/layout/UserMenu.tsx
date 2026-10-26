"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { SignOutButton } from "@/components/account/SignOutButton";
import { Avatar } from "@/components/ui/Avatar";
import { Link } from "@/i18n/navigation";

const item = "block w-full rounded-sm px-3 py-2 text-left text-sm text-fg hover:bg-surface-raised";

/** Avatar button opening a small menu: shelf, settings, moderation (admins), sign out. Closes on Escape or outside click. */
export function UserMenu({
  locale,
  username,
  displayName,
  avatarUrl,
  isAdmin = false,
}: {
  locale: string;
  /** Null until onboarding is done. */
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  /** Shows the moderation link (the admin pages check the role on the server anyway). */
  isAdmin?: boolean;
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full focus-visible:outline-offset-2"
      >
        <Avatar
          name={displayName}
          seed={username ?? displayName}
          src={avatarUrl}
          className="size-9"
        />
        <span className="sr-only">{t("accountMenu")}</span>
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 mt-2 w-52 rounded-md border border-border bg-surface p-1 shadow-card"
        >
          <p className="truncate px-3 py-2 text-xs text-fg-muted">
            {username ? `@${username}` : displayName}
          </p>
          <ul onClick={() => setOpen(false)}>
            <li>
              <Link href={username ? `/u/${username}` : "/welcome"} className={item}>
                {t("myShelf")}
              </Link>
            </li>
            {/* The header's links are hidden on phones: Discover is reachable here. */}
            <li className="sm:hidden">
              <Link href="/discover" className={item}>
                {t("discover")}
              </Link>
            </li>
            {username && (
              <li>
                <Link href="/settings" className={item}>
                  {t("settings")}
                </Link>
              </li>
            )}
            {isAdmin && (
              <li>
                <Link href="/admin" className={item}>
                  {t("admin")}
                </Link>
              </li>
            )}
            <li>
              <SignOutButton
                href={`/${locale}`}
                variant="ghost"
                className={`${item} justify-start`}
              >
                {t("signOut")}
              </SignOutButton>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
