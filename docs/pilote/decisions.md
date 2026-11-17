# Décisions du pilote — jalon 13 « Quoi écouter ce soir ? »

Chaque choix pris sans Azzo : date, étape, choix, raison, alternative écartée. Azzo relit et
peut revenir sur n'importe lequel. Les questions qui demandent Azzo sont sous un titre
`QUESTION POUR AZZO`. Décisions du jalon 11 : `docs/pilote/archives/jalon-11/decisions.md`.

## Décidé par le conseiller (17 novembre 2026)

Règles par défaut du cahier des charges (section « Quoi écouter ce soir ? (jalon 13) »),
retenues ou ajustées. Le détail de chaque étape est dans les « Décisions actées » de
`feuille-de-route.md`.

**Écouter sur…**

- Fiches album (EP, single), morceau et artiste ; cinq services, toujours dans cet ordre :
  Spotify, Deezer, Apple Music, YouTube Music, Bandcamp. Chaque service a un lien : direct quand
  MusicBrainz le connaît et qu'il passe la validation, sinon une recherche « premier artiste +
  titre » (le nom seul sur une fiche artiste). Ajusté : YouTube Music remplace la recherche
  YouTube actuelle et Bandcamp s'ajoute, comme le dit le cahier.
- Seule source : les relations d'URL de MusicBrainz, demandées dans les requêtes existantes de
  l'import (aucune requête en plus). Aucun appel pendant l'affichage d'une page.
- Fiches déjà importées : relues par la tâche de nuit, plafonnée à 200 disques et 100 artistes
  (10 minutes au plus), puis de nouveau après 30 jours. Ajusté : les morceaux déjà importés ne
  sont pas relus la nuit (une requête de plus par disque) ; ils reçoivent leurs liens directs à
  l'import seulement, et gardent la recherche sinon.
- Validation stricte avant d'enregistrer et avant d'afficher : `https`, hôte exact par service,
  forme de chemin selon le type de fiche, URL reconstruite. Un lien refusé laisse la recherche.
- Aucun lien affilié, aucun paramètre de suivi, aucun logo (noms en texte), liens en
  `nofollow`.

**Tes amis sur ce disque**

- Sur la fiche d'un disque. Ajusté : pas sur les morceaux ni les artistes (le nom de la
  fonction dit « disque » ; une fiche de morceau pourra suivre plus tard).
- Les membres que je suis, avec une note ou un cœur sur le disque ; 5 au plus, les plus récents
  d'abord, puis « Voir tous ».
- Exclus : comptes bloqués dans un sens ou l'autre, comptes suspendus, membres au journal privé.
  Ajusté : « contenus privés » = journal privé, comme pour le fil Amis.
- Écoute à l'aveugle : section cachée tant que je n'ai pas noté le disque. Ajouté : cachée aussi
  sur un disque pas encore sorti (comme la moyenne, voir plus bas), et pour un visiteur.

**Tire un disque**

- Un bouton dans l'onglet « À écouter » de mon profil mène à une page qui tire au hasard, côté
  serveur, un disque de ma liste ; filtres de type (album, EP, single) et de durée (moins de
  30 min, 30 à 60 min, plus d'une heure) ; bouton « Un autre » ; marche sans JavaScript.
- Ajusté : seulement les disques (pas les morceaux, absents de l'onglet du profil), déjà sortis
  dans mon fuseau ; une durée inconnue est exclue quand un filtre de durée est choisi. Rien
  n'est enregistré (ni historique ni compteur). Ferme l'issue #31.

**Restes du jalon 11** (réponses du conseiller du 16 novembre, en issues)

- Notification d'une sortie d'un jour passé : « Sorti le <date> » ; horaire de nuit inchangé.
- Disque pas encore sorti : moyenne masquée et « Les critiques ouvriront le jour de la
  sortie. ».
- Toujours ouvert, hors de ce jalon : retirer les sorties à venir de la discographie de la
  fiche artiste.

**Hors périmètre** : connexion aux services de streaming, lecteurs intégrés, extraits, images ou
logos de marque, liens affiliés, autres services (Tidal, Qobuz, SoundCloud), tirage dans une
liste ou dans tout le catalogue, historique des tirages, amis sur les morceaux, nouveaux textes
légaux.

## Décisions du pilote

- 2026-11-17, étape 1 : l'année de « Sorti le {date} » s'ajoute quand elle diffère de celle du
  jour de Paris (comme `formatUpcomingDate`), calculée par la page à l'affichage ; `releaseDay`
  et `releasedToday` viennent de l'API. Raison : même règle que les dates à venir, aucun champ
  de plus dans l'API. Écarté : un champ `releaseYearShown` dans `NotificationGroup`.
- 2026-11-17, étape 1 : issues de l'étape trouvées : #41 (« Sorti le … ») et #42 (disque à
  venir).
- 2026-11-17, étape 2 : formes d'URL d'après les réponses réelles. YouTube Music : seule la
  forme artiste `/channel/UC{22}` a été vue ; les formes disque (`/playlist?list=`,
  `/browse/`) et morceau (`/watch?v=`) ne sont pas ajoutées (règle actée : une forme jamais
  vue n'est pas ajoutée), ces fiches gardent la recherche YouTube Music. `itunes.apple.com`
  n'apparaît que terminé et sous une autre forme (`/artist/id{n}`) : non accepté. Apple Music
  : slug facultatif gardé comme dans le tableau. Bandcamp : tableau tel quel (artiste `/` vu).
  Raison : prudence, réversible à l'étape 3 si la relecture de nuit en montre. Écarté : ajouter
  les formes YouTube Music du tableau sans exemple réel.
- 2026-11-17, étape 2 : la purge e2e (`deleteE2eAccounts`, `packages/db/src/e2e.ts`) supprime
  les disques jetables, que la clé `restrict` de `listen_links` bloque. Les liens de ces disques
  sont effacés dans `apps/web/e2e/cleanup.ts`, juste avant. Raison : « Autorisé à la fusion »
  n'ouvre dans `packages/db` que le schéma et le seed. Écarté : la ligne dans `e2e.ts`. Le
  disque est lu avec ses liens dans la même requête (sous-requête `json_agg`, comme l'artiste
  et le morceau) plutôt qu'une requête de plus dans le `Promise.all` : rien de plus en
  parallèle sur le pool. Mesure (build de prod, deux passages) : pageMs 212/133/219/182/226
  et 211/134/219/167/227 contre 215/136/231/182/228 : gardé.
