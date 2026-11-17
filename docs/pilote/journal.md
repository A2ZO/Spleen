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
