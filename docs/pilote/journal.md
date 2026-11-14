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
- 2026-11-14 — Étape 6 (le reste), pilote. Commits `4bd712a`..`1f3c7f7`. `pnpm check` vert ;
  e2e dev 220 réussis / 0 échoué / 10 ignorés ; prod sans compte 104 réussis (seul
  `hydration.spec`, attendu) ; après corrections, 6 specs : 68 réussis / 8 ignorés ; axe 0 ;
  `measure.mjs` ×2 dans les 20 ms de la référence (214/128/221/197/219) ; search ≈ 117 ms,
  liste ≈ 110 ms (sans référence). Relecteur : 2 tours (filtres segmentés, zone de texte,
  dates admin, numéro 404 en encre, captures nuitblanche) → OK. Décisions : OG en Inter
  (Bricolage TTF à déposer), aucun bloc lilas, badge dev de la 404 (script du layout, hors
  périmètre). Point ouvert : `docs/pilote/installation/*` toujours supprimés sans commit.
- 2026-11-14 — Étape 7 (les animations), pilote. Commits `8651b34`..`eafd049`. `pnpm check`
  vert ; e2e dev 230 réussis / 0 échoué / 10 ignorés (teardown « render cancelled mid-stream »
  → #34 commenté) après correction de 8 échecs (contraste des tuiles en cascade, vignette en
  `<img>`) ; prod sans compte 114 réussis (seul `hydration.spec`, attendu) ; axe 0 (visiteur et
  membre). `measure.mjs` : accueil 226–234 ms contre 209 de référence ; A/B dans la même
  session : branche 213/133/220/206/218 contre 219/136/230/205/212 avant l'étape (accueil +6).
  Relecteur : 1 tour (mesure A/B, décalage par colonne) → appliqué. Décisions : voir
  `decisions.md` (étape 7). Point ouvert : `docs/pilote/installation/*` toujours supprimés sans
  commit.
- 2026-11-14 — Étape 8 : plan écrit et relu (OK avec corrections, appliquées) ; limite d'usage atteinte avant le code, reprise en phase `code`.
- 2026-11-14 — Étape 8 (la passe finale), pilote. Commits `2270622`..`a382c19`. `pnpm check`
  vert ; e2e dev 230 réussis / 0 échoué / 10 ignorés ; prod sans compte 114 réussis (seul
  `hydration.spec`, attendu) ; axe 0 sur toutes les pages (visiteur, membre, admin, welcome).
  `measure.mjs` : branche 241/138/226/202/227, `main` A/B 237/140/225/208/210 (max +17 ms).
  Relecteur : 2 tours (2 écoutes de test parasites supprimées par l'interface, carte artiste,
  AddToList et titres de liste sur mobile, capture d'édition de liste) → OK. Décisions : voir
  `decisions.md` (étape 8). Point ouvert : `docs/pilote/installation/*` toujours supprimés sans
  commit. Prochain passage : fin de jalon (PR, CI verte, sans fusion).
- 2026-11-14 — Fin de jalon, pilote. `pnpm check` + e2e complet (verificateur) : tout passe.
  CLAUDE.md ramené de 218 à 199 lignes (`94b3369`, pièges regroupés, détails dans
  `docs/pieges.md`). PR https://github.com/A2ZO/Spleen/pull/35 ouverte, CI verte
  (check, api-postgres). Pas de fusion (feuille de route, décision de l'étape 8) : à Azzo, puis
  `/fin-de-jalon fusionné`. Point ouvert : `docs/pilote/installation/*` toujours supprimés sans commit.
