# Spleen — notes for Claude Code

"Letterboxd for music": rate, review, list music, keep a dated listening diary, follow
people, see stats. Web first (FR/EN), Expo app later reusing every package.

- Functional reference: `docs/cahier-des-charges.md` (it wins on doubt; ask when ambiguous).
- Original brief, milestone list and process rules: `docs/prompt-claude-code-spleen.md`.
- The user works on Windows / PowerShell and speaks French: answer and recap in French.

## Monorepo

pnpm 12 workspaces + Turborepo 2, Node ≥ 24. Internal packages export TypeScript sources
(no build step); Next transpiles them via `transpilePackages`.

- `apps/web`: Next.js 16 (App Router, Turbopack, `src/proxy.ts` = former middleware),
  React 19, Tailwind CSS 4 (CSS-first), next-intl 4. Next docs for this version:
  `apps/web/node_modules/next/dist/docs`.
- `packages/api`: tRPC 11 routers = all business logic. Pages still read fixtures through
  `src/mock/repository.ts`; routers move to the database in milestones 4–6.
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
- To come: `packages/catalog` (MusicBrainz, M4), `apps/mobile` (Expo).

## Commands (PowerShell, from the repo root)

```
pnpm install
pnpm dev                 # http://localhost:3000 (redirects to /fr or /en)
pnpm lint; pnpm typecheck
pnpm test                # Vitest in every package (always in-memory PGlite)
pnpm format              # Prettier write (CI runs format:check)
pnpm --filter @spleen/design-tokens generate   # after editing tokens
pnpm db:generate         # new SQL migration after editing packages/db/src/schema
pnpm db:migrate          # apply migrations (direct connection on Neon)
pnpm db:seed             # migrate + insert demo data (idempotent) — never in production
pnpm db:reset            # wipe the LOCAL PGlite database, migrate, seed (refuses Postgres)
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
- Fixture `ratingCounts` / `weeklyListens` are mockup-only (no fake raters are seeded).

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

- TypeScript 6.0, not 7: typescript-eslint 8.x requires < 6.1.
- ESLint 9, not 10: Next's ESLint plugins do not support 10 yet.
- Drizzle ORM 0.45 / drizzle-kit 0.31: latest stable (1.0 was still a pre-release).
- postgres.js, not Neon's serverless driver: plain Postgres protocol keeps hosting portable.
- dotenv-cli for Next rather than one `.env` per app: a single secrets file.
- Tests on PGlite (pg_trgm + unaccent contrib): no Docker, no network, no secrets in CI.
- Brevo for emails (French, 300/day free, plain `fetch`); Expo sessions via the Cookie
  header (Better Auth's official flow); no `sharp` (not on Workers): avatars resized client-side.
- Public profiles: identity from the database, activity from fixtures for demo members
  until milestones 5-6 (`packages/api/src/lib/profiles.ts`).

## Pitfalls already met (and the fix)

- `node --env-file` in Next scripts → crash: Next forwards it via NODE_OPTIONS, which Node
  rejects. Use dotenv-cli.
- `new URL("…", import.meta.url)` in code bundled by Next → Turbopack copies the target as
  a public asset (it once exposed `.env`). Use `path.resolve(dirname, …)`.
- Quotes or spaces around a URL in `.env` broke parsing; `createDb()` now throws on a
  malformed URL without echoing it. Never log raw DB errors that may contain the URL.
- Neon pooler = PgBouncer transaction mode: no `SET`, `LISTEN`, session advisory locks or
  SQL `PREPARE` (protocol-level prepared statements are fine). Migrations need the direct URL.
- Neon free tier sleeps after 5 min: first query is slow (`connect_timeout: 15`).
- Next 16 allows one dev server per app; Playwright reuses port 3000. Stopping turbo may
  leave `next` running on Windows: `Get-NetTCPConnection -LocalPort 3000` → `Stop-Process`.
  The dev log `apps/web/.next/dev/logs` can contain error details: never paste it as is.
- pnpm `minimumReleaseAge` blocks packages published too recently: pin an older version
  rather than adding exclusions (`pnpm add` may write `minimumReleaseAgeExclude` into
  `pnpm-workspace.yaml` by itself: revert it). Native builds: `allowBuilds` there.
- Two drizzle-orm copies (different peer sets) break types: import `sql`, `eq`… from
  `@spleen/db`, never from `drizzle-orm` outside packages/db.
- Client components import `@spleen/api/errors` (or types only), never `@spleen/api`.
- drizzle-kit writes unformatted `migrations/meta/*.json`: run Prettier on them.
- Backticks inside `node -e "…"` / unquoted heredocs run as shell commands: use the editor.
- PowerShell `Set-Content -Encoding utf8` writes a BOM: write files with the editor tools.
- next-intl detects `Accept-Language`: e2e tests set `test.use({ locale })`.

## Git

- Never commit or push to `main`; no force push; no history rewrite of pushed branches.
- One branch per milestone `feat/<nn>-<name>` from an up-to-date `main`
  (`git switch main; git pull`).
- Milestone end: run `/fin-de-jalon` (`.claude/skills/fin-de-jalon/SKILL.md`).
- Present a plan before starting a milestone; ask before costly or irreversible decisions.

## Milestones

- [x] 1. Foundations + static mockup (home, album, profile with the vinyl Shelf, 404).
- [x] 2. Database: full Drizzle schema, constraints and indexes, Neon (pooled app / direct
      migrations) with PGlite fallback, idempotent demo seed, `/api/health`.
- [x] 3. Accounts: Better Auth magic link + optional Google (+ Expo plugin), onboarding,
      settings, @username history, avatars, export, deletion. Before production the user
      creates: Google OAuth client, Brevo key + sender, R2 bucket.
- [ ] 4. Catalog — next: `CatalogProvider` (MusicBrainz + Cover Art Archive), global 1 req/s
      limiter in Postgres, on-demand import, local search, album/artist/track pages,
      `db:seed:catalog`. The user provides a contact email for `MUSICBRAINZ_USER_AGENT`.
- [ ] 5. Listening
- [ ] 6. Profile & base stats
- [ ] 7. Social
- [ ] 8. Lists & discovery
- [ ] 9. Admin, legal, polish
- [ ] 10. Launch

## Mockup data

- Fake members (`<username>@example.test`): `nuitblanche` (full shelf), `vinylvince`,
  `rainydaysam` (empty shelf). Artists and albums are fictional; covers are generated from
  the slug (`Cover`) until Cover Art Archive is wired.
- `computeBaseStats` (`packages/api/src/lib/stats.ts`) is the reference behaviour for the
  future SQL aggregates.
