import { z } from "zod";

export const releaseTypes = ["album", "ep", "single"] as const;
export const releaseTypeSchema = z.enum(releaseTypes);
export type ReleaseType = z.infer<typeof releaseTypeSchema>;

/** Display order matters: forms and the database enum use it. */
export const listenFormats = [
  "vinyl",
  "cd",
  "cassette",
  "streaming",
  "download",
  "radio",
  "live",
  "other",
] as const;
export const listenFormatSchema = z.enum(listenFormats);
export type ListenFormat = z.infer<typeof listenFormatSchema>;

/** Lowercase ASCII words separated by single hyphens, as used in /album/[slug]. */
export const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** Groups of an artist's discography; `?all=<group>` on the artist page lists one in full. */
export const discographyGroups = ["albums", "eps", "singles", "other"] as const;
export const discographyGroupSchema = z.enum(discographyGroups);
export type DiscographyGroup = z.infer<typeof discographyGroupSchema>;

/** Community language used to split trending charts (FR / EN). */
export const audienceLangs = ["fr", "en"] as const;
export const audienceLangSchema = z.enum(audienceLangs);
export type AudienceLang = z.infer<typeof audienceLangSchema>;

/** What the unified search looks for. */
export const searchKinds = ["all", "release", "artist", "track"] as const;
export const searchKindSchema = z.enum(searchKinds);
export type SearchKind = z.infer<typeof searchKindSchema>;

export const catalogSearchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  type: searchKindSchema.default("all"),
});
export type CatalogSearchInput = z.infer<typeof catalogSearchSchema>;

/**
 * Instant search text, normalised the same way by the browser (its cache key and the URL the
 * CDN caches) and the server: Unicode NFC, trimmed, inner spaces collapsed, lower case.
 */
export const normalizeSearchQuery = (q: string) =>
  q.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

/** Shortest query that asks for suggestions ("@" counts: "@n" looks for members). */
export const SUGGEST_MIN_LENGTH = 2;

export const catalogSuggestSchema = z.object({
  q: z
    .string()
    .max(200)
    .transform(normalizeSearchQuery)
    .pipe(z.string().min(SUGGEST_MIN_LENGTH).max(100)),
});
export type CatalogSuggestInput = z.infer<typeof catalogSuggestSchema>;

/** MusicBrainz identifier (any UUID layout). */
export const mbidSchema = z.guid();

/** Entities a member can import from the catalog provider. */
export const importKinds = ["release_group", "artist", "recording"] as const;
export const importKindSchema = z.enum(importKinds);
export type ImportKind = z.infer<typeof importKindSchema>;

export const catalogImportSchema = z.object({ kind: importKindSchema, mbid: mbidSchema });
export type CatalogImportInput = z.infer<typeof catalogImportSchema>;
