# Pitfalls already met (and the fix)

Moved out of CLAUDE.md to keep it short. Append new ones here.

- `node --env-file` in Next scripts → crash: Next forwards it via NODE_OPTIONS, which Node
  rejects. Use dotenv-cli.
- `new URL("…", import.meta.url)` in code bundled by Next → Turbopack copies the target as
  a public asset (it once exposed `.env`). Use `path.resolve(dirname, …)`.
- Quotes/spaces around a URL in `.env` broke parsing; `createDb()` throws without echoing it.
  Never log raw DB errors that may contain the URL.
- Neon pooler = PgBouncer transaction mode: no `SET`, `LISTEN`, session advisory locks or
  SQL `PREPARE`. Migrations need the direct URL. Free tier sleeps after 5 min (slow 1st query).
- Next 16 allows one dev server per app; Playwright reuses port 3000. Stopping turbo may
  leave `next` running on Windows: `Get-NetTCPConnection -LocalPort 3000` → `Stop-Process`.
  The dev log `apps/web/.next/dev/logs` can contain error details: never paste it as is.
- pnpm `minimumReleaseAge` blocks packages published too recently: pin an older version
  rather than adding exclusions (`pnpm add` may write `minimumReleaseAgeExclude` into
  `pnpm-workspace.yaml` by itself: revert it). Native builds: `allowBuilds` there.
- Two drizzle-orm copies (different peer sets) break types: import `sql`, `eq`… from
  `@spleen/db`, never from `drizzle-orm` outside packages/db.
- Client components import `@spleen/api/errors` (or types only), never `@spleen/api`.
  drizzle-kit writes unformatted `migrations/meta/*.json`: run Prettier on them.
- Backticks in `node -e` run; `Set-Content -Encoding utf8` adds a BOM; Python writes CRLF.
- next-intl detects `Accept-Language`: e2e tests set `test.use({ locale })`. Typed message
  keys: map dynamic values through typed helpers (`apps/web/src/lib/catalog-labels.ts`).
- Strict Mode replays effects in dev: a `<dialog>` closed in an effect cleanup fires `close`
  and unmounts itself. e2e after `reload()`: SSR HTML shows before hydration, retry clicks.
  A "skip the first run" `useRef` flag fails too (the replay runs the effect): `SearchBox`
  sent a needless `router.replace` after load, cancelled mid-render when a test ended. Compare
  with the state the effect syncs to (the field against the URL's `q`) instead.
- `updated_at` is wall clock (`$onUpdate`), not `ctx.now`: tests compare orders, not times.
- New migration → `pnpm db:migrate` on the running dev server's database, or its page 500s.
- Burst writes arrive out of order: group clicks, send an `order` (`docs/ecoute.md`).
- Raw `sql` params: postgres.js rejects a JS `Date` (PGlite accepts it): `toISOString()` +
  `::timestamptz` (job `api-postgres` catches it; API tests use `createTestDb()`). Read
  `db.execute()` results with `rowsOf()` (an array on postgres.js, `{ rows }` on PGlite).
- Single-table drizzle selects drop qualifiers: subqueries spell `"t"."col"`.
- After a Server Action, refresh with `refresh()` (`next/cache`) inside the action, never a
  client `router.refresh()`: that second request was cancelled mid-render ("The destination
  stream errored"). e2e must not leave a page before its navigation ends (checked by
  `e2e/server-log.ts`).
- No `generateStaticParams` under `app/` (lint rule): pages are dynamic anyway, and in dev it
  made concurrent first renders read a half-written `prerender-manifest.json`.
- A state update inside `startTransition` is deferred: optimistic UI (a checkbox ticked at
  once) must be set before the transition starts.
- MusicBrainz often answers 503 even under 1 req/s (back-off + retries; next edition when one
  keeps failing). The gate lives in each database: never import on PGlite and Neon at once.
- e2e after a full load (`window.location.assign`, as the sign-in code does): `toHaveURL` passes
  before hydration, and hydration resets a controlled field typed into too early (empty
  field, no error; issue #24). Wait for `html[data-hydrated]` (set by `HydrationMarker`) with
  `waitForHydration()`, then type once (`onboard()` in `e2e/helpers.ts`); no retry loop, so a
  real error fails with its message.
- Archive.org storage nodes answer 500 now and then, node by node (CAA redirects to them): the
  same cover can load in one browser and fail with `curl`. An `onError` handler alone is not a
  fallback: the image can fail before hydration (no handler yet) or without JavaScript, and
  leaves an empty square or a broken-image icon. And `onError` on next/image makes it reset
  `img.src` at hydration (`image-component.js`), restarting every download. `Cover` (server)
  shows the plain surface under the real image (`alt=""`, so a broken one draws nothing);
  `CoverImage` (client) swaps in the generated sleeve on failure, from a native listener plus
  the set kept by the inline `<head>` script (`lib/cover-errors.ts`, allowed by its CSP hash).
  Never test `complete && naturalWidth === 0`: a lazy image out of view can look failed. e2e
  (`covers.spec.ts`) stubs `coverartarchive.org` (Playwright does not route the target of a
  redirect) and covers the failure with JavaScript off, with late scripts and after hydration.
- CSP: `*.archive.org` does not cover `archive.org` itself (both are listed). A nonce or hash
  in `script-src` makes `'unsafe-inline'` ignored: the static policy of cached pages (issue #22)
  carries no hash at all (cover script, future theme script), `'unsafe-inline'` covers them.
  A whole-page navigation (`window.location.href`, the Google sign-in) is not bound by the
  policy. next-intl copies the request headers: set the CSP on a
  `new NextRequest(request, { headers })`.
- Never run `next build` in `apps/web` while `pnpm dev` runs: the production `.next` makes the
  dev server reload in a loop (same with a build id read at config time: `/sw.js` reads it at
  run time). To measure, `next start` needs the production variables: dummy values on the
  command line for that one process.
- e2e: two projects (desktop, mobile) signing in to the same demo account steal each other's
  magic link: one `e2e-<id>` account per test, made admin with `grantAdmin()` (`helpers.ts`,
  Postgres only). To find the test that makes the server log an error, run `--workers=1`: the
  `[WebServer]` lines land right after the guilty test. A browser-side check of cancelled RSC
  requests is useless (the router cancels some normally): only the server log is reliable.
- Never test a catalog merge on Neon `dev`: it cannot be undone (`docs/social.md`).
- API tests: `ctx.account()` is memoised per context: count round trips with one context per
  request (`api(user)` each time). `hrefWith` skips `null`, not `undefined`.
- Lint: the React hooks rule takes a Playwright fixture parameter named `use` for the hook
  `use`: name it `run`.
- Screenshots with Playwright: the "1 Issue" badge of Next came from the `caret-color` style the
  capture tool injects, not from the site.
- Windows shell: heredocs and `node -e` break on French apostrophes (write the script with the
  editor, then run it); the shell may stay in `apps/web/.next/dev/logs` and make `pnpm dev`
  fail with `EBUSY … rmdir` (`cd` to the root first); a `== 'true'` written to a YAML through
  the shell loses its quotes (re-read the file).
- CI `api-postgres`: Vitest's 5 s timeout counts every round trip to a real Postgres. A test
  that onboarded and followed 32 members one by one (~100 transactions, 0.3–0.6 s usually)
  once took 5 s on a docs-only commit: no date or order bug, the runner stalled. Build bulk
  fixtures with one `insert` (`quietMembers()` in `social.test.ts`) and keep one real API call.
  Faking only the JS clock (`vi.useFakeTimers({ toFake: ["Date"] })`) breaks feed orders: the
  database still stamps rows with its own `now()`. Fake both, or neither.
- A `loading.tsx` streams the page: once the skeleton has been sent, `notFound()` and
  `permanentRedirect()` in the page can no longer change the status (Next answers 200 with a
  `noindex` tag, and the redirect happens in the browser). The album, artist and profile
  segments check existence in their `layout.tsx` (`ensureCatalogPage()`, `profile.exists`), one
  indexed query before the skeleton; a new dynamic page with a skeleton needs the same layout.
