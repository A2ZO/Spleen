# Jalon 14 « Souvenirs » — passation

Faire revenir sans rien demander, à partir de ce que le membre a déjà noté : « Il y a un an, tu
écoutais… » et les anniversaires de ses disques sur l'accueil, « Sortis un <jour mois> » sur
`/discover`. Spécification : règles du conseiller du 17 novembre dans `docs/pilote/decisions.md`
(« Décidé par le conseiller »), tirées du cahier des charges (section « Souvenirs (jalon 14) »).
Consignes de chaque étape : `docs/pilote/feuille-de-route.md`. Branche `feat/14-souvenirs`,
depuis `dev`. L'étape 1 traite le reste du jalon 13 décidé par Azzo (bouton de l'accueil).

## Contraintes (rappel)

- Toute la logique dans `packages/api`, utilisable par l'appli Expo. Aucun appel à MusicBrainz ni
  à ListenBrainz. Souvenirs calculés à la lecture : rien d'enregistré, aucune tâche de nuit,
  aucune notification, aucun email.
- « Aujourd'hui » : fuseau du membre sur l'accueil (repli Europe/Paris) ; jour de Paris sur
  `/discover`, lecture identique pour tous (issue #22). Dates au jour près seulement, jamais
  d'heure ; un 29 février ne revient qu'un 29 février.
- Une seule migration, générée et additive : `profiles.show_memories` (« Autorisé à la
  fusion ») ; `pnpm db:migrate` sur Neon `dev`.
- Une seule requête SQL par bloc, lancée dans la première vague ; aucun index nouveau (listes
  de jours sur les index existants). Pool Postgres de 5 connexions.
- Identité Lilas (`docs/design/README.md`) : aucun bloc lilas ajouté, jamais de section vide,
  AA (texte 4,5:1, non-texte 3:1, cibles de 44 px), marche sans JavaScript ; pas de Suspense,
  pas de `loading.tsx`, pas de transitions de page.
- Seule donnée nouvelle : la préférence `show_memories` (export, suppression du compte).
  Politique de confidentialité inchangée : phrase proposée à Azzo dans la PR. Pas de nouvelle
  dépendance, variable d'environnement, CSP ni workflow.
- Démo : `vieuxsillons` et `deuxiemeface`, suivis par personne et ne suivant personne, sans note
  ni critique ; `pnpm db:seed` sur Neon `dev` le jour des captures et des mesures. Seul
  `db.test.ts` (inventaire, ajouts seuls) peut suivre ; le snapshot `feed-loading` ne change pas.

## Étapes

1. **Le bouton de l'accueil membre** (reste du jalon 13) : le 2e bouton du bloc lilas devient
   « Tire un disque au hasard » → `/pick` ; accueil visiteur inchangé.
2. **Souvenirs de l'accueil : réglage et API** : migration `show_memories`,
   `account.setShowMemories`, `lib/memories.ts`, `memories.home` (une requête), tests PGlite.
3. **Souvenirs de l'accueil : écrans, réglages et démo** : section « Souvenirs », `MemoryGrid`,
   section des réglages, `seed/memories.ts`, `MEASURE_EMAIL`, e2e, captures, mesures.
4. **« Sortis un <jour mois> » sur `/discover`** : `discovery.releasedOnThisDay`, bloc, 2e membre
   de démo, tests, e2e, `EXPLAIN`, mesures.
5. **La passe finale** : `docs/souvenirs.md`, renvois, cahier, `docs/stack-et-limites.md`,
   captures, axe, mesures, `CLAUDE.md`, puis fin de jalon.

## Où on en est

- Jalon préparé par le conseiller le 17 novembre. **Prochaine : étape 1.**

## Mesures de référence

- `measure.mjs` (fin du jalon 13, étape 6 : build de prod, `nuitblanche`, médianes de 6, A/B
  dans la même session, HEAD `d806eee`, plus haut des deux passages) : accueil → album 215,
  album → artiste 132, artiste → profil 216, profil → `/discover` 180, `/discover` → accueil
  223 ms. Référence par page : **215 / 132 / 216 / 180 / 223 ms**. Une page déjà mesurée ne doit
  pas prendre plus de 20 ms ; en cas d'écart, A/B `origin/dev` / HEAD dans la même session (au
  jalon 13, un premier passage à +20 ms venait de la machine : `origin/dev` 214/134/220/180/226
  contre HEAD 215/132/216/180/223).
- Pour mémoire, l'ancienne référence (fin du jalon 11) : 215 / 136 / 231 / 182 / 228 ms.
- `/pick` (`MEASURE_ONLY=/fr/pick`, build de prod, `nuitblanche`) : 137 / 136 ms en fin de
  jalon 13, référence **142 ms**.
- `/upcoming` : référence **160 ms** (fin du jalon 11), pas remesurée depuis.
- Accueil de `vieuxsillons` (avec souvenirs, `MEASURE_EMAIL`) : pas encore de référence ; l'A/B
  de l'étape 3 la fixe (parcours « /discover → accueil »).
- Pages de `measure.mjs` qui changent dans ce jalon : l'accueil (bouton à l'étape 1 ; section
  « Souvenirs » à l'étape 3, une requête de plus dans la première vague) et `/discover` (bloc
  « Sortis un … » à l'étape 4, une requête de plus dans le `Promise.all`). Leçons : trois lectures
  parallèles de plus sur l'accueil coûtaient 25 à 32 ms (jalon 11), les fondre en une requête a
  suffi ; une lecture lancée après les autres ajoute une vague (+36 à +60 ms).
