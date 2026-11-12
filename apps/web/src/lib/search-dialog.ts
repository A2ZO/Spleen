/**
 * Opens the full-screen search (`HeaderSearch` renders it): from the mobile header's
 * magnifier, the tab bar's "+" (members) and its Search tab (visitors). Same pattern as
 * `openKeyboardHelp`: a window event, so the openers need no shared React context.
 */
export const OPEN_SEARCH_EVENT = "spleen:open-search";

export function openSearch() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}
