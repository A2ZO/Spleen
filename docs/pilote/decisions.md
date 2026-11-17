# Décisions du pilote — jalon 14 « Souvenirs »

Chaque choix pris sans Azzo : date, étape, choix, raison, alternative écartée. Azzo relit et
peut revenir sur n'importe lequel. Les questions qui demandent Azzo sont sous un titre
`QUESTION POUR AZZO`. Décisions du jalon 13 : `docs/pilote/archives/jalon-13/decisions.md`.

## Décidé par le conseiller (17 novembre 2026)

Règles par défaut du cahier des charges (section « Souvenirs (jalon 14) »), retenues ou
ajustées. Le détail de chaque étape est dans les « Décisions actées » de `feuille-de-route.md`.

**Ce jour-là** (accueil membre, groupe « Il y a un an, tu écoutais… »)

- À partir des écoutes **datées** du membre, dans son fuseau (`profiles.time_zone`, repli
  Europe/Paris si le fuseau est refusé). Les écoutes sans date (notes rapides, cœurs) n'y sont
  jamais. Rien s'il n'y a rien.
- Ajusté : **disques seulement** (album, EP, single). Une écoute de morceau n'y figure pas : la
  tuile d'un disque dirait « tu écoutais ce disque » quand seul un morceau a joué.
- Ajusté : **l'année passée la plus récente** qui a des écoutes ce jour-là, une seule (1 an s'il y
  en a, sinon 2 ans, etc.). Titre « Il y a un an, tu écoutais… » ou « Il y a N ans, tu
  écoutais… ». Raison : un seul titre vrai pour toutes les tuiles ; le cahier ne parlait que
  d'un an.
- Ajouté : une tuile par disque (écoutes et réécoutes du même jour réunies), la plus récemment
  enregistrée d'abord, 6 au plus ; disques fusionnés et disques redevenus « pas encore sortis »
  exclus ; lien « Ouvrir ce mois dans mon journal » (calendrier de ce mois-là).

**Anniversaires du jour** (accueil membre)

- Les disques que j'ai notés ou aimés (état actuel : une note ou un cœur ; ni « écouté » seul,
  ni « À écouter »), seulement pour les dates connues au jour près : « N ans aujourd'hui ».
- Ajusté : disques principaux seulement (album, EP, single, mixtapes ; ni live, ni compilation,
  ni bande originale, ni remix : leur date est souvent celle d'une réédition), non fusionnés.
- Ajouté : N ≥ 1 (un disque sorti aujourd'hui même relève de « Sortie aujourd'hui ») ; 6 au plus.
- Ronds mis en avant (10, 20, 25, 30, 40, 50 ans). Ajusté : au-delà de 50, chaque dizaine (60,
  70…) et 75 ans. Mise en avant : en tête de liste et âge écrit en lilas (`text-star`), sans
  badge ni second bloc lilas ; puis du plus ancien au plus récent.
- Ajouté : un disque peut être dans les deux groupes (écouté il y a un an le jour de son
  anniversaire) : gardé dans les deux.

**Une seule section « Souvenirs »** sur l'accueil membre, entre « Bientôt dans tes oreilles » et
les tendances, avec les deux groupes (titres de niveau 3) ; un groupe vide disparaît, la section
aussi quand les deux le sont. Accueil visiteur inchangé.

**29 février** (ajouté, pour les trois blocs) : un souvenir ou un anniversaire du 29 février ne
revient qu'un 29 février (années bissextiles), jamais le 28 février ni le 1er mars : on ne dit
jamais « aujourd'hui » pour un autre jour.

**Réglage**

- Ajusté : **un seul réglage** pour toute la section de l'accueil (les deux groupes sont des
  souvenirs du membre) : colonne `profiles.show_memories`, booléen, vrai par défaut ; case
  « Afficher mes souvenirs sur l'accueil » dans une section « Souvenirs » des réglages, après
  « Sorties à venir ». Il ne masque pas « Sortis un … » de `/discover` (public).
- Export : oui (la ligne `profiles` entière part déjà dans l'export, comme `notify_releases`).
  Suppression du compte : la colonne disparaît avec le profil (cascade).
- Politique de confidentialité **inchangée dans ce jalon** (textes légaux interdits au pilote) :
  aucune donnée nouvelle n'est collectée (les souvenirs se calculent à partir des écoutes et de
  l'état déjà décrits, rien n'est enregistré), seule une préférence d'affichage s'ajoute. Phrase
  proposée à Azzo dans la PR, à ajouter à la liste des réglages de la section « Les données
  collectées » : FR « réglages (journal privé, stats privées, écoute à l'aveugle, notifications
  des sorties, souvenirs sur l'accueil) » ; EN « settings (private diary, private stats, blind
  listening, release notifications, memories on the home page) ». À décider avant la mise en
  ligne (relecture juridique du jalon 10).

**Sortis un <jour mois>** (`/discover`)

- Même « aujourd'hui » que les autres blocs de `/discover` : **le jour de Paris**, lecture
  identique pour tous (issue #22), sans donnée du lecteur.
- Disques principaux non fusionnés, datés au jour près, sortis ce jour-là une année passée
  (année en cours exclue), avec au moins **2 membres distincts** ayant une note ou un cœur
  (comme les tendances : un seul membre serait exposé, et le bloc ne serait jamais à moitié
  vide) ; comptes suspendus exclus ; journaux privés comptés, comme dans les moyennes (agrégat
  anonyme, ni nom ni nombre affiché).
- Tri : nombre de membres, puis le plus ancien, puis le titre ; 6 au plus ; tuiles liées aux
  fiches, avec « N ans aujourd'hui » (ronds en lilas comme à l'accueil). Rien → pas de bloc.
  Place : après « Sorties récentes », avant « Les mieux notés ».
- Ajouté (les trois blocs) : tuiles **sans moyenne de la communauté** (le bloc montre une date,
  pas une note) : rien à masquer en écoute à l'aveugle, une seule requête par bloc.
- Performance : une seule requête SQL par bloc, aucun index nouveau (les dates sont comparées à
  la liste des mêmes jours des années passées, qui sert les index existants).

**Démo** (ajouté) : deux membres fictifs, `vieuxsillons` (Suzanne, les souvenirs de l'accueil)
et `deuxiemeface` (Gaspard, 2e cœur pour `/discover`), que personne ne suit et qui ne suivent
personne, sans note ni critique, avec des écoutes et des cœurs anciens, dates recalculées à
chaque seed. Raison : `nuitblanche` est suivie par `rainydaysam`, dont le fil est dans le
snapshot `feed-loading` (il aurait changé), et le test « demo members » de `listening.test.ts`
attend sa dernière écoute au 18 octobre 2026 (une écoute « il y a un an » relative au seed
l'aurait dépassée dès octobre 2027). Seul `db.test.ts` (inventaire) suit, autorisé à la fusion.

**Reste du jalon 13** (décidé par Azzo le 17 novembre)

- Sur l'accueil **membre**, le 2e bouton du bloc lilas (« Trouver quoi écouter » → `/discover`),
  celui que visait l'issue #31, devient « Tire un disque au hasard » (EN « Pick a random record »)
  et mène à `/pick` ; même style (`on-accent`). Accueil **visiteur** inchangé.
- Affiché même quand « À écouter » est vide : `/pick` le dit déjà et propose « Découvrir des
  disques ». Le bouton de l'onglet « À écouter » reste. L'issue #31 reste fermée (PR 46) ; la PR
  du jalon dit « Suite de #31 ».

**Hors périmètre** : notifications, emails ou push de souvenirs ; souvenirs des amis (« il y a
un an, tes amis écoutaient… ») ; souvenirs de critiques, de listes, de morceaux ou d'artistes ;
page dédiée aux souvenirs ou historique ; souvenirs sur le profil public ; cartes partageables,
Spleen Rewind, stats de souvenirs ; défi de l'année (jalon 15) ; abonnement calendrier ; nouveaux
textes légaux. Les sorties à venir restent dans la discographie de la fiche artiste (décidé par
Azzo le 17 novembre) : rien à changer. Next.js passe de 16.4.2 à 16.4.5 au début de l'étape 5
(correctifs de sécurité du 3 novembre ; décidé par le conseiller le 17 novembre, avec l'accord
d'Azzo ; seule dépendance permise, voir « Autorisé à la fusion »). Restent ouverts hors de ce
jalon, sans y toucher : un 503 de MusicBrainz qui arrête la relecture nocturne des
liens avant les artistes, les fiches e2e jetables qui s'accumulent sur Neon `dev`.

## Décisions du pilote
