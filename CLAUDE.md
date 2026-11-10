# Spleen — notes for Claude Code

"Letterboxd for music". Web first (FR/EN), Expo app later reusing every package.

- Functional reference: `docs/cahier-des-charges.md` (it wins on doubt; ask when ambiguous).
- Original brief, milestone list and process rules: `docs/prompt-claude-code-spleen.md`.
- The user works on Windows / PowerShell and speaks French: answer and recap in French.
- Maintenance: `docs/services.md` (service limits, costs, budget alerts) and `/maintenance`.
- Stack, limits in number of members, scaling steps: `docs/stack-et-limites.md`.
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
pnpm check               # silent: prettier --check + lint + typecheck + test (errors only)
pnpm e2e:quiet           # silent Playwright (dot reporter); set PLAYWRIGHT_CHANNEL first
pnpm test                # Vitest in every package (in-memory PGlite)
pnpm --filter @spleen/design-tokens generate   # after editing tokens
pnpm db:generate         # new SQL migration after editing packages/db/src/schema
pnpm db:migrate          # apply migrations (direct connection on Neon)
pnpm db:seed             # migrate + insert demo data (idempotent) — never in production
pnpm db:reset            # wipe the LOCAL PGlite database, migrate, seed (refuses Postgres)
pnpm db:seed:catalog     # import packages/api/scripts/catalog-seed.json from MusicBrainz
pnpm catalog:refresh     # re-read discographies for recent releases (nightly in Actions)
pnpm admin:grant <email> # admin role (also admin:revoke); never from the site
pnpm retention          # privacy retention rules (nightly in Actions, src/lib/retention.ts)
$env:PLAYWRIGHT_CHANNEL="chrome"; pnpm e2e     # Playwright with the installed Chrome
```

CI, e2e cleanup guard, env vars and database details: `docs/environnement.md`.

## Environment and database

- One secrets file: `.env` at the repo root (template `.env.example`). Never read or write
  `.env` / `.env.local`: print only "set / missing" or booleans. New variables must be
  declared in `turbo.json`, or they silently vanish. Next scripts use dotenv-cli; db scripts
  and Vitest call `loadRootEnv()`.
- `DATABASE_URL` = Neon pooled (app), `DATABASE_URL_UNPOOLED` = direct (migrations, seed);
  unset → PGlite in `.data/pglite`. Neon: the current project is for development only (branch
  `dev` = local; its `production` branch holds test data and never serves the site); the live
  site gets a **separate Neon project, `spleen-prod`** (`docs/mise-en-ligne.md` § 0), whose
  URLs never go in a file.
- e2e accounts are `e2e-<id>@example.test`, deleted by `apps/web/e2e/cleanup.ts` (global setup/teardown), which
  refuses production and the Neon branch named by `NEON_MAIN_HOST` (`spleen-prod`'s `production`
  branch once it exists). Keep each e2e test short.
- Never edit generated migrations (a test fails on schema/snapshot drift);
  `0000_search_extensions.sql` is hand-written.
- "Target" = `release_id` / `track_id` / `artist_id` real FKs + CHECK exactly one
  (`targetColumns()` / `targetCheck()`). Catalog rows are never hard-deleted (`restrict`);
  member data cascades when a user is deleted.
- Demo seed: `<username>@example.test` (`nuitblanche` full shelf, `vinylvince`, `rainydaysam`
  empty, `fouilleuse` 30 hearts, `lacontrebasse` admin; `seed/crate.ts`, `seed/social.ts`,
  `seed/lists.ts`, `seed/moderation.ts`).

Domain docs (read before touching the domain): listening `docs/ecoute.md`
(`recomputeItemState()`), profile & stats `docs/profil-stats.md` (bump `CACHE_VERSION` when
a stats rule changes), social & moderation `docs/social.md`, lists & discovery `docs/decouverte.md`, search & sharing
`docs/referencement.md` (indexing rule, sitemaps, robots, OG images).

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

`ctx.account()` reads role, suspension and blind mode once per request. `ctx.user()` is null
for a **suspended** account (a visitor everywhere); `accountProcedure` (suspension, export,
deletion) still accepts it; `adminProcedure` answers `NOT_FOUND` to non-admins. Hidden
content (`hidden_at`) and suspended members are filtered in the shared loaders
(`memberRefs`, `memberCards`, `loadReviewCards`, `findProfile`): keep new queries on them.
Moderation rules: `docs/social.md`.

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

## Token economy

- Verify with `pnpm check` and `pnpm e2e:quiet`. Re-run verbose only the failing package or spec.
- During a step, run only the spec files you touched. Full e2e once per step, through the
  `verificateur` subagent, never twice in a row unless you fixed something.
- External docs and repo-wide searches go through a subagent (Explore), which brings back only
  the answer.
- Read large files by line range. Don't re-read a file you already have unless it changed.
- Chrome only when the step changes the UI: a few screenshots of the relevant area, never a
  dump of the whole page.
- Recaps: 20 lines at most.
- One step per session: end it with `/fin-d-etape`.

## Pitfalls already met (and the fix)

One line each; details and fixes in `docs/pieges.md` (add new ones there).

- `node --env-file` in Next scripts crashes (use dotenv-cli) → `docs/pieges.md`
- `new URL(…, import.meta.url)` in bundled code exposes files (use `path.resolve`) → `docs/pieges.md`
- Quotes/spaces in a `.env` URL break parsing; never log raw DB errors → `docs/pieges.md`
- Neon pooler = PgBouncer: no `SET`/`LISTEN`/`PREPARE`; migrations use the direct URL → `docs/pieges.md`
- One Next dev server per app; a stray `next` on port 3000 on Windows → `docs/pieges.md`
- pnpm `minimumReleaseAge` blocks fresh packages: pin older, revert exclusions → `docs/pieges.md`
- Two drizzle-orm copies break types: import from `@spleen/db` → `docs/pieges.md`
- Client components import `@spleen/api/errors`, never `@spleen/api`; Prettier on drizzle meta → `docs/pieges.md`
- Shell quirks: backticks in `node -e`, BOM from `Set-Content`, CRLF from Python → `docs/pieges.md`
- next-intl reads `Accept-Language`: e2e sets `locale`; typed message keys → `docs/pieges.md`
- Strict Mode replays effects: `<dialog>` closed in cleanup unmounts itself; retry clicks after `reload()` → `docs/pieges.md`
- `updated_at` is wall clock: tests compare orders, not times → `docs/pieges.md`
- New migration → `pnpm db:migrate` on the dev server's database or pages 500 → `docs/pieges.md`
- Burst writes arrive out of order: group clicks, send an `order` (`docs/ecoute.md`) → `docs/pieges.md`
- Raw `sql` params reject JS `Date`; read `db.execute()` with `rowsOf()` → `docs/pieges.md`
- Single-table drizzle selects drop qualifiers in subqueries → `docs/pieges.md`
- Refresh with `refresh()` inside Server Actions, never client `router.refresh()` → `docs/pieges.md`
- No `generateStaticParams` under `app/` (half-written prerender manifest in dev) → `docs/pieges.md`
- State updates inside `startTransition` are deferred: set optimistic UI before it → `docs/pieges.md`
- MusicBrainz often answers 503; never import on PGlite and Neon at once → `docs/catalogue.md`, `docs/pieges.md`
- CSP nonce on every page: list `archive.org` and `*.archive.org`; a nonce ignores `'unsafe-inline'` → `docs/pieges.md`
- e2e: one account per test (`grantAdmin`); no `next build` while `pnpm dev` runs → `docs/pieges.md`
- No `loading.tsx` / `Suspense` fallback on pages: up to +300 ms (React) and stuck without JS → `docs/pieges.md`
- Controlled fields need `useTypedBeforeHydration()` (built into `TextField`, issue #24) → `docs/pieges.md`
- Reactions: e2e waits for `actionAnswered` before leaving; actions imported in the `[locale]` layout → `docs/pieges.md`

## Git

- Never commit or push to `main`; no force push; no history rewrite of pushed branches.
- One branch per milestone `feat/<nn>-<name>` from an up-to-date `main`
  (`git switch main; git pull`).
- Milestone end: run `/fin-de-jalon` (`.claude/skills/fin-de-jalon/SKILL.md`).

## Milestones

- [x] 1. Foundations · 2. Database · 3. Accounts · 4. Catalog · 5. Listening · 6. Profile &
      base stats · 7. Social · 8. Lists & discovery · 9. Admin, legal, polish (moderation and
      merges `docs/social.md`, SEO `docs/referencement.md`, CSP `lib/security.ts`, PWA).
- [ ] 10. **Launch**: publish a new `TERMS_VERSION` before the first real members
      (everyone accepts again, after the legal review); e2e in CI; issue #22 (cache of public
      pages, option a); issue #27 (catalog popularity counter: recomputed by the nightly job,
      plus a pnpm command to recompute it in dev, also run by the seed, since the nightly job
      only runs in production). **Real services are not connected yet** (Google, Brevo, R2, Neon project
      `spleen-prod`, domain): follow `docs/mise-en-ligne.md`.
- [ ] 11. Upcoming releases from followed artists — spec in docs/cahier-des-charges.md (section
      « Sorties à venir de tes artistes »); may run before milestone 10, depends only on 4, 7
      and 8.
- [ ] 12. **Douceurs**: small features that make Spleen smoother and faster, one step per
      feature (step 0: navigation speed, loading skeletons, link prefetch; issue #24, text typed
      before hydration is lost).
- [ ] 13. **« Quoi écouter ce soir ? »**: "Listen on…" links (Spotify, Deezer, Apple Music,
      YouTube Music, Bandcamp; direct when MusicBrainz knows the URL, else a search link; no
      affiliate links), "Your friends on this record", "Pick a record" from "À écouter" (works
      without JS).
- [ ] 14. **« Souvenirs »**: "One year ago you were listening to…" on the home page; record
      anniversaries (exact dates only, round ones highlighted) and "Released on <day month>" on
      `/discover`.
- [ ] 15. **« Défi de l'année »** (after launch): yearly goal of discovered records, progress bar
      on the profile.
- [ ] 16. **« En ce moment et RSS »** (after launch): "Listening now" for 2 h on the profile and
      in followers' feeds; public RSS feed of a member's diary and reviews.

Order: 12 (current) → 11 → 13 → 14 → 10 (launch) → 15 → 16. Specs in
`docs/cahier-des-charges.md`; each milestone opens by having the user validate its default rules.
