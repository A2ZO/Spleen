/**
 * Opens the full-screen search (`HeaderSearch` renders it): from the mobile header's
 * magnifier, the tab bar's "+" (members), its Search tab (visitors) and the home page's
 * "Rate a record". Same pattern as
 * `openKeyboardHelp`: a window event, so the openers need no shared React context.
 */
export const OPEN_SEARCH_EVENT = "spleen:open-search";

export function openSearch() {
  // On a wide screen the header's own field shows: same search, no dialog over the page.
  const field = document.getElementById("header-search");
  if (field instanceof HTMLInputElement && field.offsetParent !== null) field.focus();
  else window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

/** Click handler for a link to `/search` that opens the dialog instead once hydrated. */
export function openSearchInstead(event: { preventDefault(): void }) {
  event.preventDefault();
  openSearch();
}
