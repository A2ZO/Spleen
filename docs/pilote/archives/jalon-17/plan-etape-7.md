# Plan — étape 7 « Les animations »

Brief : `feuille-de-route.md` § Étape 7. Apparence seulement : aucune API, aucune donnée nouvelle.
Jetons existants : `--ease-spleen`, `--ease-spring` (`motion` de `scales.ts`), 150 / 300 ms.
Tailwind 4 : `hover:` et `group-hover:` ne s'appliquent déjà que sous `@media (hover: hover)`.

## 1. Ménage des transitions (commit à part)

- `transition-colors` (segmented, Pill, LikeButton, LogDialog, TabBarItems, NavLinks,
  LocaleSwitcher) retiré : changement de couleur instantané. `transition` (AddToList) réduit à
  `transition-opacity` ou `transition-transform` selon ce qu'il anime, sinon retiré.
- Utilitaire `animate-record` (`sp-spin`, plus utilisé depuis l'étape 5) retiré s'il n'a plus
  d'usage (vérifié par recherche).
- Recherche finale : plus aucun `transition-colors`, `transition-all`, `transition ` nu ni
  keyframe touchant autre chose que transform / opacity dans `apps/web/src`.

## 2. Boutons : remontée en ressort

`Button.tsx` : l'appui descend vite (`active:ease-out`), le relâchement remonte avec
`ease-spring` 150 ms (déjà la base). Seul transform est animé ; l'ombre bascule d'un coup.

## 3. Étoiles qui se remplissent une à une

- `Stars` : prop `pop?: number`. Quand `pop > 0`, la rangée pleine porte `key={pop}` (relance)
  et chaque étoile pleine reçoit `animate-star-pop` avec `animation-delay: i × 40 ms`.
- Keyframe `sp-star-pop` : `scale(.6)` + `opacity .4` → `scale(1)`, 150 ms, `--ease-spring`
  (léger rebond), `animation-fill-mode: backwards`, sous `no-preference` seulement. Les
  étoiles vides ne bougent pas.
- `StarRating` : compteur incrémenté quand `value` change vers une note (clic, clavier,
  raccourcis) — comparaison à la valeur précédente pendant le rendu, pas d'effet. Jamais au
  premier rendu : rien ne bouge au chargement. Notes affichées ailleurs (`Stars` seul) : fixes.

## 4. Cartes qui montent au survol

- `Card` : prop `lift` → `transition-transform duration-150 ease-spleen
  motion-safe:hover:-translate-y-1`.
- Cartes qui sont un lien entier seulement : `ListCard`. `ReviewCard` et `FeedItemCard`
  (plusieurs liens, long texte) ne montent pas. `ReleaseTile` : 300 → 150 ms et
  `motion-safe:group-hover:`.

## 5. Tendances en cascade au défilement

- `TrendsGrid` : chaque `<li>` reçoit `scroll-cascade` et `style={{ "--i": index % 3 }}`.
- CSS dans `@supports (animation-timeline: view())` **et**
  `@media (prefers-reduced-motion: no-preference)` : keyframe `sp-cascade` (opacity 0 +
  translateY 1.5rem → rien), `animation-timeline: view()`, `animation-fill-mode: both`,
  `animation-range: entry calc(var(--i) * 10%) entry calc(70% + var(--i) * 10%)`.
- Sans support ou en mouvement réduit : aucune règle, tout est visible. Une tuile déjà à
  l'écran au chargement est au-delà de sa plage : visible tout de suite.

## 6. Pochette mobile qui se range dans la barre

- Album et morceau, `< 48rem` seulement. La pochette est enveloppée d'un `div`
  `cover-scroll` (`view-timeline: --sp-cover block`), l'animation porte sur la pochette
  (`sp-cover-shrink` : `scale(1)` → `scale(.55) translateY(20%)`, opacity → 0, plage
  `exit-crossing 0% 100%`). `<article>` : `timeline-scope: --sp-cover`.
- `DetailBar` : prop `thumb?: ReactNode` (vignette 32 px `Cover` sans texte, `aria-hidden`),
  avant le libellé. Dans `@supports (animation-timeline: view()) and (timeline-scope: none)`
  + `no-preference` + mobile : opacity 0 → 1 et
  `scale(.6)` → 1, liée à `--sp-cover` (plage `exit-crossing 50% 100%`). Hors de ces
  conditions, la vignette est `hidden` : la pochette reste seule, aucun contenu masqué.
- Autres fiches (artiste, critique) : inchangées.

## 7. Chiffres qui comptent

- `components/ui/CountUp.tsx` (client) : `<span class="sr-only">{value}</span>` +
  `<span aria-hidden="true" class="tabular">` qui affiche `value` au rendu serveur, avec
  `min-width` = nombre de chiffres de `value` en `ch` (rien ne bouge pendant le comptage).
- Compte de 0 à `value` (300 ms, `requestAnimationFrame`, ease-out) **seulement** quand le
  chiffre entre à l'écran après l'hydratation (`IntersectionObserver`) ; déjà visible au
  chargement ou `prefers-reduced-motion` : rien ne bouge (aucun chiffre ne passe par 0 à
  l'affichage) : le premier rappel de l'observateur, s'il arrive déjà visible, est ignoré
  explicitement. Une seule fois par montage.
- Utilisé par `Figure` (profil) et `StatsPanel` (compteurs par type).

## 8. Tests

- `e2e/motion.spec.ts` (sans compte), `reducedMotion: "reduce"` : accueil visiteur, tuiles des
  tendances à opacity 1 et sans animation en cours (`getAnimations()`), après défilement aussi ;
  fiche album à 390 px défilée : pochette à opacity 1, vignette de la barre invisible ; profil
  `nuitblanche` : le texte des chiffres égale la valeur.
- Sans mouvement réduit : la tuile en bas de la grille finit visible après défilement (état
  final attendu avec `expect.poll`, jamais de délai fixe).
- Specs existants touchés (listening, keyboard, profile, lists) : seuls les sélecteurs suivent ;
  un chiffre se lit sur le span visible (le `dd` contient aussi le `sr-only`).
- Perf : `measure.mjs` ×2 sur build de prod, mêmes pages que la référence (accueil, album,
  profil `nuitblanche`) : `CountUp` et `StarRating` ajoutent du JS client.

## Hors périmètre

Transitions de page (#29), Suspense, `loading.tsx` ; la barre de navigation et les bannières
« Annuler » gardent leurs animations (transform / opacity déjà).
