# Plan — étape 1 : le bouton « Tire un disque au hasard » de l'accueil membre

Reste du jalon 13 décidé par Azzo le 17 novembre (suite de l'issue #31, fermée par la PR 46).
Sans migration ni API. Décisions actées : `feuille-de-route.md`, étape 1.

## Données vérifiées

- `apps/web/src/app/[locale]/page.tsx` : branche membre, l. 365-368 : `RateButton`, puis
  `ButtonLink href="/discover" variant="on-accent"` avec `home.findMusic`. Branche visiteur
  (et compte sans profil), l. 314-316 : même lien, inchangé.
- `/pick` existe (jalon 13) et gère la liste vide (« Ta liste « À écouter » est vide. » et
  « Découvrir des disques »). Clé `home.findMusic` présente dans `fr.json` / `en.json`.
- `apps/web/e2e/pick.spec.ts` : `signUp`, sélecteurs `getByRole("link", { name: "Tire un
  disque" })` (l. 39 et 115), sans `exact`.

## Changements

1. **i18n** : `home.pickRandom` après `home.findMusic` dans les deux fichiers : FR « Tire un
   disque au hasard », EN « Pick a random record ». `home.findMusic` reste (accueil visiteur).
2. **Accueil membre** (`page.tsx`, branche membre seulement) : le 2e bouton devient
   `ButtonLink href="/pick" variant="on-accent"` avec `t("home.pickRandom")`. Même place, même
   style, sans icône. Aucune lecture ajoutée (ni `toListen.pick`, ni compte de la liste).
3. **e2e** `pick.spec.ts` :
   - les deux sélecteurs « Tire un disque » existants prennent `exact: true` (le libellé de
     l'accueil le contient) ;
   - nouveau test « the member home links to the draw » : compte jetable (`signUp`) → `/fr` :
     lien « Tire un disque au hasard » (`exact: true`) avec `href` `/fr/pick` ; clic → URL
     `/fr/pick`, phrase de liste vide visible ;
   - nouveau test visiteur : sur `/fr`, ce lien est absent (`toHaveCount(0)`) et « Trouver
     quoi écouter » a pour cible `/fr/discover`.
   - bloc « on a phone » : après le `signUp` existant, `noOverflow()` aussi sur l'accueil membre
     `/fr` à 390 px (libellé plus long à côté de `RateButton` ; `overflow.spec` est sans compte).
4. **Doc** `docs/quoi-ecouter.md` : « Ferme l'issue #31 » reste ; seule la suite « l'accueil
   reste inchangé (décision actée…) » disparaît ; « Accès » ajoute « 2e bouton du bloc lilas de l'accueil membre (« Tire un disque
   au hasard », jalon 14, étape 1, toujours affiché) ».

Aucun test d'API (l'API ne change pas).

## Vérifications

- `pnpm check` ; `pick.spec.ts` seul ; puis e2e complet via `verificateur`.
- Build de prod : specs sans compte et `overflow.spec` (Brevo, S3, `CONTACT_EMAIL` factices dans
  la commande seulement).
- `pnpm db:seed` sur Neon `dev` le jour des captures et des mesures.
- axe WCAG 2.2 AA à 1280 et 390 : accueil visiteur (build de prod) et accueil `nuitblanche`
  (build de prod, session via `MEASURE_STATE` ; à défaut en dev avec un compte e2e jetable
  supprimé à la fin).
- Captures 1280 et 390 dans `docs/pilote/captures/1/` : accueil `nuitblanche` et visiteur
  (mêmes conditions que l'axe).
- `measure.mjs` complet, deux passages, contre 215 / 132 / 216 / 180 / 223 ms (A/B si écart).

## Avancement

- [x] i18n `home.pickRandom`
- [x] bouton de l'accueil membre
- [x] e2e `pick.spec.ts`
- [x] doc `docs/quoi-ecouter.md`
- [x] vérifications
- [x] relecture 1 (OK)
- [x] relecture 2 (sans objet : OK au 1er tour)
- [ ] clôture
