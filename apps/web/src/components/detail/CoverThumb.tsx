import { Cover } from "@/components/ui/Cover";

/**
 * Decorative sleeve thumbnail for the detail bar (phone, once the big cover scrolls away).
 * No `<img>`: a CSS background, which the browser does not fetch while the thumbnail is
 * hidden, and which never counts as a second cover image on the page.
 */
export function CoverThumb({
  slug,
  title,
  coverUrl,
}: {
  slug: string;
  title: string;
  coverUrl: string | null;
}) {
  if (!coverUrl) return <Cover slug={slug} title={title} showText={false} />;
  return (
    <span
      className="block aspect-square rounded-thumb bg-surface bg-cover bg-center"
      style={{ backgroundImage: `url(${JSON.stringify(coverUrl)})` }}
    />
  );
}
