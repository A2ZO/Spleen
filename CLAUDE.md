# Spleen — notes for Claude Code

"Letterboxd for music". Web first (FR/EN), Expo app later reusing every package.

- Functional reference: `docs/cahier-des-charges.md` (it wins on doubt; ask when ambiguous).
- Original brief, milestone list and process rules: `docs/prompt-claude-code-spleen.md`.
- The user works on Windows / PowerShell and speaks French: answer and recap in French.
- Maintenance: `docs/services.md` (service limits, costs, budget alerts) and `/maintenance`.
- Ask before costly or irreversible decisions; present a plan before each milestone.

## Monorepo

pnpm 12 workspaces + Turborepo 2, Node ≥ 24. Internal packages export TypeScript sources
(no build step); Next transpiles them via `transpilePackages`.

- `apps/web`: Next.js 16 (App Router, Turbopack, `src/proxy.ts` = former middleware),
  React 19, Tailwind CSS 4 (CSS-first), next-intl 4. Next docs for this version:
  `apps/web/node_modules/next/dist/docs`.
- `packages/api`: tRPC 11 routers = all business logic, on the database (catalog, listening,
  profiles, shelf, stats, social).
- `packages/catalog`: `CatalogProvider` + MusicBrainz implementation (no DB access), tested on
  recorded responses (`@spleen/catalog/testing`). Flow, rules, limiter: `docs/catalogue.md`.
- `packages/db`: Drizzle schema (`src/schema/*`, one file per domain), SQL migrations
  (`migrations/`), `createDb()`, `loadRootEnv()`, demo seed and fixtures (`@spleen/db/fixtures`).
- `packages/auth`: Better Auth config (`createAuth()`, `getSessionUser()`), magic-link emails.
- `packages/infra`: outside services with dev fallbacks: `./email` (Brevo), `./storage`
  (S3-R2), `./rate-limit` (Postgres `rate_limits`), `./config` (production checks).
- `packages/validators`: Zod 4 schemas shared by API, forms and the future app.
- `packages/i18n`: `messages/fr.json` (source of keys) and `messages/en.json`.
- `packages/design-tokens`: palette, dark / light themes, cover swatches, WCAG helpers;
  generates `generated/theme.css` for Tailwind.
- `packages/config`: shared ESLint flat config, tsconfigs, Prettier.
- To come: `apps/mobile` (Expo).

## Commands (PowerShell, from the repo root)

```
pnpm install
pnpm dev                 # http://localhost:3000 (redirects to /fr or /en)
pnpm lint; pnpm typecheck; pnpm format         # format = Prettier write (CI: format:check)
pnpm test                # Vitest in every package (in-memory PGlite)
pnpm --filter @spleen/design-tokens generate   # after editing tokens
pnpm db:generate         # new SQL migration after editing packages/db/src/schema
pnpm db:migrate          # apply migrations (direct connection on Neon)
pnpm db:seed             # migrate + insert demo data (idempotent) — never in production
pnpm db:reset            # wipe the LOCAL PGlite database, migrate, seed (refuses Postgres)
pnpm db:seed:catalog     # import packages/api/scripts/catalog-seed.json from MusicBrainz
pnpm catalog:refresh     # re-read discographies for recent releases (nightly in Actions)
$env:PLAYWRIGHT_CHANNEL="chrome"; pnpm e2e     # Playwright with the installed Chrome
```

CI, e2e cleanup guard, env vars and database details: `docs/environnement.md`.

## Environment and database

- One secrets file: `.env` at the repo root (template `.env.example`). Never read or write
  `.env` / `.env.local`: print only "set / missing" or booleans. New variables must be
  declared in `turbo.json`, or they silently vanish. Next scripts use dotenv-cli; db scripts
  and Vitest call `loadRootEnv()`.
- `DATABASE_URL` = Neon pooled (app), `DATABASE_URL_UNPOOLED` = direct (migrations, seed);
  unset → PGlite in `.data/pglite`. Neon branch `dev` = local; branch `production` = live site (never in a file).
- e2e accounts are `e2e-<id>@example.test`, deleted by `apps/web/e2e/cleanup.ts` (global setup/teardown), which
  refuses production and Neon's `production` branch (`NEON_MAIN_HOST`). Keep each e2e test short.
- Never edit generated migrations (a test fails on schema/snapshot drift);
  `0000_search_extensions.sql` is hand-written.
- "Target" = `release_id` / `track_id` / `artist_id` real FKs + CHECK exactly one
  (`targetColumns()` / `targetCheck()`). Catalog rows are never hard-deleted (`restrict`);
  member data cascades when a user is deleted.
- Demo seed: `<username>@example.test` (`nuitblanche` full shelf, `vinylvince`, `rainydaysam`
  empty, `fouilleuse` 30 hearts; `seed/crate.ts`, `seed/social.ts`, `seed/lists.ts`).

Domain docs (read before touching the domain): listening `docs/ecoute.md`
(`recomputeItemState()`), profile & stats `docs/profil-stats.md` (bump `CACHE_VERSION` when
a stats rule changes), social `docs/social.md`, lists & discovery `docs/decouverte.md`.

## Conventions

- Code, identifiers, commits (Conventional Commits) and comments in English.
- UI text only through `packages/i18n` (FR uses "tu"). Both files must have identical keys
  (tested). Years/decades go into messages as strings (ICU would print "2 026").
- Styling only with tokens (`bg-surface`, `text-star`, `text-link`, `fill-vinyl`, ...).
  Never raw hex in components; brand hex values live in `packages/design-tokens`.
- Ratings: integers 1..10 shown as 0.5..5 stars (`ratingToStars`). UUIDs; slugs in URLs.
- Animations neutralised by `prefers-reduced-motion` (global rule in `globals.css`).
- Theme: `spleen-theme` cookie read server-side in the `[locale]` layout (no flash).
- Verify library versions on the npm registry / official docs, not from memory.

## Architecture rules (non-negotiable)

1. No business logic in React components or pages. Pages call `getApi()` (server tRPC
   caller, `apps/web/src/server/api.ts`); Server Actions may only call `packages/api`.
2. API usable by the mobile app (see "Accounts and sessions" below for the Expo flow).
3. Hosting portability: no Vercel-proprietary services (KV, Blob, Edge Config, Vercel
   Postgres, crons, queues), no Edge runtime. Postgres, S3, plain HTTP only.
4. Stable URLs: `/[locale]/album/[slug]`, `/artist/[slug]`, `/track/[slug]`,
   `/u/[username]`, `/u/[username]/diary`, `/list/[id]`.
5. Secrets never in code or logs.
6. No paid service without asking. Do not modify `.claude/` without being asked.

## Accounts and sessions

Read `docs/accounts.md` before touching auth: sign-in, session → tRPC (`contextFor`,
`protectedProcedure`, error codes), `/welcome` and `/settings`, @username reservation rules
(`username_history`), avatars, and the **Expo flow** (session cookie sent in the `Cookie`
header). Dev: magic links are printed in the `pnpm dev` terminal; demo member
`nuitblanche@example.test`.

## Decisions and why

- TypeScript 6.0 (typescript-eslint 8 needs < 6.1); ESLint 9 (Next's plugins lack 10).
- Drizzle ORM 0.45 / drizzle-kit 0.31: latest stable (1.0 was still a pre-release).
- postgres.js, not Neon's serverless driver: plain Postgres protocol keeps hosting portable.
- dotenv-cli for Next rather than one `.env` per app: a single secrets file.
- Tests on PGlite (pg_trgm + unaccent contrib): no Docker, no network, no secrets in CI.
- Brevo for emails (French, 300/day free, plain `fetch`); Expo sessions via the Cookie
  header (Better Auth's official flow); no `sharp` (not on Workers): avatars resized client-side.
- "Today" for a listen = member's `profiles.time_zone` (IANA), never the server's zone.
- Catalog: MusicBrainz WS/2 with plain `fetch` (no client library); global gate = one atomic
  `rate_limits` statement (`reserveSlot`); imports and stub completion for members only;
  covers from Cover Art Archive shown `unoptimized` (no image service, no quota).

## Pitfalls already met (and the fix)

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

## Git

- Never commit or push to `main`; no force push; no history rewrite of pushed branches.
- One branch per milestone `feat/<nn>-<name>` from an up-to-date `main`
  (`git switch main; git pull`).
- Milestone end: run `/fin-de-jalon` (`.claude/skills/fin-de-jalon/SKILL.md`).

## Milestones

- [x] 1. Foundations · 2. Database · 3. Accounts · 4. Catalog · 5. Listening · 6. Profile &
      base stats · 7. Social · 8. Lists & discovery (`docs/decouverte.md`).
- [ ] 9. **Admin, legal, polish** (next): moderation queue (reports, lists included), duplicate
      merges, legal pages, PWA, Open Graph · 10. Launch. **Real services are not connected yet** (Google,
      Brevo, R2, Neon `production`, domain): follow `docs/mise-en-ligne.md`.
