# Plan — étape 3 « Les écrans des sorties à venir » (jalon 11)

Brief : `feuille-de-route.md`, « Étape 3 ». Aucune migration. Règle unique : `upcomingSql()`.
Relu par le relecteur (OK avec corrections, appliquées).

1. **Refus côté API** (`lib/listening/targets.ts`) : `requireReleased(db, input, timeZone, now)`
   — disque seulement (un morceau passe), `upcomingSql(today)` au jour du fuseau du membre
   (Paris par défaut) → `fail("BAD_REQUEST", "RELEASE_NOT_OUT")`. Seulement ce qui ajoute :
   note non nulle, cœur à vrai, « J'ai écouté », nouvelle écoute ou écoute modifiée, critique
   créée ou modifiée. Retirer une note, un cœur, supprimer une écoute ou une critique, « À
   écouter » et les listes restent permis. Code dans `API_ERROR_CODES`, `errors.*` FR/EN,
   `docs/ecoute.md`. Tests : chaque ajout refusé, chaque retrait permis, un morceau et le jour
   de sortie acceptés.
2. **Lectures** :
   - `ReleaseDetail.upcoming: { dateChanged: boolean } | null` (`pages.ts`, jour de Paris :
     phrase et badge publics, cache #22).
   - `MyItemState.releaseNotOut: boolean` (`getMyItemState`, fuseau du membre, même règle) :
     décide du masquage des contrôles de la fiche.
   - `UpcomingItem.wantToListen` (état du lecteur ; faux pour un visiteur et `byArtist`).
   - `upcoming.suggestions` (membre) → `{ following: number, artists: {id, slug, name}[] }` :
     `topArtists` de `getMemberStats` (déjà en cache, comme le profil), ids lus par slug en
     suivant `merged_into_id`, hors artistes suivis. Première mesure de `/upcoming` sans cache.
   - Tests PGlite : `upcoming` de la fiche, `releaseNotOut` (fuseau), `wantToListen`,
     suggestions (suivis exclus, fusion, vide).
3. **Dates** (`lib/release-date.ts`) : `formatUpcomingDate(format, date, precision)` → « ven.
   21 nov. » au jour, « novembre 2026 » au mois, « 2027 » à l'année (UTC, jamais de jour
   inventé).
4. **`/[locale]/upcoming`** : visiteur → `/sign-in`, sans profil → `/welcome` (comme
   `/notifications`). `Promise.all` : `upcoming.mine({type})`, `upcoming.suggestions()`. Bloc
   lilas (`Card tone="accent"`, comme `/discover`) : titre et phrase. `LinkTabs` « Tout /
   Albums / EP / Singles » (`?type=`, `hrefWith`). Quatre groupes (`SectionHeading`), chacun
   caché s'il est vide. Sans suivi : phrase d'invitation. « Tes artistes les plus écoutés »
   (`ArtistFollowButton`), cachée si vide. En bas : « Une sortie manque ? Signale-la depuis la
   fiche de l'artiste. » `generateMetadata` : titre, `noindex`.
5. **Rangée** `components/upcoming/UpcomingRow.tsx` : `CoverThumb`, titre lié, artistes liés,
   date, badge « Date modifiée », `WantToListenButton` (client, nouveau : `useListen` avec un
   état minimal, `wantToListenAction`, même clé que la fiche). Pas de carte entière en lien.
6. **Fiche artiste** : `upcoming.byArtist` appelé une fois l'artiste trouvé (sinon
   `missingCatalogPage`, pas d'erreur 500) ; section « À venir » au-dessus de la discographie,
   `ReleaseTile` avec une prop optionnelle `detail` (la date à la place de l'année) ; cachée
   si vide. Pour un membre, toujours (même sans « À venir ») : « Une sortie manque ? » +
   `CatalogReportButton` (props `defaultType="addition"` et libellé).
7. **Fiche d'un disque à venir** : la ligne « Sorti le … » (`album.releasedOn` / `releasedIn`)
   devient « Sort le 21 novembre 2026 » / « Sort en novembre 2026 » / « Annoncé pour 2027 »
   (`formatReleaseDate`) + badge. `ListenControls` prop `notOut` : sans étoiles, « J'ai
   écouté », cœur, « Noter en détail », `ShelfPicker`, ni raccourcis clavier 1..5 / 0 / L ;
   le visiteur (`SignedOut`) sans étoiles. « À écouter » et « Ajouter à une liste » restent.
   `MyListensCard` caché, `cards` / `phoneCards` recalculés (pas de case vide, `InListsCard`
   visible sur téléphone). `album.reviewsEmpty` inchangé (écart noté).
8. **Réglages** : lien « Voir mes sorties à venir » dans la section « Sorties à venir ».
9. **e2e** `upcoming.spec.ts` : `throwawayReleases` étendu (artiste, date relative à
   aujourd'hui, précision, `announced_at`) — pas de dépendance au jour du seed. Visiteur
   redirigé ; membre qui suit l'artiste voit la sortie dans « Cette semaine », filtre
   `?type=ep` ; fiche artiste « À venir » (visiteur) ; fiche à venir sans « J'ai écouté »,
   « À écouter » marche.
10. **Docs et captures** : `decouverte.md` (écrans), `ecoute.md` (refus). Captures 1280 / 390
    dans `docs/pilote/captures/3/` : `/upcoming` avec et sans suivis, filtre actif, fiche
    artiste avec « À venir », fiche à venir au jour et à l'année. Mesure de `/upcoming`
    (première = référence, notée dans `jalon-11-en-cours.md`).

## Avancement

- [x] 1. Refus côté API
- [x] 2. Lectures
- [x] 3. Dates
- [x] 4. Page `/upcoming`
- [x] 5. Rangée
- [x] 6. Fiche artiste
- [x] 7. Fiche d'un disque à venir
- [x] 8. Réglages
- [x] 9. e2e
- [x] 10. Docs et captures
- [ ] vérifications
- [ ] relecture 1
- [ ] relecture 2
- [ ] clôture
