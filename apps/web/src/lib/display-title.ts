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

/**
 * Profile name, set next to an 80 px avatar on phones (about 230 px left on a 360 px screen):
 * past 12 letters in one word the avatar goes above the name so the word gets the full width,
 * and the size keeps shrinking with the longest word. Desktop shrinks only for long words. Every size is returned here: `cn` does not merge classes.
 */
export function profileNameLayout(name: string): { stacked: boolean; size: string } {
  const longest = Math.max(0, ...name.split(/\s+/).map((word) => word.length));
  if (longest > 24) return { stacked: true, size: "max-md:text-[20px] md:text-[40px]" };
  if (longest > 20) return { stacked: true, size: "max-md:text-[24px] md:text-[40px]" };
  if (longest > 16) return { stacked: true, size: "max-md:text-[28px] md:text-[40px]" };
  if (longest > 12) return { stacked: true, size: "max-md:text-[32px] md:text-[48px]" };
  if (longest > 9) return { stacked: false, size: "max-md:text-[32px] md:text-[64px]" };
  if (longest > 7) return { stacked: false, size: "max-md:text-[40px] md:text-[64px]" };
  return { stacked: false, size: "text-5xl md:text-[64px]" };
}
