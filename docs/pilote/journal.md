# Journal du pilote — jalon 13 « Quoi écouter ce soir ? »

Une entrée par exécution qui a fait quelque chose (10 lignes au plus). Journal du jalon 11 :
`docs/pilote/archives/jalon-11/journal.md`.

- 2026-11-17 — Jalon 13 préparé par le conseiller : feuille de route en 6 étapes (restes du
  jalon 11, liens « Écouter sur… » à l'import puis la nuit, « Tes amis sur ce disque », « Tire
  un disque », passe finale), règles du cahier retenues ou ajustées dans `decisions.md`, une
  seule migration autorisée. Prochaine : étape 1.
- 2026-11-17 — Étape 1 (restes du jalon 11, issues #41 et #42) : commits e5d5497..d8e18bf.
  `notification.list` donne `releaseDay` / `releasedToday`, « Sorti le {date} » un autre jour ;
  disque à venir sans moyenne, « Les critiques ouvriront le jour de la sortie. ». `pnpm check`
  vert ; e2e complet 248 passed, 0 failed, 0 flaky, 10 skipped ; specs sans compte en prod
  114 passed, 2 failed (`hydration.spec.ts:17`, clé Brevo factice refusée, passe en dev).
  axe 0 violation (fiche visiteur et membre, notifications × 4 cas, 1280 et 390). Mesures prod
  clicMs 220/219 · 141/140 · 244/230 · 187/187 · 236/242 ms (max +14). Relecteur : OK au
  premier tour. Décision : année de « Sorti le » comparée au jour de Paris. Prochaine : étape 2.
- 2026-11-17, étape 2, réponses réelles (MusicBrainz, `inc=url-rels`, `recording-level-rels`
  accepté) : `relations[]` = `{ type: "free streaming" | "streaming" | "purchase for download"
  | "youtube music" | "bandcamp"…, direction: "forward", ended, url: { resource } }`, relations
  des enregistrements présentes (vides parfois). Formes vues : `open.spotify.com/{album,track,
  artist}/{22}`, `www.deezer.com/{album,track,artist}/{n}`, `music.apple.com/{cc}/{album,song,
  artist}/{n}` (sans slug), `music.youtube.com/channel/UC…` (artiste), `{nom}.bandcamp.com/`
  (artiste) ; bruit : `shop.spotify.com`, `itunes.apple.com/gb/artist/id…` (terminé), Tidal,
  Qobuz, Amazon. Disque de test : BRAT (édition XW `ab55ac76`). Valeurs des tests : inchangées.
- 2026-11-17, étape 2 terminée, commits `9c92263..0b3e6d4` : url-rels lues, migration 0017,
  validation unique `validListenUrl`, liens écrits à l'import et repris à la fusion, `ListenOn`
  direct / recherche. `pnpm check` vert ; e2e complet 250 passed, 0 failed, 0 flaky, 10 skipped ;
  specs sans compte en prod 116 passed, 2 failed (`hydration.spec.ts:17`, clé Brevo factice).
  axe WCAG 2.2 AA 0 violation (album, artiste, morceau ; visiteur prod, membre dev ; 1280 et
  390). Mesures prod pageMs 212/133/219/182/226 et 211/134/219/167/227 (référence
  215/136/231/182/228). Relecteur : OK au premier tour. Décisions : purge e2e des liens dans
  `cleanup.ts`, liens lus par `json_agg`. Ouvert : liens des artiste et morceau jetables qui
  s'accumulent sur Neon `dev`. Prochaine : étape 3.

## 2026-11-17 — étape 3, « Écouter sur… », relecture de nuit

Commits c5ad297..HEAD (`getEditionLinks`, `refreshListenLinks`, `-- --links-only`, docs).
`pnpm check` vert ; e2e 250 passés, 0 échec, 10 ignorés (1 instabilité au démontage, issue #34).
Pas d'axe ni de mesures : aucun écran changé. Essais réels sur Neon `dev` : 19 disques, 48 liens,
1 échec, 148 pour plus tard, puis 8 disques, 21 liens, 1 échec, 140 ; 5 artistes, 14 liens à part.
Relecteur : corrections au premier tour (capture artiste, passation, risque ci-dessous).
Décisions : `maxAttempts` 3, 0 édition = `not_found`. Ouvert : un 503 de MusicBrainz arrête la
phase avant les artistes ; s'il se répète chaque nuit, les artistes ne sont jamais relus.
Prochaine : étape 4.

## 2026-11-17 — étape 4, « Tes amis sur ce disque »

Commits 458340f..HEAD (`release.friends`, section `FriendsOnRecord`, démo, e2e, docs).
`pnpm check` vert ; e2e 254 réussis · 2 échoués, run perturbé par une passe concurrente (les 3
specs passent seules 34/34, issue #34 commentée). Axe : 0 à 1280 et 390 (membre, visiteur prod).
Mesures album 213–239 ms contre 215, A/B sans l'appel identique : bruit de la machine.
Décisions : inventaire `db.test.ts` et snapshot `feed-loading` mis à jour (ajouts seuls).
Ouvert : Azzo valide la régénération du snapshot ou préfère un autre compte de démo suiveur.
Relecteur : OK avec corrections au premier tour. Prochaine : étape 5.
