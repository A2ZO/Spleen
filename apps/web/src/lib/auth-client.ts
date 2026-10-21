"use client";

import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Browser auth client: same origin, cookie session. */
export const authClient = createAuthClient({ plugins: [magicLinkClient()] });
