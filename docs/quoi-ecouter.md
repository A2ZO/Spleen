# Quoi écouter ce soir ? (jalon 13)

Passer de la fiche à l'écoute. Point d'entrée du domaine ; le détail reste dans les docs citées.

## Règles retenues (conseiller, 17 novembre 2026)

Tirées du cahier des charges (section du jalon 13) ; texte complet et ajustements dans
`docs/pilote/decisions.md`, « Décidé par le conseiller » (archivé après le jalon dans
`docs/pilote/archives/jalon-13/`).

- **Écouter sur…** : fiches album (EP, single), morceau et artiste ; cinq services toujours
  dans cet ordre : Spotify, Deezer, Apple Music, YouTube Music, Bandcamp. Lien direct quand
  MusicBrainz connaît la page et qu'elle passe la validation, sinon recherche « premier
  artiste + titre » (le nom seul pour un artiste). Seule source : les relations d'URL de
  MusicBrainz (aucune requête de plus à l'import, aucun appel pendant l'affichage). Validation
  stricte avant d'enregistrer **et** avant d'afficher (`https`, hôte exact, forme de chemin
  selon le type de fiche), URL reconstruite. Aucun logo (noms en texte), aucun lien affilié ni
  paramètre de suivi, `rel="nofollow noopener noreferrer"`.
- **Tes amis sur ce disque** : fiche d'un disque seulement. Les membres que je suis avec une
  note ou un cœur, 5 au plus (les plus récents d'abord), puis « Voir tous tes amis ». Exclus
  comme dans le fil Amis : blocage dans un sens ou l'autre, comptes suspendus, journaux privés.
  Rien pour un visiteur, sur un disque pas encore sorti, ni en écoute à l'aveugle tant que je
  n'ai pas noté le disque.
- **Tire un disque** : un disque de ma liste « À écouter » tiré au hasard côté serveur ; disques
  seulement (pas les morceaux), non fusionnés, déjà sortis dans mon fuseau. Filtres de type
  (album, EP, single) et de durée (moins de 30 min, 30 à 60 min bornes comprises, plus d'une
  heure ; durée inconnue exclue dès qu'un filtre de durée est choisi). « Un autre » évite le
  disque affiché quand il en reste un autre. Rien n'est écrit (ni historique ni compteur).
  Ferme l'issue #31 ; l'accueil reste inchangé (décision actée, voir les décisions du pilote).
- **Restes du jalon 11** (étape 1, issues #41 et #42) : une notification lue un autre jour dit
  « Sorti le {date} » (`docs/social.md`, « Notifications ») ; un disque pas encore sorti n'a
  pas de moyenne et dit « Les critiques ouvriront le jour de la sortie. » (`docs/ecoute.md`).
- **Hors périmètre** : connexion aux services, lecteurs, extraits, logos, autres services,
  tirage hors « À écouter », amis sur morceaux et artistes, textes légaux.

## Données

- Migration `0017` : type `listen_service` ; table `listen_links` (une ligne par fiche et
  service, cible `release_id` / `track_id` / `artist_id` en clés `restrict`, `url` en
  `https://`, index uniques partiels par cible et service) ; `releases.links_checked_at` et
  `artists.links_checked_at` (relecture de nuit).
- Données dérivées de MusicBrainz : l'import, la fusion de doublons (la fiche gardée prend les
  services qui lui manquent) et la relecture de nuit les ajoutent, remplacent ou retirent.
- Aucune donnée personnelle nouvelle : « Tes amis » montre ce que le fil Amis montre déjà,
  « Tire un disque » n'écrit rien. Politique de confidentialité, export et suppression du
  compte inchangés.
- e2e : les liens des disques jetables sont effacés par `apps/web/e2e/cleanup.ts` avant la
  purge (clé `restrict`).

## API (`packages/api`)

- `release.bySlug`, `artist.bySlug`, `track.bySlug` : gagnent `listenLinks` (sous-requête
  `json_agg` dans la lecture de la fiche, aucune requête de plus), identiques pour tous (cache
  public, issue #22). Validation et liens de recherche : `lib/listen-links.ts`
  (`validListenUrl`, `pickListenLinks`, `buildListenLinks`).
- `release.friends({ slug, all? })` : `lib/social/release-friends.ts` (une requête, total par
  `count(*) over ()`) ; null pour un visiteur, un compte suspendu ou sans profil ; lu à part,
  en parallèle de la fiche.
- `toListen.pick({ type?, duration?, not? })` → `{ listTotal, matching, pick }` :
  `lib/listening/pick.ts` (deux vagues, aléa injectable, `pickMinutes` pour une durée affichée
  qui ne contredit jamais le filtre) ; `protectedProcedure`, `PROFILE_REQUIRED` sans profil.

## Commande et phase de nuit

`pnpm catalog:refresh` relit les liens en dernière phase (`lib/catalog/listen-links-refresh.ts`,
`refreshListenLinks`) : 200 disques complets puis 100 artistes, 10 minutes au plus (fournisseur
à 3 essais), jamais relus d'abord puis relus après 30 jours ; MusicBrainz indisponible arrête la
phase pour la nuit. `pnpm catalog:refresh -- --links-only` ne lance qu'elle. Les morceaux ne
sont pas relus la nuit (liens reçus à leur import). Détail : `docs/catalogue.md`, « Écouter
sur… (jalon 13) ».

## Écrans

- `components/catalog/ListenOn.tsx` sur les trois fiches : cinq liens dans l'ordre, direct
  (icône externe) ou recherche (« (recherche) » pour les lecteurs d'écran).
- `components/release/FriendsOnRecord.tsx` sur la fiche album (après la mosaïque, avant la
  liste des titres) ; `?friends=all#friends` ouvre la liste entière sans JavaScript.
- `/[locale]/pick` (noindex ; visiteur → connexion, sans profil → `/welcome`) : filtres en
  `LinkTabs`, `components/pick/PickCard.tsx`, « Un autre » (`AnotherPick.tsx`, formulaire GET,
  `useNavigate` avec JavaScript) ; états liste vide, rien de sorti, aucun ne correspond, un
  seul. Accès : bouton « Tire un disque » dans l'onglet « À écouter » de mon profil, liste non
  vide.
- Démo : `seed/friends.ts` (« Dernier métro pour Belleville », 7 membres suivis par
  `nuitblanche`, 6 visibles), `seed/pick.ts` (6 disques sortis dans « À écouter » de
  `nuitblanche`).

## Points ouverts (PR du jalon)

- Snapshot `feed-loading` régénéré à l'étape 4 (ajouts seuls) : à valider par Azzo, ou faire
  suivre les membres de démo par un autre compte.
- Un 503 de MusicBrainz arrête la phase des liens avant les artistes ; si ça se répète chaque
  nuit, les artistes ne sont jamais relus.
- Les artiste et morceau e2e jetables, jamais supprimés, gardent leurs liens sur Neon `dev`.
