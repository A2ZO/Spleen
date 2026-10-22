---
name: maintenance
description: Spleen maintenance round — process open Dependabot PRs (check CI, merge green minor/patch PRs after the user's approval, migrate major versions from the official guide), review docs/services.md for figures to re-verify, then recap in French.
disable-model-invocation: true
---

# Maintenance

Run when the user types `/maintenance` (weekly, after Dependabot's Monday run, is a good
rhythm). Answer and recap in French.

Hard rules:

- Never commit or push to `main`, never `git push --force`, never rewrite pushed history.
- **Merge only after the user's explicit approval in this conversation, PR by PR or for a
  list they confirmed.** Approval for one round does not carry to the next one.
- Never read or print `.env`; never paste raw logs that may contain secrets (`CLAUDE.md`,
  "Environment variables").
- Never skip, `.only` or weaken a test to get green. Fix the code, or stop and explain.
- Commits: Conventional Commits in English, ending with the attribution line required by
  the session.

## 1. Inventory

```
git switch main; git pull --ff-only
gh pr list --author "app/dependabot" --json number,title,headRefName,labels,createdAt
gh pr checks <number>          # for each PR
```

Sort the PRs into:

- **Grouped minor/patch** (`minor-and-patch`, `actions-minor-and-patch` groups in
  `.github/dependabot.yml`);
- **Majors** (one PR per dependency);
- **Security updates** (Dependabot alerts: `gh api repos/{owner}/{repo}/dependabot/alerts
--jq '.[] | select(.state=="open")'`). Treat them first, whatever their type.

## 2. Minor and patch PRs

For each one:

1. CI must be green. If it is red, read the logs (`gh run view <run-id> --log-failed`):
   - `pnpm install --frozen-lockfile` fails → Dependabot left `pnpm-lock.yaml` out of sync
     (it officially supports pnpm 7–10; the repo uses pnpm 12). Check out the PR branch,
     run `pnpm install`, commit the lockfile (`chore(deps): sync pnpm lockfile`), push.
   - A real breakage → fix it on the PR branch the same way, or exclude the culprit from
     the group (`@dependabot ignore this dependency` in a PR comment is for the user to
     decide: ask).
2. Read the changelogs of the bumped packages quickly for anything that matters here
   (deprecations, behaviour changes in Next, tRPC, Drizzle, Better Auth, next-intl, Zod).
3. Present the list to the user (PR, packages, CI status, notable changelog points) and
   ask: « Je fusionne ces PR ? ». Only then:

```
gh pr merge <number> --merge --delete-branch
```

Merge one PR at a time and let Dependabot rebase the others (it does so by itself; wait
for their CI to turn green again before merging the next).

## 3. Major versions

For each major PR, one at a time:

1. Find the **official** migration guide / release notes (package docs, GitHub release,
   `CHANGELOG.md`; for Next: `apps/web/node_modules/next/dist/docs` once installed). No
   blog posts as the reference. Note the guide's URL for the PR comment.
2. Check the constraints already recorded in `CLAUDE.md` ("Decisions and why"): some
   majors are deliberately held back (TypeScript, ESLint, Drizzle…). If the reason still
   holds, tell the user and propose closing the PR with `@dependabot ignore this major
version` instead of migrating.
3. Otherwise, check out the PR branch (`gh pr checkout <number>`), apply the migration
   steps, then run everything:

```
pnpm install
pnpm format; pnpm format:check; pnpm lint; pnpm typecheck; pnpm test
cd apps/web; $env:PLAYWRIGHT_CHANNEL="chrome"; pnpm exec playwright test
```

The e2e step needs the dev server (reuse port 3000 if it runs, see `CLAUDE.md`). 4. Commit the fixes on the PR branch (`fix(deps): migrate to <package> <major>`), push
(no force), comment the PR with the guide's URL and what changed, watch CI
(`gh pr checks <number> --watch --interval 15`). 5. Update `CLAUDE.md` if a decision, pin or pitfall changed (it must stay under 200
lines). 6. Ask the user before merging, as for minor PRs.

If a migration is too large for one session, stop, summarise what is left in a PR comment
and tell the user.

## 4. Review `docs/services.md`

Read the whole file and report what must be re-verified:

- the verification date at the top is older than **6 months**;
- every line marked _(non vérifié)_ or « à revérifier »;
- anything tied to an upcoming step: the hosting change and MusicBrainz commercial tier
  before ads or Spleen+, Stripe before payments, Google brand verification before
  launch;
- services the code now uses but the file does not cover (look at `packages/infra`,
  `.env.example`, `turbo.json`).

Do not change figures without checking the official page. If the user asks for a
re-verification, fetch the official pages, update the figures and the date, and commit on
a `chore/services-<yyyy-mm>` branch (PR as for any change).

## 5. Recap (in French)

- PRs merged (with the main packages and versions), PRs waiting for approval, majors
  migrated or held back (and why), PRs closed or ignored;
- CI status of `main` after the merges (`gh run list --branch main --limit 3`);
- what `docs/services.md` needs re-verified, and any budget alert the user should set or
  check in a dashboard (never ask for credentials or secrets in the chat);
- open Dependabot security alerts, if any.

Then stop.
