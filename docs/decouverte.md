# Listes et découverte (jalon 8)

API : `packages/api/src/lib/lists.ts`, `lib/discovery.ts`, `lib/catalog/refresh.ts`.
Web : `/[locale]/list/[id]` (page publique), `/list/new`, `/list/[id]/edit`, `/discover`,
les blocs de l'accueil, le bouton « Ajouter à une liste » des fiches album, morceau et
artiste. Server Actions : `apps/web/src/app/[locale]/list/actions.ts`.

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
  notifications (cascade).
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
  du plus récent au plus ancien. Aucun appel à MusicBrainz à l'affichage.
- Alimentation : `pnpm catalog:refresh` relit la discographie (stubs des nouvelles
  sorties) d'au plus 150 artistes : ceux écoutés par des membres sur 30 jours (disques,
  morceaux, artistes) et ceux présents sur une Étagère, les plus suivis d'abord, chacun au
  plus une fois par semaine (`artists.discography_refreshed_at`). Toujours à 1 requête/s
  par le limiteur de la base (partagé avec le site).
- Lancement : chaque nuit par `.github/workflows/catalog-refresh.yml` (environnement
  GitHub `production`, secret `DATABASE_URL_UNPOOLED` ; activation :
  `docs/mise-en-ligne.md` § 9), ou à la main sur Neon `dev` : `pnpm catalog:refresh`.

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
