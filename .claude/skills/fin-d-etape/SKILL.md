---
name: fin-d-etape
description: Close a step inside a milestone — one full verification via the verificateur subagent, update docs/<jalon>-en-cours.md, commit and push the milestone branch, French recap with a resume prompt, then stop so the user can /clear.
disable-model-invocation: true
---

# Fin d'étape

Answer in French. Hard rules: never commit or push to `main`, no force push, never read or
print `.env`.

1. **Verify once.** Delegate to the `verificateur` subagent (full run: check + e2e). One run
   only, not two. If it lists failures, stop and report them; do not close the step.
2. **Hand-over doc.** Update `docs/<jalon>-en-cours.md` (e.g. `docs/jalon-09-en-cours.md`):
   status of the step, decisions taken, « Appris en route », and the next step described
   precisely enough to restart from nothing else (files, commands, open questions).
3. **Commit and push.** Check `git branch --show-current` is the milestone branch
   (`feat/<nn>-<name>`), not `main`. Run `pnpm exec prettier --write` on the doc, commit
   `docs: passation étape <n>` (Conventional Commits, session attribution line), then
   `git push -u origin <branch>`.
4. **Recap**, 15 lines at most, in French. Then a block « Prompt de reprise » ready to paste:
   `Lis CLAUDE.md puis docs/<jalon>-en-cours.md, et fais l'étape <n+1>`, followed by the
   decisions the user has to take.
5. End with exactly: « Fais /clear puis colle le prompt de reprise. » Then stop.
