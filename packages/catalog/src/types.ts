import type { ReleaseType } from "@spleen/validators";

/*
 * Provider-neutral catalog shapes. MusicBrainz is one implementation of `CatalogProvider`;
 * the rest of Spleen only sees these types. Identifiers are MusicBrainz ids (UUIDs) for now,
 * stored in the `mbid` columns.
 */

export type DatePrecision = "year" | "month" | "day";

/** A possibly partial date, padded to a full ISO date ("1959" → "1959-01-01", precision year). */
export interface PartialDate {
  date: string;
  precision: DatePrecision;
}

export interface ProviderArtist {
  mbid: string;
  name: string;
  sortName: string | null;
  disambiguation: string | null;
  /** ISO 3166-1 alpha-2, when known. */
  country: string | null;
  /** "person", "group", "orchestra"… lowercased; null when unknown. */
  type: string | null;
}

/** An artist as credited on a release or a recording ("feat." credits included). */
export interface ArtistCredit {
  artist: ProviderArtist;
  /** Name printed on the credit when it differs from the artist name. */
  creditName: string | null;
}

export interface ReleaseGroupSummary {
  mbid: string;
  title: string;
  type: ReleaseType;
  /** "live", "compilation", "soundtrack", "remix"… lowercased. */
  secondaryTypes: string[];
  firstReleaseDate: PartialDate | null;
  artists: ArtistCredit[];
}

/** One concrete release (edition) of a release group. */
export interface ReleaseEdition {
  mbid: string;
  status: string | null;
  date: PartialDate | null;
  country: string | null;
}

export interface ReleaseGroupDetail extends ReleaseGroupSummary {
  /** Most voted genres first, at most 5. */
  genres: string[];
  editions: ReleaseEdition[];
}

export interface ProviderRecording {
  mbid: string;
  title: string;
  lengthMs: number | null;
  artists: ArtistCredit[];
}

export interface TracklistEntry {
  disc: number;
  position: number;
  recording: ProviderRecording;
}

export interface Tracklist {
  /** Release (edition) the tracklist comes from. */
  releaseMbid: string;
  /** Language of the titles, "fr" / "en" or an ISO 639-3 code; null when unknown. */
  language: string | null;
  tracks: TracklistEntry[];
}

/** A recording with the release groups it appears on (to import it through an album). */
export interface RecordingDetail extends ProviderRecording {
  appearsOn: { releaseGroup: ReleaseGroupSummary; edition: ReleaseEdition }[];
}

export interface SearchHit<T> {
  /** Provider relevance, 0..100. */
  score: number;
  item: T;
}

export interface CatalogProvider {
  searchReleaseGroups(query: string, limit?: number): Promise<SearchHit<ReleaseGroupSummary>[]>;
  searchArtists(query: string, limit?: number): Promise<SearchHit<ProviderArtist>[]>;
  searchRecordings(query: string, limit?: number): Promise<SearchHit<ProviderRecording>[]>;
  getReleaseGroup(mbid: string): Promise<ReleaseGroupDetail>;
  getTracklist(releaseMbid: string): Promise<Tracklist>;
  getArtist(mbid: string): Promise<ProviderArtist>;
  /** The artist's release groups, albums and EPs first, capped to keep imports short. */
  getArtistReleaseGroups(mbid: string): Promise<ReleaseGroupSummary[]>;
  getRecording(mbid: string): Promise<RecordingDetail>;
  /** URL of the front cover, or null when there is none. */
  getCoverUrl(releaseGroupMbid: string): Promise<string | null>;
}

/**
 * Global request gate shared by every server process (Postgres-backed in production).
 * `acquire` resolves when the caller may send one request; `backOff` pushes every caller back
 * after the provider said it is overloaded.
 */
export interface Throttle {
  acquire(): Promise<void>;
  backOff(seconds: number): Promise<void>;
}
