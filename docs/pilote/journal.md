# Journal du pilote — jalon 11 « Sorties à venir »

Une entrée par exécution qui a fait quelque chose (10 lignes au plus). Journal du jalon 17 :
`docs/pilote/archives/jalon-17/journal.md`.

- 2026-11-16 — Jalon 11 préparé par le conseiller : feuille de route, règles validées par Azzo,
  skill et relecteur adaptés (plans validés par Azzo). Prochaine : étape 1.
- 2026-11-16 — Étape 1 : plan écrit et relu (OK avec corrections, appliquées) ; attente de la
  validation d'Azzo (`docs/pilote/plan-etape-1.md`).
- 2026-11-16 — Étape 1 « Suivre un artiste » faite : e2fce69 (db), c3124ce (api), 6b7cfa1 (web),
  a5a0974 (e2e), 0cf425c (perf), 79c6a35 (erreur sans JavaScript). `pnpm check` vert (API 250
  tests) ; e2e complet 230 réussis / 6 échecs (`aria-pressed` attendu, deux « Enregistrer »)
  corrigés et rejoués verts, plus un « render cancelled mid-stream » au teardown (#34). axe AA
  0 violation (fiche artiste visiteur et membre, réglages, 1280 et 390 px). Mesures prod :
  214–234 / 139–140 / 227–230 / 194–220 / 218–232 contre 237 / 140 / 225 / 208 / 210 ; `dev`
  dans la même session : 221–226 / 135 / 235–247 / 196–206 / 217–232 (écart = machine).
  Décision : aucun mécanisme de retour après connexion n'existe (tout le monde arrive sur
  `/welcome`), aucun créé. Relecteur : OK avec corrections, appliquées.
