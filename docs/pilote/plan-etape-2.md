# Plan — étape 2 : souvenirs de l'accueil, réglage et API

Brief : `feuille-de-route.md`, « Étape 2 » (décisions actées). Pas d'écran.

## Données existantes vérifiées

- `profiles` (`packages/db/src/schema/auth.ts`) : `timeZone`, `notifyReleases` (modèle du réglage).
- `entries` : `user_id`, `release_id`, `track_id`, `listened_on` (date), `created_at` ; index
  `entries_user_listened_idx (user_id, listened_on desc)`.
- `user_item_state` : `user_id`, `release_id`, `rating`, `liked` ; `user_item_state_release_uidx`.
- `releases` : `slug`, `title`, `type`, `release_date`, `release_date_precision`, `cover_url`,
  `merged_into_id`, `secondary_types` ; `releases_release_date_idx`. `release_artists.position`.
- `todayIn`, `isTimeZone`, `DEFAULT_TIME_ZONE` (`@spleen/validators`) ; `mainReleaseSql()`,
  `upcomingSql(today, false)` (`lib/catalog/upcoming.ts`) ; `rowsOf()` ; `fail()`.
- `ctx.account()` : ligne `profiles` entière (`account.profile`), suspension ; `getMe` construit
  `MyProfile` depuis elle ; `exportAccount` exporte la ligne `profiles` entière.
- Modèles : `upcoming.home` (`publicProcedure`, null sans requête), `setNotifyReleases`,
  tests de `artist-follows.test.ts` (codes d'erreur), `trackRoundTrips` de `feed-loading.test.ts`.

## Travail

1. **Migration** : `showMemories: boolean("show_memories").notNull().default(true)` après
   `notifyReleases`, avec un commentaire ; `pnpm db:generate` → `0018_*.sql` (vérifier qu'il vaut
   exactement l'`ALTER TABLE` attendu), Prettier sur `meta/*` ; `pnpm db:migrate` (Neon `dev`).
2. **Réglage** : `setShowMemories(db, userId, enabled)` dans `lib/account.ts` (comme
   `setNotifyReleases` : `PROFILE_REQUIRED` sans profil) ; `account.setShowMemories`
   (`protectedProcedure`, `z.object({ enabled: z.boolean() })`) ; `MyProfile.showMemories`
   (`types.ts`) et `getMe`.
3. **Types** (`types.ts`) : `MemoryRelease`, `AnniversaryItem`, `HomeMemories` comme le brief.
4. **`lib/memories.ts`** :
   - constantes `MEMORIES_FROM_YEAR = 1900`, `MEMORIES_LISTENS_MAX = 6`,
     `MEMORIES_ANNIVERSARIES_MAX = 6`, `ROUND_ANNIVERSARIES = [10, 20, 25, 30, 40, 50, 75]`,
     `ROUND_EVERY_DECADE_FROM = 50` ;
   - `sameDayInPastYears(today, fromYear)` (pure ; 29 février → années bissextiles seulement) ;
   - `isRoundAnniversary(years)` et `roundAnniversarySql(yearsExpr)` bâtie sur les mêmes
     constantes (`years in (…) or (years > 50 and years % 10 = 0)`) ;
   - `homeMemories(db, { id, timeZone }, now)` : jour du membre (`isTimeZone` sinon Paris),
     liste des jours passée par `in (${sql.join(days.map((d) => sql\`${d}::date\`), sql\`, \`)})`
     (jamais un tableau JS en `::date[]`) ; si la liste est vide → null sans requête ;
     **une requête** `union all`, chaque groupe dans une sous-requête entre parenthèses avec son
     `order by … limit 6`, `releases r` joint dans chacun (alias de `mainReleaseSql` /
     `upcomingSql`) :
     - `listens` : CTE des écoutes datées de disques du membre (`listened_on in (…)`,
       `release_id` non nul) **déjà filtrées** (disque non fusionné, `not upcomingSql(today,
       false)`) avant `max(listened_on)` (une année dont tous les disques sont exclus laisse
       sortir la précédente) ; groupée par disque (`max(created_at)`) ; ordre
       `max(created_at) desc, id` ; limite 6 ;
     - `anniversaries` : `user_item_state` du membre (`rating is not null or liked`), disque
       `mainReleaseSql()`, précision `day`, `release_date in (…)` ; `years` en SQL ; ordre
       rond d'abord, `years desc`, titre, id ; limite 6 ;
     - colonnes communes : groupe, rang (`row_number()` dans l'ordre du groupe), jour, `slug`,
       `title`, `type`, `cover_url`, année, artistes `json_agg(json_build_object('slug','name')
       order by position)` en sous-requête ;
   - lignes **triées en TS par (groupe, rang)** (`union all` ne garde pas l'ordre) →
     `HomeMemories` (`listens` null si vide ; `round` par `isRoundAnniversary`) ; null si les
     deux groupes sont vides.
5. **Routeur** `memories: router({ home })` dans `root.ts` : `publicProcedure`, null si pas de
   compte, suspendu, sans profil ou `showMemories` faux (lu dans `ctx.account()`, sans requête).
6. **Tests** `packages/api/src/memories.test.ts` : tous les cas du brief (fonctions pures, deux
   groupes, minuit Paris / Los Angeles, fuseau invalide, 29 février, nulls, réglage et export,
   erreurs, allers-retours 2 et 1 sur PGlite via `trackRoundTrips` copiée). En plus (relecture) :
   l'année la plus récente n'a que des disques exclus → l'année d'avant sort ; un même disque
   dans les deux groupes y reste ; membre sans souvenir → null (pas un objet vide) ; export lu
   comme `artist-follows.test.ts:224` (`exported.profile.showMemories`).

## Vérifications

`pnpm check` ; `memories.test.ts` seul puis la suite ; snapshot `feed-loading` inchangé ;
e2e complet via `verificateur` (la colonne ne change aucun écran). Pas de captures, d'axe ni de
mesures (aucun écran ne change).

## Avancement

- [x] migration `show_memories` (+ `db:migrate` Neon `dev`)
- [x] réglage `account.setShowMemories`, `MyProfile.showMemories`
- [x] types
- [x] `lib/memories.ts`
- [x] routeur `memories.home`
- [x] tests `memories.test.ts`
- [x] vérifications
- [x] relecture 1 (OK, aucune correction)
- [x] relecture 2 (sans objet)
- [x] clôture
