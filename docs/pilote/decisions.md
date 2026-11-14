# Décisions du pilote

Chaque choix pris sans Azzo : date, étape, choix, raison, alternative écartée. Azzo relit et
peut revenir sur n'importe lequel. Les questions qui demandent Azzo sont sous un titre
`QUESTION POUR AZZO`.

## Déjà décidé avec Azzo (étapes 1 à 4)

- Pas de thème clair ; l'avatar garde sa tranche ; la lune lilas devant « spleen ».
- Fiches mobiles sans en-tête du site : barre ← · étiquette · ⋯ (⋯ seulement s'il y a des
  actions).
- Barre d'onglets : membre = Accueil · Découvrir · + · Notifications · Profil ; visiteur =
  Accueil · Découvrir · Recherche · Se connecter. Lien actif = fond surface-raised + point
  lilas.
- Accueil : « Trouver quoi écouter » provisoire (#31), « Vient de sortir » provisoire (#32),
  mois calculé en UTC (#33), fil en 2 colonnes, rangée « Sorties récentes » retirée, tourne-
  disque retiré.
- e2e local à 2 workers ; tests instables suivis dans #34.

## Décisions du pilote
- 2026-11-14 — étape 5 — `measure.mjs` : la 1re étape ouvre toujours `/fr/album/brume-sur-le-canal`
  par `window.next.router.push` (le routeur d'un `<Link>`). Raison : l'accueil change d'album.
  Écarté : un lien ajouté à l'accueil pour la mesure (changerait la page mesurée).
- 2026-11-14 — étape 5 — Trois chiffres du profil : « disques en {année} » (bloc lilas),
  « depuis toujours », « notés », lus dans `profile.stats` (lecture existante, ajoutée à la page
  en parallèle du profil, partagée avec l'onglet Stats). Raison : « découvertes » et « note
  moyenne » de la maquette n'existent pas dans l'API ; la moyenne serait une règle nouvelle.
  Écarté : calculer une moyenne dans la page (logique métier dans React). Stats privées : pas
  de rangée.
- 2026-11-14 — étape 5 — Étagère d'un autre membre : seulement les disques posés ; vide, la
  section disparaît (le brief : « rien sur celui d'un autre »). Sous-titre reformulé sans « 4 ».
  Message « prend la poussière » gardé pour son propre profil seulement.
- 2026-11-14 — étape 5 — Le sien : bouton « Réglages » (vers `/settings`), pas « Modifier le
  profil » (pas de page dédiée). Section « Récemment » gardée (contenu existant).
- 2026-11-14 — étape 6 — Aucun bloc lilas sur recherche, listes, notifications, réglages,
  connexion, légal, erreurs, hors ligne et admin. Raison : le brief le demande pour légal et
  erreurs ; ailleurs aucun chiffre ni appel à mettre en avant. Écarté : un bloc par page.
- 2026-11-14 — étape 6 — Images OG : titres en Inter Regular (déjà dans `assets/fonts`),
  Fraunces supprimé. Raison : aucun TTF de Bricolage dans le dépôt et le pilote ne télécharge
  rien sans Azzo ; Satori ne fabrique pas de gras. Provisoire : déposer
  `BricolageGrotesque-ExtraBold.ttf` (OFL) dans `apps/web/assets/fonts` pour le rétablir.
  Écarté : Geist du paquet `next/og` (licence à part, fichier interne à Next).
- 2026-11-14 — étape 6 — Page hors ligne et emails en polices système sans serif (Arial /
  pile système) : ni Geist ni Bricolage n'y sont disponibles. Écarté : polices web en email.
- 2026-11-14 — étape 6 — Index des listes : pas de page dédiée dans l'appli ; c'est l'onglet
  Listes du profil, refait à l'étape 5. Rien d'ajouté (pas de nouvelle route).
- 2026-11-14 — étape 6 — Badge « 1 Issue » de Next sur la 404 en dev : React avertit
  « Encountered a script tag » à cause du `<script>` `COVER_ERROR_SCRIPT` de
  `[locale]/layout.tsx` (commit `ba9c786`, jalon antérieur) quand la 404 est rendue côté
  client. Hors périmètre (apparence seulement) : laissé tel quel, capture refaite sans
  l'indicateur de dev. Écarté : déplacer le script (`next/script`), à décider hors pilote.
