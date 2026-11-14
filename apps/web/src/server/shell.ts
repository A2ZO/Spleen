import "server-only";

import { cache } from "react";

import { getApi } from "./api";

/**
 * What the header and the mobile tab bar both show (who is signed in, unread notifications),
 * loaded once per request.
 */
export const loadShell = cache(async () => {
  const api = await getApi();
  const me = await api.account.me();
  const unread = me?.profile ? await api.notification.unreadCount() : 0;
  return { me, unread };
});
