# Plan — étape 8 « La passe finale »

Brief : `feuille-de-route.md` § Étape 8. Apparence et docs seulement : aucune API, base,
migration, dépendance, CSP ou variable d'environnement touchée.

## 1. Ménage (commit `refactor(web): drop the last aliases of the old identity`)

Recherche (`git grep -i` serif, italic, wood, vinyl, brass, velvet, cream, Fraunces, Plex). Restes :

- `globals.css` : alias `--font-serif` → `--font-serif: initial` (l'utilitaire disparaît au
  lieu de retomber sur Georgia). `italic` : vérifié par grep (0 dans `apps/web/src`), noté.
- `Button` : variante `outline` = ancien nom de `secondary` (mêmes classes), ~20 usages
  (admin, error, list, settings, profil, formulaires de compte, KeyboardHelp, AddToList,
  LogDialog, RemoteSearch, ShelfPicker, MemberRow, ReportDialog…) → `secondary`, puis la
  variante disparaît du type (le typecheck attrape les oublis). `Pill tone="outline"`
  (genres) est autre chose : gardé.
- Commentaires datés (`discover/page.tsx:42`, en-tête de `Button`) reformulés.
- Gardés : note Fraunces de `assets/fonts/README.md`, données et textes (`vinylvince`, « platine »).
- Page démo `/dev/composants` : sans `outline` ; vérifier qu'elle montre l'état final
  (étoiles qui rebondissent, bouton, carte qui monte) ; compléter avec les composants
  existants seulement (ni variante, ni donnée). Sa garde de production reste intacte.

## 2. Captures (`docs/pilote/captures/8/`, script Playwright dans le scratchpad)

1280 et 390 px, pleine page. Visiteur sur le build de prod ; membre (nuitblanche, connexion
par l'outbox de dev comme `measure.mjs`) et admin (lacontrebasse) en dev.

- Visiteur : accueil, /discover, album, artiste, morceau, critique, profil (onglets journal,
  critiques, listes, stats), `/diary`, abonnés, abonnements, profil vide `rainydaysam`, fiche
  liste, /search?q=pluie, connexion, `/legal`, `/privacy`, `/terms`, 404, `/offline.html`.
- Membre : accueil, notifications, réglages, son profil avec l'éditeur de l'Étagère ouvert,
  création et édition de liste, `/settings/blocks`, édition de critique, album, page démo,
  `/welcome` (compte e2e jetable, supprimé à la fin). Dialogues ouverts (ceux du passage
  `outline` → `secondary`), 390 px au moins, avec axe : LogDialog, ReportDialog, AddToList,
  ShelfPicker, KeyboardHelp, RemoteSearch. Admin : tableau de bord, fusion, suspendus,
  historique.
- Relecteur en deux fournées contre `docs/design/maquettes/*.png` : (a) accueil, album,
  profil et voisines (artiste, morceau, critique, discover), (b) le reste. Corrections
  d'apparence seulement, deux tours au plus.

## 3. Vérifications

- `pnpm check` ; aucun e2e ne vise `outline` (recherche avant) ; e2e complet en dev via
  `verificateur`.
- Session de mesure (`MEASURE_STATE`) enregistrée contre `pnpm dev`, puis build de prod
  (Brevo, S3, `CONTACT_EMAIL` factices dans la commande) : specs sans compte, `overflow.spec`,
  `motion.spec`.
- axe WCAG 2.2 AA, 1280 et 390, toutes les pages ci-dessus (même script que les captures).
- `measure.mjs` en prod, A/B dans la même session contre `main` (même lockfile, médianes de
  3), plus les références étape 5 (217/133/223/207/209) et jalon 12 (267/133/229/211/219).
  `/fr/search?q=pluie` (≈ 117 ms) et la fiche liste (≈ 110 ms, étape 6) remesurées.
  Plus de 20 ms → corriger ou expliquer.

## 4. Docs (commit `docs: Lilas identity in CLAUDE.md and the design README`)

- `CLAUDE.md` : section « Design (Lilas) » (jetons et rôles dont `border-field` /
  `star-empty`, polices, un bloc lilas par page, ni serif ni italique, 44/52 px, maquettes,
  page démo) ; `[x] 17. Nouvelle peau` ; « Animations neutralised » → transform et opacity
  seulement ; pièges nouveaux (opacity + axe, `cn` sans fusion) : une ligne vers `pieges.md`.
- `docs/design/README.md` : changé en route (Étagère adaptable, OG en Inter, cascade en
  transform, chiffres comptés à l'entrée, montée des cartes-liens seules, rôles 3:1).
- `docs/jalon-17-en-cours.md` : section étape 8 (fin-d-etape).

Fin de jalon (PR, CI) à l'exécution suivante (décision dans `decisions.md`).
