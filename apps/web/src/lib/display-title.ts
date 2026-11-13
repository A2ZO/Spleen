/**
 * Phone size for a huge page title: a long word would otherwise be cut mid-word
 * (`overflow-wrap: anywhere`) on a 360 px screen. Desktop sizes are left to the page.
 */
export function phoneTitleSize(title: string, base: "56" | "48"): string {
  const longest = Math.max(0, ...title.split(/\s+/).map((word) => word.length));
  if (longest > 12) return "max-md:text-[32px]";
  if (longest > 9) return "max-md:text-[40px]";
  return base === "56" ? "max-md:text-[56px]" : "max-md:text-[48px]";
}
