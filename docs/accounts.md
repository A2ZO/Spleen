# Accounts and sessions

Reference for milestone 3. `CLAUDE.md` keeps the summary; this file has the details.

## Sign-in

- Better Auth 1.7 (`packages/auth/src/auth.ts`) on the tables of `packages/db/src/schema/auth.ts`
  through `@better-auth/drizzle-adapter`. Ids come from Postgres (`generateId: false`).
  Endpoints live under `/api/auth/*` (`apps/web/src/app/api/auth/[...all]/route.ts`).
- Magic link: valid 15 minutes, single use, token stored hashed. The email is localized
  through `metadata.locale` (`packages/auth/src/emails.ts`).
- Sign-in code (milestone 9): the **same email** carries a 6-digit code under the link (never
  in the subject or the preview), for the app installed on an iPhone, whose cookies are not
  Safari's (Apple, WWDC23 "What's new in web apps"). Better Auth's email OTP plugin; the code
  is created with the server-only `createVerificationOTP` inside `sendMagicLink`, and every
  email OTP route that would send a second email is in `DISABLED_AUTH_PATHS` (Better Auth
  answers 404). Same sign-in as the link (same user creation, session, `/welcome`, suspension
  screen; tested through both paths). Valid 15 minutes, stored hashed, 3 tries per code, and
  `SIGN_IN_CODE_FAILURES` (10 failed codes per address and per hour, all IP addresses
  together) checked in a `before` hook. A new link deletes the old code; using the link deletes
  the code and using the code deletes the pending links (`after` hook).
- Google only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set; `accountLinking`
  joins a Google sign-in to an existing account with the same email. Apple later is one more
  entry in `socialProviders`, with no migration (rows in `account`).
- Rate limits: Better Auth's `customStorage.consume` → `consumeRateLimit()` in `rate_limits`
  (`/sign-in/magic-link`: 5 per 10 min, `/sign-in/email-otp`: 10 per 10 min per IP; on in
  production, off in development). Avatar
  uploads: 10 per hour per member.

## From session to API

- `contextFor(headers)` (`apps/web/src/server/api.ts`) builds the tRPC context; the user is
  resolved lazily and memoised. `protectedProcedure` (`packages/api/src/trpc.ts`) requires it.
- Per request, `ctx.account()` reads the whole profile row once; `account.me` and
  `listening.myState` reuse it, and `me` itself is memoised (`ctx.memo`). A signed-in page
  costs 3 queries for this (Better Auth's session and user rows, then the profile); `me` adds
  none. The next allowed @username change is a separate query, read by `/settings` only
  (`account.usernameChangeAvailableAt`). Every mutation clears
  the memo (`ctx.forget()`), so a read after a write sees fresh data. No Better Auth
  `cookieCache`: a suspension or a revoked session applies on the very next request.
- Errors carry a stable code in `TRPCError.message` (`@spleen/api/errors`, safe to import in
  client components). The UI translates them under `errors.*`; a test checks both languages.

## Screens

- After sign-in, everyone lands on `/[locale]/welcome`: onboarding (@username, display name,
  one required box "15 or older and I accept the terms of use", linked to `/terms`), or a
  redirect to `/u/<username>`. Under the button, a sentence links to `/privacy` (information,
  no box). Magic link, code and Google all create a session without a profile, so
  `account.onboard` is the single rule (`termsAccepted: true`, tested). It stores
  `ageConfirmedAt`, `termsAcceptedAt` and `termsVersion` = `TERMS_VERSION`
  (`packages/validators`, set by the server, never by the client): proof of consent. When the
  terms change, bump `TERMS_VERSION` (and `LEGAL_UPDATED`); asking members whose
  `termsVersion` differs again is still to build. [À FAIRE RELIRE] wording of the box and of the
  privacy sentence (`welcome.termsLabel`, `welcome.privacyNotice`).
- `/[locale]/settings`: profile, language, privacy, blind listening, avatar, @username,
  export (`/api/account/export`) and deletion (typing one's @username to confirm).

## @username rules

`packages/api/src/lib/usernames.ts`:

- one rename per 30 days (the first choice during onboarding does not count);
- a former username stays reserved 30 days for others (`username_history`); its owner may
  take it back;
- account deletion adds a row for the current username, then `user_id` becomes NULL
  (`ON DELETE SET NULL`): every name stays reserved 30 days without any link to the person;
  except e2e test accounts (`e2e-<id>@example.test`) in development and tests, whose
  generated names are freed at once (`freesUsernamesAtOnce()` in `@spleen/db`; never when
  `NODE_ENV` is `production`);
- expired anonymous rows are purged whenever a username is claimed (onboarding, rename);
- redirects from former usernames: not yet (the history is ready for them).

## Avatars

- The browser crops and resizes the image (512 px square, WebP or PNG; re-encoding drops
  EXIF), then sends it as multipart to `/api/avatar` (`file` field).
- The API checks the magic bytes (WebP, PNG or JPEG, ≤ 1 MB) and stores
  `avatars/<userId>/<uuid>.<ext>`: a new key per upload, the old file is deleted.
- No `sharp`: it would not run on Cloudflare Workers.

## Expo app (official Better Auth flow)

The server already loads `expo()` and trusts `spleen://` (plus `exp://` in development).

```ts
import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: "https://<site>",
  plugins: [expoClient({ scheme: "spleen", storagePrefix: "spleen", storage: SecureStore })],
});

// tRPC: send the stored session cookie by hand.
httpBatchLink({
  url: "https://<site>/api/trpc",
  headers: async () => {
    const cookie = await authClient.getCookie();
    return cookie ? { Cookie: cookie } : {};
  },
  fetch: (url, options) => fetch(url, { ...options, credentials: "omit" }),
});
```

- Packages: `expo-secure-store`, plus `expo-linking`, `expo-web-browser` and `expo-constants`
  for Google.
- The session travels in the `Cookie` header: no bearer token, nothing to change on the server.
- Avatars: `expo-image-manipulator`, then the same multipart POST to `/api/avatar` with the
  same header.

## Development

- Without `BREVO_API_KEY`, magic links are printed in the `pnpm dev` terminal and copied to
  `.data/outbox/` (read by `apps/web/e2e/accounts.spec.ts`).
- To sign in as a demo member, request a link for `nuitblanche@example.test`.
- Without `S3_*`, files go to `.data/uploads/`, served by the development-only
  `/api/uploads/[...key]` route.
