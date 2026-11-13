# Plan — étape 5 : le profil et l'Étagère (relu, corrections intégrées)

Apparence seulement. Maquette `D-profil-mobile.png`. Décisions dans `decisions.md`.

## 0. `measure.mjs` (fait, `0e230ff`)
Étape 1 = `window.next.router.push("/fr/album/brume-sur-le-canal")` (album fixe du seed).
Nouvelle référence, build de prod, page affichée : 217 / 133 / 223 / 207 / 209 ms.

## 1. En-tête (`u/[username]/page.tsx`)
- Mobile : avatar `size-20` à côté du nom (maquette) ; dès `md` avatar `size-28`. Nom en
  `font-display font-extrabold` 48 / 64 px, `min-w-0`, `phoneTitleSize(nom, "48")`.
  @pseudo Geist Mono, bio, abonnés · abonnements · inscription (liens inchangés).
- Actions : autre membre inchangé (Suivre / vers `/sign-in` / `MemberMenu`) ; le sien :
  `ButtonLink` secondaire « Réglages » vers `/settings` (clé existante).

## 2. Trois chiffres
- `api.profile.stats({ username: requested })` en `cache()`, lancé en parallèle du profil et
  réutilisé par l'onglet Stats (même clé `requested` aux deux appels).
- Grille 3 colonnes (mobile et ordinateur) : `Card tone="accent"` = disques cette année
  (album + EP + single de `listenedThisYear`, année passée en chaîne) ; cartes : disques depuis
  toujours (`listenedTotal`), disques notés (somme de `ratingDistribution`). Chiffres Bricolage
  800 `text-5xl md:text-7xl tabular whitespace-nowrap`, libellé dessous. Clés `profile.figures.*`.
- `statsHidden` ou `stats` nul : pas de rangée (donc pas de bloc lilas).

## 3. L'Étagère
- `components/shelf/ShelfGrid.tsx` : `grid-cols-2 md:grid-cols-4`, lien album, `Cover`
  `rounded-cover`, titre dans une pilule opaque `bg-bg` en bas à gauche, `truncate`.
- Autre membre : emplacements remplis seulement ; vide → section absente. Sous-titre
  `shelf.subtitle` reformulé sans chiffre (« Les disques favoris de {name} ») ;
  `profile.shelfEmpty` retiré. `mockup.spec.ts` « empty shelf » réécrit : la région
  « L'Étagère » est absente sur `/fr/u/rainydaysam`.
- Le sien (`ShelfEditor`) : 4 emplacements, vides en pointillés `border-field` arrondis ;
  bouton « Modifier mon Étagère » dans l'en-tête de section ; liste de réordonnancement en
  `Card`, rangées 44 px, « Emplacement libre » sans italique. Vide : invitation existante.
- `ShelfPicker` : `rounded-card`, emplacements `rounded-cover`, pointillés `border-field`.
- Supprimés : `ui/VinylShelf.tsx`, `release/Turntable.tsx` (aucun import).

## 4. Onglets et journal
- `LinkTabs` (déjà segmenté), 6 onglets gardés.
- `DiaryList` : mois en Geist Mono capitales ; rangées en cartes `bg-surface` arrondies ;
  jour en Bricolage 800 `tabular` ; vignette ; titre display gras ; artiste gris ; note
  « ★ 4,5 » Geist Mono `text-star` (sr-only gardé) ; icônes gardées ; humeurs sans italique.
- « Récemment » gardé (tuiles existantes).

## 5. Ordinateur (1280 px)
En-tête sur une ligne (avatar, nom, actions à droite) ; chiffres en 3 colonnes ; Étagère en
4 colonnes ; onglets et contenu pleine largeur (max-w du site).

## 6. Autres pages
- `diary/page.tsx`, `DiaryCalendar` : titres display, cases `rounded-thumb`, vides sans
  serif ni italique. `StatsPanel` : sections en `Card` neutres (pas d'accent), chiffres
  Bricolage, barres `aria-hidden` + `sr-only` gardés. `FollowListPage` : titre display,
  rangées en cartes, vide sans italique. `EmptyState` du profil sans serif ni italique.

## 7. Vérifications
- `pnpm check` ; specs `shelf`, `social`, `listening`, `mockup`, `a11y`, `overflow` ; e2e
  complet via `verificateur`.
- Prod : specs sans compte, `overflow.spec`, axe 1280/390 (nuitblanche, rainydaysam, journal,
  stats, abonnés). Dev : son profil avec éditeur ouvert, compte e2e jetable au nom long d'un
  seul mot (capture 390 px), supprimé à la fin.
- `measure.mjs` ×2 vs référence ; une mesure de son propre profil juste après une écoute
  (cache des stats froid), chiffre au journal.
- Captures `docs/pilote/captures/5/` : son profil, un autre, journal, stats, éditeur, 1280/390.
