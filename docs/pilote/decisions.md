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
