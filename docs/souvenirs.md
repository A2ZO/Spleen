# Souvenirs (jalon 14)

Faire revenir sans rien demander, à partir de ce que le membre a déjà noté. Point d'entrée du
domaine ; règles complètes et ajustements dans `docs/pilote/decisions.md`, « Décidé par le
conseiller » (archivé après le jalon dans `docs/pilote/archives/jalon-14/`).

## Règles retenues (conseiller, 17 novembre 2026)

- **Une section « Souvenirs »** sur l'accueil membre, entre « Bientôt dans tes oreilles » et
  les tendances, deux groupes (`h3`). Un groupe vide disparaît, la section aussi quand les deux
  le sont. Accueil visiteur inchangé.
- **« Il y a un an, tu écoutais… »** (ou « Il y a N ans ») : écoutes **datées** de disques
  (album, EP, single ; jamais un morceau, jamais une écoute sans date), jour du membre
  (`profiles.time_zone`, repli Europe/Paris). Seule l'année passée la plus récente qui a des
  écoutes ce jour-là ; une tuile par disque (réécoutes réunies), la plus récemment enregistrée
  d'abord, 6 au plus ; disques fusionnés et redevenus « pas encore sortis » exclus **avant** de
  choisir l'année. Lien « Ouvrir ce mois dans mon journal » (`/u/<pseudo>/diary?view=calendar&month=`).
- **Anniversaires du jour** : disques notés ou aimés (état actuel), principaux
  (`mainReleaseSql()` : ni live, ni compilation, ni bande originale, ni remix), non fusionnés,
  datés au jour près ; « N ans aujourd'hui », N ≥ 1, 6 au plus. Ronds (10, 20, 25, 30, 40, 50,
  75, puis chaque dizaine après 50) en tête, âge en `text-star`, puis du plus ancien au plus
  récent. Un disque peut être dans les deux groupes.
- **« Sortis un <jour mois> »** sur `/discover`, entre « Sorties récentes » et « Les mieux
  notés » : jour de Paris, même réponse pour tous (issue #22). Disques principaux non fusionnés,
  datés au jour près, sortis ce jour une année passée, avec au moins 2 membres distincts qui
  les ont notés ou aimés (`countsPublicly` : suspendus exclus, journaux privés comptés). Tri :
  membres, date, titre ; 6 au plus ; aucun bloc s'il n'y a rien.
- **Tuiles** sans moyenne de la communauté (une date, pas une note) : rien à masquer en écoute
  à l'aveugle.
- **Réglage** : une case « Afficher mes souvenirs sur l'accueil » (section « Souvenirs » de
  `/settings`, après « Sorties à venir »), cochée par défaut ; elle masque toute la section de
  l'accueil, pas le bloc public de `/discover`.

## Cas sans objet

- 29 février : ne revient qu'un 29 février (années bissextiles), jamais le 28 février ni le
  1er mars. Dates au mois ou à l'année : jamais (aucun jour inventé). Jamais d'heure.
- Visiteur, compte suspendu, profil pas fini, réglage coupé : `memories.home` rend `null` sans
  requête. Année en cours exclue partout (un disque sorti aujourd'hui relève de « Sortie
  aujourd'hui »).

## Données

- Une migration additive (`0018`) : `profiles.show_memories`, booléen, non nul, vrai par défaut.
  Rien d'autre n'est enregistré : ni historique, ni compteur, ni cache, ni tâche de nuit,
  notification ou email.
- Export : la ligne `profiles` entière (comme `notify_releases`). Suppression : cascade avec le
  profil.

## API (`packages/api`)

- `lib/memories.ts` : `sameDayInPastYears(today)` (même jour de 1900 à l'an passé, 29 février
  filtré), `isRoundAnniversary` / `roundAnniversarySql` (mêmes constantes), `homeMemories`,
  `releasedOnThisDay`. Les dates sont comparées à cette **liste de jours** (`in (…)`), ce qui sert
  les index existants : aucun index nouveau.
- **Une requête par bloc** : `memories.home` (`publicProcedure`, une requête `union all` pour
  les deux groupes, lancée dans la première vague de l'accueil) ; `discovery.releasedOnThisDay`
  (`publicProcedure`, sans entrée, dans le `Promise.all` de `/discover`) ;
  `account.setShowMemories` (`protectedProcedure`, `PROFILE_REQUIRED` sans profil).
- Tests : `memories.test.ts` (PGlite, `now` fixe, Paris et Los Angeles de part et d'autre de
  minuit, 29 février).

## Écrans (`apps/web`)

- `components/memories/MemoryGrid.tsx` : grille des tendances, `ReleaseTile` sans étoile, âge en
  lilas si rond. Section `Memories` de `app/[locale]/page.tsx`, bloc `on-this-day` de
  `/discover`, `MemoriesForm` + `setShowMemoriesAction` dans `/settings` (marche sans JS).
- Bouton de l'étape 1 (reste du jalon 13) : sur l'accueil membre, le 2e bouton du bloc lilas
  « Tire un disque au hasard » (`home.pickRandom`) mène à `/pick` ; visiteur inchangé.

## Démo et e2e

- `packages/db/src/seed/memories.ts` : `vieuxsillons` (Suzanne, souvenirs de l'accueil) et
  `deuxiemeface` (Gaspard, 2e cœur pour `/discover`), suivis par personne, sans note ni
  critique ; dates recalculées au jour du seed (Paris). **Re-seeder (`pnpm db:seed`) le jour des
  captures et des mesures.** `measure.mjs` : `MEASURE_EMAIL=vieuxsillons@example.test`.
- e2e `memories.spec.ts` : données insérées par rapport au **jour réel** du compte
  (`throwawayMemories`, `throwawayFans`, `ThrowawayOptions.date` `{ yearsAgo }`) ; aucun e2e ne
  dépend des dates de la démo.

## Points ouverts

- Politique de confidentialité inchangée (textes légaux hors jalon). Phrase proposée à Azzo,
  à ajouter à la liste des réglages de « Les données collectées » : FR « réglages (journal
  privé, stats privées, écoute à l'aveugle, notifications des sorties, souvenirs sur
  l'accueil) » ; EN « settings (private diary, private stats, blind listening, release
  notifications, memories on the home page) ». À décider avant la mise en ligne (jalon 10).
- Hors périmètre : souvenirs des amis, des critiques, des morceaux, des artistes ; page ou
  historique des souvenirs ; notifications ; profil public ; cartes partageables.
