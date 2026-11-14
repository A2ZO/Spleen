import type { ArtistRef } from "@spleen/api";

import { Link } from "@/i18n/navigation";

/** "Artist A, Artist B", each linking to its artist page. */
export function ArtistLinks({
  artists,
  linkClassName = "hover:text-star",
}: {
  artists: ArtistRef[];
  linkClassName?: string;
}) {
  return artists.map((artist, index) => (
    <span key={artist.slug}>
      {index > 0 && ", "}
      <Link href={`/artist/${artist.slug}`} className={linkClassName}>
        {artist.name}
      </Link>
    </span>
  ));
}
