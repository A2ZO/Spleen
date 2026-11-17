# Plan — étape 4 : « Sortis un <jour mois> » sur `/discover`

Brief : `feuille-de-route.md`, « Étape 4 » (décisions actées). Accueil fait aux étapes 2 et 3.

## Existant vérifié

- `lib/memories.ts` : `sameDayInPastYears`, `isRoundAnniversary`, `roundAnniversarySql`,
  `toMemoryRelease`, `MemoryRow` ; `mainReleaseSql()` (`lib/catalog/upcoming`) ;
  `countsPublicly(userId)` (`lib/ratings`, SQL `not exists` sur `profiles.suspended_at`).
- Types `AnniversaryItem`, `MemoryRelease` (`types.ts:801-812`). Routeur `discovery` dans
  `root.ts` (`awaited: publicProcedure.query(({ ctx }) => awaitedReleases(ctx.db(), ctx.now))`).
- `/discover` : `Promise.all` de 8 lectures (l. 78), sections `awaited` (titre + `awaitedHint`)
  puis `recent` puis `top`. `MemoryGrid` (items `{ release, years, round }`),
  `formatDayMonth(format, day, today)` : `today = day` → jamais l'année.
- Démo `seed/memories.ts` : Suzanne (48_100), cœurs 60 jours sur A (10 ans), B (30 ans), C (7 ans),
  entrées 48_200+0..6 ; `db.test.ts` 64 / 19 / 87 ; test démo dans `memories.test.ts` (l. 505).
- e2e : `ThrowawayOptions.date` (`{ inDays }` | `"nextYear"`), `throwawayCatalog`,
  `throwawayMemories`, `memories.spec.ts` (Postgres seulement).

## Travail

1. **API** : `RELEASED_ON_THIS_DAY_MIN_MEMBERS = 2`, `RELEASED_ON_THIS_DAY_MAX = 6` ;
   type `ReleasedOnThisDay = { day: string; items: AnniversaryItem[] }` (exporté par `@spleen/api`) ;
   `releasedOnThisDay(db, now)` : `todayIn(DEFAULT_TIME_ZONE, now)`, liste de jours, une requête
   partant de `releases` (`release_date in (…)`, précision `day`, `mainReleaseSql()`), jointure
   `user_item_state s on s.release_id = r.id and (s.rating is not null or s.liked) and
   countsPublicly(s.user_id)`, `group by r.id having count(distinct s.user_id) >= 2` (jamais
   d'agrégat de toute la table) ; tri membres desc, date asc, titre, id ; `limit 6` ; artistes
   en `json_agg … order by ra.position`). Liste vide (1900) → `{ day, items: [] }`.
   Procédure `discovery.releasedOnThisDay` (`publicProcedure`, sans entrée, sans `viewerOf`).
2. **Tests** `memories.test.ts` (PGlite, `now` fixe) : tous les cas du brief (2 retenus / 1 exclu,
   suspendu, note/cœur vs écouté/« À écouter », journal privé, principal, mois exclu, année en
   cours exclue, fusionné, tri + 6 max, minuit Paris `2026-11-17T23:30:00Z` → 18, avec un membre
   America/Los_Angeles (encore le 17) et un membre aveugle qui reçoivent la même réponse que le
   visiteur ; 29 février ; un aller-retour). Tri : chaque critère (membres, date, titre, id)
   testé avec deux disques à égalité sur les précédents.
3. **Textes** : `discover.onThisDayTitle` (« Sortis un {day} » / « Released on {day} »),
   `discover.onThisDayHint` (FR/EN du brief).
4. **Écran** : lecture dans le `Promise.all` ; section `aria-labelledby="on-this-day"` entre
   `recent` et `top`, `SectionHeading`, hint au style d'`awaitedHint`, `MemoryGrid` avec
   `years`/`round` ; pas de section si `items` vide.
5. **Démo** : `deuxiemeface` (« Gaspard », 48_101, compte et profil comme Suzanne, **aucune
   écoute datée**, aucune note), cœurs à 60 jours
   sur A et B (entrées 48_200+7, +8), `recomputeItemState` + `updatedAt` comme Suzanne ;
   `db.test.ts` 19→20 profiles, 87→89 entries ; test démo : `releasedOnThisDay` = B, A (pas C) ;
   snapshot `feed-loading` inchangé ; `pnpm db:seed` sur Neon `dev`.
6. **e2e** : `ThrowawayOptions.date` + `{ yearsAgo }` (jour de Paris, précision `day`, sans
   `announcedAt`) ; `throwawayFans(testInfo, slug, count)` (comptes `e2e-<id>f<i>`, profil fini,
   cœur à 40 jours, `recomputeItemState`) ; deux tests dans `memories.spec.ts` (80 ans / 3 fans
   présent avec « 80 ans aujourd'hui » ; 12 ans / 1 fan absent).
7. **EXPLAIN** une fois sur Neon `dev` (script jetable dans le scratchpad, jamais commité) :
   `releases_release_date_idx` et `user_item_state_release_uidx` utilisés, durée au journal.

## Vérifications

`pnpm check` ; `memories.spec` ; snapshot inchangé ; e2e complet via `verificateur`. Build de
prod : specs sans compte + `overflow.spec`. axe AA `/discover` visiteur et `nuitblanche`
(1280/390). Captures idem après `pnpm db:seed`. `measure.mjs` complet, deux passages ;
« profil → /discover » dans les 20 ms, sinon A/B `origin/dev` / HEAD.

## Avancement

- [x] API
- [x] tests API
- [x] textes
- [x] écran
- [x] démo + `db.test.ts` + test démo + `db:seed`
- [ ] e2e
- [ ] EXPLAIN
- [ ] vérifications
- [ ] relecture 1
- [ ] relecture 2
- [ ] clôture
