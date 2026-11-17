# Plan — étape 6 « La passe finale » (jalon 13)

Brief : `feuille-de-route.md`, « Étape 6 ». Aucune migration, dépendance ni code métier :
docs, vérifications, captures ; code touché seulement si une vérification échoue. Relu par le
relecteur (OK avec corrections, appliquées).

1. **`docs/quoi-ecouter.md`** (90 lignes au plus), point d'entrée sans recopier le détail :
   règles retenues (conseiller, 17 novembre) des trois fonctions — « Écouter sur… » (5
   services dans l'ordre, direct si MusicBrainz le connaît sinon recherche, hôtes et chemins
   validés, URL reconstruite, aucun logo ni lien affilié), « Tes amis sur ce disque »
   (abonnements, notes et cœurs déjà visibles du fil Amis, masquage, suspension), « Tire un
   disque » (« À écouter », sortis selon mon jour, filtres type et durée, rien d'écrit) ;
   données (migration `0017`, fusion, purge e2e, aucune donnée personnelle nouvelle) ; API
   (`*.bySlug` avec liens identiques pour tous, `release.friends`, `toListen.pick`, fichiers
   `lib/listen-links.ts`, `lib/catalog/listen-links-refresh.ts`,
   `lib/social/release-friends.ts`, `lib/listening/pick.ts`) ; commande et phase de nuit
   (`pnpm catalog:refresh`, liens en dernier, 200 disques, 100 artistes, 10 min, 30 jours,
   `maxAttempts` 3, `-- --links-only`) ; écrans (`ListenOn`, `FriendsOnRecord`, `/pick`,
   bouton de l'onglet) et démo (`seed/friends.ts`, `seed/pick.ts`) ; restes du jalon 11 ;
   points ouverts (snapshot `feed-loading`, 503 avant les artistes, liens e2e jetables).
2. **Renvois** d'une ligne vers `docs/quoi-ecouter.md` depuis `catalogue.md`, `ecoute.md`,
   `social.md`, `decouverte.md`.
3. **Cahier** : ligne cochée « Quoi écouter ce soir ? : règles retenues… » dans la section du
   jalon 13 (renvoi) ; lignes 5 (version) et 60 (« en cours ») : jalon fait ; ligne 125 (page
   album) : liens directs quand MusicBrainz les connaît, sinon recherche, cinq services.
4. **Captures 1280 et 390 px** dans `docs/pilote/captures/6/`, axe WCAG 2.2 AA à chacune.
   Avant : vérifier sur la base de dev que les fiches choisies ont des liens directs (fiches
   réelles relues à l'étape 3) et des données de démo.
   - Visiteur, build de prod : fiches album, artiste et morceau avec liens directs, « Dernier
     métro pour Belleville », disque à venir de la démo (`seed/upcoming.ts`, refait :
     pastilles, pas de section des amis), `/fr/pick` (→ connexion).
   - `nuitblanche` : session obtenue une fois en dev (lien magique, `MEASURE_STATE`), réutilisée
     sur le build de prod (même base) : les mêmes fiches, « Dernier métro » dans ses deux états
     (5 lignes + « Voir tous tes amis », puis `?friends=all#friends` + « Voir moins »),
     `/fr/pick`, `/fr/pick?type=ep`, son onglet « À écouter ».
   - Compte e2e jetable en dev (supprimé par le nettoyage) : `/fr/pick` liste vide.
   - Notifications « Sorti le … » / « Sortie aujourd'hui » seulement : captures de l'étape 1
     copiées (aucune donnée de démo du jour) ; écart noté dans `decisions.md`.
5. **Vérifications** : `pnpm check` ; build de prod (`pnpm run free-port`, valeurs factices
   dans la commande) : specs sans compte et `overflow.spec` ; `measure.mjs` complet, deux
   passages, contre 215 / 136 / 231 / 182 / 228 (+20 ms) ; `MEASURE_ONLY=/fr/pick`
   (`MSYS_NO_PATHCONV=1`) contre 142 ; écart → build de prod de `origin/dev`, mêmes parcours,
   `nuitblanche`, deux passages, comparé à HEAD dans la même session ; e2e complet en dev via
   `verificateur` (jamais deux passes Playwright en même temps).
6. **`CLAUDE.md`** : jalon 13 coché en une ligne (renvoi) et retiré de la liste à faire ;
   `docs/quoi-ecouter.md` dans les docs de domaine ; `--links-only` déjà dans « Commands »
   (gardé) ; décision « liens d'écoute : relations d'URL MusicBrainz seulement, hôtes validés,
   aucun lien affilié » ; ordre 14 → 10 → 15 → 16. Rien d'autre.
7. **Relecture**, clôture, fin de jalon (sections 5 et 6) : PR vers `dev` avec `Closes #31`,
   `#41`, `#42`, points ouverts et questions de `decisions.md`, dont la validation du snapshot
   `feed-loading` en clair (réponse attendue avant la release vers `main`) ; avant la fusion,
   `git diff --stat origin/dev...HEAD` contre « Autorisé à la fusion » ; phase B : PR de
   release `dev` → `main` en brouillon, qui répète les `Closes`.

## Avancement

- [x] 1 doc du domaine · [x] 2 renvois · [x] 3 cahier · [ ] 4 captures · [ ] 5 mesures et
  specs prod · [x] 6 `CLAUDE.md`
- [ ] vérifications · [ ] relecture 1 · [ ] relecture 2 · [ ] clôture
