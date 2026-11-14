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

- `apps/web`: Next.js 16 (App Router, Turbopack, `src/proxy.ts` = former middleware), React 19,
  Tailwind CSS 4 (CSS-first), next-intl 4. Next docs for this version: `apps/web/node_modules/next/dist/docs`.
- `packages/api`: tRPC 11 routers = all business logic (catalog, listening, profiles, shelf, stats, social).
- `packages/catalog`: `CatalogProvider` + MusicBrainz (no DB), recorded responses (`@spleen/catalog/testing`); `docs/catalogue.md`.
- `packages/db`: Drizzle schema (`src/schema/*`, one file per domain), SQL migrations
  (`migrations/`), `createDb()`, `loadRootEnv()`, demo seed and fixtures (`@spleen/db/fixtures`).
- `packages/auth`: Better Auth config (`createAuth()`, `getSessionUser()`), magic-link emails.
- `packages/infra`: services with dev fallbacks: `./email` (Brevo), `./storage` (S3-R2), `./rate-limit`, `./config`.
- `packages/validators`: Zod 4 schemas shared by API, forms and the future app.
- `packages/i18n`: `messages/fr.json` (source of keys) and `messages/en.json`.
- `packages/design-tokens`: palette, themes, cover swatches, WCAG helpers → `generated/theme.css`.
- `packages/config`: shared ESLint flat config, tsconfigs, Prettier.
- To come: `apps/mobile` (Expo).

## Commands (PowerShell, from the repo root)

```
pnpm dev                 # http://localhost:3000 (redirects to /fr or /en)
pnpm lint; pnpm typecheck; pnpm format         # format = Prettier write (CI: format:check)
pnpm check               # silent: prettier --check + lint + typecheck + test (errors only)
pnpm e2e:quiet           # silent Playwright + summary line; 2 local workers (PLAYWRIGHT_WORKERS)
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
- Never edit generated migrations (a test fails on drift); `0000_search_extensions.sql` is hand-written.
- "Target" = `release_id` / `track_id` / `artist_id` real FKs + CHECK exactly one
  (`targetColumns()` / `targetCheck()`). Catalog rows are never hard-deleted (`restrict`);
  member data cascades when a user is deleted.
- Demo seed: `<username>@example.test` (`nuitblanche` full shelf, `vinylvince`, `rainydaysam` empty,
  `fouilleuse` 30 hearts, `lacontrebasse` admin; `seed/crate.ts`, `social.ts`, `lists.ts`, `moderation.ts`).

Domain docs (read before touching the domain): listening `docs/ecoute.md` (`recomputeItemState()`),
profile & stats `docs/profil-stats.md` (bump `CACHE_VERSION` when a stats rule changes), social &
moderation `docs/social.md`, lists & discovery `docs/decouverte.md`, search & sharing `docs/referencement.md`.

## Conventions

- Code, identifiers, commits (Conventional Commits) and comments in English.
- UI text only through `packages/i18n` (FR uses "tu"). Both files must have identical keys
  (tested). Years/decades go into messages as strings (ICU would print "2 026").
- Styling only with tokens (`bg-surface`, `text-star`, ...); never raw hex (it lives in `packages/design-tokens`).
- Ratings: integers 1..10 shown as 0.5..5 stars (`ratingToStars`). UUIDs; slugs in URLs.
- Navigate from code only with `useNavigate()` (`@/i18n/navigation`, feeds the top bar;
  ESLint forbids `useRouter`); actions ending in `redirect()` call `useNavigationWhile(pending)`.
- Animations: transform and opacity only, neutralised by `prefers-reduced-motion` (global rule in
  `globals.css`; scroll-driven ones also need an explicit `no-preference` guard).
- Dark only (Lilas): no theme cookie or toggle; the `profiles.theme` column awaits removal (issue).
- Verify library versions on the npm registry / official docs, not from memory.

## Design (Lilas, milestone 17)

Reference: `docs/design/README.md` (principles, tokens, relief, motion, what changed on the
way) and the mockups `docs/design/maquettes/*.png` (the target; the `.html` twins hold exact
values). Dev-only gallery of the components: `/fr/dev/composants`.

- Tokens from `packages/design-tokens` only: `bg`, `surface`, `surface-raised`, `border`,
  `fg`, `fg-muted`, `accent` (lilac) / `accent-fg`, ... `border-field` (form fields) and
  `star-empty` are derived shades that reach 3:1 (WCAG 1.4.11): use them for those roles.
- Fonts: Bricolage Grotesque 700/800 (`font-display`, headings and big numbers, tight
  tracking), Geist (text), Geist Mono (small caps labels). No serif, no italic anywhere.
- One full lilac block per page at most (`Card tone="accent"`, buttons inside it use `ink` /
  `on-accent`); no gradient, no glow. Buttons: `primary` (52 px) / `secondary` / `ghost`;
  every target 44 px at least. Cards that are one whole link rise on hover (`Card lift`).
- `cn()` is `clsx` without merging: a class never overrides one of the base (use a variant
  such as `max-md:hidden`) → `docs/pieges.md`.

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

Read `docs/accounts.md` before touching auth: sign-in, session → tRPC (`contextFor`, error codes),
`/welcome`, `/settings`, @username rules (`username_history`), avatars, **Expo flow** (session
cookie in the `Cookie` header). Dev: magic links printed in the `pnpm dev` terminal.

`ctx.account()` reads role, suspension and blind mode once per request. `ctx.user()` is null
for a **suspended** account (a visitor everywhere); `accountProcedure` (suspension, export,
deletion) still accepts it; `adminProcedure` answers `NOT_FOUND` to non-admins. Hidden content
(`hidden_at`) and suspended members are filtered in the shared loaders (`memberRefs`,
`memberCards`, `loadReviewCards`, `findProfile`): keep new queries on them. Rules: `docs/social.md`.

## Decisions and why

- TypeScript 6.0 (typescript-eslint 8 needs < 6.1); ESLint 9 (Next's plugins lack 10).
- Drizzle ORM 0.45 / drizzle-kit 0.31: latest stable (1.0 was still a pre-release).
- postgres.js, not Neon's serverless driver: plain Postgres protocol keeps hosting portable.
- dotenv-cli for Next rather than one `.env` per app: a single secrets file.
- Tests on PGlite (pg_trgm + unaccent contrib): no Docker, no network, no secrets in CI.
- Brevo for emails (French, 300/day free, plain `fetch`); Expo sessions via the Cookie
  header (Better Auth's official flow); no `sharp` (not on Workers): avatars resized client-side.
- "Today" for a listen = member's `profiles.time_zone` (IANA), never the server's zone.
- Catalog: MusicBrainz WS/2 with plain `fetch`; global gate = one atomic `rate_limits` statement
  (`reserveSlot`); imports for members only; Cover Art Archive covers `unoptimized` (no quota).
- Speed (milestone 12): no Suspense / `loading.tsx`; slow clicks show the top bar after 150 ms;
  reactions are instant (`lib/use-instant-writes.ts`); deletions are undoable for 8 s (`lib/use-undoable-delete.ts`).

## Token economy

- Verify with `pnpm check` and `pnpm e2e:quiet`. Re-run verbose only the failing package or spec.
- During a step, run only the spec files you touched. Full e2e once per step, through the
  `verificateur` subagent, never twice in a row unless you fixed something.
- External docs and repo-wide searches go through a subagent (Explore), which returns only the answer.
- Read large files by line range. Don't re-read a file you already have unless it changed.
- Chrome only when the step changes the UI: a few screenshots of the relevant area.
- Recaps: 20 lines at most. One step per session: end it with `/fin-d-etape`.

## Pitfalls already met (and the fix)

One line each; details and fixes in `docs/pieges.md` (add new ones there).

- `node --env-file` in Next scripts crashes (use dotenv-cli) → `docs/pieges.md`
- `new URL(…, import.meta.url)` in bundled code exposes files (use `path.resolve`) → `docs/pieges.md`
- Quotes/spaces in a `.env` URL break parsing; never log raw DB errors → `docs/pieges.md`
- Neon pooler = PgBouncer: no `SET`/`LISTEN`/`PREPARE`; migrations use the direct URL → `docs/pieges.md`
- One Next server at a time: no `next build` during `pnpm dev`; stray `next` on 3000 → `taskkill` → `docs/pieges.md`
- pnpm `minimumReleaseAge` blocks fresh packages: pin older, revert exclusions → `docs/pieges.md`
- Two drizzle-orm copies break types: import from `@spleen/db` → `docs/pieges.md`
- Client components import `@spleen/api/errors`, never `@spleen/api`; Prettier on drizzle meta → `docs/pieges.md`
- Shell quirks: backticks in `node -e`, BOM from `Set-Content`, CRLF from Python → `docs/pieges.md`
- next-intl reads `Accept-Language`: e2e sets `locale`; typed message keys → `docs/pieges.md`
- Strict Mode replays effects: `<dialog>` closed in cleanup unmounts itself; retry clicks after `reload()` → `docs/pieges.md`
- `updated_at` is wall clock: tests compare orders, not times → `docs/pieges.md`
- New migration → `pnpm db:migrate` on the dev server's database or pages 500 → `docs/pieges.md`
- Burst writes arrive out of order: group clicks, send an `order` (`docs/ecoute.md`) → `docs/pieges.md`
- Raw `sql` params reject JS `Date` (`rowsOf()` for `db.execute()`); single-table selects drop qualifiers in subqueries → `docs/pieges.md`
- Refresh with `refresh()` inside Server Actions, never client `router.refresh()` → `docs/pieges.md`
- No `generateStaticParams` under `app/` (half-written prerender manifest in dev) → `docs/pieges.md`
- State updates inside `startTransition` are deferred: set optimistic UI before it → `docs/pieges.md`
- MusicBrainz often answers 503; never import on PGlite and Neon at once → `docs/catalogue.md`, `docs/pieges.md`
- CSP nonce on every page: list `archive.org` and `*.archive.org`; a nonce ignores `'unsafe-inline'` → `docs/pieges.md`
- No `loading.tsx` / `Suspense` fallback on pages: up to +300 ms (React) and stuck without JS → `docs/pieges.md`
- Controlled fields need `useTypedBeforeHydration()` (built into `TextField`, issue #24) → `docs/pieges.md`
- e2e: one account per test (`grantAdmin`); wait for `actionAnswered` after a reaction; actions imported in the `[locale]` layout → `docs/pieges.md`
- Playwright: `page.route` with a pathname predicate (no `?` glob); timers via `page.clock` `pauseAt` + `runFor` → `docs/pieges.md`
- Measuring the suggestion route: space the calls (per-IP limiter); Windows CPU time moves in 15.6 ms ticks → `docs/pieges.md`
- View transitions: Next 16.4 gives the transition type to its first commit, the page arrives without it (issue #29) → `docs/pieges.md`
- A green e2e in dev proves nothing for what depends on how React splits renders: check a prod build → `docs/pieges.md`
- A tile animated in opacity below the fold fails axe `color-contrast`: animate transform only → `docs/pieges.md`

## Git

- Never commit or push to `main`; no force push; no history rewrite of pushed branches.
- One branch per milestone `feat/<nn>-<name>` from an up-to-date `main`
  (`git switch main; git pull`).
- Milestone end: run `/fin-de-jalon` (`.claude/skills/fin-de-jalon/SKILL.md`).

## Milestones

- [x] 1. Foundations · 2. Database · 3. Accounts · 4. Catalog · 5. Listening · 6. Profile &
      base stats · 7. Social · 8. Lists & discovery · 9. Admin, legal, polish (`docs/social.md`,
      `docs/referencement.md`, CSP `lib/security.ts`, PWA) · 12. Douceurs (navigation speed,
      instant search and reactions, "Undo", keyboard rating; `docs/stack-et-limites.md`) · 17. Nouvelle peau (Lilas identity, `docs/design/README.md`).
- [ ] 10. **Launch**: publish a new `TERMS_VERSION` before the first real members (everyone
      accepts again, after the legal review); e2e in CI; issue #22 (cache of public pages,
      option a); issue #27 (catalog popularity counter: recomputed by the nightly job, plus a
      pnpm command for dev, also run by the seed). **Real services are not connected yet**
      (Google, Brevo, R2, Neon project `spleen-prod`, domain): follow `docs/mise-en-ligne.md`.
- [ ] 11. **Next.** Upcoming releases from followed artists (cahier, « Sorties à venir de tes
      artistes »); depends only on 4, 7 and 8. Nothing to provide: the user validates its rules.
- [ ] 13. **« Quoi écouter ce soir ? »**: "Listen on…" links (direct when MusicBrainz knows the
      URL, else a search link; no affiliate links), "Your friends on this record", "Pick a record".
- [ ] 14. **« Souvenirs »**: "One year ago…" on the home page; anniversaries, "Released on" on `/discover`.
- [ ] 15. **« Défi de l'année »** · 16. **« En ce moment et RSS »** (both after launch).
- Deferred: page transitions (milestone 12, step 6, abandoned): retry per issue #29.

Order: 11 → 13 → 14 → 10 (launch) → 15 → 16. Specs in `docs/cahier-des-charges.md`; each
milestone opens by having the user validate its default rules.
