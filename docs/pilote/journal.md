# Journal du pilote — jalon 14 « Souvenirs »

Une entrée par exécution qui a fait quelque chose (10 lignes au plus). Journal du jalon 13 :
`docs/pilote/archives/jalon-13/journal.md`.

- 2026-11-17 — Jalon 14 préparé par le conseiller : feuille de route en 5 étapes (bouton « Tire
  un disque au hasard » de l'accueil membre, souvenirs de l'accueil côté API puis écrans et
  démo, « Sortis un … » sur `/discover`, passe finale), règles du cahier retenues ou ajustées
  dans `decisions.md`, une seule migration autorisée (`profiles.show_memories`), inventaire de
  `db.test.ts` autorisé (ajouts seuls), snapshot `feed-loading` à ne pas toucher. Prochaine :
  étape 1.
- 2026-11-17 — Étape 1 (bouton « Tire un disque au hasard » de l'accueil membre → `/pick`,
  accueil visiteur inchangé). Commits `4839b2d`..`98d1ace` (plan, `b18b637` feat, `13c30e2`
  e2e + doc, passation). `pnpm check` vert ; `pick.spec` 8/8 ; e2e complet dev 264 réussis,
  0 échoué, 10 ignorés (teardown « render cancelled mid-stream » → #34 commentée). Prod sans
  compte + overflow 116 · 2 (`hydration.spec:17`, Brevo factice, connu). axe AA 0 (accueil
  visiteur et `nuitblanche`, 1280/390). Mesures : 1er passage hors des 20 ms (241/144/238/
  196/241) ; A/B même session `origin/dev` 241/144/242/194/242 contre HEAD 227/144/230/194/241
  → pas de régression. Relecteur : plan OK avec 3 corrections appliquées, étape OK au 1er tour.
  Aucune décision nouvelle. Prochaine : étape 2.
- 2026-11-17 — Étape 2 (souvenirs de l'accueil : réglage et API, pas d'écran). Commits
  `904fc66`..HEAD (plan relu, `f9ea530` migration `0018` `show_memories`, `45cdb03`
  `memories.home` + `account.setShowMemories`, `e81b4d3` 21 tests). `pnpm check` vert ;
  snapshot `feed-loading` inchangé ; e2e complet 264 réussis, 0 échoué, 10 ignorés (teardown
  « render cancelled mid-stream » → #34 commentée). Pas d'axe ni de mesures (aucun écran ne
  change). Relecteur : plan OK avec corrections appliquées, étape OK au 1er tour. Décision :
  exclusions appliquées avant le choix de l'année la plus récente. Prochaine : étape 3.
- 2026-11-17 — Étape 3 (souvenirs de l'accueil : écrans, réglages et démo). Commits
  `288d1cc`..HEAD (plan relu, `3882cd9` accueil + réglage, `aac8674` démo `vieuxsillons`,
  `d4837b9` `MEASURE_EMAIL`, `3127ecc` e2e). `pnpm check` vert ; `memories.spec` 8/8 ; e2e
  complet 272 réussis, 0 échoué, 10 ignorés (teardown « render cancelled mid-stream » → #34
  commentée). Prod sans compte + overflow 114 · 2 (`hydration.spec:17`, connu). axe AA 0
  (accueil `vieuxsillons`, réglages ; 1280/390). Mesures A/B même session : `nuitblanche`
  `origin/dev` 219/137/216/182/226 contre HEAD 219/136/219/163/244 ; `vieuxsillons` 196/133/213/
  182/169 contre 205/134/207/183/187 (+18 au plus) → nouvelle référence de cet accueil.
  Relecteur : plan OK avec corrections, étape OK au 1er tour. Décision : F à 8 ans un 29 février.
  Prochaine : étape 4.
- 2026-11-17 — Étape 4 (« Sortis un <jour mois> » sur `/discover`). Commits `85a55e6`..HEAD
  (plan relu, `d814146` API, `850233f` écran, `c1f114a` démo `deuxiemeface`, `4c277e8` e2e,
  `55ae795` passation). `pnpm check` vert ; e2e complet 274 réussis, 0 échoué, 10 ignorés.
  Prod sans compte + overflow 116 · 2 (`hydration.spec:17`, connu). axe AA 0 (`/discover`
  visiteur et `nuitblanche`, 1280/390). `EXPLAIN` Neon `dev` 0,41 ms ; index utilisés quand le
  parcours complet est coupé. Mesures pageMs (plus haut de deux) 231/141/229/193/246 : profil →
  `/discover` +13 ; `/discover` → accueil 246 comme HEAD de l'étape 3 (244). Relecteur : plan
  OK avec corrections, étape OK au 1er tour. Aucune décision nouvelle. Prochaine : étape 5.
- 2026-11-17 — Étape 5 (passe finale). Commits `020edbf`..HEAD (plan relu, `a845bae` Next
  16.4.5, `ac53904` `docs/souvenirs.md` et renvois, cahier, `b69637f` `CLAUDE.md`, `9a6aace`
  mesures, passation). `pnpm check` vert ; e2e complet 274 réussis, 0 échoué, 10 ignorés
  (teardown « render cancelled » → #34 commentée). Prod sans compte + overflow 116 · 2
  (`hydration.spec:17`, connu). axe AA 0 sur 18 pages × largeurs. Mesures pageMs : HEAD
  236/143/236/200/253 → A/B `origin/dev` 238/150/240/196/242 (≤ +11, machine plus lente) ;
  `vieuxsillons` 211/147/226/198/197 ; `/pick` 137. Relecteur : plan OK avec corrections, étape
  OK au 1er tour. Décision : Next 16.4.5 plutôt que 16.4.6 (à revoir au jalon 10). Ouvert :
  phrase de confidentialité à valider. Prochaine : fin du jalon (PR → `dev`, fusion, PR de version).
- 2026-11-17 — Fin du jalon 14. README (jalons 13 et 14) ; PR #50 `feat/14-souvenirs` → `dev`
  ouverte, CI verte (check, api-postgres). Pas de nouvelle passe locale (code inchangé depuis la
  passe complète de l'étape 5). Zones sensibles conformes à « Autorisé à la fusion » (migration
  0018, `auth.ts`, `db.test.ts` +6/+2/+9, Next/eslint-config-next 16.4.5, lockfile). Relecteur :
  OK avec corrections (description de la PR), puis OK. Fusion automatique dans `dev` demandée.
  Ouvert : phrase de confidentialité proposée dans la PR, à valider par Azzo (jalon 10 au plus tard).
