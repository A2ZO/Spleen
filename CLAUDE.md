# Spleen — notes for Claude Code

"Letterboxd for music": rate, review and list albums / EPs / singles / tracks / artists,
keep a dated listening diary, follow people, see stats. Web first (FR/EN), Expo app later
reusing every package. Functional reference: `docs/cahier-des-charges.md` (it wins on doubt).
Original brief: `docs/prompt-claude-code-spleen.md`.

## Stack

- Monorepo: pnpm 12 workspaces + Turborepo 2. Node ≥ 24.
- `apps/web`: Next.js 16 (App Router, Turbopack, `src/proxy.ts` = former middleware),
  React 19, Tailwind CSS 4 (CSS-first), next-intl 4.
- `packages/api`: tRPC 11 routers (all business logic). Currently backed by fixtures
  (`src/fixtures`, `src/mock/repository.ts`).
- `packages/validators`: Zod 4 schemas shared by API, forms and the future app.
- `packages/i18n`: `messages/fr.json` (source of keys) and `messages/en.json`.
- `packages/design-tokens`: palette, semantic themes (dark / light), scales, cover swatches,
  WCAG contrast helpers; generates `generated/theme.css` for Tailwind.
- `packages/config`: shared ESLint 9 flat config, tsconfigs, Prettier.
- TypeScript 6.0 (not 7: typescript-eslint 8.x requires < 6.1).
- To come: `packages/db` (Drizzle, M2), `packages/catalog` (MusicBrainz, M4), `apps/mobile`.

Internal packages export TypeScript sources directly (no build step); Next transpiles them
via `transpilePackages`.

## Commands (PowerShell, from the repo root)

```
pnpm install
pnpm dev                 # http://localhost:3000 (redirects to /fr or /en)
pnpm lint
pnpm typecheck
pnpm test                # Vitest in every package
pnpm format              # Prettier write (CI runs format:check)
pnpm --filter @spleen/design-tokens generate   # after editing tokens
pnpm e2e                 # Playwright; needs `pnpm --filter @spleen/web exec playwright install chromium`
                         # or set $env:PLAYWRIGHT_CHANNEL="chrome" to use the installed Chrome
```

Next 16 allows a single dev server per app: Playwright reuses the one on port 3000.

## Conventions

- Code, identifiers, commits (Conventional Commits) and comments in English.
- UI text only through `packages/i18n` (FR uses "tu"). Both files must have identical keys
  (tested). Years/decades go into messages as strings (ICU would print "2 026").
- Styling only with tokens (`bg-surface`, `text-star`, `text-link`, `fill-vinyl`, ...).
  Never raw hex in components. Brand hex values live in `packages/design-tokens`.
- Ratings are integers 1..10, displayed as 0.5..5 stars (`ratingToStars`).
- UUIDs everywhere; readable slugs for URLs.
- Animations must be neutralised by `prefers-reduced-motion` (global rule in `globals.css`).
- Theme: `spleen-theme` cookie (functional, consent-exempt), read server-side in the
  `[locale]` layout → no flash, no inline script.

## Architecture rules (non-negotiable)

1. No business logic in React components or pages. Pages call `getApi()` (server tRPC
   caller, `apps/web/src/server/api.ts`); Server Actions may only call `packages/api`.
2. API usable by the mobile app: cookie sessions (web) and bearer tokens (Expo). Planned:
   Better Auth with `@better-auth/expo`; Expo stores the session token in SecureStore and
   sends it as `Authorization: Bearer` to the tRPC HTTP endpoint (to document in M3).
3. Hosting portability: no Vercel-proprietary services (KV, Blob, Edge Config, Vercel
   Postgres, crons, queues), no Edge-runtime dependency. Postgres, S3, plain HTTP only.
4. Stable URLs: `/[locale]/album/[slug]`, `/artist/[slug]`, `/track/[slug]`,
   `/u/[username]`, `/u/[username]/diary`, `/list/[id]`.
5. Secrets never in code; see `.env.example`. Never read or write `.env` / `.env.local`.
6. Do not modify `.claude/` without being asked.

## Git

Never commit or push to `main`. One branch per milestone `feat/<nn>-<name>` from up-to-date
`main`. At milestone end: lint + typecheck + tests green, PR with `gh pr create`, wait for
review and merge. No force push. (Milestone 1: local only, no push/PR until asked.)

## Milestones

- [x] 1a. Foundations: monorepo, shared configs, CI, design tokens (AA-tested), Tailwind,
      next-intl FR/EN, layout (header, footer, locale + theme switchers).
- [x] 1b. Static mockup on fixtures: home (trending FR/EN, new releases, popular reviews),
      album page (rating histogram, local-state "I listened" panel with tonearm, tracklist,
      reviews, lists, listen-on links), profile (vinyl Shelf, recent, diary, reviews, lists,
      base stats), Baudelaire 404. Playwright smoke tests.
- [ ] 2. Database (Drizzle schema, migrations, seed)
- [ ] 3. Accounts
- [ ] 4. Catalog (MusicBrainz)
- [ ] 5. Listening
- [ ] 6. Profile & base stats
- [ ] 7. Social
- [ ] 8. Lists & discovery
- [ ] 9. Admin, legal, polish
- [ ] 10. Launch

## Mockup notes

- Fake members: `nuitblanche` (demo "me", full shelf), `vinylvince`, `rainydaysam` (empty
  shelf). All artists/albums in fixtures are fictional; covers are generated from the slug
  (`Cover` component) until Cover Art Archive is wired.
- Base stats are computed by `computeBaseStats` (`packages/api/src/lib/stats.ts`), the
  reference behaviour for the future SQL aggregates.
