# Feuille de route du pilote — jalon 14 « Souvenirs »

Écrite par le conseiller d'Azzo le 17 novembre 2026. Le pilote (`/pilote`) fait une étape par
exécution, dans l'ordre, **sans s'arrêter entre les étapes**. Branche `feat/14-souvenirs`
(depuis `dev`, qui contient le jalon 13 depuis la fusion de la PR 46). Spécification : les
règles du conseiller dans `docs/pilote/decisions.md` (« Décidé par le conseiller »), tirées du
cahier des charges (section « Souvenirs (jalon 14) »). L'étape 1 traite le reste du jalon 13
décidé par Azzo le 17 novembre (bouton de l'accueil membre, suite de l'issue #31, déjà fermée
par la PR 46). Aucune issue à fermer.

**Décisions actées par le conseiller.** Chaque étape porte ses décisions déjà prises : elles
priment sur toute autre option, et le relecteur juge les plans d'après elles. Une question
qu'elles ne couvrent pas : l'option la plus prudente, notée dans `decisions.md`, sans s'arrêter.
« Attente » seulement pour ce qui est irréversible, ou touche aux données, à la sécurité ou à
l'argent, **et** que cette feuille de route ne prévoit pas.

## Cadre

- Nouvelle fonction : une colonne de réglage, deux procédures de lecture et une d'écriture, une
  section de l'accueil membre, une section des réglages, un bloc de `/discover`. Toute la logique
  dans `packages/api` (utilisable par l'appli Expo) ; pages et Server Actions ne font qu'appeler
  l'API. Aucun appel à MusicBrainz ni à ListenBrainz : tout vient de la base.
- Les souvenirs sont **calculés à la lecture** : rien n'est enregistré (ni historique, ni
  compteur, ni cache, ni table), aucune tâche de nuit, aucune notification, aucun email, aucun
  push.
- « Aujourd'hui » : fuseau du membre pour l'accueil (`profiles.time_zone`, repli
  Europe/Paris) ; jour de Paris pour `/discover`, lecture identique pour tous (issue #22), sans
  aucune donnée du lecteur.
- Dates : seulement des dates connues au jour près (jamais un jour inventé pour une date au mois
  ou à l'année), jamais d'heure, jour et mois en lettres dans la langue du lecteur.
- Migration : générée par `pnpm db:generate`, additive, seulement celle de « Autorisé à la
  fusion ». Jamais de suppression ni de réécriture de données existantes. Après la migration :
  `pnpm db:migrate` sur la base de dev (Neon `dev`), jamais ailleurs.
- Performance (pool postgres.js de 5 connexions) : **une seule requête SQL par bloc** (accueil :
  une pour les deux groupes ; `/discover` : une), lancée dans la première vague de la page ; pas
  de `loadReleaseCards` pour ces tuiles ; **aucun index nouveau** (les requêtes comparent les
  dates à une liste de jours calculée en JS, ce qui sert les index existants).
- Écrans : identité Lilas (`docs/design/README.md`) et composants existants ; aucun bloc lilas
  ajouté (un seul par page) ; jamais de carte ni de section vide ; pas de carte entière en lien
  (tuiles `ReleaseTile` existantes) ; AA (texte 4,5:1, non textuel 3:1) ; cibles de 44 px ;
  tout marche sans JavaScript ; pas de Suspense ni de `loading.tsx` ; pas d'`aria-pressed` sur
  un bouton dont le libellé change. Pas de maquette : s'inspirer de « Bientôt dans tes
  oreilles », des tendances et des blocs de `/discover`.
- Textes FR et EN dans `packages/i18n` (clés identiques), tutoiement, courts et doux ; aucune
  référence à Baudelaire dans les textes ajoutés.
- Données personnelles : seule nouveauté, la préférence `profiles.show_memories` ; elle part dans
  l'export (ligne `profiles` entière) et disparaît avec le compte (cascade). Textes légaux
  interdits dans ce jalon : la phrase de la politique de confidentialité est **proposée à Azzo
  dans la PR** (texte exact dans `decisions.md`) ; la politique inchangée est une décision
  actée, pas un manque à corriger.
- Démo : deux membres fictifs que personne ne suit et qui ne suivent personne, sans note ni
  critique (seulement des écoutes et des cœurs anciens) : ni les fils, ni les tendances, ni les
  mieux notés, ni `nuitblanche` ne bougent (étapes 3 et 4).
- Pas de service payant, pas de compte, pas de clé, pas de nouvelle dépendance, pas de nouvelle
  variable d'environnement, pas de changement de CSP, de `proxy.ts`, de connexion ni de
  workflow.

## Autorisé à la fusion

En fin de jalon, le pilote fusionne la PR dans `dev` (section 6 du skill) si elle ne touche, en
zone sensible, **que** ce qui suit. Toute autre chose sensible : « Attente ».

- Une seule migration additive générée (étape 2), avec exactement la colonne
  `profiles.show_memories` : `boolean`, non nulle, `true` par défaut (SQL attendu :
  `ALTER TABLE "profiles" ADD COLUMN "show_memories" boolean DEFAULT true NOT NULL;`). Aucun
  index, aucune autre colonne, aucune autre table, aucun type. Vont avec : l'ajout de
  `showMemories` à la table `profiles` dans `packages/db/src/schema/auth.ts` (seul changement de
  ce fichier) et les fichiers générés par `pnpm db:generate` (le `.sql` `0018_*`, qui suit
  `0017_lowly_silhouette.sql`, et `packages/db/migrations/meta/*`, passés à Prettier).
- `packages/db/src/seed/*` (nouveau `seed/memories.ts`, son appel dans `seed/seed.ts`) : pas une
  zone sensible.
- `packages/db/src/db.test.ts` : **autorisé explicitement**, dans le test « loads the demo
  dataset » seulement : les compteurs `releases`, `profiles` et `entries` augmentent du nombre
  exact de lignes ajoutées par `seed/memories.ts` (étape 3 : +6, +1, +7 ; étape 4 : +0, +1, +2),
  et un compteur des utilisateurs, s'il existe, comme `profiles` ; les autres compteurs restent
  identiques ; aucune assertion retirée ni affaiblie. C'est le seul fichier de `packages/db`
  permis hors du schéma, de la migration et du seed.
- Le snapshot `packages/api/src/__snapshots__/feed-loading.test.ts.snap` ne doit **pas** changer :
  la démo du jalon n'entre dans aucun fil. S'il change, c'est la démo qui est en cause (un
  abonnement, une critique ou une date récente) : la corriger ; jamais régénérer ce snapshot
  dans ce jalon.
- Mise à jour de sécurité de Next.js (étape 5, point 0) : dans `apps/web/package.json`, `next`
  de 16.4.2 à 16.4.5 (ou au dernier 16.4.x permis par `minimumReleaseAge`), avec les paquets
  `@next/*` et `eslint-config-next` au même numéro s'il y en a, et `pnpm-lock.yaml` mis à jour
  par `pnpm install`. Rien d'autre dans les dépendances : ni autre paquet, ni version mineure ou
  majeure.
- Hors zones sensibles et donc libres : `apps/web/e2e/*` (helpers compris),
  `apps/web/scripts/measure.mjs`, les docs.
- Interdit dans tous les cas : workflows (`.github/workflows/`), logique de connexion
  (`packages/auth`), `proxy.ts`, en-têtes de sécurité et CSP, variables d'environnement
  (`turbo.json`, `.env.example`), dépendances (`package.json`, `pnpm-lock.yaml`) hors la ligne
  Next.js ci-dessus, textes légaux
  (clés `legal.*` de `packages/i18n`, `LEGAL_UPDATED`, `TERMS_VERSION`), `.claude/`.

## Vérifications habituelles (à chaque étape)

- `pnpm check` ; les specs touchés ; puis l'e2e complet via le sous-agent `verificateur`. Jamais
  deux passes Playwright en même temps (le nettoyage global de l'une supprime les comptes de
  l'autre).
- Un test d'API (PGlite) pour chaque règle de l'étape ; la CI les rejoue sur Postgres. Dates
  maîtrisées : `now` passé à l'API (`createContext({ now, … })`, paramètre `now` des fonctions de
  `lib/`), jamais l'horloge de la machine dans un test d'API. Chaque règle « aujourd'hui » est
  testée avec deux fuseaux de part et d'autre de minuit (Europe/Paris et America/Los_Angeles).
- e2e : le serveur rend avec la vraie date (`page.clock` ne change rien au rendu serveur, comme
  au jalon 11, étape 5) : chaque test insère ses données par rapport au jour réel, dans le
  fuseau du compte (helpers de l'étape 3) ; aucun e2e ne dépend des dates de la démo.
- Démo : ses souvenirs suivent le jour du seed. Le jour des captures et des mesures,
  `pnpm db:seed` sur Neon `dev` d'abord (idempotent), dans la même journée de Paris.
- Quand l'étape change des écrans :
  - build de prod (`pnpm run free-port` d'abord ; Brevo, S3 et `CONTACT_EMAIL` en valeurs
    factices dans la commande seulement, jamais dans `.env`) : specs sans compte et
    `overflow.spec` ;
  - axe WCAG 2.2 AA à 1280 et 390 px sur les pages de l'étape : visiteur sur le build de prod ;
    membre sur le build de prod avec le compte de démo qui porte les données (`nuitblanche`, ou
    `vieuxsillons` pour les souvenirs, session via `MEASURE_STATE`), ou en dev avec un compte
    e2e jetable supprimé à la fin ;
  - `scripts/measure.mjs` sur le build de prod, deux passages : les pages déjà mesurées restent
    dans les 20 ms de la référence (`docs/jalon-14-en-cours.md`, « Mesures de référence ») ; en
    cas d'écart, A/B : build de prod de `origin/dev` puis de HEAD, mêmes parcours, même session,
    deux passages chacun, avec le `measure.mjs` de HEAD ; c'est l'A/B qui tranche ;
  - captures 1280 et 390 px dans `docs/pilote/captures/<n>/`, en visiteur et en membre quand la
    page change selon le cas, avec les données de démo (jamais une page vide faute de données).
- Un test qui échoue dans la passe complète et passe seul : commenter l'issue #34 et continuer ;
  jamais de relance en boucle.
- Connu, sans action (jalon 13) : sur le build de prod avec Brevo factice,
  `hydration.spec.ts:17` échoue toujours (il passe en dev) ; un `pnpm build` peut sortir en
  code 1 juste après l'avertissement de sécurité de Next 16.4.2, un second essai passe (Next
  monte à l'étape 5, point 0, pas avant) ; `pnpm start` se lance depuis `apps/web` ; sous Git Bash,
  `MSYS_NO_PATHCONV=1` devant `MEASURE_ONLY=/fr/…`.
- Tests existants et démo, deux cas seulement : (1) un test qui **compte** des lignes de la démo
  (`db.test.ts`, le seul trouvé par le conseiller) suit les ajouts, comme permis plus haut ; un
  autre test de comptage découvert en route suit la même règle (valeur suivie, ajouts seuls,
  noté dans `decisions.md`) ; (2) un test dont un **résultat ou un ordre** change à cause de la
  démo (recherche, suggestions, tendances, mieux notés, fils, profils de démo) : changer la démo
  (titre, artiste, date d'écriture), jamais le test.

## Étape 1 — Le bouton « Tire un disque au hasard » de l'accueil membre

Consignes : reste du jalon 13 décidé par Azzo le 17 novembre. Un lien, une clé de texte, un
e2e, une doc. Étape courte, sans migration ni API.

Décisions actées :

- **Où** : `apps/web/src/app/[locale]/page.tsx`, branche membre (`member` non nul), bloc lilas
  du haut. Le 2e bouton, aujourd'hui `ButtonLink href="/discover" variant="on-accent"` avec
  `home.findMusic` (« Trouver quoi écouter »), devient `ButtonLink href="/pick"
  variant="on-accent"` avec la clé à créer `home.pickRandom` : « Tire un disque au hasard »
  (EN « Pick a random record »). Même place (après `RateButton`), même style (`on-accent`,
  52 px), sans icône.
- **Accueil visiteur** (et compte sans profil, qui voit le même accueil) : inchangé, « Trouver
  quoi écouter » vers `/discover`. La clé `home.findMusic` reste.
- **Liste « À écouter » vide** : le bouton est toujours affiché ; `/pick` gère déjà ses quatre
  états (liste vide → phrase et « Découvrir des disques »). Aucune lecture de plus sur
  l'accueil (ni `toListen.pick`, ni compte de la liste).
- L'onglet « À écouter » de mon profil garde son bouton « Tire un disque ». En-tête, barre
  d'onglets et `/pick` inchangés. `/discover` reste joignable depuis l'accueil membre (en-tête,
  « Découvrir plus » des tendances, carte « Vient de sortir »).
- **Issue #31** : fermée par la PR 46, ne pas la rouvrir ; la PR du jalon dira « Suite de #31 :
  bouton de l'accueil membre, décidé par Azzo le 17 novembre ».
- **Docs** : `docs/quoi-ecouter.md` : « Accès » dit aussi « 2e bouton du bloc lilas de l'accueil
  membre (jalon 14, étape 1) » et la phrase « l'accueil reste inchangé » disparaît.
- **Tests** : aucun test d'API (l'API ne change pas). e2e dans `apps/web/e2e/pick.spec.ts` :
  compte jetable → sur `/fr`, le lien « Tire un disque au hasard » (`exact: true`) a pour cible
  `/fr/pick` ; le clic mène à la page « Tire un disque » avec la phrase de liste vide ;
  visiteur → ce lien est absent et « Trouver quoi écouter » mène à `/fr/discover`. Les
  sélecteurs « Tire un disque » existants prennent `exact: true` là où les deux libellés
  pourraient coexister.
- **Captures** : accueil `nuitblanche` et accueil visiteur, 1280 et 390. axe sur les deux.
  `measure.mjs` complet, deux passages (l'accueil change d'un lien).

## Étape 2 — Souvenirs de l'accueil : réglage et API

Consignes : migration, réglage côté API, `packages/api/src/lib/memories.ts` (à créer),
procédure `memories.home`, types, tests PGlite. Pas d'écran (étape 3). Après la migration :
`pnpm db:migrate` sur Neon `dev`.

Décisions actées :

- **Migration** (la seule du jalon) : voir « Autorisé à la fusion ». Schéma :
  `showMemories: boolean("show_memories").notNull().default(true)` dans la table `profiles`
  (`packages/db/src/schema/auth.ts`), à côté de `notifyReleases`, avec un commentaire.
- **Réglage côté API** : `account.setShowMemories({ enabled: boolean })`, `protectedProcedure`
  (compte suspendu refusé `ACCOUNT_SUSPENDED`), sur le modèle de `account.setNotifyReleases`
  (`setNotifyReleases`, `lib/catalog/artist-follows.ts`) : fonction `setShowMemories(db, userId,
  enabled)` dans `lib/account.ts` ; sans profil `PROFILE_REQUIRED` ; pas de limiteur, comme les
  autres réglages (`updateProfile`, `setNotifyReleases`). `MyProfile.showMemories` ajouté
  (`types.ts`, `getMe`). Export : la colonne part avec la ligne `profiles` (déjà lue entière par
  `exportAccount`) ; suppression du compte : cascade. Rien d'autre.
- **« Aujourd'hui » du membre** : `todayIn(fuseau, now)` avec fuseau = `profiles.time_zone` s'il
  passe `isTimeZone()`, sinon `DEFAULT_TIME_ZONE` ; `now` = `ctx.now`.
- **Jours** : `sameDayInPastYears(today, fromYear)` (pure, `lib/memories.ts`) renvoie, pour chaque
  année de `fromYear` à l'année de `today` − 1, la date `YYYY-MM-DD` du même mois et du même jour ;
  un 29 février n'existe que les années bissextiles (les autres sont sautées : un souvenir du
  29 février ne revient qu'un 29 février). `MEMORIES_FROM_YEAR = 1900` (même plancher que
  `LISTENED_ON_MIN` et `DISCOVERY_YEAR_MIN`). Les requêtes comparent `entries.listened_on` et
  `releases.release_date` à cette liste (`= any(…::date[])` ou `in (…)`) : index
  `entries_user_listened_idx`, `user_item_state_release_uidx`, `releases_release_date_idx`. Ni
  `to_char` ni `extract` sur ces colonnes dans un `where`, aucun index nouveau. Limite assumée :
  un disque sorti avant 1900 n'a pas d'anniversaire dans Spleen (comme les filtres d'année des
  mieux notés).
- **Groupe « Ce jour-là »** (`listens`) :
  - écoutes **datées** du membre (`listened_on` non nul ; jamais les écoutes sans date) de
    **disques** (`release_id` non nul ; ni morceaux ni artistes), dont le jour est dans la liste ;
  - **une seule année** : la plus récente qui en a (`max(listened_on)` de ces écoutes) ;
    `yearsAgo` = année d'aujourd'hui − année de ce jour ; les années plus anciennes ne sortent
    pas ce jour-là ;
  - une tuile par disque (plusieurs écoutes ou réécoutes du même disque ce jour-là n'en font
    qu'une) ; ordre : l'écoute de ce jour enregistrée le plus récemment d'abord
    (`max(entries.created_at)` décroissant), puis `releases.id` ; 6 au plus
    (`MEMORIES_LISTENS_MAX`) ;
  - exclus : disque fusionné (`merged_into_id` non nul) et disque redevenu « pas encore sorti »
    au jour du membre (`upcomingSql(today, false)`, `lib/catalog/upcoming.ts` : une date de
    sortie reportée après coup) ;
  - renvoie `{ day, yearsAgo, releases }`, ou null s'il n'y a rien.
- **Groupe « Anniversaires du jour »** (`anniversaries`) :
  - disques de l'**état actuel** du membre (`user_item_state`, `release_id` non nul) avec une note
    (`rating` non nul) **ou** un cœur (`liked`) ; ni « écouté » seul, ni « À écouter » ;
  - disque principal non fusionné (`mainReleaseSql()` : album, EP, single, mixtapes comprises ;
    ni live, ni compilation, ni bande originale, ni remix), date **au jour près**
    (`release_date_precision = 'day'`), jour dans la liste ;
  - `years` = année d'aujourd'hui − année de sortie, toujours ≥ 1 (sorti aujourd'hui même : ce
    n'est pas un anniversaire, c'est « Sortie aujourd'hui ») ;
  - `round` = `isRoundAnniversary(years)` : vrai pour 10, 20, 25, 30, 40, 50, puis chaque
    dizaine (60, 70…) et 75 ; règle écrite une fois en TS (constantes exportées) et l'expression
    SQL du tri construite à partir des mêmes constantes ;
  - ordre : ronds d'abord, puis `years` décroissant, puis titre, puis `releases.id` ; 6 au plus
    (`MEMORIES_ANNIVERSARIES_MAX`) ;
  - un disque peut figurer dans les deux groupes (écouté il y a un an le jour de son
    anniversaire) : gardé dans les deux.
- **Sans objet** (à dire dans la doc, pas de code) : écoute à l'aveugle (les tuiles n'ont aucun
  chiffre de la communauté), modération (ni critique ni liste montrée), fusion de comptes
  (n'existe pas), journal privé (le membre voit toujours ses propres souvenirs).
- **API** : nouveau routeur `memories`, procédure `memories.home()`, `publicProcedure` sans
  entrée (comme `upcoming.home`, pour être lancée avant `account.me`), → `HomeMemories | null`.
  Types à créer dans `packages/api/src/types.ts` :
  `MemoryRelease = Omit<ReleaseCard, "averageRating" | "ratingCount" | "ratingsHidden">`
  (« pas de chiffres de la communauté : ces blocs montrent une date, pas une note ») ;
  `AnniversaryItem = { release: MemoryRelease; years: number; round: boolean }` ;
  `HomeMemories = { today: string; listens: { day: string; yearsAgo: number; releases:
  MemoryRelease[] } | null; anniversaries: AnniversaryItem[] }`.
- **Rien à montrer** : null pour un visiteur, un compte suspendu, un compte sans profil, ou
  `show_memories` faux (dans ces cas, **aucune requête SQL** : tout se lit dans
  `ctx.account()`), et quand les deux groupes sont vides.
- **Une seule requête SQL** pour les deux groupes (`homeMemories(db, { id, timeZone }, now)`,
  `lib/memories.ts`) : deux sélections réunies par `union all`, qui renvoient aussi de quoi faire
  les tuiles (`slug`, `title`, `type`, `cover_url`, année de `release_date`, artistes `{ slug,
  name }` en `json_agg` trié par `release_artists.position`). Ni `loadReleaseCards`, ni
  `ratedIds`. La procédure coûte deux allers-retours : la lecture du compte (partagée avec
  `account.me`) puis cette requête. Rien n'est écrit.
- **Tests** `packages/api/src/memories.test.ts` (à créer ; PGlite vide, membres et disques du
  test, `now` fixe) :
  - `sameDayInPastYears` : jour ordinaire, 1er janvier, 31 décembre, 28 février, 29 février
    (seulement les années bissextiles, 1900 exclue), borne 1900 ;
  - `isRoundAnniversary` : vrai pour 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100 ; faux pour
    1, 5, 9, 15, 24, 26, 35, 45, 55, 65 ; et l'ordre SQL d'accord avec la fonction ;
  - « Ce jour-là » : écoute sans date exclue ; écoute de morceau exclue ; veille et lendemain
    exclus ; aujourd'hui même exclu ; 1 an et 3 ans → seulement 1 an ; seulement 3 ans →
    `yearsAgo` 3 ; même disque deux fois ce jour-là → une tuile ; ordre ; 6 au plus ; disque
    fusionné exclu ; disque dont la sortie est reportée après aujourd'hui exclu ; minuit :
    `now = 2026-11-17T23:30:00Z` → membre de Paris (déjà le 18) voit le 18 novembre 2025, membre
    de Los Angeles (le 17) le 17 novembre 2025 ; fuseau invalide en base → jour de Paris ;
  - « Anniversaires » : note seule et cœur seul retenus ; « écouté » seul et « À écouter »
    exclus ; précision au mois ou à l'année exclue (même si le jour stocké tombe juste) ; sorti
    aujourd'hui exclu ; date future exclue ; live et compilation exclus, mixtape retenue ;
    fusionné exclu ; ordre (ronds, puis `years`, puis titre) ; 6 au plus ; 29 février :
    `now` le 29 février 2028 → disque du 29 février 2004 à 24 ans, `now` le 28 février 2027 → rien ;
    minuit comme plus haut ;
  - null : visiteur, compte suspendu, sans profil, réglage coupé, rien à montrer ;
  - `account.setShowMemories` : bascule, `account.me().profile.showMemories`, export
    (`data.profile.showMemories`), suspendu → `ACCOUNT_SUSPENDED`, sans profil →
    `PROFILE_REQUIRED` ;
  - allers-retours (PGlite seulement, `it.skipIf(process.env.TEST_DATABASE_URL)`, mesure copiée
    de `trackRoundTrips` de `feed-loading.test.ts`, un contexte par requête) : `memories.home`
    = 2 ; réglage coupé = 1.
- Pas de captures, d'axe ni de mesures (aucun écran ne change).

## Étape 3 — Souvenirs de l'accueil : écrans, réglages et démo

Consignes : section de l'accueil membre, composant de tuiles, section des réglages, démo
`packages/db/src/seed/memories.ts` (à créer), `MEASURE_EMAIL` dans `measure.mjs`, e2e,
captures, mesures.

Décisions actées :

- **Lecture** : `memoriesRead = cache(async () => (await getApi()).memories.home())` dans
  `apps/web/src/app/[locale]/page.tsx`, lancée en tête de `HomePage` avec `discoveryReads(lang)`
  et `upcomingRead()` (`.catch(() => {})`), avant `account.me` : même vague (sinon +36 à
  +60 ms). Pour un visiteur, elle répond null sans requête SQL.
- **Place** : accueil membre seulement, section pleine largeur juste après « Bientôt dans tes
  oreilles » (`<Soon />`) et avant les tendances (`<Trends />`). Accueil visiteur inchangé.
- **Structure** : composant serveur `Memories({ username })` dans la page :
  `<section aria-labelledby="memories" className="scroll-mt-24">`, `SectionHeading
  id="memories"` « Souvenirs » (`memories.title`), sans action ; puis un ou deux groupes,
  `space-y-10`, chacun un `div` avec un `h3` (`mb-4 font-display text-xl font-bold
  tracking-[-0.02em]`, comme les sous-titres des réglages) :
  1. `memories.listened` (« Il y a un an, tu écoutais… » / « Il y a N ans, tu écoutais… ») ;
     tuiles sans ligne d'âge ; sous la grille, le lien « Ouvrir ce mois dans mon journal »
     (`memories.diaryLink`) vers `hrefWith(\`/u/${username}/diary\`, { view: "calendar", month:
     listens.day.slice(0, 7) })`, en `mt-4 inline-flex min-h-11 items-center text-sm text-link
     underline-offset-2 hover:underline` ;
  2. `memories.anniversaries` (« Anniversaires du jour ») ; tuiles avec la ligne d'âge.
  Un groupe vide n'est pas rendu ; `memories.home` null → aucune section. Les tuiles gardent le
  `h3` de `ReleaseTile` (composant existant, comme dans les tendances) ; les e2e existants qui
  lisent la région « Bientôt dans tes oreilles » ne sont pas touchés (la section vient après).
- **Tuiles** : composant serveur à créer `apps/web/src/components/memories/MemoryGrid.tsx`,
  prop `items: { release: MemoryRelease; years?: number; round?: boolean }[]` : `ul` à la grille
  des tendances (`grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6`) ; chaque `li` =
  `ReleaseTile` existant (pochette, titre lié à la fiche, « Artistes · année »), à qui on passe
  la carte complétée par `averageRating: null, ratingCount: 0` (il ne dessine alors aucune
  étoile ; `ReleaseTile` ne change pas) ; puis, si `years` est donné, une ligne
  `mt-1 font-mono text-xs` avec `memories.age` : `text-fg-muted`, ou `font-semibold text-star`
  quand `round` (mise en avant par la couleur et l'ordre ; le texte dit déjà l'âge, la couleur
  n'est pas seule porteuse de sens ; texte lilas comme l'étiquette de `JustOutCard` ; ni badge,
  ni bloc lilas). Réutilisé à l'étape 4.
- **Textes** (clés à créer, FR / EN) :

  | Clé | FR | EN |
  | --- | --- | --- |
  | `memories.title` | Souvenirs | Memories |
  | `memories.listened` | `{years, plural, one {Il y a un an, tu écoutais…} other {Il y a # ans, tu écoutais…}}` | `{years, plural, one {One year ago, you were listening to…} other {# years ago, you were listening to…}}` |
  | `memories.diaryLink` | Ouvrir ce mois dans mon journal | Open that month in my diary |
  | `memories.anniversaries` | Anniversaires du jour | Anniversaries today |
  | `memories.age` | `{years, plural, one {# an aujourd'hui} other {# ans aujourd'hui}}` | `{years, plural, one {# year old today} other {# years old today}}` |
  | `settings.memoriesTitle` | Souvenirs | Memories |
  | `settings.showMemories` | Afficher mes souvenirs sur l'accueil | Show my memories on the home page |
  | `settings.showMemoriesHint` | « Il y a un an, tu écoutais… » et les anniversaires de tes disques. | “One year ago, you were listening to…” and your records’ anniversaries. |

  Guillemets et apostrophes comme dans les fichiers (FR « … », EN “…” et ’).
- **Réglages** (`/settings`) : nouvelle `Section id="memories"` « Souvenirs » juste après
  « Sorties à venir » (`releases`), avant « Compte ». Composant à créer
  `apps/web/src/components/account/MemoriesForm.tsx`, sur le modèle de `NotifyReleasesForm` :
  formulaire `useActionState`, `Checkbox name="showMemories"` cochée selon
  `profile.showMemories`, libellé `settings.showMemories`, aide `settings.showMemoriesHint`,
  bouton secondaire « Enregistrer », messages `settings.saved` et `errors.*`. Server Action à
  créer `setShowMemoriesAction` dans `apps/web/src/app/[locale]/settings/actions.ts` (renvoie
  `FormState`, appelle `account.setShowMemories({ enabled: formData.get("showMemories") === "on"
  })`, puis `refresh()` de `next/cache`). Marche sans JavaScript. Le réglage masque toute la
  section de l'accueil, rien d'autre (« Sortis un … » de `/discover` reste : c'est public).
- **Démo** `packages/db/src/seed/memories.ts` (plage d'identifiants 48_000+, idempotente,
  appelée après `seedPick` dans `seed.ts`) :
  - membre `vieuxsillons`, nom affiché « Suzanne », `vieuxsillons@example.test`, locale `fr`,
    fuseau `Europe/Paris`, réglage vrai, inscrite 800 jours avant le seed ; elle ne suit
    personne, personne ne la suit ; aucune note, critique, liste ni Étagère ;
  - six disques inventés, artistes de démo déjà pris par `seed/pick.ts` (jamais `lune-basse` ni
    `odette-marchal`), titres sans les mots que tapent les tests de recherche (« lune »,
    « pluie », « vitre », « béton », « velours », « nocturnes », « zinzolin », « quokka ») :
    A « Harbour Postcards » (album, `theo-brightwater`), sorti le jour du seed il y a 10 ans ;
    B « Les jours ralentis » (album, `quartet-sepia`), il y a 30 ans ; C « Petit matin, gare de
    l'Est » (EP, `nora-vidal`), il y a 7 ans ; D « Carnet de bord » (album, `kassim`,
    2011-04-08) ; E « Paper Boats » (single, `juniper-hale`, 2018-06-29) ; F « Amber Hours »
    (album, `dee-marlowe`, 2009-02-13). Tous au jour près, sans `mbid` ;
  - Suzanne : cœurs sur A, B et C (écoutes sans date, `liked`, sans note) ; D écouté deux fois il
    y a un an jour pour jour (la 2e en réécoute), E une fois il y a un an jour pour jour, F une
    fois il y a deux ans jour pour jour (il ne doit pas apparaître : l'année la plus récente
    gagne) ;
  - dates de A, B, C et jours d'écoute recalculés à chaque seed depuis le jour du seed à Paris
    (`onConflictDoUpdate`, comme `seed/upcoming.ts` et `seed/friends.ts`) ; un 29 février, chaque
    écart passe au multiple de 4 supérieur (1 → 4, 2 → 4, 7 → 8, 10 → 12, 30 → 32) ;
  - écoutes datées : `created_at` = `updated_at` le jour de l'écoute, à 20 h et 21 h UTC pour les
    deux de D, 22 h UTC pour E, 21 h UTC pour F (ordre lisible : E puis D) ; cœurs :
    `created_at` = `updated_at` = 60 jours avant le seed (hors tendances à 7 et 30 jours, hors
    suggestions à 30 jours) ; `recomputeItemState` après chaque écriture ; **aucune piste** (comme
    le disque sans pistes de `seed/pick.ts` : rien d'autre ne bouge dans l'inventaire) ;
  - lignes comptées par `db.test.ts` : +6 `releases`, +1 `profiles`, +7 `entries` (et le
    compteur des utilisateurs, s'il existe, de +1 comme `profiles`) : seul changement permis de
    ce fichier, voir « Autorisé à la fusion » ;
  - test d'API sur la démo (dans `memories.test.ts`, `seed(db, { now })` avec un `now` fixe) :
    pour Suzanne, « Il y a un an » avec E puis D (une tuile pour D), sans F ; anniversaires
    B (30, rond), A (10, rond), C (7, pas rond) ;
  - avant de coder, vérifier qu'aucun test ni e2e ne lit ces artistes, ces titres ou ces
    pseudos ; sinon appliquer les deux cas des vérifications habituelles ;
  - `pnpm db:seed` sur Neon `dev`.
- **`measure.mjs`** : variable `MEASURE_EMAIL` (défaut `nuitblanche@example.test`, comportement
  inchangé sans elle) ; le lien de l'outbox est cherché avec la partie de l'adresse avant `@`.
  Une ligne dans `docs/environnement.md` (« Mesurer la navigation »).
- **Helpers e2e** (`apps/web/e2e/helpers.ts`) : `throwawayMemories(testInfo, username, {
  listenedYearsAgo, heartedYearsAgo })` (à créer ; null sur PGlite) : lit le fuseau du compte,
  calcule son jour réel, crée des disques jetables (`e2e-<id>-<n>`, sans `mbid`, sans artiste,
  au jour près) : le premier (date de sortie quelconque) reçoit une écoute datée du même jour
  `listenedYearsAgo` ans plus tôt ; puis un disque par valeur de `heartedYearsAgo`, sorti le même
  jour `n` ans plus tôt, avec un cœur (écoute sans date, sans note) ; `created_at` et
  `updated_at` à 40 jours, puis `recomputeItemState` ; renvoie titres et âges. Les e2e prennent
  des écarts multiples de 4 (4, 12, 20), valables même un 29 février.
- **e2e** `apps/web/e2e/memories.spec.ts` (à créer, Postgres seulement) :
  - compte jetable, `throwawayMemories(…, { listenedYearsAgo: 4, heartedYearsAgo: [20, 12] })` →
    région « Souvenirs » : « Il y a 4 ans, tu écoutais… » et le titre écouté ; « Anniversaires du
    jour », « 20 ans aujourd'hui » avant « 12 ans aujourd'hui » ; le lien du journal mène au
    calendrier du bon mois ;
  - le même accueil sans JavaScript (contexte sans JS avec la même session, comme
    `pick.spec.ts`) montre la section ;
  - réglage décoché dans la région « Souvenirs » de `/fr/settings`, « Enregistrer », « C'est
    enregistré. » → plus de section sur `/fr` ;
  - compte jetable sans souvenirs → pas de section ; visiteur → pas de section ;
  - sur téléphone (390 px, bloc « on a phone » comme `pick.spec.ts`) : pas de débordement de
    l'accueil avec souvenirs.
- **Captures** : accueil de `vieuxsillons` (les deux groupes) 1280 et 390 ; accueil de
  `nuitblanche` (sans section, sauf hasard du jour) ; accueil visiteur (inchangé) ; section
  « Souvenirs » des réglages. Le cas « réglage coupé » est couvert par l'e2e ; ne jamais laisser
  le réglage de `vieuxsillons` coupé.
- **axe** : accueil de `vieuxsillons` et réglages, 1280 et 390.
- **Mesures** : `measure.mjs` complet (`nuitblanche`), deux passages, contre la référence ; et
  A/B de l'accueil avec souvenirs : `MEASURE_EMAIL=vieuxsillons@example.test`, builds de prod de
  `origin/dev` puis de HEAD dans la même session, deux passages chacun : l'écart du parcours
  « /discover → accueil » reste dans les 20 ms ; les chiffres de HEAD deviennent la référence de
  cet accueil (`docs/jalon-14-en-cours.md`).
- **Si un écart de plus de 20 ms persiste** après l'A/B (accueil ici, `/discover` à l'étape 4) :
  `EXPLAIN (ANALYZE)` de la requête sur Neon `dev` (méthode de `docs/pieges.md`) ; un index non
  utilisé ou une requête lente se corrige dans la requête, jamais par un index nouveau. Si la
  requête est rapide et l'écart reste, troisième passage A/B ; s'il reste encore : mesures et
  `EXPLAIN` notés dans `decisions.md`, question pour Azzo dans la PR, et le jalon continue (rien
  d'irréversible).

## Étape 4 — « Sortis un <jour mois> » sur `/discover`

Consignes : API, bloc de `/discover`, démo (2e membre), tests, e2e, captures, mesures, une
vérification `EXPLAIN` sur Neon `dev`.

Décisions actées :

- **Règle** : disques principaux non fusionnés (`mainReleaseSql()`), date au jour près, même mois
  et même jour qu'**aujourd'hui à Paris** (`todayIn(DEFAULT_TIME_ZONE, now)`), d'une année passée
  (même liste `sameDayInPastYears`, depuis 1900 ; `years` ≥ 1 : l'année en cours est exclue),
  avec au moins **2 membres distincts** (`RELEASED_ON_THIS_DAY_MIN_MEMBERS`) qui ont une note ou
  un cœur dans leur état actuel (`user_item_state`) ; comptes suspendus exclus
  (`countsPublicly`). Les journaux privés comptent, comme dans les moyennes (agrégat anonyme :
  ni nom ni nombre affiché) ; les blocages ne filtrent pas (comme les tendances).
- **Tri** : nombre de membres décroissant, puis date de sortie la plus ancienne, puis titre,
  puis `releases.id` ; 6 au plus (`RELEASED_ON_THIS_DAY_MAX`). `years` et `round` comme à
  l'accueil (même `isRoundAnniversary`). 29 février : même règle stricte.
- **Lecture identique pour tous** (issue #22) : aucune donnée du lecteur (ni aveugle, ni « À
  écouter ») ; tuiles `MemoryRelease` sans chiffres de la communauté.
- **API** : `discovery.releasedOnThisDay()`, `publicProcedure` sans entrée → type à créer
  `ReleasedOnThisDay = { day: string; items: AnniversaryItem[] }` (`day` = jour de Paris) ;
  fonction `releasedOnThisDay(db, now)` dans `lib/memories.ts` ; **une seule requête SQL** (liste
  de jours sur `releases_release_date_idx`, `user_item_state` par `release_id`, artistes en
  `json_agg`) : un aller-retour.
- **Écran** (`apps/web/src/app/[locale]/discover/page.tsx`) : la lecture rejoint le
  `Promise.all` existant ; section `aria-labelledby="on-this-day"` placée juste après « Sorties
  récentes » et avant « Les mieux notés » ; `SectionHeading id="on-this-day"` avec
  `discover.onThisDayTitle` (« Sortis un {day} » / EN « Released on {day} ») où `day` =
  `formatDayMonth(format, data.day, data.day)` (jour et mois en lettres, jamais l'année, `format`
  de `getFormatter()`) ; dessous `discover.onThisDayHint` dans le style de `awaitedHint`
  (« Les disques que les membres aiment, sortis ce jour-là les années passées. » / EN « Records
  members love, released on this day in years past. ») ; puis `MemoryGrid` avec la ligne d'âge.
  `items` vide → pas de section (comme « Les plus attendus »). Visiteur et membre voient la même
  chose.
- **Démo** (`seed/memories.ts`) : membre `deuxiemeface`, nom affiché « Gaspard »,
  `deuxiemeface@example.test`, mêmes règles que Suzanne (ne suit personne, suivi par personne,
  aucune note ni critique, cœurs datés de 60 jours) : cœurs sur A et B. Au jour du seed, A et B
  ont 2 membres et sortent sur `/discover` (B puis A) ; C, un seul membre, n'y est pas.
  `db.test.ts` : +1 `profiles`, +2 `entries`. Le test de la démo vérifie
  `discovery.releasedOnThisDay` (B, A ; pas C).
- **Tests** (`memories.test.ts`, PGlite, `now` fixe) : 2 membres retenu, 1 exclu ; deux membres
  dont un suspendu → exclu ; note ou cœur comptés, « écouté » seul et « À écouter » non ;
  journal privé compté ; principal seulement ; précision au mois exclue ; année en cours
  exclue ; fusionné exclu ; tri et 6 au plus ; minuit à Paris (`now = 2026-11-17T23:30:00Z` → jour
  du 18) ; 29 février ; même réponse pour un visiteur et pour un membre en écoute à l'aveugle ;
  un aller-retour (PGlite seulement).
- **Helpers e2e** : `ThrowawayOptions.date` accepte `{ yearsAgo: number }` (même jour à Paris, `n`
  ans plus tôt, au jour près, sans `announcedAt`) ; `throwawayFans(testInfo, releaseSlug,
  count)` (à créer) insère `count` membres jetables (`e2e-<id>f<i>@example.test`, pseudo
  `e2e_<id>f<i>`, supprimés par le nettoyage global) avec un cœur ancien (40 jours) sur ce
  disque, puis `recomputeItemState`.
- **e2e** (dans `memories.spec.ts`) : visiteur, disque jetable sorti il y a 80 ans avec **3** fans
  (pour passer devant les disques à 2 membres de la base de dev, dont ceux de la démo) → région
  « Sortis un … » avec son titre et « 80 ans aujourd'hui » ; disque jetable sorti il y a 12 ans
  avec 1 fan → absent de la région. Si la base de dev a déjà 6 disques du jour à 3 membres ou
  plus, le premier cas échoue sans faute du code : le noter (issue #34), ne pas changer la règle.
- **`EXPLAIN`** une fois sur Neon `dev` : `releases_release_date_idx` utilisé, durée notée dans le
  journal. Pas de test d'`EXPLAIN` (sur une petite base, Postgres peut préférer un parcours
  complet).
- **Captures** : `/discover` visiteur et `nuitblanche`, 1280 et 390, le jour du seed. **axe** sur
  les deux. **Mesures** : `measure.mjs` complet, deux passages ; « profil → /discover » dans les
  20 ms (règle d'écart de l'étape 3).

## Étape 5 — La passe finale

0. **Next.js 16.4.5** (décidé par le conseiller le 17 novembre, avec l'accord d'Azzo) : les
   correctifs de sécurité publiés par Next.js le 3 novembre (sept failles, corrigées en 16.4.5).
   Premier commit de l'étape, seul : `next` (et `@next/*`, `eslint-config-next` s'il y en a) au
   même numéro exact, `pnpm install`, `pnpm check`, un `pnpm build` ;
   `chore(deps): bump next to 16.4.5 (security)`. Si `minimumReleaseAge` refuse 16.4.5, prendre
   le dernier 16.4.x permis qui est au moins 16.4.5 ; s'il n'y en a aucun, renoncer, le noter dans
   `decisions.md` et continuer (pas d'attente). Une régression : la corriger dans le code de
   Spleen ; sinon revenir à 16.4.2 et le noter. Les vérifications du point 5 couvrent la mise à
   jour (l'A/B des mesures compare `origin/dev`, encore en 16.4.2, à HEAD).
1. Doc du domaine `docs/souvenirs.md` (à créer, 90 lignes au plus) : règles retenues des trois
   blocs et du réglage, cas sans objet, données (migration, rien d'enregistré d'autre, export,
   suppression), API (`memories.home`, `discovery.releasedOnThisDay`, `account.setShowMemories`,
   `lib/memories.ts`, une requête par bloc, listes de jours), écrans (`MemoryGrid`, section de
   l'accueil, réglages, `/discover`), démo (`seed/memories.ts`, re-seed le jour des captures),
   e2e (données relatives au jour réel), bouton de l'étape 1, points ouverts.
2. Renvois d'une ligne vers `docs/souvenirs.md` depuis `docs/ecoute.md`, `docs/decouverte.md`,
   `docs/profil-stats.md` et `docs/accounts.md` (liste des réglages de `/settings`).
3. `docs/cahier-des-charges.md` : dans la section du jalon 14, « Fini le … » et une ligne cochée
   « - [x] Souvenirs : règles retenues par le conseiller le 17 novembre et livrées au jalon 14 :
   … (`docs/souvenirs.md`) » ; ligne 5 (mise à jour) ; puce du jalon 14 dans la liste des jalons
   finis ; roadmap (phase 1 : 13 et 14 faits, puis 10) ; la puce du jalon 13 dit aussi « et le
   2e bouton de l'accueil membre (jalon 14) » ; dans « Questions ouvertes », « - [ ] Politique de
   confidentialité : ajouter les souvenirs aux réglages (phrase proposée dans la PR du
   jalon 14) ».
4. `docs/stack-et-limites.md` § 3 : « Mesure : souvenirs (jalon 14) », trois lignes (une requête
   par bloc, aucun index, mesures finales).
5. Captures 1280 et 390 de tous les écrans du jalon (re-seed le jour même), visiteur et membre ;
   axe, `overflow.spec`, e2e complet en dev, specs sans compte sur le build de prod,
   `measure.mjs` complet (`nuitblanche`), `MEASURE_ONLY=/fr/pick` contre 142 ms, et l'accueil de
   `vieuxsillons` contre sa référence de l'étape 3 ; écart → A/B `origin/dev` / HEAD dans la
   même session.
6. `CLAUDE.md` : jalon 14 coché en une ligne (renvoi `docs/souvenirs.md`) et retiré de la liste
   à faire ; ordre « 10 (launch) → 15 → 16 » ; `docs/souvenirs.md` dans les docs de domaine ;
   `vieuxsillons` (souvenirs) dans la liste de la démo ; décision « Memories: computed at read
   time from dated listens and the current state, nothing stored; member's day on the home page,
   Paris day on /discover, one query per block ». Rien d'autre.
7. Puis la fin de jalon du pilote (sections 5 et 6 du skill) : PR `feat/14-souvenirs` → `dev`
   (« Suite de #31 » ; proposition de phrase pour la politique de confidentialité, telle que
   dans `decisions.md` ; Next.js monté au point 0 (version prise) ; points ouverts hors jalon :
   503 de MusicBrainz avant les artistes, fiches e2e jetables de Neon `dev`) ; avant la
   fusion, `git diff --stat origin/dev...HEAD` comparé à « Autorisé à la fusion » ; fusion dans
   `dev` si tout tient, puis PR de release `dev` → `main` en brouillon, que fusionne Azzo.
