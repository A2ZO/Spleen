# Plan — étape 6 « Le reste »

Apparence seulement : aucune lecture d'API, route, migration ni dépendance nouvelle. Briques
existantes : `Card`, `SectionHeading`, `Pill`, `Badge`, `Button`, `Field`, `LinkTabs`/`Tabs`,
`Cover`, rangées `rounded-card-sm bg-surface` (comme `FollowListPage`). Aucun bloc lilas sur
ces pages (décision : la règle « un seul » devient « aucun » quand il n'apporte rien).

## Vocabulaire commun (appliqué partout)
- h1 de page : `font-display text-4xl font-extrabold tracking-[-0.03em]`, jamais `break-words`
  (coupe les mots) ; titre saisi par un membre (nom de liste) : `phoneTitleSize`.
- h2/h3 en `font-serif` → `font-display font-bold tracking-[-0.02em]` (ou `SectionHeading`).
- États vides en serif italique → phrase `text-fg-muted` droite (comme `/discover`).
- Citations/notes en italique (`admin`, notifications) → texte droit `text-fg-muted`, la
  bordure gauche garde la distinction.
- Sections de formulaire → `Card` ; listes → rangées `rounded-card-sm bg-surface`.

## Commits prévus (un par groupe)
1. **Recherche** : `search/page.tsx`, `RemoteSearch`, `SearchCombobox` (fenêtre instantanée :
   panneau `rounded-card-sm` + `shadow-card`, titres en display, état vide droit).
2. **Listes** : fiche `list/[id]` (en-tête display, commentaires et vide), `ListCard`,
   `ListItemRow`, `ListItemsEditor`, `AddToList`, `ListForm` (création/édition en `Card`).
   L'index des listes = onglet Listes du profil (déjà fait à l'étape 5) : rien à ajouter.
3. **Notifications** : rangées en cartes, extraits sans italique ; la carte ne devient pas
   un lien entier (liens inchangés).
4. **Compte** : `settings` (sections en `Card`, `DeleteAccountForm` garde son bouton `bg-danger` et
   ses confirmations), `settings/blocks`, `ProfileForm` (legend display), `SuspendedNotice`,
   `sign-in` + `SignInForm` (code : `autocomplete="one-time-code"`, `inputMode="numeric"`,
   `useTypedBeforeHydration` intacts — on ne touche que les classes), `welcome` +
   `OnboardingForm`.
5. **Légal, erreurs, hors ligne, raccourcis** : `LegalPage` (h2 display), `not-found`,
   `error`, `global-error` (citation → grand titre display droit, pas de bloc lilas),
   `offline.html` (Geist absent hors Next → pile système sans serif, bouton pilule lilas
   `palette.lilac`/`palette.ink`, 52 px de haut,
   `:focus-visible` contour `mist` décalé, paragraphe en `haze` au lieu d'une opacité), `KeyboardHelp` (dialogue en carte, touches en Geist Mono).
6. **Admin et modération** : `admin`, `admin/history`, `admin/merge`, `admin/suspended`
   (sobres : cartes, titres display, plus de serif/italique). `review/[id]/edit` (kicker).
7. **Pochettes générées** (`Cover.tsx`) : les formes restent dans le haut (`y` ≤ 48 sur 100)
   quand le titre est imprimé ; bande `label` et rayures bornées au-dessus du texte ; sans
   texte (`showText=false`), formes centrées et plus grandes. Nuancier `coverSwatches`
   inchangé (jetons Lilas, testé AA) ; vérifié en capture sur 8 slugs.
8. **Emails** (`packages/auth/src/emails.ts`, `packages/api/src/lib/moderation/emails.ts`) :
   mise en page en `<table role="presentation">`, styles en ligne, fond `night`, carte
   `plum`, texte `mist`, bouton lilas encre, police de repli `Arial, Helvetica, sans-serif`,
   lune en caractère texte + U+FE0E (pas d'image, pas d'emoji). Diff limité au gabarit HTML
   (sujet, URL, code, envoi inchangés ; dit dans le commit). Lien et code : texte sur fond explicite
   (`bgcolor` + `background`), lisible si le client inverse. Version texte inchangée (déjà
   à jour). Les tests existants (`auth.test.ts`, `moderation.test.ts`) restent verts.
9. **OG** : fond `night`, lune lilas + « spleen », titre en Inter 400 grand corps serré
   (police déclarée en `weight: 400` seulement, provisoire). **Bricolage TTF absent du
   dépôt et aucun téléchargement sans Azzo** → titres en Inter (déjà dans `assets/fonts`,
   sans serif) ; `Fraunces-SemiBold.ttf` et sa licence supprimés, README mis à jour ; pochette
   de repli = même dessin que `Cover` (aplat + lune), plus de dégradé. Décision notée.
10. **PWA** : `icon.svg` refait (1er élément = `<rect fill="#0E0C12"/>` lu par le script ; carré `night`, croissant lilas du `Logo`, zone sûre 80 %),
    `pnpm --filter @spleen/web icons` régénère PNG + `apple-icon` ; manifest déjà
    `palette.night` (#0E0C12), vérifié.

## Vérifications
- `measure.mjs` sur le build de prod (pages de référence) ; `/search` et une fiche liste
  mesurées en plus, sans référence antérieure (notées pour l'étape 8).

- Recherche finale : `grep -rnE "font-serif|italic|Georgia|serif"` sur `apps/web/src` et
  `packages/*/src` → seulement l'alias
  `--font-serif` de `globals.css` (retiré à l'étape 8) et le commentaire « No faux italic ».
- Habituelles (feuille de route) + specs touchés : instant-search, lists, accounts, legal,
  moderation, pwa, keyboard, covers, seo (OG), a11y, hydration (connexion).
- Captures 1280/390 : recherche (page + fenêtre ouverte), fiche liste, création de liste,
  notifications, réglages, connexion (+ étape du code), welcome, légal, 404, hors ligne,
  raccourcis, admin ; plus un email HTML, une image OG, l'icône PWA, 8 pochettes générées.
