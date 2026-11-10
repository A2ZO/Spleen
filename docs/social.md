# Social (jalon 7)

API : `packages/api/src/lib/social/` — `relations.ts` (blocages, cartes de membres),
`follows.ts` (suivre, blocages), `feed.ts` (fil Amis / Populaire, suggestions),
`interactions.ts` (likes, commentaires, signalements), `notifications.ts`, `reviews.ts`
(cartes de critique, page d'une critique), `cursor.ts`. Web : `/[locale]` (fil),
`/[locale]/review/[id]`, `/[locale]/u/[username]/followers|following`,
`/[locale]/notifications`, `/[locale]/settings/blocks`. Server Actions :
`apps/web/src/app/[locale]/social/actions.ts`.

## Procédures

| Procédure                                   | Rôle                                              | Limite / h |
| ------------------------------------------- | ------------------------------------------------- | ---------- |
| `social.follow` / `unfollow`                | suivre un membre (`follow-write`)                 | 200        |
| `social.followers` / `following`            | listes paginées (30, curseur), publiques          | —          |
| `feed.friends` / `feed.popular`             | fil Amis (20) / critiques populaires par langue   | —          |
| `feed.suggestions`                          | 5 membres actifs à suivre (fil Amis vide)         | —          |
| `review.byId`                               | page d'une critique + droits du lecteur           | —          |
| `like.set`                                  | aimer / ne plus aimer une critique ou une liste   | 300        |
| `comment.list` / `create` / `update` / `delete` | commentaires (50 par page, plus anciens d'abord) | 60     |
| `notification.list` / `unreadCount` / `markAllRead` | notifications groupées (20)               | —          |
| `block.add` / `remove` / `list`             | blocages                                          | 60         |
| `report.create`                             | signaler une critique, un commentaire, une liste, un profil | 20 |

Erreurs : `SELF_ACTION` (soi-même), `ACTION_UNAVAILABLE` (blocage, réponse neutre),
`MEMBER_NOT_FOUND`, `COMMENT_NOT_FOUND`, `LIST_NOT_FOUND`, `INVALID_CURSOR`.

## Pagination par curseur

`CursorPage<T>` = `items` + `nextCursor` (null à la fin). Le curseur est opaque (base64url
d'un tableau JSON). Les horodatages y voyagent en texte Postgres (`created_at::text`, avec
les microsecondes) : un `Date` JS perdrait les microsecondes et sauterait ou répéterait des
lignes. Index : `entries (user_id, created_at desc, id desc)`,
`follows (follower_id|followee_id, created_at desc)`, `reviews (lang, created_at desc)`,
`likes (created_at)`, `comments (created_at)`, `notifications (user_id, group_key)`.
Côté web, `?after=<curseur>` et un lien « Revenir aux plus récents ».

## Fil

- **Amis** : écoutes (avec leur critique), coups de cœur et notes rapides (écoutes sans
  date), et critiques écrites hors écoute, des membres suivis, triés par moment
  d'activité (`created_at`, ou celui de la critique quand elle est écrite plus tard). La
  date d'écoute est affichée à part. Une critique dont l'écoute n'apparaît pas (journal
  privé, écoute sans date dont la note et le cœur ont été retirés) apparaît seule.
- **Journal privé** : aucune écoute d'un journal privé n'apparaît. Ses critiques restent
  publiques, comme sur le profil.
- **Populaire** : critiques dans une langue (celle de l'interface par défaut,
  `?lang=fr|en`) classées par score sur 7 jours glissants = likes + 2 × commentaires
  reçus dans la fenêtre (les commentaires de l'auteur ne comptent pas). Une critique plus
  ancienne revient si elle est aimée cette semaine.
- **Écoute à l'aveugle** : notes masquées (fil, Populaire, page de critique) tant que le
  lecteur n'a pas noté le disque (ou le morceau pour une écoute de morceau).
- Fil Amis vide : message d'accueil et `feed.suggestions` (activité des 30 derniers jours,
  hors membres suivis et bloqués).
- **Chargement** : la requête de page renvoie aussi la dernière critique de chaque écoute ;
  les cartes (`loadReviewCards`, `loadListens`) coûtent ensuite deux allers-retours en
  parallèle (les lignes, puis tout ce qu'elles référencent, masquage aveugle compris).
  Plafonds et identité du résultat : `packages/api/src/feed-loading.test.ts`.

## Likes et commentaires

Sujet = `{ kind: "review" | "list", id }` (listes : `docs/decouverte.md`). Pas de like sur sa propre critique ou liste. Commentaires :
1 000 caractères max, modifiés par leur auteur seul (`edited_at` → « modifié »), supprimés
(suppression douce, `deleted_at`) par leur auteur ou par l'auteur de la critique / liste.

Like et suivi s'affichent au clic (file commune `use-instant-writes.ts`, détails dans
`docs/ecoute.md` § « Réactions instantanées ») : compteur du like et nombre d'abonnés de
l'en-tête du profil (`FollowerCountLink`) bougent tout de suite ; double clic = aucune requête,
donc aucune notification créée puis retirée ; refus (bloqué, suspendu, 429) → retour en arrière
et message. Limites : fermer l'onglet dans les 350 ms perd le clic ; les compteurs des onglets
« abonnés / abonnements » des listes de membres bougent à la confirmation.

## Notifications

Une ligne par événement (`follow`, `like`, `comment`), créée dans la transaction de
l'action, jamais vers soi-même ni à travers un blocage ; annuler l'action (ne plus suivre,
ne plus aimer, commentaire supprimé) retire la ligne. `group_key` regroupe : likes et
commentaires par critique / liste, abonnés par jour (fuseau du destinataire). La pastille
compte les groupes non lus. Pas de temps réel : le compteur se met à jour au rendu des pages.

## Blocage

Un blocage vaut dans les deux sens : désabonnement mutuel, notifications entre eux
effacées, plus de suivi, like ni commentaire, chacun disparaît du fil, du Populaire, des
notifications, des commentaires et des suggestions de l'autre (les compteurs de
commentaires aussi). Exception : sur ses propres critiques, on voit toujours les
commentaires d'un membre bloqué, pour pouvoir les supprimer. Le profil reste visible,
sans bouton d'interaction ; l'API répond `ACTION_UNAVAILABLE`. La personne bloquée n'est
jamais prévenue (son propre `viewerBlocked` reste faux).

## Signalements

Motifs : `spam`, `harassment`, `hate`, `spoiler`, `inappropriate`, `other`, plus 500
caractères facultatifs. Un seul signalement ouvert par auteur et par sujet. Quand un
membre supprime son compte, ses signalements restent (`reporter_id` → null) pour la
modération (ci-dessous).

## Modération (jalon 9)

API : `packages/api/src/lib/moderation/` — `queue.ts` (file, sujets), `decisions.ts`
(décisions, suspension), `history.ts` (historique, conservation), `emails.ts`. Web :
`/[locale]/admin` (signalements), `/admin/history`, `/admin/suspended` ; Server Actions
`apps/web/src/app/[locale]/admin/actions.ts`.

**Rôle admin.** Dans `profiles.role`, donné ou retiré uniquement en ligne de commande :
`pnpm admin:grant <email>` / `pnpm admin:revoke <email>` (`setAdminRole`, sur la base de
l'environnement ; le compte doit avoir choisi son pseudo). Aucune route ne le modifie.
`adminProcedure` relit le rôle à chaque appel et répond `NOT_FOUND` à tout autre compte ; le
layout `/admin` affiche la 404. Démo : `lacontrebasse@example.test`.

| Procédure                       | Rôle                                                                     |
| ------------------------------- | ------------------------------------------------------------------------ |
| `admin.reports`                 | file filtrée par statut (`open` par défaut) et type ; plus anciens d'abord |
| `admin.decide`                  | décision sur un signalement ouvert : `dismiss`, `resolve`, `hide`, `delete`, `suspend` |
| `admin.suspend` / `unsuspend`   | suspendre un membre sans signalement / lever une suspension              |
| `admin.restore`                 | rétablir un contenu masqué par une décision                              |
| `admin.history` / `suspended`   | historique (30 par page), comptes suspendus                              |
| `account.suspension`            | motif de sa suspension, pour le membre connecté seulement (null sinon)   |

**Décisions.** Chacune tient en une transaction : une ligne `moderation_actions` (action,
motif obligatoire, auteur, membre concerné, contenu, signalement, catégorie, extrait), la
fermeture de **tous** les signalements ouverts sur le même sujet, l'effet, et une
notification `moderation` avec le motif (sauf rejet et catalogue). Une décision ne
s'applique qu'aux sujets qui s'y prêtent (`MODERATION_ACTION_INVALID`) ; un admin n'est
jamais suspendu depuis le site (`CANNOT_MODERATE_ADMIN`).

- **Masquer** : `hidden_at` + `hidden_by = 'moderation'` sur la critique, la liste ou le
  commentaire ; jamais supprimé, rétablissable. Invisible pour tous **sauf son auteur**, qui
  le voit avec un bandeau « Masqué par la modération », le motif (dernière décision `hide`
  sur ce contenu, `lib/moderation/holds.ts` ; absent après anonymisation) et l'adresse pour
  contester : page de la critique ou de la liste (`hidden` dans `ReviewDetail` /
  `ListDetail`), son propre profil (étiquette « Masqué »), fil de commentaires
  (`CommentView.hidden`). Plus de j'aime ni de commentaire, auteur compris ; un commentaire
  masqué ne se modifie plus mais son auteur peut le supprimer. Les filtres passent par
  `visibleTo(table, lecteur)` (`lib/social/reviews.ts`) : « non masqué, ou à moi ».
- **Supprimer** : comme le ferait l'auteur (critique : `deleteReview` ; liste supprimée ;
  commentaire marqué supprimé). L'historique garde l'extrait.
- **Suspendre** : `profiles.suspended_at` + motif ; sessions supprimées ; critiques, listes
  et commentaires masqués avec `hidden_by = 'suspension'` ; email avec le motif et l'adresse
  de contestation (`CONTACT_EMAIL`, sinon `[À COMPLÉTER]`). Un email raté ne défait rien.
- **Lever la suspension** : rend visible ce que la suspension avait masqué, pas ce qu'une
  décision propre avait masqué.

**Compte suspendu.** `ctx.user()` vaut null : partout, c'est un visiteur (écritures →
`ACCOUNT_SUSPENDED`). Seuls `account.suspension`, `account.export` et `account.delete`
(`accountProcedure`) restent ouverts. Il peut se connecter (lien magique ou Google) : la
page de connexion répond comme pour tout le monde, et le motif ne s'affiche qu'une fois
l'identité prouvée, sur l'écran « Compte suspendu » qui remplace toutes les pages. Profil,
critiques, listes, commentaires, écoutes du fil et cartes de membre disparaissent pour les
autres (`findProfile`, `memberRefs`, `memberCards`, filtres `hidden_at is null`). Ses notes et
écoutes sortent de tous les chiffres publics (moyennes, répartition, tendances, mieux notés)
par un filtre calculé à la volée (`countsPublicly`, `lib/ratings.ts`) : rien à invalider, et
elles reviennent quand la suspension est levée. Son propre état (`user_item_state`) n'est pas
touché.

**Conservation.** Un an après la décision (`MODERATION_RETENTION_DAYS`),
`anonymizeModerationHistory` garde l'action, le motif et la catégorie, efface les liens vers
les personnes, l'extrait et la notification, et supprime les signalements clos. Les
signalements ouverts ne sont jamais touchés. Tâche `retention` du workflow nocturne, ou
`pnpm retention` (idempotent), avec les autres règles de conservation
(`packages/api/src/lib/retention.ts`).

**Signalements de catalogue.** Bouton « Signaler une erreur ou proposer un ajout » des fiches
album, artiste et morceau (membres) → `report.catalog` (`lib/catalog/reports.ts`). Types :
information erronée (`catalog_error`), pochette (`catalog_cover`), doublon
(`catalog_duplicate`, avec l'autre fiche du même type dans `duplicate_*`, adresse ou slug lu
par `catalogSlugFrom`), ajout manquant (`catalog_addition`), autre (`other`). Traités
(`resolve`) ou rejetés avec une note, sans notification. Un doublon ouvert affiche
« Fusionner les deux fiches » dans la file.

**Fusion de doublons** (`lib/catalog/merge.ts`, page `/admin/merge`, `admin.mergePreview` /
`admin.merge`). Une transaction : écoutes, notes de pistes, critiques, éléments de listes,
Étagères et signalements ouverts passent du doublon à la fiche gardée ; un conflit (un membre,
une liste, une Étagère, une écoute d'album avec les deux) n'en garde qu'une ligne (écoute sans
date : la plus récemment modifiée) ; les états `user_item_state` sont recalculés
(`recomputeItemState`, « À écouter » gardé si l'une l'avait) et les stats des membres
invalidées. La fiche gardée reprend ce qui lui manque (crédits, pistes, genres, pochette,
date) ; les liens de catalogue du doublon sont retirés. Le doublon n'est jamais supprimé :
`merged_into_id` (toujours un seul saut), son adresse redirige en permanence (308,
`lib/catalog-redirect.ts`, via `catalog.mergedInto`), la recherche et les sorties récentes
l'ignorent, l'import MusicBrainz suit le lien. Décision `resolve` (sujet `catalog`) dans
l'historique, extrait « doublon → gardée ». **Ne se défait pas : jamais de fusion d'essai sur
Neon `dev`.**

## Données de démo

`packages/db/src/seed/social.ts` : abonnements, likes, commentaires et notifications
datés par rapport au moment du seed (le Populaire compte 7 jours : `pnpm db:reset` ou un
nouveau seed rafraîchit la démo), et `bruitdefond`, bloqué par Camille.
`packages/db/src/seed/moderation.ts` : l'admin `lacontrebasse`, un commentaire de spam,
six signalements ouverts (membre, commentaire, liste, critique, erreur et ajout de
catalogue) et un signalement rejeté avec sa décision.
