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
| `report.create`                             | signaler une critique, un commentaire, un profil  | 20         |

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

## Likes et commentaires

Sujet = `{ kind: "review" | "list", id }` : les listes (jalon 8) sont déjà prises en charge
par l'API, sans interface. Pas de like sur sa propre critique ou liste. Commentaires :
1 000 caractères max, modifiés par leur auteur seul (`edited_at` → « modifié »), supprimés
(suppression douce, `deleted_at`) par leur auteur ou par l'auteur de la critique / liste.

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
modération (file au jalon 9).

## Données de démo

`packages/db/src/seed/social.ts` : abonnements, likes, commentaires et notifications
datés par rapport au moment du seed (le Populaire compte 7 jours : `pnpm db:reset` ou un
nouveau seed rafraîchit la démo), et `bruitdefond`, bloqué par Camille.
