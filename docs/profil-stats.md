# Profil et stats de base (jalon 6)

API : `packages/api/src/lib/profiles.ts` (sections du profil), `lib/shelf.ts` (Étagère),
`lib/stats/` (stats). Web : `/[locale]/u/[username]?tab=…&page=…`,
`/[locale]/u/[username]/diary?view=calendar&month=AAAA-MM`, `/[locale]/review/[id]/edit`.

## Sections du profil

`profile.byUsername` ne renvoie que l'en-tête, l'Étagère, l'activité récente et `isOwner`.
Chaque onglet est son propre appel, et la page ne charge que l'onglet affiché :

| Procédure            | Contenu                                                | Taille de page |
| -------------------- | ------------------------------------------------------ | -------------- |
| `profile.diary`      | écoutes datées, de la plus récente à la plus ancienne  | 30             |
| `profile.diaryMonth` | écoutes datées d'un mois (calendrier), plus ancienne d'abord | 500 max  |
| `profile.likes`      | disques aimés, du cœur le plus récent au plus ancien    | 24             |
| `profile.reviews`    | critiques de disques, les plus récentes d'abord         | 20             |
| `profile.toListen`   | « À écouter »                                          | 24             |
| `profile.lists`      | listes (pagination au jalon 8)                          | —              |
| `profile.stats`      | stats (null si privées ou membre inconnu)               | —              |

Les pages commencent à 1 (`Page<T>` : `items`, `page`, `pageCount`, `total`). Les écoutes
**sans date** n'apparaissent ni dans la liste ni dans le calendrier.

Confidentialité (sauf pour le membre lui-même) : journal privé → journal, calendrier,
activité récente, coups de cœur et « À écouter » vides ; stats privées → `stats` null.
Écoute à l'aveugle : toutes les cartes de disque du profil et les notes des critiques sont
masquées tant que le visiteur n'a pas noté le disque (`blindReleaseItems`, `blindReviewCards`).

## L'Étagère

Table `favorites` (positions 1 à 4, un disque au plus une fois), tous types de disques.
`shelf.set` pose un disque à une place : il remplace l'occupant, ou se déplace s'il est déjà
sur l'Étagère. `shelf.remove` vide une place. `shelf.reorder` reçoit le nouvel ordre des
**mêmes** disques (sinon `SHELF_MISMATCH`). Limite : 120 écritures par heure. Sur le web :
bouton « Mettre sur mon Étagère » sur la fiche d'un disque et dans l'onglet Coups de cœur
(dialogue des 4 places) ; mode « Modifier mon Étagère » sur son profil (boutons ← → et
Retirer, utilisables au clavier, annonces dans une zone `status`).

## Coups de cœur

`user_item_state.liked_at` (migration `0005`, rattrapage `0006` = `updated_at`), index
partiel `(user_id, liked_at desc) where liked and release_id is not null`. Un cœur retiré
puis redonné prend la nouvelle date. Les dates viennent de l'horloge de la base
(`updated_at` des écoutes), pas du `now` de la requête.

## Stats de base

Règles dans `lib/stats/source.ts`, requêtes dans `lib/stats/base.ts` (une agrégation SQL
par bloc, lancées en parallèle) :

- **Compteurs** (année en cours / depuis toujours) : albums, EP et singles distincts écoutés,
  morceaux distincts **journalisés seuls**. Les notes de pistes données dans une écoute
  d'album ne comptent pas comme morceaux écoutés.
- **Répartition des notes** : note actuelle de chaque disque (`user_item_state.rating`).
- **Top 5 artistes / genres de l'année** : en écoutes, réécoutes comprises (crédits des
  disques et des morceaux pour les artistes, genres des disques).
- **Décennies** : écoutes de disques, par année de sortie, depuis toujours.
- **Activité par mois** : écoutes datées de l'année (disques et morceaux).
- L'année en cours est celle du jour dans `profiles.time_zone` ; `listened_on` est déjà une
  date locale du membre. Les écoutes sans date comptent dans les totaux et les décennies,
  jamais par année ni par mois.

L'interface indique « en écoutes, réécoutes comprises » sous les tops et l'activité.

### Cache

`user_stats_cache` : `{ version, year, sections: { base } }`, une ligne par membre.
Supprimé par chaque écriture d'écoute (`recomputeItemState`). Recalculé à la lecture si
`version` a changé (`CACHE_VERSION` dans `lib/stats/index.ts` : à incrémenter quand une
règle ou la forme change), si l'année du membre a tourné, ou après 24 h (des genres peuvent
arriver plus tard avec un import). Une lecture concurrente d'une écriture peut mettre en
cache des chiffres un peu anciens : l'âge maximal le borne.

### Spleen+ (plus tard)

`MemberStats` = `{ tier: "free", base, plus: null, computedAt }`. Les stats avancées
seront une autre section du cache (`sections.plus`), calculée seulement pour les abonnés et
renvoyée dans `plus`, sans changer `base`. Rien n'est codé pour l'instant.

### Performance

Index utilisés : `entries (user_id, listened_on desc)`, clés primaires
`release_artists (release_id, …)`, `release_genres (release_id, …)`, `track_artists
(track_id, …)`, `user_item_state` unique `(user_id, release_id)`. Test
`profile.test.ts > stats performance` : 5 000 écoutes sur 800 disques, calcul complet
< 3 s sur PGlite en mémoire (≈ 0,4 s en local), lecture en cache < 200 ms, page 50 du
journal < 1 s, et un `EXPLAIN` vérifie l'index du journal.
