# Jalon 13 « Quoi écouter ce soir ? » — passation

Passer de la fiche à l'écoute : des liens « Écouter sur… » directs quand MusicBrainz les
connaît, les notes et cœurs de mes amis sur une fiche, et « Tire un disque » dans « À
écouter ». Spécification : règles du conseiller du 17 novembre dans `docs/pilote/decisions.md`
(« Décidé par le conseiller »), tirées du cahier des charges (section « Quoi écouter ce soir ?
(jalon 13) »). Consignes de chaque étape : `docs/pilote/feuille-de-route.md`. Branche
`feat/13-quoi-ecouter`, depuis `dev`.

## Contraintes (rappel)

- Toute la logique dans `packages/api`, utilisable par l'appli Expo. Aucun appel à MusicBrainz
  pendant l'affichage d'une page : les liens viennent de la base (import, tâche de nuit).
- Lecture publique d'une fiche identique pour tous (issue #22) ; ce qui dépend du membre se lit
  à part, par slug, en parallèle.
- Une seule migration, générée et additive : `listen_links`, `releases.links_checked_at`,
  `artists.links_checked_at` (« Autorisé à la fusion ») ; `pnpm db:migrate` sur Neon `dev`.
- URL de MusicBrainz validées (https, hôte exact, chemin selon le type de fiche) et
  reconstruites avant d'être enregistrées et affichées. Aucun logo, aucun lien affilié.
- MusicBrainz : aucune requête de plus à l'import ; relecture de nuit plafonnée à 300 requêtes
  et 10 minutes.
- Identité Lilas (`docs/design/README.md`) : un seul bloc lilas par page, jamais de carte vide,
  AA (texte 4,5:1, non-texte 3:1, cibles de 44 px), marche sans JavaScript.
- Pas de Suspense, pas de `loading.tsx`, pas de transitions de page. Animations en transform et
  opacity seulement.
- Aucune donnée personnelle nouvelle : politique de confidentialité, export et suppression du
  compte inchangés. Pas de nouvelle dépendance, variable d'environnement, CSP ni workflow.

## Étapes

1. **Les restes du jalon 11** : notification d'un jour passé « Sorti le … » ; disque pas encore
   sorti sans moyenne, avec « Les critiques ouvriront le jour de la sortie. ».
2. **« Écouter sur… » à l'import** : migration, relations d'URL MusicBrainz, validation,
   écriture à l'import et à la fusion, cinq services sur les trois fiches.
3. **« Écouter sur… » la nuit** : relecture plafonnée des fiches déjà importées dans
   `pnpm catalog:refresh`, passage réel sur Neon `dev`.
4. **« Tes amis sur ce disque »** : `release.friends`, section de la fiche d'un disque, démo.
5. **« Tire un disque »** : `toListen.pick`, page `/pick`, bouton dans « À écouter » (issue #31).
6. **La passe finale** : `docs/quoi-ecouter.md`, captures, axe, mesures, `CLAUDE.md`, cahier,
   puis fin de jalon.

## Où on en est

- **Étape 1 faite** (17 novembre) : `notification.list` renvoie `releaseDay` et `releasedToday`
  (jour du membre, repli Paris ; `ctx.now`), l'écran dit « Sorti le {date} : … » et « {count}
  sorties le {date} chez tes artistes » un autre jour ; la fiche d'un disque à venir n'a plus
  de moyenne et dit « Les critiques ouvriront le jour de la sortie. ». Issues #41 et #42 : la PR
  de fin de jalon dira `Closes #41`, `Closes #42` (et `Closes #31` à l'étape 5).
- Décisions : l'année de « Sorti le … » s'ajoute quand elle diffère de celle du jour de Paris,
  calculée par la page (`formatDayMonth`) ; détail dans `docs/pilote/decisions.md`.
- Appris en route : sur le build de prod avec Brevo factice, `hydration.spec.ts:17` échoue
  toujours (HTTP 401 de Brevo, envoi du lien) ; il passe en dev, ce n'est pas une régression.
  Mesures prod : se connecter une fois en dev avec `MEASURE_STATE`, puis mesurer la prod.
- **Étape 2 faite** (17 novembre) : migration `0017` (`listen_service`, `listen_links`,
  `links_checked_at` sur `releases` et `artists`) ; le fournisseur lit les `url-rels`
  (`urlRelations`) ; `validListenUrl` / `pickListenLinks` / `buildListenLinks`
  (`packages/api/src/lib/listen-links.ts`) ; liens écrits à l'import (disque, morceaux, artiste
  via `importArtist` + `links_checked_at`), repris à la fusion ; `ListenOn` : 5 services dans un
  ordre fixe, direct (icône externe) ou recherche (« (recherche) » pour les lecteurs d'écran).
  Détail : `docs/catalogue.md`, « Écouter sur… (jalon 13) ».
- Décisions : YouTube Music seulement en forme artiste, `itunes.apple.com` refusé ; liens lus
  dans la même requête que la fiche (sous-requête `json_agg`, mesure dans la référence) ; purge
  e2e des liens des disques jetables dans `apps/web/e2e/cleanup.ts` (`docs/pilote/decisions.md`).
- Appris en route : la clé `restrict` de `listen_links` bloque la suppression des disques e2e
  (d'où la purge) ; l'artiste et le morceau jetables, jamais supprimés, gardent leurs liens sur
  Neon `dev` (sans effet, ils s'accumulent ; à purger si ça gêne).
- **Étape 3 faite** (17 novembre) : `getEditionLinks` (parcours des éditions d'un groupe avec
  `url-rels`, fixture `12.json` ; fixtures 01–11 réenregistrées, aucun attendu changé) ;
  `refreshListenLinks` (`packages/api/src/lib/catalog/listen-links-refresh.ts`) : 200 disques,
  100 artistes, 10 min, relus tous les 30 jours ; en dernier dans `pnpm catalog:refresh`, seule
  avec `-- --links-only`. Détail : `docs/catalogue.md`, « Relecture de nuit ».
- Essais réels sur Neon `dev` (`links: postgres, not Neon's production branch: true`) :
  19 disques, 48 liens, 1 échec, 148 pour plus tard, puis 8 disques, 21 liens, 1 échec,
  140 pour plus tard ; liens de disques : Spotify 16, Deezer 15, Apple Music 15, Bandcamp 2.
  Échecs = `CatalogError` MusicBrainz indisponible/occupé (arrêt de la phase). Artistes relus
  à part (script temporaire, 5 artistes, 14 liens, 0 échec) pour la capture.
- Décisions : `maxAttempts` 3 et 0 édition traité comme `not_found` ; le parcours renvoie bien
  les relations (`docs/pilote/decisions.md`).
- Appris en route : un 503 de MusicBrainz arrête la phase avant les artistes ; si ça se
  répète chaque nuit, les artistes ne sont jamais relus (point ouvert, voir le journal).
- **Étape 4 faite** (17 novembre) : `releaseFriends` (`packages/api/src/lib/social/
  release-friends.ts`, une requête, total par `count(*) over ()`) derrière `release.friends`
  (`{ slug, all? }`, null pour visiteur, compte suspendu ou sans profil) ; section
  `FriendsOnRecord` sur la fiche album (après la mosaïque, avant « Liste des titres ») ;
  `?friends=all#friends` ouvre la liste sans JavaScript ; démo `seed/friends.ts` (« Dernier
  métro pour Belleville », 7 membres suivis par `nuitblanche`, 6 visibles) ; e2e
  `release-friends.spec.ts` (helper `followMembersInDatabase`, Postgres seulement).
- Décisions : inventaire de `db.test.ts` mis à jour ; snapshot `feed-loading` régénéré (ajouts
  seuls) — **point ouvert pour Azzo** : valider, ou faire suivre ces membres par un autre
  compte de démo ; appel gardé en première vague (A/B sans l'appel : même temps) ; détail dans
  `docs/pilote/decisions.md`. `docs/social.md` cite le fichier parmi les filtres de masquage.
- Appris en route : `user_item_state.updated_at` suit l'horloge, la démo le recale sur la date
  d'écoute pour un ordre lisible ; ne jamais lancer deux passes Playwright en même temps (le
  nettoyage global de l'une supprime les comptes de l'autre) ; `pnpm start` se lance depuis
  `apps/web`.
- **Étape 5 faite** (17 novembre) : `pickToListen` (`packages/api/src/lib/listening/pick.ts`,
  deux vagues, aléa injectable, rien d'écrit) derrière `toListen.pick({ type?, duration?, not?
  })` → `{ listTotal, matching, pick }` (`pick.durationMinutes` via `pickMinutes`, jamais en
  contradiction avec le filtre) ; page `/[locale]/pick` (noindex, filtres en `LinkTabs`,
  `PickCard`, « Un autre » = formulaire GET + `useNavigate` dans `AnotherPick`) ; bouton
  « Tire un disque » sur mon onglet « À écouter » seulement ; démo `seed/pick.ts` (6 disques
  pour `nuitblanche`, dates `updated_at` fixées) ; tests `pick.test.ts`, e2e `pick.spec.ts`
  (débordement à 390 px dedans, pas dans `overflow.spec`) ; `measure.mjs` gagne
  `MEASURE_ONLY=<chemin>`.
- Décisions : accueil inchangé malgré l'issue #31 (décisions actées) ; tailles de titre de carte
  `phoneCardTitleSize` / `phoneCardLineSize` (`lib/display-title.ts`) ; détail dans
  `docs/pilote/decisions.md`.
- Appris en route : sous Git Bash, un chemin dans une variable (`MEASURE_ONLY=/fr/pick`) devient
  un chemin Windows : `MSYS_NO_PATHCONV=1` ; `rainydaysam` n'est plus vide sur la base de dev
  (ajouts hors seed) : prendre un compte e2e jetable pour un état vide ; le garde-fou du log
  serveur a relevé une fois « render cancelled mid-stream » en passe complète, non reproduit
  seul (issue #34).
- **Étape 6 faite** (17 novembre) : doc du domaine `docs/quoi-ecouter.md`, renvois depuis
  `catalogue.md`, `ecoute.md`, `social.md` et `decouverte.md`, cahier des charges (jalon 13 fini,
  page album), `CLAUDE.md` (jalon coché, décision des liens d'écoute, ordre 14 → 10 → 15 → 16).
  Vérifications : `pnpm check` vert, e2e complet en dev vert, prod sans compte + overflow 116 · 2
  (`hydration.spec:17`, Brevo factice) · 10, axe 0 violation, A/B `origin/dev` / HEAD identiques
  (pageMs 214/134/220/180/226 contre 215/132/216/180/223), `/pick` 137 ms. Relecteur : OK au
  premier tour.
- Appris en route : un premier écart de 20 ms (album, `/discover` → accueil) a disparu en A/B
  dans la même session : comparer toujours deux builds dans la même session avant de conclure ;
  `pnpm build` peut sortir en code 1 juste après l'avertissement de sécurité de Next 16.4.2,
  un second essai passe.
- **Prochaine : fin du jalon** (sections 5 et 6 du skill du pilote) : PR `feat/13-quoi-ecouter`
  → `dev` avec `Closes #31`, `#41`, `#42` ; questions pour Azzo : régénération du snapshot
  `feed-loading` (étape 4), passage à un Next.js corrigé (PR `chore/` séparée) avant la release ;
  points ouverts : 503 de MusicBrainz qui arrête la phase des liens avant les artistes, liens
  des fiches e2e jetables qui s'accumulent, disques à venir dans la discographie. Puis fusion
  dans `dev` si les conditions tiennent, et PR de release `dev` → `main` en brouillon.

## Mesures de référence

- `measure.mjs` (fin du jalon 11, étape 6, build de prod, médianes de 6, deux passages,
  `nuitblanche`) : accueil → album 215 / 213, album → artiste 136 / 135, artiste → profil
  231 / 219, profil → `/discover` 182 / 180, `/discover` → accueil 228 / 225 ms. Référence par
  page : la plus haute des deux, **215 / 136 / 231 / 182 / 228 ms**. Une page déjà mesurée ne
  doit pas prendre plus de 20 ms.
- `/upcoming` (fin du jalon 11, accueil → `/upcoming`, mêmes conditions) : 158 / 160 ms,
  référence **160 ms**.
- `/pick` (étape 5, `MEASURE_ONLY=/fr/pick`, build de prod, `nuitblanche` et ses 7 disques
  « À écouter ») : 138 / 141 / 142 ms, référence **142 ms**. Cinq parcours à la fin de
  l'étape 5 (A/B même session) : `d70f426` 226/144/233/188/233, `f6fcdad` 221/143/230/187/234
  (plus hauts des deux passages) : inchangés par l'étape.
- Pages qui changent dans ce jalon et figurent dans `measure.mjs` : la fiche album (liens lus
  avec la fiche, `release.friends` en parallèle) et la fiche artiste (liens). Le pool Postgres a
  5 connexions : une lecture parallèle de plus peut coûter 25 à 30 ms (étape 4 du jalon 11).
