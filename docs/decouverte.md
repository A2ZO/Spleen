# Listes et découverte (jalon 8)

API : `packages/api/src/lib/lists.ts`, `lib/discovery.ts`, `lib/catalog/refresh.ts`.
Web : `/[locale]/list/[id]` (page publique), `/list/new`, `/list/[id]/edit`, `/discover`,
les blocs de l'accueil, le bouton « Ajouter à une liste » des fiches album, morceau et
artiste. Server Actions : `apps/web/src/app/[locale]/list/actions.ts`.

Quoi écouter ce soir ? (« Écouter sur… », « Tes amis sur ce disque », « Tire un disque »,
jalon 13) : `docs/quoi-ecouter.md`.

Souvenirs (« Sortis un <jour mois> » sur `/discover`, section « Souvenirs » de l'accueil membre,
jalon 14) : `docs/souvenirs.md`.

## Listes

| Procédure                                 | Rôle                                                   | Limite / h |
| ----------------------------------------- | ------------------------------------------------------ | ---------- |
| `list.create` / `update` / `delete`       | titre (120), description (2 000), classée ou non       | 120        |
| `list.addItem` / `removeItem` / `reorder` | disques, morceaux, artistes mélangés (seau commun)     | (idem)     |
| `list.byId`                               | page publique, 50 éléments par page, droits du lecteur | —          |
| `list.mine`                               | mes listes ; avec une cible, l'élément qu'elle y a     | —          |
| `profile.lists`                           | onglet Listes du profil, 20 par page                   | —          |

- Un élément figure au plus une fois par liste (contraintes uniques), 250 au plus
  (`LIST_FULL`). L'ajout verrouille la ligne de la liste (`for update`) : deux ajouts
  simultanés ne prennent ni la même position ni la dernière place.
- `reorder` reçoit l'ordre complet des mêmes éléments, sinon `LIST_MISMATCH`. Le rang
  affiché est la place dans l'ordre (pas de trou après une suppression).
- Seul l'auteur modifie sa liste ; pour les autres, elle « n'existe pas »
  (`LIST_NOT_FOUND`). Supprimer une liste supprime ses éléments, j'aime, commentaires et
  notifications (cascade). Côté web, « Supprimer la liste » ramène aux listes du membre et
  laisse 8 s pour « Annuler » avant d'envoyer (`docs/social.md`, « Supprimer avec Annuler »).
- Côté web, l'éditeur déplace l'élément aussitôt et envoie les enregistrements l'un après
  l'autre (jamais dans le désordre) ; le focus reste sur la flèche de l'élément déplacé.
- Likes, commentaires et signalements : API sociale (`docs/social.md`), sujet `list`.

**Règles transverses**

- Blocage (dans les deux sens) : la liste reste lisible, sans bouton j'aime ni
  commentaire ; les commentaires des membres bloqués sont masqués et sortis du compteur,
  sauf pour l'auteur de la liste. Sur la fiche d'un disque, les critiques et les listes
  des membres bloqués disparaissent, et les compteurs de commentaires ne comptent que ce
  que le lecteur voit.
- Écoute à l'aveugle : les moyennes des disques (et des disques des morceaux) d'une liste
  sont masquées tant que le lecteur ne les a pas notés.
- Journal privé : une liste ne montre rien du journal.

## Tendances de la semaine

- Une écoute compte pour la langue d'interface (`profiles.locale`) du membre qui écoute.
- Score d'un disque = membres distincts sur 7 jours glissants ; à égalité, les coups de
  cœur, puis l'écoute la plus récente.
- Une écoute compte à son **enregistrement** : écoutes datées par `created_at`, écoutes
  sans date (notes rapides, coups de cœur) par `updated_at`. Une écoute d'un vieux disque
  notée aujourd'hui compte cette semaine.
- Au moins 2 membres par disque (un seul membre serait exposé) ; journaux privés et
  comptes suspendus exclus.
  Disques seulement (les écoutes de morceaux ne comptent pas).
- **Repli** : moins de 5 disques dans la langue → complété avec toutes les langues sur la
  semaine, puis avec toutes les langues sur 30 jours. Chaque élément porte sa `source`
  (`lang`, `all`, `month`), et la page le dit. Un bloc toujours vide est masqué sur
  l'accueil.
- Ce sont des agrégats anonymes : les blocages ne les filtrent pas (comme la moyenne
  d'un disque).

## Sorties récentes

- Disques sortis ces 90 derniers jours, au jour ou au mois près (une année seule n'est pas
  « récente »), sans live ni compilation ; albums et EP par défaut, singles à part ;
  du plus récent au plus ancien. Aucun appel à MusicBrainz à l'affichage. Ce que la règle
  des sorties à venir retient (jour de Paris) en est exclu : un mois annoncé reste « à venir »
  pendant ce mois, puis devient récent.
- Alimentation : `pnpm catalog:refresh` relit la discographie (stubs des nouvelles
  sorties) d'au plus 150 artistes : ceux écoutés par des membres sur 30 jours (disques,
  morceaux, artistes) et ceux présents sur une Étagère, les plus suivis d'abord, chacun au
  plus une fois par semaine (`artists.discography_refreshed_at`). Toujours à 1 requête/s
  par le limiteur de la base (partagé avec le site).
- Lancement : chaque nuit par `.github/workflows/catalog-refresh.yml` (environnement
  GitHub `production`, secret `DATABASE_URL_UNPOOLED` ; activation :
  `docs/mise-en-ligne.md` § 9), ou à la main sur Neon `dev` : `pnpm catalog:refresh`.

## Sorties à venir (jalon 11)

Vue d'ensemble du domaine (règles, données, commandes, tâches de nuit) : `docs/sorties.md`.

Règle partagée (`lib/catalog/upcoming.ts`), au jour du lecteur (fuseau de son profil,
Europe/Paris pour un visiteur) :

- au jour : après aujourd'hui ; au mois : un mois suivant, ou le mois en cours si la sortie a
  été annoncée (`announced_at`) ; à l'année : l'année suivante, ou l'année en cours si annoncée ;
- jamais au-delà de 12 mois (une année : la suivante au plus) ; « pas encore sorti » (fiche du
  disque, refus `RELEASE_NOT_OUT`) est la même règle sans ce plafond (`upcomingRelease()`) ;
- non fusionnée, disque principal (sans live ni compilation), album, EP ou single.

Date au jour affichée courte (« ven. 21 nov. »), avec l'année hors de l'année en cours
(`formatUpcomingDate()`).

Lectures (routeur `upcoming`) :

- `mine({ type? })` (membre) : sorties des artistes suivis, par date puis titre, 200 au plus,
  en groupes `week` (7 prochains jours), `month` (reste du mois, ou mois en cours au mois),
  `later`, `tba` (année seule) ; `dateChanged` quand la date a bougé ;
- `byArtist({ slug })` (publique) : 20 au plus, identique pour tous (cache public, issue #22),
  jour de Paris ; un artiste fusionné lit la fiche gardée, inconnu → `NOT_FOUND`.
- `home()` (publique, `null` pour un visiteur ou un compte suspendu) : `{ following, items,
  soon }` ; `items` = 5 prochaines sorties suivies (année seule en dernier, puis date, titre) ;
  `soon` = première sortie suivie **au jour** entre demain et J+6, avec `inDays` (issue #32).
- `discovery.awaited()` (publique, 10 au plus, jour de Paris, sans données du lecteur) : sorties
  à venir comptées par membres distincts qui suivent un de leurs artistes **ou** les ont dans
  « À écouter » (une fois chacun, membres suspendus exclus), 2 au moins ; tri : nombre, année
  seule en dernier, date, titre. Aucun nombre ni nom n'est montré.

Écrans (étape 3) :

- `/upcoming` (« Mes sorties à venir », membre, `noindex` ; visiteur → connexion) : onglets
  Tout / Albums / EP / Singles (`?type=`), quatre groupes (« Cette semaine », « Ce mois-ci »,
  « Plus tard », « Annoncé, date à préciser ») ; chaque ligne : pochette, titre, artistes, date courte
  (`formatUpcomingDate()`, `lib/release-date.ts`), type, badge « Date modifiée », bouton
  « À écouter » instantané (`components/upcoming/`). Sans suivi : invitation à suivre depuis
  les fiches ; suggestions d'artistes (`upcoming.suggestions`) ; lien de signalement en bas.
  Lien depuis `/settings` (« Sorties »).
- Fiche artiste : section « À venir » au-dessus de la discographie (tuiles, date à la place de
  l'année ; les disques restent aussi dans la discographie) ; pour un membre, « Une sortie
  manque ? » ouvre le signalement catalogue avec le type « ajout » présélectionné.
- Accueil membre (étape 4) : « Bientôt dans tes oreilles » (`upcoming.home`, pleine largeur
  sous la grille du haut, lien « Toutes tes sorties à venir ») ; sans suivi, l'invitation ;
  suivis sans annonce, rien. La petite carte devient « Sort demain » / « Sort vendredi » quand
  `soon` existe (sans action d'écoute), sinon « Vient de sortir ». Visiteur : inchangé.
- `/discover` : « Les plus attendus » (`#awaited`) avant « Sorties récentes », caché si vide.
  Les tuiles de ces trois endroits viennent de `components/upcoming/UpcomingGrid.tsx`.
- Fiche d'un disque à venir : « Sort le … », « Sort en … » ou « Annoncé pour … » à la place de
  la date, badge « Date modifiée » ; contrôles réduits, sans carte « Note de la communauté »,
  et « Les critiques ouvriront le jour de la sortie. » quand il n'a aucune critique (voir
  `docs/ecoute.md`).
- Notifications du jour J (étape 5) : `pnpm releases:notify` (chaque nuit après
  `catalog:refresh` dans `.github/workflows/catalog-refresh.yml`, même si la relecture a
  échoué) crée « Sortie aujourd'hui » pour chaque membre qui suit un artiste crédité, a
  `notify_releases` vrai, n'est pas suspendu, quand la date **au jour** du disque (principal,
  non fusionné) est aujourd'hui dans son fuseau (`todayIn`, repli Europe/Paris si le fuseau est
  inconnu). Une fois par membre et par disque, relançable ; pas d'email ni de push. Les disques
  d'un même jour forment un groupe : un seul → « Sortie aujourd'hui : **Titre** de Artiste »,
  carte liée à la fiche ; plusieurs → « N sorties aujourd'hui chez tes artistes », les 3
  premiers par titre liés, puis « et N autres ». La fusion de doublons repointe `release_id`.
  Lue un autre jour (`releasedToday` faux, calculé par l'API dans le fuseau du membre) : « Sorti
  le 14 novembre : **Titre** de Artiste » ou « N sorties le 14 novembre chez tes artistes »
  (jour et mois en lettres, année hors de l'année en cours, jamais d'heure ; jalon 13).

Démo : `nuitblanche` suit trois artistes, `vinylvince` deux, six sorties annoncées
(`seed/upcoming.ts`, dates recalculées à chaque seed, sans `mbid`).

## Les mieux notés

- Notes actuelles des membres (`user_item_state`), comme la moyenne d'une fiche ; celles des
  comptes suspendus sont exclues (moyenne du site comprise).
- Au moins `DISCOVERY_MIN_RATINGS` notes (3 au lancement, à relever quand la communauté
  grandit, dans `lib/discovery.ts`).
- Score = moyenne bayésienne `(v × R + m × C) / (v + m)` : `v` notes du disque, `R` sa
  moyenne, `C` la moyenne de toutes les notes du site, `m` le seuil. Un disque noté 5
  étoiles par peu de membres reste tiré vers la moyenne du site.
- Filtres : genre, année **ou** décennie, type (album par défaut). 25 par page.
- Écoute à l'aveugle : le rang reste, le score et la moyenne sont masqués.

## Critiques populaires

`feed.popular` (`docs/social.md`), dans la langue choisie ; 4 sur `/discover`.
