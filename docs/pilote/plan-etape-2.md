# Plan — étape 2 « Alimentation de nuit et lectures »

Pas d'écran. Doc ListenBrainz vérifiée (16 nov.) : paramètres `release_date`, `days` ≤ 90,
`past`, `future` ; réponse `payload.releases[]`, en-têtes `X-RateLimit-*`.

1. **Migration** (`schema/catalog.ts`, `pnpm db:generate`, `pnpm db:migrate` sur Neon dev) :
   `releases.announced_at`, `releases.release_date_changed_at`, `timestamptz` nullables.
2. **Client ListenBrainz** `packages/catalog/src/listenbrainz.ts` :
   `createListenBrainzClient({ userAgent, fetch? }).freshReleases(releaseDate)` (`days=90`,
   `past=false`, `future=true`), réponse validée par Zod ; `Remaining` à 0 → attend
   `Reset-In`, au-delà de 60 s ou en cas d'erreur (HTTP, délai 30 s, JSON) →
   `CatalogError("unavailable")`. Fixture réduite rejouée par `createReplayFetch`, tests du client.
3. **Suivi des dates** `lib/catalog/release-dates.ts`, une expression SQL partagée :
   - `announced_at` : rempli une fois, si le premier jour de la période (date au mois ou à
     l'année stockée au 1er) est après le jour UTC du passage ; jamais réécrit ;
   - `release_date_changed_at` : si `announced_at` existe et que la nouvelle date sort de la
     période de l'ancienne (comparée à la précision la plus grossière des deux) : « 2027 » →
     « 2027-03-14 » est une précision ajoutée, pas un changement ;
   - utilisée par `writeReleaseGroup`, `insertStubs`, et par `refreshArtistDiscography` pour les
     groupes connus, mais seulement s'ils ont un `announced_at` ou si l'ancienne ou la nouvelle
     date est après aujourd'hui (jamais de réécriture des dates passées).
4. **Passage de nuit** (`scripts/refresh-catalog.ts` + `lib/catalog/upcoming-feed.ts`, date en
   paramètre) :
   a. ListenBrainz ; erreur notée dans la sortie, la suite continue ;
   b. rapprochement par `artists.mbid` des artistes suivis seulement (le reste ignoré).
      MusicBrainz reste la seule source de date (ListenBrainz donne la date d'une édition) :
      groupe inconnu → `importReleaseGroup` ; groupe connu (fusion suivie) dont la date
      ListenBrainz diffère → relecture du groupe sur MusicBrainz (`getReleaseGroup`), fiche
      gardée, date appliquée par le point 3 ;
   c. fiches incomplètes (`tracklist_imported_at` nul) des sorties à venir d'artistes suivis →
      `importReleaseGroup`. b + c : 40 appels par nuit au plus ;
   d. `artistsToRefresh` : artistes suivis en tête (suiveurs décroissants), même règle des 7
      jours, même plafond de 150 ; ordre du reste inchangé.
5. **Règle partagée** `lib/catalog/upcoming.ts` : `mainReleaseSql()` (repris par
   `recentReleases`) et `upcomingSql(today)` : jour > today ; mois > mois en cours, ou mois en
   cours avec `announced_at` ; année > année en cours, ou en cours avec `announced_at` ; jamais
   au-delà de today + 12 mois (année : la suivante au plus) ; non fusionnée, disque principal,
   album / ep / single. `recentReleases` ajoute `and not upcoming` (jour de Paris).
6. **Lectures tRPC** (routeur `upcoming`) :
   - `mine({ type? })` (protégée) : `todayIn(profiles.time_zone)`, artistes suivis via
     `release_artists` ; groupes `week` / `month` / `later` / `tba` en JS selon la consigne ; tri
     date puis titre ; 200 au plus ; élément `{ release: ReleaseCard, date, precision,
     dateChanged, group }` ;
   - `byArtist({ slug })` (publique, Europe/Paris, identique pour tous) : 20 au plus, par date ;
     artiste fusionné suivi, inconnu → `NOT_FOUND`.
7. **Démo** (`seed/upcoming.ts` après `seedDiscovery`, ids `fixtureId(45_xxx)`) : `nuitblanche`
   suit 3 artistes, `vinylvince` 2 (un en commun) ; 6 sorties aux titres inventés, sans `mbid`
   (comme tous les artistes de la démo : le vrai passage ne les relit pas), dates recalculées à
   chaque seed (J+3, J+10, mois prochain au jour, M+2 au mois, année suivante, une avec
   `release_date_changed_at`), toutes avec `announced_at`. Puis `pnpm db:seed` et un vrai
   `pnpm catalog:refresh` sur Neon dev (résultat au journal).
8. **Docs** : `catalogue.md`, `decouverte.md`, ligne « validé par Azzo » de `jalon-11-en-cours.md`.

Tests d'API (PGlite, date en paramètre, sans réseau) : `announced_at` (jour futur ; mois en cours
vu la première fois → rien ; mois suivant → rempli et reste à venir pendant ce mois) ; changement
contre précision affinée ; dates passées jamais réécrites ; ListenBrainz ≠ MusicBrainz sur deux
passages → aucun second changement ; artiste non suivi ignoré ; erreur ListenBrainz sans arrêt ;
plafond de 40 ; ordre de la file ; règle par précision, 12 mois, groupes, filtre, 200, passage
aux récentes, `byArtist` identique visiteur / membre.

## Avancement

- [x] 1. Migration
- [x] 2. Client ListenBrainz
- [x] 3. Suivi des dates
- [x] 4. Passage de nuit
- [x] 5. Règle partagée
- [x] 6. Lectures tRPC
- [x] 7. Démo
- [x] 8. Docs
- [x] vérifications
- [x] relecture 1
- [ ] relecture 2
- [ ] clôture
