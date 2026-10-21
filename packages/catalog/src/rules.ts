import type { PartialDate, ReleaseEdition } from "./types";

/** "1959" / "1959-08" / "1959-08-17" → padded date and precision; null when absent or invalid. */
export function parsePartialDate(value: string | null | undefined): PartialDate | null {
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value ?? "");
  if (!match) return null;
  const [, year, month, day] = match;
  if (year === "0000") return null;
  return {
    date: `${year}-${month ?? "01"}-${day ?? "01"}`,
    precision: day ? "day" : month ? "month" : "year",
  };
}

/** Countries preferred for the reference edition: worldwide first, then our audiences. */
const PREFERRED_COUNTRIES = ["XW", "FR", "GB", "US", "XE"];

const countryRank = (country: string | null) => {
  const index = PREFERRED_COUNTRIES.indexOf(country ?? "");
  return index === -1 ? PREFERRED_COUNTRIES.length : index;
};

/** Year, then the full date with unknown parts sorted last ("1959" after "1959-08-17"). */
const dateKey = (date: PartialDate | null) => {
  if (!date) return "9999-99-99";
  const [year, month, day] = date.date.split("-");
  if (date.precision === "year") return `${year}-99-99`;
  if (date.precision === "month") return `${year}-${month}-99`;
  return `${year}-${month}-${day}`;
};

/**
 * Picks the edition whose tracklist represents a release group ("reference release"):
 * 1. official editions first (then any status);
 * 2. earliest year (the original release, not a later reissue with bonus tracks);
 * 3. within that year, the preferred country (XW, FR, GB, US, XE, then others);
 * 4. the most precise and earliest date;
 * 5. the MusicBrainz id, so the choice is stable.
 * Importers try the next edition when MusicBrainz cannot serve the first one.
 * Documented in docs/catalogue.md.
 */
export function rankEditions(editions: ReleaseEdition[]): ReleaseEdition[] {
  const year = (e: ReleaseEdition) => e.date?.date.slice(0, 4) ?? "9999";
  return [...editions].sort(
    (a, b) =>
      Number(b.status === "official") - Number(a.status === "official") ||
      year(a).localeCompare(year(b)) ||
      countryRank(a.country) - countryRank(b.country) ||
      dateKey(a.date).localeCompare(dateKey(b.date)) ||
      a.mbid.localeCompare(b.mbid),
  );
}

export function pickReferenceEdition(editions: ReleaseEdition[]): ReleaseEdition | null {
  return rankEditions(editions)[0] ?? null;
}

/** MusicBrainz language codes (ISO 639-3) of our two audiences, mapped to the app's codes. */
const LANGUAGES: Record<string, string> = { fra: "fr", eng: "en" };

export function normalizeLanguage(code: string | null | undefined): string | null {
  if (!code || code === "zxx" || code === "mul") return null;
  return LANGUAGES[code] ?? code.slice(0, 8);
}

/** Lucene special characters are escaped so a member's text is searched literally. */
export function escapeLucene(text: string): string {
  return text.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");
}

/**
 * Secondary types that still count as main releases: mixtapes are core records in rap.
 * Live albums, compilations, soundtracks, remixes… are listed apart.
 */
export const MAIN_SECONDARY_TYPES = ["mixtape/street"];

export function isMainRelease(secondaryTypes: string[]): boolean {
  return secondaryTypes.every((type) => MAIN_SECONDARY_TYPES.includes(type));
}
