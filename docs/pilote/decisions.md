# Décisions du pilote — jalon 11 « Sorties à venir »

Chaque choix pris sans Azzo : date, étape, choix, raison, alternative écartée. Azzo relit et
peut revenir sur n'importe lequel. Les questions qui demandent Azzo sont sous un titre
`QUESTION POUR AZZO`. Décisions du jalon 17 : `docs/pilote/archives/jalon-17/decisions.md`.

## Déjà décidé avec Azzo (16 novembre)

Règles par défaut du cahier des charges, validées :

- Suivre un artiste : membres connectés ; 500 artistes au plus ; 200 suivis par heure.
- La liste des artistes suivis est privée : visible seulement dans mes réglages.
- « À venir » : disque principal (album, EP, single ; ni live ni compilation) d'un artiste
  suivi, daté après aujourd'hui dans le fuseau du membre, 12 mois au plus.
- Date au jour ou au mois : classée par date. Année seule : « Annoncé, date à préciser ».
- Avant la sortie : ni « J'ai écouté », ni note, ni critique ; « À écouter » autorisé.
- Date modifiée : la dernière date connue, avec un badge « date modifiée ».
- Notifications : le jour de la sortie, regroupées par jour, avec un réglage pour les couper,
  jamais pour un compte suspendu. Elles partent avec la tâche de nuit (vers 4 h à Paris) : pour
  un fuseau très à l'ouest, elles arrivent le soir du jour J.
- Fusion de doublons d'artistes : les suivis passent sur la fiche gardée. Suppression du compte :
  les suivis disparaissent.

Ajouts du conseiller, validés :

- « Les plus attendus » : 2 membres au moins par disque (comme les tendances), comptes
  suspendus exclus.
- Les suivis et le réglage des notifications entrent dans l'export des données et dans la
  politique de confidentialité.

## Décisions du pilote

- 2026-11-16, étape 1 — Suivre une fiche fusionnée suit la fiche gardée (seul un artiste inconnu
  est refusé). Raison : même règle que les autres cibles fusionnées. Écarté : refuser.
- 2026-11-16, étape 1 — L'état « je suis cet artiste » vient d'une procédure à part
  (`artistFollow.status`), pas de `artist.bySlug`. Raison : garder la lecture de la fiche
  identique pour tous (cache public, issue #22). Écarté : un champ `viewerFollows`.
- 2026-11-16, étape 1 — Bouton « Suivre » / « Ne plus suivre », sans `aria-pressed` : le
  libellé dit l'état (correction 1 d'Azzo ci-dessous, appliquée aussi à `FollowButton`). Écarté :
  « Suivi », qui ne dit pas ce que fait le clic.
- 2026-11-16, étape 1 — Réglages : « Mes artistes suivis » sans compteur dans le titre ; le
  bouton redevient « Suivre » au clic (annulation). Écarté : sous-page dédiée.
- 2026-11-16, étape 1 — Lien « Suivre » du visiteur : vers `/sign-in` sans retour sur la fiche.
  Aucun mécanisme de retour après connexion n'existe (tout le monde arrive sur `/welcome`) ;
  aucun créé (correction 2 d'Azzo). Écarté : un paramètre `next` maison.
- 2026-11-16, étape 1 — Statut de suivi lu par slug, en parallèle de la fiche (fiche artiste
  201 → 139 ms). Mesures : retour accueil 218–232 ms contre 210 de référence, mais `dev` mesuré
  dans la même session donne 217–232 (page non touchée) : bruit de la machine. Écarté : rien.
- 2026-11-16, étape 1 — Sans JavaScript, une erreur de suivi (plafond, limite horaire) s'affiche
  sous le bouton (`useActionState`), comme les réglages (relecteur). Écarté : la documenter.
- 2026-11-16, étape 2 — MusicBrainz reste la seule source de date : une sortie inconnue vue
  par ListenBrainz est importée par MusicBrainz, une sortie connue dont la date ListenBrainz
  diffère est relue sur MusicBrainz (ListenBrainz donne la date d'une édition ; relecteur).
  Écarté : créer ou dater la fiche depuis ListenBrainz.
- 2026-11-16, étape 2 — 40 appels MusicBrainz par nuit au plus pour ces imports et relectures.
  Raison : garder le passage dans sa durée actuelle. Écarté : sans plafond.
- 2026-11-16, étape 2 — `announced_at` compare au jour UTC du passage (vers 4 h à Paris, même
  jour civil) ; une date au mois ou à l'année compte par son premier jour. Écarté : le fuseau
  de chaque membre (la fiche est commune).
- 2026-11-16, étape 2 — Une précision ajoutée (« 2027 » → « 2027-03-14 ») n'est pas une date
  modifiée ; seules les dates des sorties annoncées ou futures sont mises à jour par la
  relecture, jamais les dates passées (relecteur). Écarté : tout réécrire.
- 2026-11-16, étape 2 — Budget de nuit dans l'ordre : imports, fiches à compléter, dates
  ListenBrainz plus tôt, puis dates plus tard (souvent une édition, parfois un report) avec ce
  qui reste. Raison : un report reste visible sans gaspiller le budget (relecteur, tour 1).
  Écarté : ne jamais relire une date plus tard (un report passerait inaperçu).
- 2026-11-16, étape 3 — Fiche d'un disque à venir : `ShelfPicker` caché avec « Noter en
  détail » (le brief ne garde que « À écouter » et « Ajouter à une liste »). Écarté : le garder.
- 2026-11-16, étape 3 — Fiche artiste : « Une sortie manque ? » reste affichée aux membres
  quand « À venir » est vide (c'est là qu'elle sert ; une phrase, pas une carte vide).
- 2026-11-16, étape 3 — « La première critique t'attend » inchangée sur un disque à venir
  (règles actuelles des blocs vides, brief). Écarté : une variante (à proposer à Azzo).
- 2026-11-16, étape 3 — Refus `RELEASE_NOT_OUT` pour ce qui ajoute seulement : retirer une
  note, un cœur ou une écoute reste permis (disque reporté après coup ; relecteur).
- 2026-11-16, étape 3 — Fiche artiste : les sorties à venir restent aussi dans la discographie
  et ses compteurs (relecteur : doublon). Choix le plus prudent : ne pas toucher
  `getArtistDetail` dans cette étape, la section « À venir » au-dessus suffit à les situer.
  Écarté : les retirer de la discographie (règle `upcomingSql` côté API) ; à proposer à Azzo
  dans la PR.
- 2026-11-16, étape 3 — Fiche d'un disque à venir : la ligne « Sort le … » suit le jour de
  Paris (identique pour tous, cache public #22), les contrôles le fuseau du membre
  (`releaseNotOut`). Quelques heures autour du jour de sortie, un membre loin de Paris peut
  voir l'une sans l'autre. Écarté : la ligne au fuseau du membre (page différente par membre).
- 2026-11-16, étape 3 — Suggestions de `/upcoming` : boutons « Suivre » secondaires et petits
  (un seul bloc lilas par page, relecteur) ; le bouton principal reste sur la fiche artiste.

- 2026-11-16, étape 4 — « Bientôt dans tes oreilles » en section pleine largeur juste sous la
  grille du haut (donc sous « Ton mois »), pas dans la colonne de droite, trop étroite pour 5
  tuiles. Écarté : une liste compacte dans la colonne.
- 2026-11-16, étape 4 — « Les plus attendus » sans nombre de membres affiché (le brief ne
  demande que disque, artiste, date) et sans données du lecteur (cache public #22). Écarté :
  « 12 membres l'attendent ».
- 2026-11-16, étape 4 — Sorties à l'année seule après les sorties datées dans les 5 tuiles de
  l'accueil et à égalité dans « Les plus attendus » (relecteur : le 1er janvier stocké n'est
  pas une vraie date).

## QUESTION POUR AZZO

Plan de l'étape 1 à valider : docs/pilote/plan-etape-1.md (migration `artist_follows` et
`profiles.notify_releases`). Note du relecteur : la case « Me prévenir le jour de la sortie »
apparaît dès l'étape 1 mais n'agit qu'à l'étape 5 (tout part dans la même PR de fin de jalon).
Réponds ici (« validé », avec tes corrections éventuelles), puis mets la phase `code` dans
`etat.md`.

**Réponse d'Azzo (16 novembre) : validé, avec deux corrections.**

1. Bouton dont le libellé change (« Suivre » / « Ne plus suivre ») : pas d'`aria-pressed`, le
   libellé suffit (un bouton bascule garde un libellé fixe, sinon les lecteurs d'écran
   annoncent « Ne plus suivre, enfoncé »). Même correction pour `FollowButton` (abonnement à
   un membre) s'il fait pareil, dans cette étape.
2. Lien « Suivre » d'un visiteur : vers la connexion avec retour sur la fiche de l'artiste
   après la connexion, comme les autres liens visiteurs vers `/sign-in` (même mécanisme ; s'il
   n'en existe pas, le noter dans le journal sans en créer un).

- 2026-11-16 — Étape 5. Unicité « une notification par membre et par disque » : index unique
  partiel sur (`user_id`, `release_id`) plutôt qu'étendre `notifications_once_uidx` (la
  nouvelle valeur d'enum n'est pas utilisée dans la migration qui la crée). Écarté : modifier
  l'index existant.
- 2026-11-16 — Étape 5. « Aujourd'hui » par fuseau calculé en JS avec `todayIn()`, repli
  `DEFAULT_TIME_ZONE` pour un fuseau refusé, plutôt que `timezone()` en SQL (un fuseau inconnu
  de Postgres ferait échouer tout le passage). Écarté : le calcul SQL.
- 2026-11-16 — Étape 5. **Écart à la feuille de route** : l'e2e n'utilise ni les données de
  démo ni `page.clock`. Le texte est rendu côté serveur (l'horloge du navigateur n'y change
  rien) et aucune date de démo ne reste « aujourd'hui ». Catalogue jetable daté du jour comme
  les autres e2e du jalon, tâche limitée au compte du test. À redire dans la PR. Écarté : figer
  des notifications de démo dans le seed.
- 2026-11-16 — Étape 5 (relecture). Une notification d'un jour passé garde « Sortie
  aujourd'hui : … » (texte de la décision actée), à côté de « il y a 3 jours ». Choix
  prudent : texte inchangé. Écarté pour l'instant : « Sorti le {date} » quand le jour est
  passé. À poser à Azzo dans la PR.
- 2026-11-16 — Étape 5 (relecture). La tâche de nuit tourne à 03:17 UTC : les membres des
  Amériques reçoivent la notification le soir de la sortie (17 h à 22 h chez eux). Choix
  prudent : horaire inchangé (une seule tâche, celle de `catalog:refresh`). Écarté : une
  seconde exécution dans la journée. À poser à Azzo dans la PR.
- 2026-11-16 — Étape 6. axe et captures membre sur les comptes de démo (`nuitblanche` sur le
  build de prod, `rainydaysam` en dev) plutôt qu'un compte e2e jetable : les écrans du jalon
  n'ont de contenu qu'avec les suivis et sorties de la démo. Les captures de « Sortie
  aujourd'hui » restent celles de l'étape 5 (compte jetable). Écarté : recréer les données de
  démo dans un compte e2e.
- 2026-11-16 — Étape 6 (relecture 1 et 2). Le relecteur demandait de masquer la « Note de la
  communauté » et l'invitation à la critique sur un disque à venir. Appliqué puis retiré : les
  « Décisions actées » (fiche d'un disque à venir) disent que les blocs vides (moyenne,
  critiques) suivent leurs règles actuelles. Gardé : le texte visiteur « Connecte-toi pour
  l'ajouter à « À écouter ». » (ce n'est pas un bloc vide ; l'ancien parlait d'écoutes,
  refusées avant la sortie). Fiche d'un titre inchangée : les morceaux ne sont pas concernés
  (décision actée). Captures `*-album_nuit-polaire-*` refaites en dev (axe : 0 violation). À
  poser à Azzo dans la PR : masquer la moyenne et remplacer l'invitation à la critique par
  « Les critiques ouvriront le jour de la sortie. » sur un disque à venir ?
