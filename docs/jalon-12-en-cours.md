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
| plus tard | Barre de navigation aussi pour les navigations lancées par le code (`router.push` / `replace`) | à faire | — |

État vérifié à la fin de l'étape 1 : `pnpm check` et suite e2e complète verte (vérificateur).
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
  reduced-motion, rien sans JS. Ne couvre que les `Link`, pas les `router.push`.
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

## Reste à traiter (hors étape 1)

- **Issue [#27](https://github.com/A2ZO/Spleen/issues/27), avant l'ouverture publique** : la
  popularité (`count(distinct user_id)` dans `packages/api/src/lib/catalog/match.ts`) est calculée
  en direct, jusqu'à 30 sous-requêtes par type à chaque requête qui atteint le serveur. 23 à 30 ms
  sur la base dev, mais avec 78 lignes dans `user_item_state` : la mesure ne dit rien de la charge
  réelle. Compteur à tenir à jour à l'écriture ou par la tâche de nuit (à trancher dans l'issue).

## Appris à l'étape 1

- Un `pnpm dev` resté actif sur le port 3000 coïncide avec un e2e tué sans sortie (code 137) ;
  port libre, la suite passe. Cause non prouvée : vérifier le port avant de lancer le e2e.
- Pour un `EXPLAIN ANALYZE` de la requête exacte : passer à `suggestCatalog` un faux `Db` qui
  capture le `sql`, puis l'exécuter préfixé par `explain (analyze, buffers)`.

## Étape suivante

Le jalon 12 n'a pas de liste écrite au-delà de l'étape 1 : **la prochaine étape reste à choisir
par l'utilisateur**. Candidat noté : barre de navigation pour `router.push` / `replace`
(`components/layout/NavigationBar.tsx`, `lib/navigation-progress.ts`, voir étape 0). Présenter un
plan avant de coder. Reprendre sur `feat/12-douceurs`, PR brouillon #26.
