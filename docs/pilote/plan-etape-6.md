# Plan — étape 6 « La passe finale » (jalon 11)

Brief : `feuille-de-route.md`, « Étape 6 ». Aucune migration, aucune dépendance, aucun code
métier : docs, vérifications, captures. Code touché seulement si une vérification échoue.
Relu par le relecteur (OK avec corrections, appliquées).

1. [x] **`docs/sorties.md`** (doc du domaine, 80 lignes au plus) : le point d'entrée du jalon,
   sans recopier le détail qui reste où il est :
   - règles retenues (validées le 16 novembre) : suivi réservé aux membres, 500 artistes,
     200 écritures par heure, liste privée (réglages), « à venir » (renvoi `decouverte.md`),
     précision de la date, horizon 12 mois, rien d'autre que « À écouter » avant la sortie
     (`RELEASE_NOT_OUT`, renvoi `ecoute.md`), notification du jour J (in-site, réglage
     `notify_releases`) ;
   - données : migrations 0014 (`artist_follows`, `profiles.notify_releases`), 0015
     (`releases.announced_at`, `release_date_changed_at`), 0016 (`notifications.release_id`,
     type `release`) ; `releases.release_date_precision` existait avant le jalon ; export,
     suppression du compte, fusion de doublons ;
   - API par routeur (`artistFollow`, `upcoming`, `discovery.awaited`, `notification`) et
     fichiers (`lib/catalog/artist-follows.ts`, `upcoming.ts`, `upcoming-feed.ts`,
     `release-dates.ts`, `release-notifications.ts`) ;
   - commandes et tâches de nuit : `pnpm catalog:refresh` (fil ListenBrainz puis
     discographies), `pnpm releases:notify`, ordre dans `catalog-refresh.yml` (03:17 UTC) ;
   - écrans (une ligne chacun, renvoi `decouverte.md`) ; démo (`seed/upcoming.ts`) ;
   - questions laissées à Azzo (doublon « À venir » / discographie, texte d'une notification
     d'un jour passé, heure de la tâche pour les Amériques).
2. [x] **Renvois** : une ligne en tête de « Sorties à venir » dans `decouverte.md` et de « Dates
   annoncées et sorties annoncées » dans `catalogue.md` vers `docs/sorties.md` ; vérifier que
   la référence de `release-notifications.ts` pointe vers un fichier qui existe.
3. [x] **Cahier** : cocher « Sorties à venir : valider les règles par défaut », avec les règles
   retenues en une phrase et le renvoi `docs/sorties.md` (date du 16 novembre).
4. [x] **Captures 1280 et 390 px** dans `docs/pilote/captures/6/`, données de démo, axe WCAG 2.2
   AA à chaque capture (script du scratchpad dérivé de `shots4.cjs`) :
   - avant tout : la carte « Sort … » de l'accueil de `nuitblanche` et les groupes de
     `/upcoming` sont non vides (dates de démo calculées au seed ; sinon `pnpm db:seed`) ;
   - visiteur sur le build de prod : `/fr`, `/fr/discover`, `/fr/artist/lune-basse`,
     `/fr/album/les-heures-bleues`, `/fr/album/nuit-polaire` (« Annoncé pour … ») ;
   - `nuitblanche` (session enregistrée) sur le build de prod : les mêmes, plus
     `/fr/upcoming`, `/fr/upcoming?type=album`, `/fr/settings` ;
   - `rainydaysam` (sans suivi) en dev : `/fr`, `/fr/upcoming`, `/fr/discover`,
     `/fr/artist/lune-basse` ;
   - écart à noter dans `decisions.md` : axe membre sur des comptes de démo (les données de
     démo sont nécessaires), pas sur un compte e2e jetable ;
   - notifications « Sortie aujourd'hui » : captures de l'étape 5 copiées (aucune donnée de
     démo n'est datée d'aujourd'hui ; écart déjà noté dans `decisions.md`).
   Relues par le relecteur avec l'étape.
5. [x] **Vérifications** : `pnpm check` ; build de prod (`pnpm run free-port`, valeurs factices
   dans la commande) : specs sans compte et `overflow.spec` ; `measure.mjs` complet, deux
   passages, contre 237 / 140 / 225 / 208 / 210 (+20 ms) ; `/upcoming` avec la méthode de sa
   référence (accueil → `/upcoming` par `router.push`, `nuitblanche`, médianes de 6,
   `upcoming-measure.cjs`) contre 149 / 151 ;
   e2e complet en dev via `verificateur`.
6. [x] **`CLAUDE.md`** : jalon 11 coché en une ligne dans « Milestones » (renvoi
   `docs/sorties.md`), retiré de la liste à faire ; `pnpm releases:notify` dans « Commands » ;
   `docs/sorties.md` dans les docs de domaine ; une décision (ListenBrainz ne sert qu'à choisir
   quoi relire, MusicBrainz seule source des dates) ; ordre des jalons mis à jour (13 → 14 → 10
   → 15 → 16). Rien d'autre.
7. [ ] **Vérif** de l'étape (relecteur), puis clôture et fin de jalon (sections 5 et 6 du
   skill) : PR vers `dev` avec `Closes #32`, l'écart e2e de l'étape 5, les trois questions
   pour Azzo et la ligne de script `releases:notify` du `package.json` racine (pas une
   dépendance). Avant la fusion : `git diff --stat origin/dev...HEAD` comparé à « Autorisé à
   la fusion ». Phase B : PR de release `dev` → `main` en brouillon (`--draft`), qui répète
   `Closes #32` (GitHub ne ferme l'issue qu'à la fusion dans `main`) et les questions.

Avancement (2026-11-16, run interrompu par la limite d'usage) : points 1 à 3 faits (649c239) ;
captures visiteur et `nuitblanche` sur prod faites (axe : 0 violation) ; mesures prod :
215/213 · 136/135 · 231/219 · 182/180 · 228/225 ; `/upcoming` 158 / 160 (référence 149 / 151,
+9 ms). Reste : captures `rainydaysam` en dev, copie des captures 5, specs sans compte et
`overflow.spec` sur prod, e2e complet, `CLAUDE.md`, relecture, PR.

Suite (2026-11-16, second run) : captures `rainydaysam` en dev (axe : 0 violation), captures 5
copiées ; `pnpm check` vert ; e2e complet en dev 245 réussis · 1 échoué · 10 ignorés
(`undo-delete.spec.ts:289` passe seul, issue #34) ; build de prod, specs sans compte +
`overflow.spec` 114 réussis · 2 échoués · 10 ignorés (`covers.spec.ts:72` passe seul sur les
deux projets, issue #34) ; `CLAUDE.md` à jour.

- [x] vérifications
- [x] relecture 1 (OK avec corrections : fiche d'un disque à venir, appliquées)
- [x] relecture 2 (OK ; moyenne et critiques remises selon les décisions actées, voir `decisions.md`)
- [ ] clôture
