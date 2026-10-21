---
name: fin-de-jalon
description: Close a Spleen milestone — all checks green, push the milestone branch, open the PR, watch CI, update CLAUDE.md in the same PR, recap in French and stop. Run again with "fusionné" once the user has merged, to return to main and pull.
argument-hint: "[fusionné]"
disable-model-invocation: true
---

# Fin de jalon

Two phases. Pick one from the arguments: `$ARGUMENTS`.

- Arguments say the PR is merged ("fusionné", "merged", "c'est fusionné") → **Phase B** only.
- Otherwise → **Phase A**.

Hard rules for both phases:

- Never merge a PR (`gh pr merge` is forbidden), never commit or push to `main`, never
  `git push --force`, never rewrite pushed history.
- Never read or print `.env`; never paste raw logs that may contain secrets (see
  `CLAUDE.md`, "Environment variables").
- Commits: Conventional Commits in English, ending with the attribution line required by
  the session. PR body ends with the Claude Code attribution line.

## Phase A — close the milestone

### 1. Check the branch

- `git status` and `git branch --show-current`: must be a milestone branch
  `feat/<nn>-<name>`, not `main`. If on `main` or the tree has unrelated changes, stop and
  ask the user.
- Commit pending milestone work first (logical commits).

### 2. Everything green, locally

Run from the repo root, fix, re-run until all pass:

```
pnpm format            # then check nothing unexpected changed
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

Then e2e. Next 16 allows one dev server: reuse the one on port 3000 if it runs, else start
`pnpm dev` in the background. Run Playwright from `apps/web` so the channel reaches it:

```
cd apps/web; $env:PLAYWRIGHT_CHANNEL="chrome"; pnpm exec playwright test
```

- Fix the code, not the tests, unless the test itself is wrong (say so in the recap).
- Never skip, `.only` or weaken a test to get green. If something cannot be fixed, stop and
  explain to the user.
- When the milestone touches the database: also `pnpm db:migrate` on Neon `dev` (direct URL)
  and check `GET /api/health`.

### 3. Update CLAUDE.md (same PR)

Keep it under 200 lines; only what every session needs. Update:

- **Milestones**: tick the milestone with a one-line summary; describe the next one and
  what the user must provide for it.
- **Decisions and why**: new structural choices (library, version pin, architecture).
- **Pitfalls already met (and the fix)**: problems that cost time this milestone.
- Commands / environment variables / structure if they changed. Remove what became false.
- Do not copy what the code or `docs/` already say: point to the file path in backticks.

Run `pnpm format:check`, then commit (`docs: update CLAUDE.md for milestone <n>`).

### 4. Push and open the PR

```
git push -u origin <branch>
gh pr create --base main --title "<type>(<scope>): milestone <n> — <summary>" --body-file <tmp file>
```

Write the body in the scratchpad directory, in English, with these sections:

- **What's included** — features, schema, packages, by area.
- **How to test** — exact commands and URLs (PowerShell).
- **Decisions** — each choice with its reason.
- **What's left / next** — follow-ups and the next milestone.

If a PR already exists for the branch (`gh pr view`), push and update its body with
`gh pr edit --body-file` instead.

### 5. Watch CI

```
gh pr checks <number> --watch --interval 15
```

On failure: read the logs (`gh run view <run-id> --log-failed`), fix, commit, push (new
commits only), watch again. Repeat until green.

### 6. Recap and stop

Reply to the user in French:

- PR link and CI status;
- what was done, how to test, decisions taken, what's left;
- anything the user must do (accounts, keys, host settings), without ever asking for
  secrets in the chat;
- the pitfalls added to CLAUDE.md.

End with: « Dis-moi quand la PR est fusionnée (`/fin-de-jalon fusionné`) ». Then **stop**:
do not start the next milestone, do not merge.

## Phase B — after the user merged

1. `gh pr view <branch> --json state -q .state` must be `MERGED`. If not, tell the user and
   stop.
2. Stop the dev server on port 3000 if it was started for this milestone.
3. Return to main and update:

```
git switch main
git pull --ff-only
```

4. Report in French: `main` is up to date (last commit), the merged branch can be deleted
   (offer `git branch -d <branch>`; do not delete the remote branch without asking), and
   the next milestone from CLAUDE.md, whose plan must be presented before any code.
