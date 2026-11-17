# Plan — étape 3 : souvenirs de l'accueil, écrans, réglages et démo

Brief : `feuille-de-route.md`, « Étape 3 » (décisions actées). API faite à l'étape 2.

## Existant vérifié

- Accueil (`[locale]/page.tsx`) : `discoveryReads` / `upcomingRead` (`cache`) lancées avant
  `account.me` ; `<Soon />` puis `<Trends />` ; `hrefWith`, `SectionHeading`. `ReleaseTile` sans
  étoile si `averageRating` null ; grille des tendances (`discovery/Charts.tsx`).
- `/settings` : `Section` `releases` puis `account` ; `NotifyReleasesForm`, `Checkbox` avec
  `hint`, `FormState` / `errorCode` (`settings/actions.ts`).
- Démo : artistes de `seed/pick.ts` dans `fixtures` ; compte, `parisDay`, écoutes en
  `onConflictDoUpdate` et `recomputeItemState` dans `seed/friends.ts`. `db.test.ts` : releases
  58, profiles 18, entries 80 (pas de compteur `user`). Aucun test ne lit les noms prévus.
- e2e : `onDevDatabase`, `userIdOf`, `throwawayCatalog`, `todayIn` ; `recomputeItemState`
  exporté par `@spleen/db`. `measure.mjs` : adresse fixe, outbox filtrée sur « nuitblanche ».

## Travail

1. **Textes** : 8 clés FR/EN du brief (`memories.*`, `settings.memoriesTitle`,
   `settings.showMemories`, `settings.showMemoriesHint`).
2. **`MemoryGrid`** (`components/memories/MemoryGrid.tsx`, serveur) : `ul` à la grille des
   tendances, `ReleaseTile` avec `averageRating: null, ratingCount: 0`, ligne d'âge
   `memories.age` (`text-fg-muted`, ou `font-semibold text-star` si rond).
3. **Accueil** : `memoriesRead = cache(...)` lancée avec les deux autres (`.catch`), composant
   `Memories({ username })` entre `<Soon />` et `<Trends />` (section, `SectionHeading`
   `id="memories"`, `h3` par groupe, lien du journal `view=calendar&month=YYYY-MM`). Rien si
   null ; un groupe vide n'est pas rendu.
4. **Réglages** : `setShowMemoriesAction` (`settings/actions.ts`, `refresh()`),
   `MemoriesForm` (modèle `NotifyReleasesForm`, `hint`), `Section id="memories"` après
   `releases`.
5. **Démo** `seed/memories.ts` (48_000+) exactement comme le brief (Suzanne `vieuxsillons`,
   6 disques A–F, 3 cœurs à 60 jours, 4 écoutes datées, règle du 29 février, sans piste) ;
   `seedMemories(tx, now)` (le `now` du seed) ; compte complet comme `seed/friends.ts`
   (`emailVerified`, âge et conditions `TERMS_VERSION`, profil fini) ; un 29 février, F passe à
   8 ans (relecture : sinon il rejoint D et E à 4 ans) ; appel après `seedPick` ; 
   `db.test.ts` 58→64, 18→19, 80→87 ; test de la démo dans
   `memories.test.ts` (E puis D, sans F ; B 30 rond, A 10 rond, C 7) ; `pnpm db:seed` Neon `dev`.
6. **`measure.mjs`** : `MEASURE_EMAIL` (défaut `nuitblanche@example.test`), filtre outbox sur la
   partie avant `@` ; une ligne dans `docs/environnement.md`.
7. **e2e** : `throwawayMemories` dans `helpers.ts` (fuseau du compte, disques jetables au jour
   près, le disque écouté sorti le 2000-01-01 (jamais « à venir »), écoute datée, cœurs, `created_at`/`updated_at` à 40 jours, `recomputeItemState`) ;
   `memories.spec.ts` (Postgres seulement) : les cas du brief (groupes et ordre, lien du
   journal, sans JS, réglage coupé, compte sans souvenirs, visiteur, 390 px sans débordement).

## Vérifications

`pnpm check` ; `memories.spec` et specs de l'accueil/réglages touchés ; snapshot `feed-loading`
inchangé ; e2e complet via `verificateur`. Build de prod : specs sans compte + `overflow.spec`.
axe AA (accueil `vieuxsillons`, réglages ; 1280/390). Captures du brief. Mesures : complet
`nuitblanche` contre la référence, A/B accueil `vieuxsillons` (`origin/dev` / HEAD) ; les chiffres de HEAD deviennent sa référence
dans `docs/jalon-14-en-cours.md`. Écart > 20 ms après l'A/B : `EXPLAIN (ANALYZE)` sur Neon `dev`,
correction dans la requête (jamais d'index), sinon 3e passage, puis note dans `decisions.md`.

## Avancement

- [x] textes
- [x] `MemoryGrid`
- [x] accueil
- [x] réglages
- [x] démo + `db.test.ts` + test démo + `db:seed`
- [x] `measure.mjs`
- [x] e2e
- [x] vérifications
- [ ] relecture 1
- [ ] relecture 2
- [ ] clôture
