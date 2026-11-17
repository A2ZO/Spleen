# Plan — étape 5 : la passe finale

Brief : `feuille-de-route.md`, « Étape 5 » (décisions actées). Étapes 1 à 4 faites.

## Existant vérifié

- `next` 16.4.2 dans `apps/web/package.json` ; `eslint-config-next` 16.4.2 dans
  `packages/config/package.json` ; aucun `@next/*` en dépendance directe. Registre npm :
  16.4.5 publié le 3 novembre (14 jours), `eslint-config-next@16.4.5` existe ; aucun
  `minimumReleaseAge` réglé dans `pnpm-workspace.yaml` (défaut de pnpm).
- Code du jalon : `packages/api/src/lib/memories.ts`, `memories.test.ts`,
  `apps/web/src/components/memories/MemoryGrid.tsx`, `packages/db/src/seed/memories.ts`,
  `apps/web/e2e/memories.spec.ts`, migration `0018`.
- Cahier : section « Souvenirs (jalon 14) » l. 228, ligne 5 (mise à jour), puces des jalons
  l. 60-61, roadmap l. 109, « Questions ouvertes » l. 470. `stack-et-limites.md` § 3,
  « Mesure : quoi écouter ce soir (jalon 13) » l. 195 avant « Tableau des seuils ».
  `accounts.md` l. 56 : liste des sections de `/settings`.

## Travail

0. **Next.js 16.4.5**, premier commit seul : `next` et `eslint-config-next` à `16.4.5` exact,
   `pnpm install`, `pnpm check`, `pnpm build` (`pnpm run free-port` avant ; valeurs factices
   Brevo/S3/`CONTACT_EMAIL` dans la commande seulement) ; `chore(deps): bump next to 16.4.5
   (security)`. Avant le commit : diff des deux `package.json` limité aux deux lignes de
   version (exactes, sans `^`) ; `git diff pnpm-lock.yaml` limité à `next`, `@next/*` et
   `eslint-config-next`, sinon revenir en arrière et noter. Refus de pnpm → dernier 16.4.x permis ≥ 16.4.5, sinon renoncer et noter.
   Régression → corriger le code de Spleen, sinon revenir à 16.4.2 et noter. Pas 16.4.6 :
   le brief nomme 16.4.5 (choix prudent, noté dans `decisions.md`).
1. **`docs/souvenirs.md`** (≤ 90 lignes) : règles des trois blocs et du réglage, cas sans objet
   (29 février, groupes vides, visiteur, suspendu), données, API (`memories.home`,
   `discovery.releasedOnThisDay`, `account.setShowMemories`, `lib/memories.ts`, une requête par
   bloc, listes de jours), écrans, démo, e2e, bouton de l'étape 1, points ouverts (dont la phrase
   FR/EN proposée pour la politique de confidentialité, texte exact de `decisions.md`). Relire le code
   pour chaque nom cité.
2. **Renvois** d'une ligne depuis `ecoute.md`, `decouverte.md`, `profil-stats.md`, `accounts.md`
   (« Souvenirs » dans la liste de `/settings`).
3. **Cahier** : « Fini le 17 novembre » dans la section du jalon 14 + ligne cochée du brief ;
   ligne 5 ; puce du jalon 14 (fini) l. 61 ; puce du jalon 13 « et le 2e bouton de l'accueil
   membre (jalon 14) » ; roadmap (13 et 14 faits, puis 10) ; question ouverte « Politique de
   confidentialité ».
4. **`stack-et-limites.md` § 3** : « Mesure : souvenirs (jalon 14) », trois lignes.
5. **Vérifications** (ci-dessous) puis mesures finales dans 4 et dans `jalon-14-en-cours.md`.
6. **`CLAUDE.md`** : exactement les points du brief (jalon 14 coché, ordre « 10 (launch) → 15 →
   16 », doc de domaine, `vieuxsillons` dans la démo, décision « Memories: … »). Rien d'autre.
7. **Fin de jalon** (sections 5 et 6 du skill) dans un run suivant si celui-ci est long :
   l'étape se clôt d'abord (section 4).

## Vérifications

D'abord `pnpm db:seed` sur Neon `dev`, avant captures et mesures, même jour de Paris. Passes
Playwright l'une après l'autre, jamais en même temps : e2e complet en dev, puis build de prod
(specs sans compte + `overflow.spec`), puis axe et captures. `pnpm check` ; e2e complet en dev via
`verificateur`. Build de prod : specs sans compte + `overflow.spec` (`hydration.spec:17` connu).
axe AA 1280/390 : accueil `vieuxsillons`, `/settings`, `/discover` visiteur et membre.
Captures 1280/390 dans `docs/pilote/captures/5/` : accueil membre (`vieuxsillons`), réglages,
`/discover` visiteur et membre, accueil visiteur. `measure.mjs` complet `nuitblanche` (deux
passages) contre 215/132/216/180/223 ; `MEASURE_ONLY=/fr/pick` contre 142 ms ; accueil de
`vieuxsillons` contre 205/134/207/183/187 ; écart > 20 ms → A/B `origin/dev` / HEAD même session.

## Avancement

- [x] Next.js 16.4.5
- [x] `docs/souvenirs.md`
- [x] renvois
- [x] cahier
- [ ] `stack-et-limites.md`
- [x] `CLAUDE.md`
- [ ] vérifications
- [ ] relecture 1
- [ ] relecture 2
- [ ] clôture
