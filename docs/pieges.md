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
