"use client";

import { emailOTPClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser auth client: same origin, cookie session. The email OTP plugin only signs in with the
 * code sent inside the magic-link email (its own sending route is disabled on the server).
 */
export const authClient = createAuthClient({ plugins: [magicLinkClient(), emailOTPClient()] });
