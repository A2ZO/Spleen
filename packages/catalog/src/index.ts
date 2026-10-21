export { CatalogError, isCatalogError, type CatalogErrorKind } from "./errors";
export { createMusicBrainzProvider, type MusicBrainzOptions } from "./musicbrainz/provider";
export {
  isMainRelease,
  MAIN_SECONDARY_TYPES,
  normalizeLanguage,
  parsePartialDate,
  pickReferenceEdition,
  rankEditions,
} from "./rules";
export { createMemoryThrottle, sleep } from "./throttle";
export type * from "./types";

/** MusicBrainz asks for at most 1 request per second per IP; keep a small margin. */
export const MUSICBRAINZ_INTERVAL_MS = 1100;
