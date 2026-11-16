# Feuille de route du pilote — jalon 17 « Nouvelle peau »

Écrite par le conseiller d'Azzo. Le pilote (`/pilote`) fait une étape par exécution, dans
l'ordre. Branche `feat/17-nouvelle-peau`. Référence : `docs/design/README.md` et
`docs/design/maquettes/*.png`. Le cadre de `docs/jalon-17-en-cours.md` s'applique partout :
apparence seulement, ni italique ni serif, un seul bloc lilas par page, aucune animation avant
l'étape 7.

## Vérifications habituelles (à chaque étape)

- `pnpm check` ; les specs touchés ; puis l'e2e complet via le sous-agent `verificateur`
  (2 workers, ligne de résumé).
- Build de prod (`pnpm run free-port` d'abord ; Brevo, S3 et `CONTACT_EMAIL` en valeurs
  factices dans la commande seulement, jamais dans `.env`) : specs sans compte et
  `overflow.spec`. `hydration.spec` échoue à l'envoi de l'email (Brevo factice) : attendu,
  seulement s'il échoue à cette ligne.
- axe WCAG 2.2 AA à 1280 et 390 px : pages visiteur sur le build de prod ; pages membre en dev,
  avec un compte e2e jetable supprimé à la fin.
- `scripts/measure.mjs` sur le build de prod, deux passages, comparé à la référence (dernière
  ligne « Mesures » de `docs/jalon-17-en-cours.md`, mêmes pages). Plus de 20 ms de plus sur une
  page : à corriger ou à expliquer dans le journal.
- Captures 1280 et 390 px des pages de l'étape dans `docs/pilote/captures/<n>/`, en visiteur
  et en membre quand la page change selon le cas.

## Étape 5 — Le profil et l'Étagère

Maquette : `D-profil-mobile.png` (mobile seulement ; sur ordinateur, même contenu en mosaïque,
comme les fiches et l'accueil).

- **D'abord, commit à part** : `measure.mjs` vise toujours le même album par son adresse, au
  lieu du premier lien album de l'accueil. Remesurer une fois : nouvelle référence.
- En-tête : grand avatar avec sa tranche, nom en Bricolage 800 (règle des longs titres),
  @pseudo en Geist Mono, bio, abonnés et abonnements.
- Le bouton d'action qui existe déjà : « Suivre » sur le profil d'un autre (vers la connexion
  pour un visiteur), réglages ou « Modifier » sur le sien.
- Trois chiffres : le premier dans le bloc lilas (le seul de la page), les deux autres en
  cartes, avec les données que le profil charge déjà ou que l'API fournit déjà
  (`profile.stats`). Sinon, d'autres chiffres qui existent (décision notée).
- L'Étagère : grille de pochettes arrondies, titre en pilule, à la place du bois et des
  vinyles. Si elle peut contenir plus ou moins de 4 disques, la grille s'adapte et le titre ne
  dit pas « 4 ». Vide : une invitation sur son propre profil, rien sur celui d'un autre.
- Onglets Journal / Critiques / Listes / Stats en contrôle segmenté. Journal en rangées
  regroupées par mois : jour en gros chiffres, vignette, titre, artiste, note en Geist Mono
  lilas.
- Pages du profil : journal (avec la vue calendrier), critiques, listes, stats, abonnés et
  abonnements, éditeur de l'Étagère, avec les mêmes briques. Les états existants gardent leur
  message (journal masqué, compte suspendu, profil sans activité…).
- Ce qui reste de `wood`, `vinyl`, `VinylShelf` ou `Turntable` disparaît.
- Captures : son propre profil, le profil d'un autre, le journal, les stats, l'éditeur de
  l'Étagère.

## Étape 6 — Le reste

Pages : recherche (page `/search` et fenêtre de recherche instantanée), listes (index, fiche
d'une liste, création et édition), notifications, réglages et formulaire de profil,
connexion (lien magique, code à 6 chiffres, `/welcome`), pages légales, 404 et page d'erreur,
page hors ligne, aide des raccourcis clavier, pages d'administration et de modération
(sobres, mêmes briques).

Hors pages :

- **Pochettes générées** : rendu refait avec le nuancier des jetons ; la bande ne passe plus
  jamais sur le titre ; lisibles en vignette.
- **Emails** (connexion et modération) : tableaux et styles en ligne, couleurs de la palette,
  aucune dépendance aux polices web (police de repli), version texte à jour. Le lien et le code
  restent lisibles si le client email inverse les couleurs.
- **Images Open Graph** : nouvelle identité (fond sombre, lune lilas, titre en Bricolage).
  `next/og` (Satori) n'accepte pas le woff2 : TTF ou OTF dans `assets/fonts`.
- **PWA** : manifest (`theme_color` et `background_color` `#0E0C12`), `icon.svg`,
  `apple-icon`, icônes maskables avec la lune lilas dans la zone sûre.

Règles :

- Connexion : le champ du code garde `autocomplete="one-time-code"` et le clavier numérique ;
  `useTypedBeforeHydration` intact.
- Réglages : la suppression du compte en rôle `danger`, confirmations inchangées.
- Pas de bloc lilas sur les pages légales et d'erreur s'il n'apporte rien.
- À la fin de l'étape, plus aucun `font-serif` ni italique dans `apps/web` (vérifié par
  recherche).
- Captures en plus : un email rendu en HTML, une image OG générée, une icône PWA.

## Étape 7 — Les animations

Section « Mouvement » de `docs/design/README.md` :

- Les étoiles se remplissent une à une avec un léger rebond quand on note.
- Les boutons descendent déjà à l'appui : ajouter la remontée en ressort (easing des jetons).
- Les cartes montent de quelques pixels au survol, seulement avec `@media (hover: hover)`.
- Les tendances arrivent en cascade au défilement : `animation-timeline: view()` dans un
  `@supports`. Sans support, tout est visible tout de suite : jamais de contenu caché en
  attendant une animation.
- Sur une fiche mobile, la pochette rétrécit et se range dans la barre du haut au défilement
  (animation liée au défilement).
- Les chiffres comptent jusqu'à leur valeur : la vraie valeur est dans le HTML (lecteurs
  d'écran, sans JavaScript) ; l'animation est décorative (`aria-hidden`), en chiffres
  tabulaires pour ne rien décaler.

Règles : transform et opacity seulement ; 150 ms pour une petite réaction, 300 ms pour un
grand changement ; tout coupé sous `prefers-reduced-motion` ; ni Suspense, ni `loading.tsx`,
ni transitions de page (#29) ; refaisable à l'identique dans l'appli ; aucune animation ne
retarde l'affichage du contenu au chargement.

Tests : les e2e existants ne deviennent pas instables (attendre l'état final, jamais un délai
fixe) ; un test vérifie qu'avec `prefers-reduced-motion` le contenu est visible sans animation.
Vérifier dans le code qu'aucune animation ne touche une autre propriété que transform et
opacity.

## Étape 8 — La passe finale

1. Ménage : retirer l'alias `font-serif` et tout reste de l'ancienne identité (recherche :
   serif, italic, wood, vinyl, brass, velvet, cream, Fraunces, Plex). La page de démo reste (dev
   seulement) et montre l'état final des composants.
2. Captures 1280 et 390 px de toutes les pages, visiteur et membre, revues par le relecteur
   contre les maquettes, en une ou deux fournées.
3. axe sur toutes les pages, `overflow.spec`, e2e complet en dev, specs sans compte en prod.
4. `measure.mjs` complet, comparé à la référence de l'étape 5 et au jalon 12
   (267 / 133 / 229 / 211 / 219).
5. `CLAUDE.md` : la nouvelle identité (jetons, polices, règles du design, où sont les
   maquettes) et les décisions du jalon ; `docs/design/README.md` mis à jour de ce qui a changé
   en route.
6. Puis la fin de jalon du pilote : PR, CI verte, jamais de fusion.
