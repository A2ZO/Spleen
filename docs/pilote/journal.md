# Journal du pilote

Une entrée par exécution qui a fait quelque chose (10 lignes au plus).

- 2026-11-13 — Mise en place du pilote. Étapes 1 à 4 faites à la main. Prochaine : étape 5.
- 2026-11-14 — Étape 5 (profil et Étagère), pilote. Commits `0e230ff`..`6fe3741`, passation `4ee6850`.
  `pnpm check` vert ; e2e dev 220 réussis / 0 échoué / 10 ignorés (teardown « render cancelled
  mid-stream » → #34) ; prod sans compte 104 réussis (seul `hydration.spec`, attendu) ; axe 0 ;
  `measure.mjs` ×2 dans les 20 ms de la référence 217/133/223/207/209 ; son profil après une
  écoute 226–247 ms. Relecteur : 2 tours (nom long coupé, badge du journal sur mobile) → OK.
  Décisions : voir `decisions.md` (étape 5). Points ouverts : 3 écoutes de test créées pour
  nuitblanche dans la base de dev puis supprimées par l'interface ; `docs/pilote/installation/*`
  supprimés dans l'arbre de travail sans être commités (au propriétaire de trancher).
