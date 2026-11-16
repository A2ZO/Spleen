import type { UpcomingItem } from "@spleen/api";
import { useFormatter } from "next-intl";

import { ReleaseTile } from "@/components/release/ReleaseTile";
import { formatUpcomingDate } from "@/lib/release-date";

/**
 * Upcoming releases as tiles, the date in place of the year: the artist page (« À venir »),
 * the member's home page (« Bientôt dans tes oreilles ») and /discover (« Les plus attendus »).
 */
export function UpcomingGrid({ items }: { items: UpcomingItem[] }) {
  const format = useFormatter();
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <li key={item.release.id}>
          <ReleaseTile
            release={item.release}
            detail={formatUpcomingDate(format, item.date, item.precision)}
          />
        </li>
      ))}
    </ul>
  );
}
