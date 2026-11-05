import { normalizeSearchQuery } from "@spleen/validators";

/*
 * The member's last searches, kept only in this browser (never sent to the server). Storage
 * may be missing or throw (private window, blocked site data): everything degrades to "none".
 */

const KEY = "spleen-recent-searches";
export const RECENT_MAX = 5;

export function readRecentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((q): q is string => typeof q === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Not saved: the list is a convenience.
  }
}

/** Puts `q` first (once, whatever its case or spacing) and keeps the 5 latest. */
export function addRecentSearch(q: string): string[] {
  const text = q.trim().replace(/\s+/g, " ");
  if (!text) return readRecentSearches();
  const key = normalizeSearchQuery(text);
  const list = [text, ...readRecentSearches().filter((r) => normalizeSearchQuery(r) !== key)];
  const kept = list.slice(0, RECENT_MAX);
  write(kept);
  return kept;
}

export function removeRecentSearch(q: string): string[] {
  const list = readRecentSearches().filter((r) => r !== q);
  write(list);
  return list;
}
