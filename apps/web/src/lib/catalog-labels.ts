/* Message keys for catalog values (typed, so next-intl can check them). */

const SECONDARY_TYPE_KEYS = [
  "compilation",
  "soundtrack",
  "spokenword",
  "interview",
  "audiobook",
  "audiodrama",
  "live",
  "remix",
  "djmix",
  "mixtapestreet",
  "demo",
  "fieldrecording",
] as const;

export type SecondaryTypeKey = (typeof SECONDARY_TYPE_KEYS)[number];

/** "dj-mix" → "djmix"; null for a type without a translation (shown as is). */
export function secondaryTypeKey(type: string): SecondaryTypeKey | null {
  const key = type.replace(/[^a-z]/g, "");
  return (SECONDARY_TYPE_KEYS as readonly string[]).includes(key)
    ? (key as SecondaryTypeKey)
    : null;
}

const ARTIST_KINDS = ["person", "group", "orchestra", "choir"] as const;

export type ArtistKind = (typeof ARTIST_KINDS)[number] | "other";

export function artistKind(type: string | null): ArtistKind {
  return (ARTIST_KINDS as readonly string[]).includes(type ?? "") ? (type as ArtistKind) : "other";
}
