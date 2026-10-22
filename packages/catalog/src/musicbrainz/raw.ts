/* The subset of MusicBrainz web service (WS/2, JSON) responses that Spleen reads. */

export interface MbArtist {
  id: string;
  name: string;
  "sort-name"?: string;
  disambiguation?: string;
  country?: string | null;
  type?: string | null;
  genres?: MbGenre[];
  score?: number;
}

export interface MbArtistCredit {
  name: string;
  joinphrase?: string;
  artist: MbArtist;
}

export interface MbGenre {
  name: string;
  count: number;
}

export interface MbRelease {
  id: string;
  title?: string;
  status?: string | null;
  date?: string;
  country?: string | null;
  "text-representation"?: { language?: string | null };
  "release-group"?: MbReleaseGroup;
  media?: MbMedium[];
}

export interface MbReleaseGroup {
  id: string;
  title: string;
  "primary-type"?: string | null;
  "secondary-types"?: string[];
  "first-release-date"?: string;
  "artist-credit"?: MbArtistCredit[];
  genres?: MbGenre[];
  releases?: MbRelease[];
  score?: number;
}

export interface MbMedium {
  position: number;
  tracks?: MbTrack[];
}

export interface MbTrack {
  position: number;
  title: string;
  length?: number | null;
  recording: MbRecording;
}

export interface MbRecording {
  id: string;
  title: string;
  length?: number | null;
  "artist-credit"?: MbArtistCredit[];
  releases?: MbRelease[];
  score?: number;
}

export interface MbReleaseGroupBrowse {
  "release-group-count": number;
  "release-groups": MbReleaseGroup[];
}
