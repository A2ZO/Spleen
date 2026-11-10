# Jalon 12 « Douceurs » — en cours (reprise de session)

Document de passation : une nouvelle session reprend le jalon 12 à partir d'ici, **sans rien
redemander**. Branche `feat/12-douceurs` (créée depuis `main` à jour). Une étape par
fonctionnalité (CLAUDE.md, « Milestones »). À supprimer à la fin du jalon (`/fin-de-jalon`),
une fois son contenu reporté dans `CLAUDE.md` et les docs de domaine.

## Avancement

| Étape | Contenu | État | Commits |
| --- | --- | --- | --- |
| 0 | Vitesse de navigation : mesure, lectures en parallèle, préchargement, issue #24 | fait | `cd91de5` → `0b43c39` |
| 1 | Recherche instantanée : suggestions dans l'en-tête et `/search`, route JSON cacheable | fait | voir `git log` (commit `feat(search)`) |
| 2 | Réactions instantanées : like, suivre, cœur, « À écouter », note rapide, « J'ai écouté » | fait | voir `git log` (commits `feat(reactions)`) |
| 3 | Barre de navigation pour les navigations par le code (`useNavigate`) | fait | voir `git log` |
| 4 | « Annuler » au lieu des confirmations de suppression | fait | voir `git log` |

État vérifié à la fin de l'étape 4 : `pnpm check` et suite e2e complète verte (vérificateur).
Jalons 13 à 16 planifiés (`004ab40`) ; ordre : 12 → 11 → 13 → 14 → 10 → 15 → 16.
Branche poussée ; PR brouillon [#26](https://github.com/A2ZO/Spleen/pull/26) (« Closes #24 »),
réutilisée par `/fin-de-jalon`.

## Étape 0 : ce qui a été fait

- **Mesure** : `apps/web/scripts/measure.mjs` + trace SQL de dev (`SPLEEN_QUERY_TRACE`,
  `packages/db/src/trace.ts`, route `api/trace-debug`), mode d'emploi dans
  `docs/environnement.md`, résultats dans `docs/stack-et-limites.md` (§ « Mesure : vitesse de
  navigation »). Gains (build de prod local, affichage de la page) : accueil → album 351 → 267 ms,
  album → artiste 227 → 133 ms, artiste → profil 343 → 229 ms, profil → discover 248 → 211 ms,
  discover → accueil 263 → 219 ms ; vagues SQL en série divisées par 2 à 3.
- **Lectures** : profil de l'appelant lu une fois par requête ; lectures indépendantes lancées
  ensemble et partagées avec `generateMetadata` (`cache`) ; `me()` ne fait plus de requête (date
  de renommage lue seulement sur `/settings`) ; accueil et discover ne chargent que ce qu'ils
  affichent ; discographie limitée à 12 par groupe, « Tout voir (n) » par `?all=<groupe>` sans JS.
- **Préchargement** : liens à l'intention (survol, focus), liens de l'en-tête à la vue
  (`i18n/link.tsx`) : 4 ou 5 préchargements par page au lieu de 17 à 46.
- **Barre de navigation** (`components/layout/NavigationBar.tsx`, `lib/navigation-progress.ts`) :
  `useLinkStatus` dans le Link de next-intl, barre `bg-star` après 150 ms, fixe sous
  reduced-motion, rien sans JS. Navigations par le code : étape 3 (`useNavigate`).
- **Issue #24** : texte tapé avant l'hydratation gardé (`useTypedBeforeHydration()`, intégré à
  `TextField` et `SearchBox`), e2e `hydration.spec.ts`. Issue à fermer avec la PR.

## Décisions prises

- Squelettes `loading.tsx` **abandonnés** (`aa0846f`) : React retient l'affichage 300 ms après
  un fallback Suspense (pages plus lentes : 327 à 365 ms) et la page reste bloquée sans JS. Les
  layouts ne vérifient plus l'existence des fiches ; e2e sur les 404 et le vrai 308 de fusion.
- Pool postgres.js laissé à `max: 5`.
- Issue #22 et CSP non touchées (jalon 10).

## Appris en route

- `loading.tsx` / Suspense : +300 ms et page bloquée sans JS → `docs/pieges.md`.
- `useLinkStatus` marche dans un enfant du `Link` de next-intl (il enveloppe celui de Next).
- Le dédoublonnage de session de Better Auth par requête marchait déjà (2 requêtes) : mesurer
  avant de corriger.
- Ne pas lancer `pnpm start` depuis la racine (le lancer depuis `apps/web`) ; tuer les `next`
  restés actifs avant un build (`taskkill`).

## Étape 1 : ce qui a été fait

- Suggestions instantanées (`SearchCombobox`, en-tête, plein écran mobile, `/search`) servies par
  `GET /api/search/suggest` (anonyme, cache CDN 60 s, limiteur mémoire par IP). Règles :
  `docs/catalogue.md` « Recherche instantanée » ; coût : `docs/stack-et-limites.md` § 3.
- Affichage dernière frappe → résultats : ≈ 300 → 133 ms (build de prod local).
- `SearchBox.tsx` supprimé ; `/search` n'est rendue qu'à la validation ; `remote=1` lance la
  recherche MusicBrainz. Même ordre (préfixe → popularité → similarité) sur la page complète.
- Tests : `suggest.test.ts`, `memory-rate-limit.test.ts`, e2e `instant-search.spec.ts`,
  `catalog.spec.ts` et `hydration.spec.ts` adaptés.
- Mise en ligne : règle de cache Cloudflare à ajouter (`docs/mise-en-ligne.md` § 11).
- Contrôles demandés en fin d'étape : `q` normalisé dans le navigateur (une seule URL en cache) ;
  aucune langue dans l'URL, car la réponse ne contient aucun texte traduit (libellés traduits
  côté navigateur) ; un 429 garde les dernières suggestions, sans message, et la frappe suivante
  réessaie. Déjà codés ; tests ajoutés dans `instant-search.spec.ts`.

## Étape 2 : ce qui a été fait

- File d'écriture commune `apps/web/src/lib/use-instant-writes.ts` (état par clé, partagé par
  tous les boutons du même objet) : affichage au clic, 350 ms de regroupement par champ, double
  clic = aucune requête, une requête à la fois, retour en arrière + message `errors.<code>` dans
  `components/ui/ReactionStatus.tsx` (`aria-live="polite"`, toujours monté). Règles :
  `docs/ecoute.md` § « Réactions instantanées », `docs/social.md` § « Likes et commentaires ».
- `LikeButton`, `FollowButton` (+ `FollowerCountLink` dans l'en-tête du profil), `ListenControls`
  (sans `useOptimistic`, `order` des notes rapides gardé). `album.actions.error` supprimé.
- `@spleen/api/instant` : `applyListenWrite`, copie pure des règles du serveur ;
  `MyItemState.quickFallback` (note du journal quand on retire la note rapide, lue dans la même
  vague que `myState`).
- Correctif : le layout `[locale]` importe `listening/actions` et `social/actions` (action
  envoyée après une navigation interne = postée à la nouvelle page, `docs/pieges.md`).
- Tests : `instant.test.ts` (copie client = serveur, 20 cas), e2e `reactions.spec.ts` (retenue,
  500, regroupement, requête en cours, rechargement ; vrais 429 / suspendu / bloqué) ; aides
  `holdActions`, `failActions`, `trackActions`, `actionAnswered`, `exhaustRateLimit`,
  `suspendInDatabase` dans `e2e/helpers.ts` ; `social.spec.ts` et `shelf.spec.ts` attendent la
  réponse de l'action.

## Décisions de l'étape 2

- Pas de règle partagée client/serveur : le serveur dérive l'état des écoutes en base. D'où la
  copie pure + test de comparaison ; toute nouvelle règle d'état passe dans les deux.
- « J'ai écouté » reste désactivé pendant son envoi (chaque clic crée une écoute).
- Limites assumées : fermer l'onglet ou recharger dans les 350 ms perd la réaction ; moyenne et
  nombre de notes des fiches, compteurs des onglets abonnés / abonnements bougent à la
  confirmation.

## Appris à l'étape 2

- Un e2e qui clique puis fait `page.goto` / `reload()` perd l'écriture (350 ms) : attendre
  `actionAnswered(page)`.
- Libellé qui change de largeur : deux `click()` plutôt que `dblclick()`.
- Next transfère une action inconnue de la page courante ; en dev, réponse `{}` 200 sans rien
  enregistrer. Trouvé en suivant la requête POST vers `/fr/artist/...`.

## Étape 3 : ce qui a été fait

- `apps/web/src/i18n/use-navigate.ts`, exporté par `@/i18n/navigation` à la place de
  `useRouter` : `useNavigate()` → `push` / `replace` dans une transition dont l'attente alimente
  la barre (même délai de 150 ms, même aspect, même reduced-motion que les liens) ; `refresh` et
  `prefetch` sans barre ; `assign` = chargement complet (connexion par code), barre retirée au
  `pageshow` ou après 10 s. `useNavigationWhile(pending)` pour les actions qui finissent par
  `redirect()` (la page cible arrive dans la réponse de l'action) : bienvenue, suppression du
  compte, import MusicBrainz, fusion admin, réglages quand la langue change.
- Jamais bloquée : la transition finit quand la page arrive, échoue ou est remplacée ; le
  nettoyage de l'effet ferme aussi au démontage.
- Règle ESLint (`apps/web/eslint.config.mjs`) : `useRouter` interdit hors du hook.
- `SignOutButton` reçoit `href="/"` (le routeur next-intl ajoute la langue).
- e2e `navigation.spec.ts` : push retardé (barre puis plus de barre), push remplacé par un lien.

## Décisions de l'étape 3

- Même délai (150 ms), même aspect et même reduced-motion que pour les liens ; rien pour
  `refresh()`.
- Une action qui redirige montre la barre pendant toute l'action (on ne sait pas d'avance si
  elle redirigera) ; seulement pour les actions dont le succès redirige, et pour les réglages
  seulement si la langue change.
- Lien magique et Google : chargements complets hors de notre code, pas de barre.

## Appris à l'étape 3

- Dans `page.route`, préférer un prédicat sur `url.pathname` à un glob contenant `?`.
- Test de mutation (barre débranchée dans le hook) : l'e2e « slow push » échoue bien.

## Étape 4 : ce qui a été fait

- Store `apps/web/src/lib/use-undoable-delete.ts` (module, survit aux navigations internes) et
  bandeaux `components/layout/UndoBanners.tsx` ; `UndoableGate` cache `ListCard` / `ReviewCard`
  (composants serveur) ; `<li className="empty:hidden">` autour d'eux.
- Listes (`ListForm`, `DeleteListDialog` retiré), critiques (`ReviewEditForm`), commentaires
  (`Comments`), écoutes (`LogDialog` → `ListenControls`, `DiaryList`).
- `MyReview` porte sa `target` (portée de la suppression d'une critique).
- `<main id="main" tabIndex={-1}>` : cible du focus quand l'élément caché l'emporte.
- Clés i18n `undo.*` ; anciennes clés de confirmation retirées.
- e2e `undo-delete.spec.ts` : 16 tests (×2 projets).

## Décisions de l'étape 4

- Suppression différée côté navigateur, 8 s, un bandeau par suppression (3 au plus) ; blocage,
  compte et modération gardent leur confirmation. Règles : `docs/social.md`.
- Écriture sur le même objet pendant le délai → la suppression part d'abord (`flushScope`).
- Limites assumées : compteurs serveur et état de la fiche à jour à la fin du délai.

## Appris à l'étape 4

- `page.clock.install()` avant la première page laisse le temps couler ; `pauseAt` (heure lue
  dans la page) juste avant la suppression, puis `runFor` : délais déterministes. Une
  réaction (350 ms) ne part ensuite qu'avec un `runFor`.
- Les liens « Modifier » des cartes ont un nom accessible complété (« Modifier (titre) »).
- Captures Chrome faites (sombre ordinateur, clair mobile) : en dev, le bouton « N » de Next
  chevauche le coin gauche du bandeau sur mobile (dev seulement).
- Dans le vérificateur, lancer l'e2e via Bash en `PLAYWRIGHT_CHANNEL=chrome pnpm e2e:quiet`
  (la syntaxe `$env:` est mangée par Bash).

## Reste à traiter

- **Issue [#27](https://github.com/A2ZO/Spleen/issues/27), avant l'ouverture publique** : la
  popularité (`count(distinct user_id)` dans `packages/api/src/lib/catalog/match.ts`) est calculée
  en direct, jusqu'à 30 sous-requêtes par type à chaque requête qui atteint le serveur. 23 à 30 ms
  sur la base dev, mais avec 78 lignes dans `user_item_state` : la mesure ne dit rien de la charge
  réelle. **Décidé** : compteur recalculé par la tâche de nuit, avec une commande pnpm pour le
  recalculer en dev, lancée aussi par le seed (la tâche de nuit ne tourne qu'en production).
  Reporté au jalon 10 dans `CLAUDE.md`.

## Appris à l'étape 1

- Un `pnpm dev` resté actif sur le port 3000 coïncide avec un e2e tué sans sortie (code 137) ;
  port libre, la suite passe. Cause non prouvée : vérifier le port avant de lancer le e2e.
- Pour un `EXPLAIN ANALYZE` de la requête exacte : passer à `suggestCatalog` un faux `Db` qui
  capture le `sql`, puis l'exécuter préfixé par `explain (analyze, buffers)`.

## Étapes restantes

Dans cet ordre, une étape par session, un plan présenté avant de coder. Reprendre sur
`feat/12-douceurs`, PR brouillon #26.

5. Noter au clavier (1 à 5, L pour le cœur). Point de départ : `components/release/ListenControls.tsx`
   (note rapide, cœur, file `lib/use-instant-writes.ts`, `flushScope` avant chaque écriture) et
   le curseur « Ta note » (déjà au clavier quand il a le focus : flèches, Fin). Questions à poser
   avant de coder : raccourcis globaux sur la page d'un disque ou seulement quand le panneau
   « Ton écoute » a le focus ; 1 à 5 = étoiles entières, et les demi-étoiles (Maj+chiffre ?) ;
   0 ou Retour arrière pour retirer la note ; ignorés quand on tape dans un champ ; aide visible
   (« ? ») ou seulement dans l'aide aux lecteurs d'écran ; conflits avec les raccourcis du
   navigateur et des lecteurs d'écran (lettres seules à éviter ?).
6. Transitions de page douces.

Puis `/fin-de-jalon`.
