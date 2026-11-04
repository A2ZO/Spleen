# Jalon 12 « Douceurs » — en cours (reprise de session)

Document de passation : une nouvelle session reprend le jalon 12 à partir d'ici, **sans rien
redemander**. Branche `feat/12-douceurs` (créée depuis `main` à jour). Une étape par
fonctionnalité (CLAUDE.md, « Milestones »). À supprimer à la fin du jalon (`/fin-de-jalon`),
une fois son contenu reporté dans `CLAUDE.md` et les docs de domaine.

## Avancement

| Étape | Contenu | État | Commits |
| --- | --- | --- | --- |
| 0 | Vitesse de navigation : mesure, lectures en parallèle, préchargement, issue #24 | fait | `cd91de5` → `0b43c39` |
| 1 | À choisir par l'utilisateur (voir plus bas) | à faire | — |

État vérifié au commit `0b43c39` : `pnpm check` et suite e2e complète verte (vérificateur).
Branche poussée, pas encore de PR.

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

## À faire ensuite (reprise) : étape 1

Prompt prévu : « Lis CLAUDE.md puis docs/jalon-12-en-cours.md, et fais l'étape 1 ». Présenter
le plan avant de coder.

Questions ouvertes pour l'utilisateur (à poser d'abord) :

- **Quelle douceur pour l'étape 1 ?** Rien n'est encore choisi. Pistes notées pendant l'étape 0 :
  barre de navigation aussi pour les `router.push` (recherche, formulaires) ; relancer
  `measure.mjs` sur Neon de prod une fois `spleen-prod` en place (jalon 10).
- **PR de l'étape 0** : ouvrir une PR brouillon maintenant (et fermer #24), ou attendre la fin du
  jalon ?
