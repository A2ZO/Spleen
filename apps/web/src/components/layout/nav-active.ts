/**
 * Whether a navigation entry points at the current page: "/" only on the home page, the
 * others on their own page and below it (`/u/x/diary` keeps "Profile" active).
 */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
