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
- 2026-11-17, étape 3 : la navigation `release?release-group=…&inc=url-rels` renvoie bien les
  relations (BRAT : 25 éditions, toutes avec des liens) : pas de repli sur l'édition de
  référence. Aucune forme YouTube Music disque ou morceau vue : `validListenUrl` inchangé.
- 2026-11-17, étape 3 : la phase des liens a son propre fournisseur (`maxAttempts: 3` au lieu
  de 8) pour borner le dépassement du budget de 10 min. Raison : le relecteur a montré qu'une
  requête à 8 essais peut durer plus de 16 min. Écarté : garder 8 essais et écrire la borne.
  Une navigation qui renvoie 0 édition est traitée comme `not_found` (liens gardés). Écarté :
  retirer tous les liens.
- 2026-11-17, étape 4 : l'inventaire de la démo (`packages/db/src/db.test.ts`, « loads the demo
  dataset ») suit les nouvelles données : 52 disques, 18 profils, 80 écoutes, 14 abonnements.
  Raison : la feuille de route impose un disque et des membres de démo ; ce test compte les
  lignes du seed, et les étapes précédentes (60dcb06) l'ont mis à jour de même. Aucun autre
  test ni e2e ne compte les abonnements de `nuitblanche` (`pnpm check` vert). Écarté : une
  démo sans nouvelles lignes, impossible pour ce besoin.
- 2026-11-17, étape 4 : le snapshot `packages/api/src/__snapshots__/feed-loading.test.ts.snap`
  (fil « Amis » de `nuitblanche`) est régénéré. Raison : deux consignes de la feuille de route
  se contredisent (membres de démo suivis par `nuitblanche` avec une note ou un cœur, et
  « ajuster la démo, jamais les tests ») : le fil montre ces écoutes avec les mêmes règles que
  la section, aucune démo ne peut les y cacher. Le diff ne fait qu'ajouter les 6 écoutes
  visibles (×2 pour le mode aveugle) et décaler les pages ; aucune ligne existante ne change,
  le membre au journal privé reste absent, le fil « Populaire » est identique. Réversible.
  Écarté : des membres suivis par un autre compte (contraire à la consigne) ou l'attente.
- 2026-11-17, étape 4 : `release.friends` reste dans la première vague de la fiche album.
  Mesure (build de prod, `nuitblanche`) : pageMs 257/148/241/192/232, 213/141/238/191/233,
  puis 229/144/236/220/234 contre 215/136/231/182/228 ; le premier passage (257) est un
  démarrage à froid, les deux suivants restent dans les 20 ms pour l'album. Écarté : la
  deuxième vague, inutile à ce niveau.
- 2026-11-17, étape 4, relecture 1 : nouvelle mesure. Même build de prod, trois passages :
  pageMs 239/155/237/173/230, 229/138/237/168/227, 218/139/234/170/229 (profil → `/discover`
  revenu à 168–173 ms : le 220 était du bruit). Contrôle A/B, même build sans l'appel
  `release.friends` (retiré le temps de la mesure, rien de commité) : album 236/207/227/225
  contre 239/229/218 avec. L'écart avec la référence vient de la machine ce jour-là, pas de
  la section : l'appel reste dans la première vague.
- 2026-11-17, étape 4, relecture 1 : le relecteur demande que Azzo valide la régénération du
  snapshot `feed-loading` (voir plus haut). Choix gardé (réversible, ajouts seuls), sans
  attente : point ouvert dans `journal.md` et dans la passation ; l'alternative (membres suivis
  par un autre compte de démo) changerait la consigne de l'étape et l'e2e.
- 2026-11-17, étape 5 : l'issue #31 demandait de remplacer le 2e bouton de l'accueil par « Tire
  un disque au hasard » ; les décisions actées gardent l'accueil inchangé et mettent l'accès
  dans l'onglet « À écouter » de mon profil : elles priment, le bouton provisoire de l'accueil
  reste. Écarté : changer l'accueil (contraire à la consigne).
- 2026-11-17, étape 5 : « Un autre » navigue avec `useNavigate().push` dans un `onSubmit` (formulaire
  GET classique sans JavaScript). Raison : règle du projet (seul moyen de naviguer depuis le
  code, il alimente la barre du haut). Écarté : `next/form` (navigation hors de la barre).
- 2026-11-17, étape 5 : le cas « rien n'est encore sorti » se lit sur la page sans champ de
  plus : `listTotal` > 0 et `matching` 0 sans filtre ; avec un filtre, « aucun ne correspond »
  puis « Retirer les filtres » mène à ce cas. Raison : forme de réponse actée `{ listTotal,
  matching, pick }`. Écarté : un champ `released`.
- 2026-11-17, étape 5 : démo `seed/pick.ts` (6 disques sortis dans « À écouter » de
  `nuitblanche`) → inventaire `db.test.ts` (sorties 52 → 58) et test « demo members » de
  `listening.test.ts` (7 disques, ordre réel en `toEqual` complet) mis à jour. Les dates
  `updated_at` sont fixées (1 à 6 jours avant) car les lignes du seed partagent le `now()` de la
  transaction (ordre sinon aléatoire). Artistes choisis hors des tests (pas `lune-basse` ni
  `odette-marchal`), titres sans les mots tapés par les tests de recherche. Écarté : un compte
  de démo dédié (plus de données, aucun gain).
- 2026-11-17, étape 5 : le contrôle de débordement à 390 px de `/fr/pick` et de mon onglet est
  dans `pick.spec.ts` (bloc « on a phone », compte jetable), pas dans `overflow.spec.ts` : ce
  dernier tourne sur le build de prod sans compte (l'inscription y échoue, Brevo factice).
  Écarté : se connecter avec un compte de démo dans `overflow.spec` (aucun précédent).
- 2026-11-17, étape 5 : `measure.mjs` gagne `MEASURE_ONLY=<chemin>` (un seul parcours accueil →
  chemin, même lecture) pour mesurer `/pick`, hors des cinq parcours. Mesure (build de prod) :
  `/pick` 138/141/142 ms, référence 142 ; cinq parcours pageMs 237/151/245/195/248 et
  238/147/239/196/248 contre 215/136/231/182/228. Album et `/discover` → accueil à +20/+22 ms :
  l'étape ne touche ni la fiche album, ni l'accueil, ni `/discover` (seul le bouton de mon onglet
  change sur un profil), et la même dérive de la machine était déjà vue à l'étape 4 (album
  218–239 sans changement). Relecture 1 : contrôle A/B dans la même session, build de prod de
  `d70f426` (fin de l'étape 4) contre `f6fcdad` : pageMs 225/140/229/187/233 et
  226/144/233/188/231 contre 221/143/230/184/234 et 220/138/229/187/232 : aucun écart dû à
  l'étape, tout dans les 20 ms de la référence.
- 2026-11-17, étape 5, relecture 1 : la durée de la carte vient de l'API (`durationMinutes`,
  `pickMinutes`) : vers le bas sous 30 min, vers le haut au-delà d'une heure, sinon au plus
  proche, pour ne jamais contredire le filtre (29:59 n'affiche pas « 30 min »). Le titre et la
  ligne des artistes rapetissent sur téléphone selon le mot le plus long
  (`phoneCardTitleSize` / `phoneCardLineSize`, `lib/display-title.ts`), la carte partant de
  32 px quand `phoneTitleSize` part de 48/56. La fiche album garde son arrondi. Écarté :
  réutiliser `phoneTitleSize` (tailles plus grandes que celles de la carte).
- 2026-11-17, étape 6 : captures (build de prod, axe WCAG 2.2 AA : 0 violation, aucun
  débordement, visiteur et `nuitblanche`). Deux états copiés plutôt que refaits, le code étant
  inchangé depuis : la liste vide de `/pick` (captures de l'étape 5, compte jetable) et les
  notifications (étape 1). Le morceau `archangel-burial` n'a que des liens de recherche : aucune
  fiche morceau de la base de dev n'a de relation URL MusicBrainz. Écarté : importer un morceau
  pour la capture (écriture dans le catalogue sans besoin).
- 2026-11-17, étape 6 : mesures (build de prod, pageMs) d'abord 238/146/235/198/247 et
  233/144/242/195/240 contre 215/136/231/182/228 ; A/B demandé par le plan, même session :
  `origin/dev` 213/134/215/180/223 et 214/134/220/180/226, HEAD (`d806eee`) 215/129/211/179/223
  et 213/132/216/180/223 : aucun écart dû au jalon, le premier écart venait de la machine.
  `/pick` 137/136, référence 142. Specs sans compte + `overflow.spec` sur prod : 116 réussis,
  2 échoués (`hydration.spec.ts:17`, Brevo factice, déjà connu), 10 ignorés.
- 2026-11-17, étape 6 : le premier `pnpm build` est sorti en code 1 juste après l'avertissement
  « Next.js 16.4.2 affected by a known security vulnerability » ; le second a réussi. Aucune
  montée de dépendance permise dans le jalon : point ouvert pour Azzo dans la PR.

## QUESTION POUR AZZO (17 novembre 2026, fin du jalon 13)

PR 46 (`feat/13-quoi-ecouter` → `dev`), CI verte. Le relecteur rend `BLOQUANT` avant la fusion,
pour une raison formelle : `packages/db/src/db.test.ts` (inventaire de la démo : disques 51 → 58,
profils 11 → 18, écoutes 73 → 80, abonnements 7 → 14, aucune assertion retirée) sort de
« Autorisé à la fusion » (« rien d'autre dans `packages/db` hors du seed »). Pas de fusion
automatique.

1. Acceptes-tu cette mise à jour de `db.test.ts` et le snapshot `feed-loading.test.ts.snap`
   régénéré à l'étape 4 ? Si oui : fusionne la PR 46 toi-même (commit de fusion), ou réponds
   « fusion autorisée » ici et remets la phase `plan` dans `etat.md` (étape « fin du jalon ») :
   le pilote refera la section 6.
2. Next.js 16.4.2 est annoncé vulnérable pendant `pnpm build` (un premier build en code 1, le
   second passe). Faut-il une PR `chore/` de mise à jour avant la release `dev` → `main` ?

Réponse d'Azzo (17 novembre 2026, dans la conversation) : « Oui, fusion autorisée » (point 1 :
`db.test.ts` et snapshot `feed-loading` acceptés). Point 2 (Next.js) sans réponse : reste ouvert
dans la PR de release.
