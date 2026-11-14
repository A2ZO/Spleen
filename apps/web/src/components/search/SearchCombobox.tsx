"use client";

import type { CatalogSuggestions, MemberSuggestion, Suggestion } from "@spleen/api";
import { highlightParts } from "@spleen/api/highlight";
import { normalizeSearchQuery, SUGGEST_MIN_LENGTH } from "@spleen/validators";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { SearchIcon } from "@/components/ui/icons";
import { Link, useNavigate } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { addRecentSearch, readRecentSearches, removeRecentSearch } from "@/lib/recent-searches";
import { useTypedBeforeHydration } from "@/lib/typed-before-hydration";

/*
 * Instant search (rules in docs/catalogue.md, "Recherche"): a W3C APG combobox whose
 * suggestions come from `GET /api/search/suggest`, the same answer for everyone. Options are
 * real links (navigation bar, prefetch); validating opens the full /search page. Without
 * JavaScript it is a plain GET form to /search.
 */

const DEBOUNCE_MS = 200;
const CACHE_MAX = 50;

/** Answers already fetched in this tab, by normalised query (oldest first). */
const cache = new Map<string, CatalogSuggestions>();
function remember(key: string, data: CatalogSuggestions) {
  cache.delete(key);
  cache.set(key, data);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
}

const PAGE_OF = { artist: "artist", release: "album", track: "track" } as const;

interface Option {
  id: string;
  href: string;
  /** Saved as a recent search when opened (the typed text, or the recent search itself). */
  remember: string | null;
  /** Set on a recent search: Delete removes it. */
  recent?: string;
  className?: string;
  content: ReactNode;
}

interface Group {
  key: string;
  label: string | null;
  options: Option[];
}

function Marked({ text, q }: { text: string; q: string }) {
  return highlightParts(text, q).map((part, i) =>
    part.match ? (
      <strong key={i} className="font-semibold text-fg">
        {part.text}
      </strong>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  );
}

function Picture({ item, size }: { item: Suggestion; size: "sm" | "lg" }) {
  const frame = size === "lg" ? "size-16" : "size-9";
  // An artist without a picture gets initials, not a made-up sleeve.
  if (!item.cover || (item.kind === "artist" && !item.cover.url))
    return <Avatar name={item.title} seed={item.slug} className={cn(frame, "ring-0")} />;
  return (
    <Cover
      slug={item.cover.slug}
      title={item.cover.title}
      coverUrl={item.cover.url}
      showText={false}
      sizes={size === "lg" ? "64px" : "36px"}
      className={cn(frame, "shrink-0", item.kind === "artist" && "rounded-full")}
    />
  );
}

export interface SearchComboboxProps {
  /** Field id (`header-search`, `search-q`, ...). */
  id: string;
  label: string;
  /** header: compact field, floating popup; page: large field; dialog: full screen (mobile). */
  variant: "header" | "page" | "dialog";
  signedIn: boolean;
  initialQuery?: string;
  /** Result filter of the /search page, kept on validation. */
  type?: string;
  autoFocus?: boolean;
  /** Called before any navigation (the mobile dialog closes itself). */
  onNavigate?: () => void;
}

export function SearchCombobox({
  id,
  label,
  variant,
  signedIn,
  initialQuery = "",
  type = "all",
  autoFocus,
  onNavigate,
}: SearchComboboxProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useNavigate();
  const listboxId = useId();
  const hintId = useId();
  const wrapper = useRef<HTMLFormElement>(null);

  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  // A new `q` from the URL (validation, back button) replaces the field.
  const [synced, setSynced] = useState(initialQuery);
  if (initialQuery !== synced) {
    setSynced(initialQuery);
    setValue(initialQuery);
  }
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
    setOpen(true);
  };
  const typed = useTypedBeforeHydration(value, onChange);

  const [recents, setRecents] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fetched, setFetched] = useState<CatalogSuggestions | null>(null);

  const key = normalizeSearchQuery(value);
  const ready = key.length >= SUGGEST_MIN_LENGTH;
  const current = ready ? (cache.get(key) ?? null) : null;
  // While the next answer loads, the previous one stays on screen (no flicker).
  const shown = ready ? (current ?? fetched) : null;

  // A new query starts with no active option.
  const [activeFor, setActiveFor] = useState(key);
  if (activeFor !== key) {
    setActiveFor(key);
    setActiveId(null);
  }

  useEffect(() => {
    if (!ready || cache.has(key)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(key)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as CatalogSuggestions;
        remember(key, data);
        setFetched(data);
      } catch {
        // Aborted by the next keystroke, or offline: validating still opens /search.
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, ready]);

  const searchHref = (q: string) => {
    const params = new URLSearchParams({ q });
    if (type !== "all") params.set("type", type);
    return `/search?${params.toString()}`;
  };
  const typedText = value.trim().replace(/\s+/g, " ");

  const groups: Group[] = [];
  if (!ready) {
    if (recents.length > 0)
      groups.push({
        key: "recent",
        label: t("search.suggest.recent"),
        options: recents.map((q, i) => ({
          id: `${listboxId}-recent-${i}`,
          href: searchHref(q),
          remember: q,
          recent: q,
          content: (
            <>
              <span className="text-fg-muted" aria-hidden="true">
                ↺
              </span>
              <span className="min-w-0 flex-1 truncate">{q}</span>
            </>
          ),
        })),
      });
  } else if (shown) {
    const suggestion = (item: Suggestion, prefix: string, size: "sm" | "lg"): Option => {
      const details =
        item.kind === "artist"
          ? [item.subtitle ?? t("search.kind.artist")]
          : [
              item.kind === "release"
                ? item.releaseType
                  ? t(`releaseType.${item.releaseType}`)
                  : null
                : t("search.kind.recording"),
              item.subtitle,
              item.year !== null ? String(item.year) : null,
            ];
      return {
        id: `${listboxId}-${prefix}-${item.kind}-${item.slug}`,
        href: `/${PAGE_OF[item.kind]}/${item.slug}`,
        remember: typedText,
        className: size === "lg" ? "py-3" : undefined,
        content: (
          <>
            <Picture item={item} size={size} />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate text-fg",
                  size === "lg" && "font-display text-xl font-bold tracking-[-0.02em]",
                )}
              >
                <Marked text={item.title} q={value} />
              </span>
              <span className="block truncate text-xs text-fg-muted">
                {details.filter(Boolean).join(" · ")}
              </span>
            </span>
          </>
        ),
      };
    };
    const member = (m: MemberSuggestion): Option => ({
      id: `${listboxId}-member-${m.username}`,
      href: `/u/${m.username}`,
      remember: typedText,
      content: (
        <>
          <Avatar name={m.displayName} seed={m.username} src={m.avatarUrl} className="size-9" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-fg">
              <Marked text={m.displayName} q={value} />
            </span>
            <span className="block truncate text-xs text-fg-muted">
              @<Marked text={m.username} q={value} />
            </span>
          </span>
        </>
      ),
    });

    if (shown.best)
      groups.push({
        key: "best",
        label: t("search.suggest.best"),
        options: [suggestion(shown.best, "best", "lg")],
      });
    const kinds = [
      ["artists", t("search.artists")],
      ["releases", t("search.filter.release")],
      ["tracks", t("search.tracks")],
    ] as const;
    for (const [kind, name] of kinds)
      if (shown[kind].length > 0)
        groups.push({
          key: kind,
          label: name,
          options: shown[kind].map((item) => suggestion(item, kind, "sm")),
        });
    if (shown.members.length > 0)
      groups.push({
        key: "members",
        label: t("search.suggest.members"),
        options: shown.members.map(member),
      });
  }

  const found = groups.reduce((n, g) => n + g.options.length, 0);
  const isMembers = key.startsWith("@");
  const nothing = current !== null && found === 0;
  if (ready) {
    const action: Option =
      nothing && !isMembers
        ? signedIn
          ? {
              id: `${listboxId}-remote`,
              href: `${searchHref(typedText)}&remote=1`,
              remember: typedText,
              className: "text-link",
              content: t("search.remoteButton"),
            }
          : {
              id: `${listboxId}-sign-in`,
              href: "/sign-in",
              remember: null,
              className: "text-link",
              content: t("search.signInToAdd"),
            }
        : {
            id: `${listboxId}-all`,
            href: searchHref(typedText),
            remember: typedText,
            className: "text-link",
            content: t("search.suggest.seeAll"),
          };
    groups.push({ key: "action", label: null, options: [action] });
  }

  const options = groups.flatMap((g) => g.options);
  const active = options.find((o) => o.id === activeId) ?? null;
  const expanded = open && options.length > 0;

  useEffect(() => {
    if (!active) return;
    document.getElementById(active.id)?.scrollIntoView({ block: "nearest" });
    router.prefetch(active.href);
  }, [active, router]);

  const close = () => {
    setOpen(false);
    setActiveId(null);
  };
  const leave = (saved: string | null) => {
    if (saved) setRecents(addRecentSearch(saved));
    close();
    onNavigate?.();
  };
  const move = (step: 1 | -1) => {
    if (options.length === 0) return;
    const at = active ? options.indexOf(active) : step === 1 ? -1 : 0;
    setActiveId(options[(at + step + options.length) % options.length]!.id);
  };
  const forget = (q: string) => {
    setRecents(removeRecentSearch(q));
    setActiveId(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!expanded) {
          setOpen(true);
          if (recents.length === 0 && !ready) setRecents(readRecentSearches());
        }
        move(event.key === "ArrowDown" ? 1 : -1);
        break;
      case "Enter":
        if (expanded && active) {
          event.preventDefault();
          document.getElementById(active.id)?.click();
        }
        break;
      case "Escape":
        if (expanded) {
          event.preventDefault();
          close();
        } else if (value) {
          event.preventDefault();
          setValue("");
        }
        // Empty and closed: the mobile dialog's own Escape closes it.
        break;
      case "Delete":
        if (expanded && active?.recent) {
          event.preventDefault();
          forget(active.recent);
        }
        break;
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!typedText) return;
    leave(typedText);
    router.push(searchHref(typedText));
  };

  const status = !open
    ? ""
    : nothing
      ? isMembers
        ? t("search.suggest.noMember")
        : t("search.suggest.nothing")
      : current
        ? t("search.suggest.count", { count: found })
        : "";

  const floating = variant !== "dialog";
  return (
    <form
      ref={wrapper}
      role="search"
      action={`/${locale}/search`}
      onSubmit={onSubmit}
      onBlur={(event) => {
        if (!wrapper.current?.contains(event.relatedTarget as Node | null)) close();
      }}
      className={cn("relative", variant === "header" && "w-full")}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <SearchIcon
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-fg-muted",
            variant === "header" ? "left-4" : "left-4 text-lg",
          )}
        />
        <input
          ref={typed}
          id={id}
          type="search"
          name="q"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active ? active.id : undefined}
          aria-describedby={hintId}
          autoComplete="off"
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={() => {
            setRecents(readRecentSearches());
            setOpen(true);
          }}
          onClick={() => setOpen(true)}
          maxLength={100}
          autoFocus={autoFocus}
          placeholder={t("nav.searchPlaceholder")}
          className={cn(
            "w-full rounded-full border border-border-field bg-bg text-fg placeholder:text-fg-muted/70 focus:border-accent focus:outline-none",
            variant === "header"
              ? "min-h-11 pr-4 pl-10 text-sm"
              : "min-h-[52px] py-3 pr-5 pl-11 text-lg",
          )}
        />
      </div>
      {type !== "all" && <input type="hidden" name="type" value={type} />}
      <span id={hintId} className="sr-only">
        {t("search.suggest.hint")}
      </span>
      <div role="status" className="sr-only">
        {status}
      </div>

      <div
        hidden={!expanded}
        className={cn(
          floating ? "overflow-y-auto bg-surface" : "overflow-y-auto bg-bg",
          floating
            ? "absolute top-full right-0 z-50 mt-2 max-h-[min(36rem,75vh)] w-full rounded-card-sm border border-border py-2 shadow-card sm:min-w-[26rem]"
            : "mt-4",
        )}
      >
        {nothing && (
          <p className="px-4 py-2 text-fg-muted" aria-hidden="true">
            {isMembers ? t("search.suggest.noMember") : t("search.suggest.nothing")}
          </p>
        )}
        <div
          id={listboxId}
          role="listbox"
          aria-label={t("search.suggest.label")}
          // A hidden listbox still answers `aria-controls`.
        >
          {groups.map((group) => (
            <div
              key={group.key}
              role="group"
              aria-labelledby={group.label ? `${listboxId}-${group.key}` : undefined}
              aria-label={group.label ? undefined : t("search.suggest.more")}
              className={cn(group.key === "action" && "mt-1 border-t border-border/60 pt-1")}
            >
              {group.label && (
                <div
                  id={`${listboxId}-${group.key}`}
                  role="presentation"
                  className="px-4 pt-2 pb-1 font-mono text-[0.7rem] tracking-wider text-fg-muted uppercase"
                >
                  {group.label}
                </div>
              )}
              {group.options.map((option) => (
                <div key={option.id} role="none" className="relative">
                  <Link
                    id={option.id}
                    href={option.href}
                    role="option"
                    aria-selected={option === active}
                    tabIndex={-1}
                    onClick={() => leave(option.remember)}
                    onPointerMove={() => {
                      if (option !== active) setActiveId(option.id);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 text-sm outline-none",
                      option === active && (floating ? "bg-surface-raised" : "bg-surface"),
                      option.recent && "pr-11",
                      option.className,
                    )}
                  >
                    {option.content}
                  </Link>
                  {option.recent && (
                    // Mouse shortcut only: keyboard users press Delete (see the hint).
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-hidden="true"
                      title={t("search.suggest.remove", { q: option.recent })}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => forget(option.recent!)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm px-1.5 text-fg-muted hover:text-fg"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}
