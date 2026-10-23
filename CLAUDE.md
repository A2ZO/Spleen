# Spleen — notes for Claude Code

"Letterboxd for music". Web first (FR/EN), Expo app later reusing every package.

- Functional reference: `docs/cahier-des-charges.md` (it wins on doubt; ask when ambiguous).
- Original brief, milestone list and process rules: `docs/prompt-claude-code-spleen.md`.
- The user works on Windows / PowerShell and speaks French: answer and recap in French.
- Maintenance: `docs/services.md` (service limits, costs, budget alerts) and `/maintenance`.

## Monorepo

pnpm 12 workspaces + Turborepo 2, Node ≥ 24. Internal packages export TypeScript sources
(no build step); Next transpiles them via `transpilePackages`.

- `apps/web`: Next.js 16 (App Router, Turbopack, `src/proxy.ts` = former middleware),
  React 19, Tailwind CSS 4 (CSS-first), next-intl 4. Next docs for this version:
  `apps/web/node_modules/next/dist/docs`.
- `packages/api`: tRPC 11 routers = all business logic, on the database (catalog, listening,
  profiles, shelf, stats); only the home feed still reads fixtures (`src/mock/repository.ts`)
  until 8.
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
pnpm test                # Vitest in every package (always in-memory PGlite)
pnpm --filter @spleen/design-tokens generate   # after editing tokens
pnpm db:generate         # new SQL migration after editing packages/db/src/schema
pnpm db:migrate          # apply migrations (direct connection on Neon)
pnpm db:seed             # migrate + insert demo data (idempotent) — never in production
pnpm db:reset            # wipe the LOCAL PGlite database, migrate, seed (refuses Postgres)
pnpm db:seed:catalog     # import packages/api/scripts/catalog-seed.json from MusicBrainz
$env:PLAYWRIGHT_CHANNEL="chrome"; pnpm e2e     # Playwright with the installed Chrome
```

CI (`.github/workflows/ci.yml`): install --frozen-lockfile, format:check, lint, typecheck,
test. No secrets in CI: tests never touch Neon.

## Environment variables

One secrets file for the whole monorepo: `.env` at the repository root (git-ignored,
template `.env.example`). Never read or write `.env` / `.env.local`: to check a variable,
print only "set / missing" (or booleans like "starts with postgres://", "has -pooler").

- Next reads env files only from `apps/web`, so its scripts use dotenv-cli (`--no-expand`);
  db scripts, drizzle-kit and Vitest configs call `loadRootEnv()` (`@spleen/db/env`).
- Variables already set in the environment (CI, hosting provider) always win over `.env`.
- Turborepo filters env vars: declare new ones in `turbo.json` (`globalEnv` if they affect
  outputs, `globalPassThroughEnv` / `passThroughEnv` otherwise), or they silently vanish.

| Variable                                    | Value                              | Used by                         |
| ------------------------------------------- | ---------------------------------- | ------------------------------- |
| `DATABASE_URL`                              | Neon **pooled** URL (`-pooler`)    | the app (`getDb()`)             |
| `DATABASE_URL_UNPOOLED`                     | Neon **direct** URL                | migrations, seed, drizzle-kit   |
| unset `DATABASE_URL`                        | → PGlite in `.data/pglite`         | local offline fallback          |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL`    | random 32+ chars / public site URL | Better Auth                     |
| `GOOGLE_CLIENT_ID` / `_SECRET`              | Google OAuth client (Web)          | Google button (hidden if unset) |
| `BREVO_API_KEY` / `EMAIL_FROM`              | Brevo v3 key / verified sender     | magic links (dev: terminal)     |
| `S3_*` (endpoint, bucket, keys, public URL) | Cloudflare R2, EU bucket           | avatars (dev: `.data/uploads`)  |
| `MUSICBRAINZ_USER_AGENT`                    | `Spleen/0.1 ( contact@… )`         | catalog imports (required)      |

Where to get each value: `.env.example`. Production refuses to start without the auth,
Brevo and S3 variables (`assertProductionConfig()`, `apps/web/src/instrumentation.ts`).

## Database

- Neon Postgres, EU (Frankfurt), free plan. Branches: `dev` = local development (URLs in
  `.env`); `main` = production (URLs set in the hosting provider, never in a file).
  Production deploys run `pnpm db:migrate`; never `db:seed`.
- `createDb(url)` (`packages/db/src/client.ts`): `postgres://…` → postgres.js;
  `memory://` → in-memory PGlite; unset/empty → PGlite on disk. Migrations/seed get their
  URL from `migrationDatabaseUrl()`, which refuses to run through the pooler.
- Switch PGlite ↔ Neon: comment out / restore `DATABASE_URL` in `.env`, or for one command
  `$env:DATABASE_URL=""; pnpm dev` (then `Remove-Item Env:DATABASE_URL`).
- The web app keeps one pool per process (`apps/web/src/server/db.ts`). The API context
  opens the database lazily (`ctx.db()`). `GET /api/health` (`system.health`) checks it.
- Migrations: `0000_search_extensions.sql` is hand-written (pg_trgm, unaccent and the
  `immutable_unaccent()` wrapper needed by search indexes); the rest is generated by
  drizzle-kit. Never edit generated migrations; a test fails if schema and snapshot drift.
- "Target" = `release_id` / `track_id` / `artist_id` real FKs + CHECK exactly one
  (`targetColumns()` / `targetCheck()` in `src/schema/target.ts`).
- Catalog rows are never hard-deleted (`on delete restrict`); duplicate merges re-point
  references first (milestone 9). Member data cascades when a user is deleted.
- Demo seed: members `<username>@example.test` (`nuitblanche` full shelf, `vinylvince`,
  `rainydaysam` empty shelf, queue only), fictional albums, real listens/reviews/moods.
  Fixture `ratingCounts` / `weeklyListens` are home-page mockup only.
- Listening: read `docs/ecoute.md`. `user_item_state` is derived by `recomputeItemState()`
  in the write's transaction (also `liked_at`, the Hearts tab order).
- Profile & stats: read `docs/profil-stats.md`. One paged tRPC call per profile section;
  stats = SQL aggregates (rules in `api/src/lib/stats/source.ts`) cached in `user_stats_cache`
  (deleted by every listening write): bump `CACHE_VERSION` when a rule changes.

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
5. Secrets never in code or logs (see Environment variables).
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
- MusicBrainz often answers 503 even under 1 req/s (back-off + retries; next edition when one
  keeps failing). The gate lives in each database: never import on PGlite and Neon at once.

## Git

- Never commit or push to `main`; no force push; no history rewrite of pushed branches.
- One branch per milestone `feat/<nn>-<name>` from an up-to-date `main`
  (`git switch main; git pull`).
- Milestone end: run `/fin-de-jalon` (`.claude/skills/fin-de-jalon/SKILL.md`).
- Present a plan before starting a milestone; ask before costly or irreversible decisions.

## Milestones

- [x] 1. Foundations · 2. Database · 3. Accounts · 4. Catalog (`docs/catalogue.md`) · 5. Listening (`docs/ecoute.md`) · 6. Profile & base stats (`docs/profil-stats.md`).
- [ ] 7. **Social** (next): follow, feed (replaces the home fixtures), likes, comments,
      notifications, blocking, reporting. Nothing to provide (no outside service).
- [ ] 8. Lists & discovery · 9. Admin, legal, polish · 10. Launch. **Real services are not
      connected yet** (Google, Brevo, R2, Neon `main`, domain): follow `docs/mise-en-ligne.md`.
