# Jalon 17 « Nouvelle peau » — passation

Reskin de Spleen avec le design « Lilas » (`docs/design/README.md` + 4 maquettes `.html`/`.png`).
**Apparence seulement** : aucune API, base ou logique ne change ; comportements et e2e restent
verts. Si un e2e dépend d'un texte ou d'une classe modifiés, on adapte le sélecteur, jamais le
comportement testé. Branche `feat/17-nouvelle-peau`.

## Contraintes (rappel)

- Jetons dans `packages/design-tokens`, rien de propre au web (réutilisés par Expo).
- Polices via `next/font` auto-hébergées, CSP inchangée.
- AA : contraste texte 4,5:1, non-texte 3:1 (WCAG 1.4.11), cibles ≥ 44 px (52 px pour le
  bouton principal), focus visible (lilas ; encre `accent-fg` sur fond lilas), axe vert.
- Animations : transform et opacity seulement, coupées par `prefers-reduced-motion`. Pas de
  Suspense, pas de `loading.tsx`, pas de transitions de page.
- Perf vérifiée sur build de prod + `scripts/measure.mjs` à chaque étape.

## Étapes

1. **Fondations** — faite (commit `a21ef4a`).
2. **Coquille** — faite (commit `b74d8ac`) : barre de navigation, barre d'onglets flottante mobile avec « + » au centre,
   pied de page, suppression du thème clair.
3. **Pages de détail** — faite : album, artiste, morceau, critique.
4. **Pages d'accueil** — faite : accueil visiteur et membre, /discover.
5. **Profil et Étagère** — faite (pilote, `0e230ff`..`6fe3741`) : en-tête, trois chiffres,
   Étagère en grille, journal, stats, abonnés.
6. Le reste : recherche, listes, réglages, connexion, légal, 404, hors ligne, emails, OG, PWA
   (icon.svg, apple-icon, polices OG `assets/fonts`).
7. Animations.
8. Passe finale : captures vs maquettes, axe, measure.mjs, e2e en prod, mise à jour CLAUDE.md.

## Étape 1 — ce qui a été fait

- `packages/design-tokens` : palette Lilas, thème unique `dark` (rôles `border-field` #676371
  et `star-empty` #7967A8 à 3:1, `accent-edge`, `edge`), `scales.ts` (rayons, ombres exactes
  des maquettes, `edgeDepth`, `fontFamily`, `motion` avec easing ressort, `size` 44/52 px),
  nouveau nuancier de pochettes. `tokens.test.ts` : paires AA texte + 3:1 non-texte.
  `ThemeName`/`defaultTheme` gardés **temporairement** pour `lib/theme.ts` et `ThemeToggle`.
- `app/fonts.ts` : Bricolage Grotesque 700/800, Geist (variable), Geist Mono 400/500
  (`preload: false`), latin seulement. `globals.css` : halo et grain supprimés, h1–h3 en
  display, focus lilas (`.on-accent` → encre). `--font-serif` est **aliasé** sur display.
- Composants `components/ui` : `Button` (primary, secondary, outline = alias, ghost, ink,
  on-accent ; tailles md, sm, icon, icon-lg), `Card` (`tone="accent"`), `Badge`, `Pill`
  (nouveau), `Field`, `Stars`, `StarRating` (sm, md, lg), `Avatar`, `segmented.ts` pour
  `Tabs`/`LinkTabs`, `SectionHeading`, `Cover`. `Logo` : croissant seul devant « spleen ».
  `Turntable` et `VinylShelf` seulement remappés (refaits à l'étape 5).
- Emails, OG, manifest, offline : anciens noms de palette remplacés (refonte à l'étape 6).
- Page démo dev `/[locale]/dev/composants` (404 en prod, noindex, textes `devComponents`).

### Mesures

- axe (WCAG 2.2 AA) sur la page démo en dev : 0 violation.
- Polices latin : Bricolage 41,2 Ko (un fichier variable pour 700 et 800), Geist 29,3 Ko
  (préchargées : 70,5 Ko), Geist Mono 23,1 Ko (à la demande). Total 93,6 Ko.
- `measure.mjs`, build de prod, page affichée (ms) : 254 / 126 / 220 / 203 / 202
  (jalon 12 : 267 / 133 / 229 / 211 / 219). Pas de régression.

## Appris en route

- `next start` local exige les variables Brevo et S3 : les passer en valeurs factices dans
  l'environnement du shell (dotenv-cli ne les écrase pas), session de mesure enregistrée avant
  contre `pnpm dev` avec `MEASURE_STATE` (`docs/environnement.md`).
- next/font sort un fichier par sous-ensemble Unicode même avec `subsets: ["latin"]` ; seul le
  latin est préchargé, les autres ne se téléchargent que si la page contient ces caractères.
- Bricolage 700 et 800 = un seul fichier variable : demander les deux poids ne coûte rien.
- L'extension Chrome peut être déconnectée : captures et axe via un script Playwright
  (`@playwright/test` + `@axe-core/playwright` résolus depuis `apps/web`).
- e2e complet en dev : `legal.spec.ts` et `moderation.spec.ts` (vérification du pseudo) ont
  échoué une fois sous charge et passent relancés seuls (timing, pas de régression).

## Étape 2 — ce qui a été fait (commit `b74d8ac`)

- Retouches de l'étape 1 (commit `ac398f9`) : boutons et champs désactivés à plat, chevron du
  select, rangées « focus permanent » (`.focus-shown`) sur la page démo.
- **En-tête** : dès `md`, pilule flottante collante (logo, liens, recherche, cloche, avatar) ;
  lien actif = fond `surface-raised` + point lilas (pas de pilule lilas, réservée au bouton
  principal et au grand bloc). Mobile : rangée non collante, logo complet, loupe et avatar pour
  les membres. `UserMenu` sans « Découvrir ». Données partagées : `server/shell.ts` (`cache`).
- **Barre d'onglets mobile** (`TabBar`, `TabBarItems`) : membre = Accueil, Découvrir, « + »
  (« Noter un disque », ouvre la recherche ; lien `/search` sans JS), Notifications, Profil ;
  visiteur = Accueil, Découvrir, Recherche, Se connecter. Masquée (opacity/transform) quand un
  champ texte a le focus. `scroll-padding` haut (pilule) et bas (barre), WCAG 2.4.11 ;
  bannières « Annuler » au-dessus (`--undo-offset`).
- **Pied de page** : logo, liens légaux, raccourcis clavier, choix de langue (sorti de l'en-tête).
- **Thème clair supprimé** : `ThemeToggle`, `lib/theme.ts`, cookie et sa lecture, `ThemeName`.
  `profiles.theme` reste (Zod : facultatif, `"dark"` par défaut) → **issue #30** pour le retirer.
  Politique de confidentialité : mention du cookie retirée, `LEGAL_UPDATED` par page
  (privacy 2026-11-12). Note ajoutée à l'**issue #22** (ce qui rend encore les pages dynamiques).
- Fiche album : `grid-cols-1` sur mobile (la colonne débordait à 425 px pour 390).

### Appris en route

- `cn()` = `clsx` seul, sans fusion : `hidden md:inline-flex` sur un `buttonClasses` perd contre
  le `inline-flex` de la base. Utiliser `max-md:hidden` (une variante gagne sur la base).
- Grille sans `grid-cols-*` = colonne `auto` dimensionnée au contenu : `min-w-0` sur l'enfant
  ne suffit pas, il faut `grid-cols-1` (`minmax(0,1fr)`).

### Mesures

- axe (WCAG 2.2 AA), 1280 et 390 px, accueil visiteur et membre, fiche album (dev et prod),
  page démo (dev) : 0 violation. Aucun débordement horizontal à 390 px sur 8 pages.
- `measure.mjs`, build de prod, page affichée (ms) : 254 / 130 / 221 / 201 / 207
  (étape 1 : 254 / 126 / 220 / 203 / 202). Pas de régression.
- e2e complet : en dev seulement. Sur un build de prod local, l'inscription envoie un vrai
  email (Brevo exigé en production) : avec une fausse clé, tous les tests qui s'inscrivent
  échouent (HTTP 401). L'e2e sur build de prod viendra avec l'e2e en CI (jalon 10).

## Étape 3 — ce qui a été fait

- Fiche mobile : l'en-tête est remplacé par `DetailBar` (← retour, libellé mono, ⋯ « Plus
  d'actions » pour les membres : signaler, modifier). La ligne d'en-tête est cachée en CSS
  (`body:has([data-detail-bar])`, hauteur 0 + `visibility`, pas `display: none` : la recherche
  plein écran du « + » vit dans cette ligne). Desktop : en-tête normal.
- **Album** : grande pochette, pastilles (type, année, titres · durée), titre géant
  (`phoneTitleSize` réduit un mot long sur téléphone), « par » souligné, genres, date ;
  carte « Ta note » (`ListenControls`), « Écouter sur » en pilules ; mosaïque lilas
  `CommunityRating` + `MyListensCard` (compte, dernière/première écoute, journal, liste
  dépliable « Modifier mes écoutes ») + `InListsCard` ; tracklist en rangées alternées ;
  critiques et listes. **Artiste** : avatar rond, carte lilas « Discographie », carte écoute/liste.
  **Morceau** : version réduite de l'album, « sur [album] », « Paraît sur ».
  **Critique** : vignette, auteur, corps en carte, carte lilas « Sa note » (étoiles encre),
  pilules j'aime / commentaires, commentaires en cartes, formulaire en carte.
- Plus d'italique ni de serif sur ces pages (ReviewCard, LogDialog, ReleaseTile, Comments).
- i18n : espace `detail`, `album.actions.log` = « Noter en détail… ». e2e adaptés (listening,
  undo-delete, moderation, keyboard).

### Appris en route

- Règles CSS dans `@layer base` perdent contre les utilitaires : la règle de la fiche mobile
  est hors couche. `cn` = clsx seul : surcharger avec `!`.
- Un `<dialog>` modal ne s'affiche pas si un ancêtre est en `display: none`, même dans la
  couche supérieure ; `visibility: hidden` + `visibility: visible` sur le dialog suffit.
- Dans une carte demi-largeur (mobile), une rangée flex `min-w-0 flex-1` peut tomber à 0 px :
  container query (`@container`, `@[16rem]:`) pour passer la date sur sa propre ligne.
- En dev, l'indicateur Next (en bas à gauche) couvre le premier onglet de la barre mobile :
  les e2e y naviguent au clavier.
- `CONTACT_EMAIL` est aussi exigé par `next start` ; après `TaskStop` de `pnpm dev`, un
  `next` orphelin peut rester sur 3000 (le tuer avant le build de prod).
- e2e complet en dev à 4 workers (défaut local) : échecs de charge, différents à chaque run
  (`social.spec` jeton de lien magique, « render cancelled mid-stream » après une recherche,
  puis `accounts.spec:58` et `legal.spec:15` en délai dépassé) ; tous passent relancés seuls,
  et l'e2e complet passe en entier avec `--workers=2` (6 min 52). C'est la charge du serveur
  de dev, pas une régression.

### Mesures

- Build de prod, specs sans compte : 104 passent, 10 ignorés ; seul `hydration.spec` (email
  tapé avant l'hydratation) échoue, attendu avec la clé Brevo factice : ligne 26 (« Regarde ta
  boîte mail » absent), le champ garde bien l'email tapé, le serveur logue Brevo HTTP 401.
  `overflow.spec` passe.
- axe WCAG 2.2 AA, visiteur, 1280 et 390 px, album / artiste / morceau / critique : 0 violation.
- axe WCAG 2.2 AA, membre (dev, compte e2e jetable avec une écoute notée), album et morceau,
  1280 et 390 px, « Ton écoute » et « Tes écoutes » remplies, dépliant ouvert : 0 violation.
- e2e complet en dev, `--workers=2` : tout passe. `pnpm check` : 26/26.
- `measure.mjs`, build de prod, page affichée (ms) : 267 / 134 / 230 / 217 / 216, deux passages
  identiques à ±2 ms (étape 2 : 254 / 130 / 221 / 201 / 207). +4 à +16 ms, y compris sur
  profil, /discover et accueil que l'étape n'a pas touchés : plutôt la machine que les pages ;
  à surveiller à l'étape 4.
- `measure.mjs` : sélecteurs en `:visible` (le premier lien artiste de l'album est désormais le
  bouton retour de la barre mobile, caché sur ordinateur).

## Étape 4 — ce qui a été fait

- Commit e2e séparé (`1675094`) : 2 workers en local par défaut (`PLAYWRIGHT_WORKERS`), ligne
  de résumé de `pnpm e2e:quiet` (`e2e/summary-reporter.ts`, `scripts/e2e-quiet.mjs`). Règle la
  question ouverte de l'étape 3 ; la CI ne change pas.
- Accueil membre : bloc lilas (date du jour, « Qu'est-ce que tu écoutes, {nom} ? » avec
  `phoneTitleSize`, « + Noter un disque » = même recherche que le « + », « Trouver quoi
  écouter » → /discover, provisoire, #31) ; « Ton mois » (`profile.diaryMonth`, seule lecture
  ajoutée ; mois de `currentMonth()` partagé avec le journal, en UTC, #33) ; « Vient de
  sortir » (1er disque de `discovery.recent`, #32) ; tendances ; « Chez tes amis » avec
  Amis / Populaire en grille 2 colonnes (3 colonnes trop serrées pour `FeedItemCard`, validé).
- Accueil visiteur : bloc lilas « Note tes disques, tiens ton journal. », « Comment ça
  marche », « Vient de sortir », tendances, critiques populaires. Turntable et rangée
  « Sorties récentes » retirés des accueils.
- /discover : en-tête = bloc lilas ; filtres en `SelectField` / `TextField` (pilules) ;
  mieux notés en rangées alternées ; plus de serif ni d'italique.
- `ReleaseTile` (partagé) : pochette `rounded-cover`, note mono « ★ 4,6 » ; pastille de rang
  seulement avec `rank` (tendances), vérifié sur artiste, recherche, profil.
- `FeedItemCard` : titre en display gras (plus de serif).

### Appris en route

- Git Bash : un chemin `/c/Users/…` passé à Node devient `C:\c\Users\…` ; donner des chemins
  `C:/Users/…` aux scripts Node et Playwright.
- Navigateur headless absent → tous les tests échouent en quelques secondes :
  `pnpm exec playwright install chromium-headless-shell`. `PLAYWRIGHT_CHANNEL=chrome` en
  dépannage seulement, jamais commité.
- Après `TaskStop` de `pnpm start`, `next start` reste orphelin sur 3000 comme le dev :
  `netstat`, puis `/api/trace-debug` (404 = prod) avant `taskkill`.

### Mesures

- `pnpm check` : vert. Specs touchés (mockup, listening avec « Ton mois », lists, social) : 38/38.
- e2e complet en dev, 2 workers : 219 réussis, 1 échoué, 10 ignorés (6 min 55) ;
  `keyboard.spec:65` passe relancé seul (12/12) → #34.
- Build de prod, navigateur headless : specs sans compte 104 réussis, 10 ignorés ; seul
  `hydration.spec` échoue (Brevo factice, attendu) ; `overflow.spec` passe.
- axe WCAG 2.2 AA, tous impacts, 1280 et 390 px, build de prod : /fr, /en, /fr/discover
  (avec et sans filtres) : 0 violation.
- `measure.mjs`, build de prod, page affichée (ms) : 196 / 130 / 234 / 215 / 225, deux
  passages à ±5 ms (étape 3 : 267 / 134 / 230 / 217 / 216). accueil→album n'est plus
  comparable (premier lien album = « Vient de sortir », autre disque) ; discover→accueil
  +9 à +14 ms, sous le seuil de 20 ms.

## Étape 5 — ce qui a été fait (pilote)

Plan : `docs/pilote/plan-etape-5.md` ; décisions : `docs/pilote/decisions.md`.

- `measure.mjs` : étape 1 = album fixe du seed (`0e230ff`) ; nouvelle référence
  217 / 133 / 223 / 207 / 209 ms.
- Profil : avatar à côté du nom, actions sous le nom sur mobile, « Réglages » pour soi ;
  `profileNameLayout()` (`lib/display-title.ts`) : avatar au-dessus du nom au-delà de
  12 lettres dans un mot, taille selon le mot le plus long.
- Trois chiffres (`profile.stats` en `cache()`, réutilisé par l'onglet Stats) : disques cette
  année (carte lilas), depuis toujours, notés.
- Étagère : `ShelfGrid` (pochettes arrondies, titre en pilule opaque) ; vide chez un autre
  membre → section absente ; `ShelfEditor` avec emplacements en pointillés.
  `VinylShelf` et `Turntable` supprimés.
- Journal en cartes (jour en display, note « ★ 4,5 » mono) ; sur mobile le support suit
  l'artiste. Calendrier, stats et listes d'abonnés au même style ; plus d'italique.

### Appris en route

- `cn()` = `clsx` sans fusion : `hidden` posé sur un composant qui a déjà `inline-flex`
  ne gagne pas toujours. Envelopper, ou faire porter toutes les tailles par une seule source.
- `break-words` masque un mot coupé : `overflow.spec` passe, seule une capture le montre.

### Mesures

- `pnpm check` vert ; e2e complet en dev, 2 workers : 220 réussis, 0 échoué, 10 ignorés
  (le teardown signale un « render cancelled mid-stream » → #34).
- Prod, specs sans compte : 104 réussis, 10 ignorés (seul `hydration.spec` échoue, attendu).
- axe WCAG 2.2, 1280/390 : 0 violation (visiteur et membre, éditeur ouvert, nom long).
- `measure.mjs` ×2 : 222/136/231/205/228 et 221/134/223/204/221 (référence ci-dessus, < 20 ms).
  Son propre profil juste après une écoute : 226–247 ms (204–206 à chaud).

## Étape 6 — ce qui a été fait (pilote)

Plan : `docs/pilote/plan-etape-6.md` ; décisions : `docs/pilote/decisions.md` (étape 6).
Commits `4bd712a`..`1f3c7f7`.

- Recherche (filtres en piste segmentée, pilule active lilas), listes, notifications en
  cartes (lue / non lue), réglages et connexion en `Card`, légal, 404 et erreurs (grand
  numéro en encre), admin (dates seules) : titres display, plus de serif ni d'italique.
- `Field` : les champs et listes en pilule, la zone de texte en `rounded-2xl`.
- Page hors ligne : pile système, bouton pilule lilas de 52 px, contour `mist` au focus.
- Pochettes générées (`Cover.tsx`) : formes dans le haut quand le titre est imprimé ;
  centrées et plus grandes sans texte (`LabelBand`, `Moon`).
- Emails (lien magique, suspension) en tables : fond `night`, carte `plum`, bouton lilas.
- OG : lune + « spleen », titre en Inter 400 (provisoire, Bricolage absent) ; Fraunces
  supprimée. Icône PWA : carré `night` + croissant lilas, PNG régénérés.

### Appris en route

- `/welcome` redirige un compte existant vers son profil : capturer le formulaire demande
  un compte neuf.
- Dans le gabarit d'un email, un `"
"` remplacé par un script devient un vrai saut de
  ligne : éditer ces chaînes à la main.

### Mesures

- `pnpm check` vert ; e2e complet en dev : 220 réussis, 0 échoué, 10 ignorés.
- Prod, specs sans compte : 104 réussis, 10 ignorés (seul `hydration.spec`, attendu).
- Après les corrections : specs instant-search, lists, legal, moderation, a11y et overflow,
  68 réussis, 8 ignorés.
- axe WCAG 2.2, 1280/390 : 0 violation.
- `measure.mjs` ×2 : 214/128/221/197/219 et 214/129/216/183/218 (référence 217/133/223/207/209).
  Sans référence antérieure, à reprendre à l'étape 8 : `/fr/search?q=pluie` ≈ 117 ms, fiche
  liste ≈ 110 ms.

## Étape 7 — ce qui a été fait (pilote)

Plan : `docs/pilote/plan-etape-7.md`. Commits `8651b34`..`eafd049`. Apparence seulement.

- Ménage : plus de `transition-colors` (7 composants) ni `animate-record` ; seuls transform et
  opacity bougent, tout sous `prefers-reduced-motion: no-preference`.
- `Button` : l'appui descend vite, le relâchement remonte en ressort (`--ease-spring`).
- `Stars` (`pop`) / `StarRating` : les étoiles pleines rebondissent une à une à chaque note
  donnée, jamais au chargement.
- `Card lift` (`ListCard`) et `ReleaseTile` : montée de 4 px au survol (`motion-safe:`).
- Tendances : `.scroll-cascade` (scroll-driven, transform seul, décalage par colonne en CSS
  selon la grille 2 / 3 / 6 colonnes) ; sans support ou mouvement réduit : rien.
- Album et morceau sur mobile : la pochette rétrécit au défilement (`.cover-scroll`) et une
  vignette `CoverThumb` (background CSS, sans `<img>`) apparaît dans `DetailBar`.
- `CountUp` (profil, `StatsPanel`) : compte seulement s'il entre à l'écran après le chargement ;
  valeur en `sr-only`, largeur réservée.
- `e2e/motion.spec.ts` : contenu visible, rien ne bouge en mouvement réduit.

### Appris en route

- Une tuile animée en opacity sous la ligne de flottaison fait échouer axe (`color-contrast`) :
  cascade en transform seul.
- Une vignette en `<img>` compte comme une seconde pochette (`covers.spec`) : background CSS,
  que Chrome ne télécharge pas tant que l'élément est `display: none`.
- La règle globale reduced-motion (durées à 0,01 ms) ne suffit pas pour les animations liées au
  défilement : garde `no-preference` explicite.
- En fin d'animation, `transform` calculé vaut `matrix(1, 0, 0, 1, 0, 0)` et non `none`.

### Mesures

- `pnpm check` vert ; e2e complet en dev : 230 réussis, 0 échoué, 10 ignorés (teardown
  « render cancelled mid-stream » → #34).
- Prod, specs sans compte : 114 réussis, 10 ignorés (seul `hydration.spec`, attendu).
- axe WCAG 2.2, 1280/390 : 0 violation (visiteur en prod, membre nuitblanche en dev).
- `measure.mjs`, A/B dans la même session (médianes de 3) : branche 213/133/220/206/218,
  avant l'étape 7 219/136/230/205/212. Référence d'étape 5 : 217/133/223/207/209.

## Prochaine étape : 8 — La passe finale

- Brief : `docs/pilote/feuille-de-route.md` § Étape 8 (ménage de l'ancienne identité, captures
  de toutes les pages revues contre les maquettes, axe partout, `measure.mjs` complet contre
  l'étape 5 et le jalon 12 267/133/229/211/219, `CLAUDE.md` et `docs/design/README.md`, puis
  fin de jalon : PR, CI verte).
- Session de mesure : se connecter contre `pnpm dev` avec `MEASURE_STATE`
  (`docs/environnement.md`) avant le build de prod.
