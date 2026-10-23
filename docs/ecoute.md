# Écoute, notes et journal (jalon 5)

Tout est dans `packages/api/src/lib/listening/` (routers `listening.*` et `review.*`) ; la
dérivation de l'état vit dans `packages/db/src/listening-state.ts` pour que le seed et l'API
utilisent exactement le même code.

## Modèle

- `entries` = le journal : une ligne par écoute d'un album/EP/single **ou** d'un morceau
  (les artistes ne s'écoutent pas). Note 1..10 (0,5 à 5 étoiles), cœur, réécoute, format,
  humeurs (`entry_moods`), notes de pistes (`track_ratings`, écoutes d'album seulement).
- `user_item_state` = l'état actuel d'un membre pour un disque ou un morceau, **toujours
  dérivé** des écoutes par `recomputeItemState()`, appelée dans la même transaction que
  chaque écriture (création, modification, suppression d'écoute ou de note de piste). Elle
  augmente aussi la version de stats du membre (voir `docs/profil-stats.md`).
- `reviews` : indépendantes des notes. Une critique peut être liée à une écoute
  (`entry_id`) ; sa note est un instantané de cette écoute (mis à jour quand l'écoute change).

## Règles de l'état

| Champ           | Règle                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| `listened`      | au moins une écoute (ou une note de piste pour un morceau)              |
| `rating`        | note de l'écoute **modifiée le plus récemment** (`updated_at`) qui en a une |
| `liked`         | cœur de l'écoute modifiée le plus récemment                            |
| `want_to_listen`| « À écouter » ; remis à faux par toute nouvelle écoute                  |
| ligne supprimée | plus aucune écoute et pas « À écouter »                                 |

L'état d'un morceau tient compte de ses propres écoutes et des notes données piste par piste
dans les écoutes d'album (même règle `updated_at`, jamais de cœur).

## Écoute sans date

`listened_on` est nul pour **au plus une** écoute par membre et par cible (index uniques
partiels `entries_undated_*`). C'est là que vivent la note rapide et le cœur donnés depuis
une fiche :

- note rapide ou cœur → crée ou met à jour cette écoute ; elle reprend d'abord l'état actuel
  (changer la note ne touche pas au cœur, et inversement) ;
- retirer la note rapide → si l'écoute n'a plus ni note, ni cœur, ni critique, ni note de
  piste, elle est supprimée ; la note actuelle redevient celle du journal s'il y en a une ;
- retirer le cœur depuis la fiche le retire de toutes les écoutes (sans toucher à leur
  `updated_at`) ;
- on peut donner une date à une écoute sans date : elle entre dans le journal. Une écoute
  datée garde toujours sa date (`DATE_REQUIRED`).

**Ordre des notes rapides.** Plusieurs clics rapprochés ne doivent jamais laisser une
ancienne note enregistrée :

- client (`ListenControls`) : les clics à moins de 350 ms d'intervalle partent en une seule
  requête (la dernière valeur) ; seule la réponse à la dernière note est appliquée ;
- serveur : chaque note porte un `order` `{ clientId, seq }` (un identifiant tiré au hasard
  par panneau affiché, un numéro croissant). Sous le verrou du membre (`bumpStatsVersion`),
  une requête du même panneau dont le numéro n'est pas plus grand que le dernier appliqué
  est ignorée (`user_listening_version.quick_client_id` / `quick_seq`). Un autre panneau
  (rechargement, autre onglet) a sa propre numérotation : la dernière écriture gagne.

« J'ai écouté » et le formulaire « Journaliser » créent une écoute datée : **aujourd'hui dans
le fuseau du membre** (`profiles.time_zone`, IANA, détecté à l'inscription, modifiable dans
les réglages ; `todayIn()` dans `@spleen/validators`). Une date future est refusée.

## Note piste par piste

`suggestAlbumRating()` (moyenne arrondie à la demi-étoile) est affichée comme suggestion avec
un bouton « Appliquer ». Elle n'est **jamais** appliquée par l'API.

## Humeurs et formats

- Humeurs proposées : 20, dans `packages/db/src/seed/seed.ts` (`suggestedMoods`, libellés
  FR/EN mis à jour à chaque seed, slugs figés, nouvelles humeurs ajoutées à la fin). Humeurs
  personnelles : même libellé dans les deux langues, 50 au plus par membre, 8 par écoute.
- Formats : `listenFormats` dans `@spleen/validators` (l'enum Postgres en dérive) : vinyle,
  CD, cassette, streaming, téléchargement, radio, concert, autre.

## Réglages et confidentialité

- **Écoute à l'aveugle** : l'API masque moyenne, nombre de notes, répartition et notes des
  critiques des disques/morceaux que le membre n'a pas notés (`ratingsHidden: true`) sur les
  fiches, la recherche et la discographie (`lib/listening/blind.ts`).
- **Journal privé** : journal, activité récente et « À écouter » vides pour les autres
  (`diaryHidden`) ; les notes comptent toujours, anonymement, dans les moyennes.
- **Stats privées** : `statsHidden`.

## Limites de débit (par membre et par heure)

Écritures d'écoute (écoutes, notes, cœurs, « À écouter ») 300 · critiques 30 · humeurs
personnelles 30 → `RATE_LIMITED`.

## Stats et profil (jalon 6)

Voir `docs/profil-stats.md` (Étagère, coups de cœur, journal liste et calendrier, stats SQL
et leur cache). `user_item_state.liked_at` est dérivé ici aussi : gardé tant que le cœur
reste, remis à la date de l'écoute quand le cœur est (re)donné.
