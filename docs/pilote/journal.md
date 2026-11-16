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
- 2026-11-16 — Étape 2 « Alimentation de nuit et lectures » faite : 2b22659..04112ac (migration
  0015, client ListenBrainz, suivi des dates, file des discographies, règle et lectures
  `upcoming`, passage de nuit, démo, docs, corrections). `pnpm check` vert ; e2e complet 236
  réussis · 0 échoués · 0 instables · 10 ignorés · 7 min 21 ; pas d'écran (ni axe ni mesure).
  `pnpm catalog:refresh` réel : ListenBrainz ok, 0 groupe d'artiste suivi, 1 sortie ajoutée.
  Décision : budget de nuit dans l'ordre imports → fiches → dates plus tôt → plus tard (écart
  assumé au tour 1 du relecteur, accepté au tour 2). Relecteur : 2 tours, OK avec corrections,
  appliquées. Note : `.claude/skills/pilote` modifié par une session d'Azzo pendant l'étape
  (section « Avancement »), suivi tel quel.
- 2026-11-16 — Étape 3 « Les écrans des sorties à venir » faite : d68155a..bdf7683 (refus API,
  lectures, `/upcoming`, fiche artiste, fiche à venir, e2e, docs, corrections). `pnpm check`
  vert ; e2e complet 242 réussis · 0 échoués · 0 instables · 10 ignorés · 7 min 23 ; axe AA 2.2
  0 violation (membre, membre sans suivi, visiteur sur build de prod ; target-size corrigé).
  Mesures prod : 211–216 / 131–134 / 219–221 / 178–180 / 202–203 contre 237 / 140 / 225 / 208 /
  210 (régression album→artiste +36 ms corrigée) ; `/upcoming` 149 / 151 ms (référence).
  Relecteur : 2 tours, OK. Point ouvert pour Azzo (PR) : retirer les sorties à venir de la
  discographie de la fiche artiste ?
- 2026-11-16 — Étape 4 « Accueil et découverte » faite : ac29227..352e016 (API, écrans, e2e et
  docs, une requête pour l'accueil). `pnpm check` vert ; e2e complet 244 réussis · 0 échoués ·
  0 instables · 10 ignorés · 7 min 33 ; axe AA 2.2 0 violation (nuitblanche et visiteur sur
  build de prod, rainydaysam en dev). Mesures prod : 211/205 · 135/130 · 218/216 · 171/157 ·
  219/220 contre 237 / 140 / 225 / 208 / 210 (accueil +25–32 ms au premier passage, corrigé).
  Relecteur : 1 tour, OK. Rappel PR : `Closes #32`.
- 2026-11-16 — Étape 5 « Les notifications du jour J » faite : d8a46cc..HEAD (migration 0016,
  `pnpm releases:notify` et étape de nuit, rendu dans les notifications, tests, docs).
  `pnpm check` vert ; tests API 6/6 ; e2e complet 246 réussis · 0 échoués · 0 instables ·
  10 ignorés · 7 min 32 ; axe AA 2.2 0 violation (/fr/notifications, 1280 et 390). Mesures
  prod : 217 / 136 / 228 / 181 / 227 contre 237 / 140 / 225 / 208 / 210 (première série 234 sur
  discover→accueil, page non touchée). Relecteur : 1 tour, OK avec corrections (deux lignes
  par disque à 390 px, groupe vide filtré). Écart e2e et deux questions pour Azzo à la PR.
