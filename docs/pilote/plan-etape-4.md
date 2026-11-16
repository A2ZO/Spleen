# Plan — étape 4 « Accueil et découverte » (jalon 11)

Brief : `feuille-de-route.md`, « Étape 4 ». Aucune migration ni dépendance. Règle unique :
`upcomingSql()`. Relu par le relecteur (OK avec corrections, appliquées).

1. **`upcoming.home`** (public ; `null` sans utilisateur ou sans profil, donc lancé avec
   `account.me` sans erreur pour un visiteur) → `{ following, items, soon }` :
   - `items` : `upcomingForMember` limité à 5, fuseau du membre, sorties à l'année seule en
     dernier (puis date, titre, id) ; `toItems` gagne une option qui saute `wantToListen`.
   - `soon` (#32) : première sortie suivie **au jour** entre J+1 et J+6, lue à part ;
     `inDays` (1 = demain). `following` : `exists` sur `artist_follows`. Tout en parallèle.
   - Tests PGlite : limite, ordre (année seule après une date lointaine), `soon` (J+1, J+6 oui ;
     aujourd'hui, J+7, au mois non ; fuseau), `following`, visiteur → `null`.
2. **`discovery.awaited`** (public, 10 au plus) : à venir au jour de Paris ; membres distincts
   qui suivent un artiste du disque **ou** l'ont dans « À écouter » ; `profiles.suspended_at
   is null` ; toutes langues ; `>= 2` ; tri : nombre desc, année seule en dernier, date, id.
   Sans données du lecteur (cache #22, comme `upcomingByArtist`). Aucun nom ni compte renvoyé.
   Tests : seuil, union comptée une fois, suspendu exclu, sortie passée exclue, égalité, 10.
3. **Passage aux sorties récentes** (test d'API) : une sortie de demain (Paris) est dans
   `awaited` et `upcoming.mine`, pas dans `discovery.recent` ; avec `now` = demain, l'inverse.
4. **`UpcomingGrid`** (`components/upcoming/`) : `ReleaseTile` + `detail` =
   `formatUpcomingDate` ; 2 colonnes à 390 px, 5 sur ordinateur ; reprise par l'accueil,
   `/discover` et la section « À venir » de la fiche artiste (remplace sa grille en dur).
5. **Accueil membre** : « Bientôt dans tes oreilles » pleine largeur juste sous la grille du
   haut (sous « Ton mois »), avant les tendances ; lien « Toutes tes sorties à venir » →
   `/upcoming`. Sans suivi : phrase d'invitation + même lien. Suivis sans annonce : rien.
   `upcoming.home` dans un `cache()` lancé avec `account.me`. Visiteur : inchangé.
6. **Carte #32** : si `soon`, `JustOutCard` montre ce disque, « Sort demain » (`inDays` 1) ou
   « Sort {weekday} » (date en UTC, langue de l'interface), lien « Toutes tes sorties à
   venir », aucune action d'écoute ni de note ; sinon « Vient de sortir ». Commentaire à jour.
7. **`/discover`** : « Les plus attendus » (`id="awaited"`) juste avant « Sorties récentes »,
   une phrase courte, caché si vide ; dans le `Promise.all` existant.
   i18n FR/EN (« tu ») : `home.soon*`, `home.outTomorrow`, `home.outOn`, `discover.awaited*`.
8. **e2e** (court, `throwawayCatalog`) : sortie à J+1 calculée au lancement en Europe/Paris
   (fuseau du profil e2e ; le serveur garde l'heure réelle) ; le membre qui suit voit le bloc
   et « Sort demain » ; un visiteur garde « Vient de sortir ». « Les plus attendus » : API.
9. **Docs et captures** (après `pnpm db:seed` du jour) : `decouverte.md`. Captures 1280 / 390
   dans `docs/pilote/captures/4/` : accueil nuitblanche (bloc + « Sort … »), rainydaysam (sans
   suivi), visiteur, `/discover`. Mesures de l'accueil et de `/discover`.

## Avancement

- [ ] 1. `upcoming.home`
- [ ] 2. `discovery.awaited`
- [ ] 3. Passage aux sorties récentes
- [ ] 4. `UpcomingGrid`
- [ ] 5. Accueil membre
- [ ] 6. Carte #32
- [ ] 7. `/discover`
- [ ] 8. e2e
- [ ] 9. Docs et captures
