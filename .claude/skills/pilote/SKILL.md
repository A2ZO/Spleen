---
name: pilote
description: Spleen autopilot. Advances the current milestone by one step without anyone watching — plan, review by the relecteur subagent, code, verification, review of the result, commit and push on the milestone branch. Use only when the user or a scheduled task asks for the autopilot (/pilote).
---

# Pilote automatique

You run unattended: nobody can answer a question during the run. Docs are written in French.
**One run advances one step at most**, then stops, so the next run starts with a fresh
context.

Hard rules, always:

- Never read or print `.env` / `.env.local`.
- Never commit or push to `main`, never force push, never merge a PR.
- No paid service, no account, no key.
- Never delete outside the repo; list a folder before deleting anything in it.
- Stop servers only with `pnpm run free-port` (it stops node processes only).

Files, all in `docs/pilote/`: `etat.md` (where we are), `feuille-de-route.md` (the brief of
each step and the usual checks), `decisions.md`, `journal.md`. Screenshots go to
`docs/pilote/captures/<n>/` (ignored by git).

## 0. Start, or stop at once

1. If `docs/pilote/STOP` exists, or `etat.md` says phase `attente` or `fini`: stop without
   writing anything.
2. Lock: if `.git/pilote.lock` exists and is less than 4 hours old, another run is working:
   stop without writing anything. Otherwise write the current date and time into it. Delete it
   at the end of the run, whatever happens.
3. `git branch --show-current` must be the branch named in `etat.md`. If it is not, switch only
   when the working tree is clean; otherwise go to « Attente » with the reason.
4. Uncommitted changes mean an interrupted run (usage limit): read `git diff` and the phase in
   `etat.md`, and continue from there. Never discard them.
5. Read `docs/jalon-17-en-cours.md`, `docs/design/README.md`, `docs/pilote/decisions.md` and,
   in `feuille-de-route.md`, the usual checks and the brief of the current step.

## 1. Plan — phase `plan`

1. Write the plan to `docs/pilote/plan-etape-<n>.md` (60 lines at most), following the brief.
   Check in the code that every piece of data the plan uses already exists.
2. Delegate to the `relecteur` subagent: « Relis le plan docs/pilote/plan-etape-<n>.md ».
3. Apply its corrections to the plan. On `BLOQUANT`, rework and ask once more; still
   `BLOQUANT` → « Attente ».
4. Do not ask the owner the questions the plan raises. Take the most cautious option (the one
   that changes the least, can be undone, and uses what exists) and log it in `decisions.md`:
   date, step, choice, reason, alternative left aside. Exception: anything irreversible, or
   touching data, security or money → « Attente ».
5. Set phase `code` in `etat.md`.

## 2. Code — phase `code`

Implement the plan. Commit as you go, in logical commits (Conventional Commits in English,
ending with the session's attribution line), so that an interruption loses little. Then set
phase `verif`.

## 3. Verification — phase `verif`

1. Run the usual checks of `feuille-de-route.md` and those of the step's brief.
2. Screenshots at 1280 and 390 px of the step's pages into `docs/pilote/captures/<n>/`.
3. Delegate to `relecteur`: « Relis l'étape <n> : commits <range>, résultats <résumé>, captures
   docs/pilote/captures/<n>/ ».
4. Fix its corrections, then re-run only what they concern. Two rounds at most; after that,
   « Attente » with the remaining points.
5. A test that fails in the full run and passes alone: comment issue #34
   (`gh issue comment 34`) and go on. A test that fails alone: fix the code.
6. Set phase `cloture`.

## 4. Close — phase `cloture`

1. Steps 2 and 3 of `.claude/skills/fin-d-etape/SKILL.md` (hand-over doc, commits, push),
   without its recap and without waiting for `/clear`.
2. Append to `journal.md`, 10 lines at most: date, step, commits, results (check, e2e summary
   line, axe, measures against the reference), decisions taken, open points.
3. In `etat.md`: next step, phase `plan`, date. Commit `docs: pilote étape <n>`, push.
4. `pnpm run free-port`, delete the lock, stop.

## 5. End of the milestone

After the last step of `feuille-de-route.md`: Phase A of `.claude/skills/fin-de-jalon/SKILL.md`
(CLAUDE.md, push, PR, CI until green), never the merge. Then phase `fini` in `etat.md`, a
summary in `journal.md`, commit and push the docs, stop.

## Attente

Set phase `attente` in `etat.md` (keep the step and the phase it stopped at), write the
question in `decisions.md` under a heading `QUESTION POUR AZZO`, add one line to `journal.md`,
commit and push the docs, `pnpm run free-port`, delete the lock, stop. Later runs stop at once
until the owner answers.
