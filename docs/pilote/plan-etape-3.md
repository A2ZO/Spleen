# Plan — étape 3 : « Écouter sur… », la relecture de nuit

Consignes et décisions actées : `docs/pilote/feuille-de-route.md`, « Étape 3 ». Aucune
migration (colonnes `links_checked_at` et table `listen_links` faites à l'étape 2), aucun écran
modifié, aucune dépendance, variable, CSP ni workflow.

1. **Réponse réelle d'abord** : `record-fixtures.ts` enregistre en plus
   `getEditionLinks(FIXTURE_STREAMING_ALBUM.mbid)` (BRAT, 25 éditions) ; réenregistrer
   (`pnpm --filter @spleen/catalog record`, le script garde déjà le fichier ListenBrainz).
   Vérifier que la navigation `release?release-group=…&inc=url-rels&limit=100` renvoie
   `relations` et `release-count`. Sinon : repli acté (relire l'édition de référence,
   `release/{reference_release_mbid}?inc=url-rels`), noté dans `decisions.md`. Forme réelle et
   nouvelles formes d'URL vues : journal ; une forme YouTube Music disque ou morceau vue en
   vrai peut entrer dans `validListenUrl` (règle de l'étape 2), notée dans `decisions.md`.
   Réponses existantes modifiées par le réenregistrement : notées au journal ; un test cassé par
   une donnée réelle ne s'affaiblit jamais (seule la valeur attendue suit, justifiée).
2. **Fournisseur** (`packages/catalog`) : `getEditionLinks(releaseGroupMbid)` dans
   `CatalogProvider` → `EditionLinks { editions: (ReleaseEdition & { urlRelations })[];
   total: number }` (`total` = `release-count`), une requête, sans page suivante ; types bruts
   dans `raw.ts` (`MbReleaseBrowse`). Test dans `catalog.test.ts` sur la réponse enregistrée.
   Le test vérifie que chaque édition enregistrée porte des relations. `rankEditions` devient
   générique (`<T extends ReleaseEdition>`), même comportement. Faux fournisseurs : inchangés.
3. **Écriture partagée** (`lib/catalog/import.ts`) : `upsertListenLinks` s'appuie sur un
   `storeListenLinks(db, kind, id, links, now, { removeMissing })` exporté (ajout / mise à
   jour ; avec `removeMissing`, suppression des services absents du résultat). L'import garde
   `removeMissing: false` (jamais de retrait à l'import).
4. **Relecture** : nouveau fichier `packages/api/src/lib/catalog/listen-links-refresh.ts`.
   - `releasesForLinks(db, now, limit = 200)` : `tracklist_imported_at`, `mbid` non nuls,
     `merged_into_id` nul, `links_checked_at` nul ou de plus de 30 jours ; ordre : jamais relus
     d'abord (`tracklist_imported_at` le plus récent d'abord), puis `links_checked_at` le plus
     ancien, puis `id`.
   - `artistsForLinks(db, now, limit = 100)` : `mbid`, `discography_imported_at` non nuls,
     non fusionné, même condition de date ; ordre : jamais relus (`discography_imported_at` le
     plus récent d'abord), puis `links_checked_at` le plus ancien, puis `id`.
   - `refreshListenLinks(db, provider, { now, clock?, budgetMs = 10 min, log? })` → `{ releases,
     artists, links, failed, deferred }`. Avant chaque requête : temps écoulé ≥ budget →
     le reste compte « pour plus tard ». Disque : éditions triées par `rankEditions`, relations
     mises bout à bout, `pickListenLinks(…, "release")` (premier valide par service) ;
     `storeListenLinks` avec `removeMissing = total <= editions.length` ; 0 édition renvoyée =
     comme `not_found` ; `links_checked_at =
     now` ; une transaction par fiche. Artiste : `getArtist` → `storeListenLinks(…, artist,
     removeMissing: true)`, `links_checked_at = now`, rien d'autre. `not_found` :
     `links_checked_at` rempli, liens gardés. `busy` / `unavailable` : 1 échec, la phase
     s'arrête, le reste (disques puis artistes) pour plus tard, rien d'écrit pour cette fiche.
     Autre erreur sur une fiche : 1 échec, on continue. Morceaux jamais touchés.
   - Fournisseur propre à la phase (`maxWaitMs: 120_000`, `maxAttempts: 3`) : une requête
     lancée avant la fin du budget le dépasse au plus de 3 × (2 min + 10 s) + pauses ; borne
     écrite dans `docs/stack-et-limites.md` § 3.
5. **Script** `refresh-catalog.ts` : phase des liens après ListenBrainz et les discographies,
   dans son propre `try/catch` (erreur journalisée par son nom, rien d'autre ne change) ;
   `--links-only` (`process.argv.includes`) saute les deux autres phases. La phase affiche
   `handle.kind` et un booléen « hôte ≠ `NEON_MAIN_HOST` » (jamais l'URL). Ligne de sortie :
   `links: N disque(s), M artiste(s) relus, K lien(s), F échec(s), S pour plus tard`. Code de
   sortie inchangé (calculé comme aujourd'hui sur les discographies seulement).
6. **Tests API** (`listen-links-refresh.test.ts`, PGlite, faux fournisseur + réponse
   enregistrée de BRAT) : files et ordre (jamais relus, puis > 30 jours, récents ignorés,
   incomplets, sans mbid et fusionnés ignorés ; artistes sans discographie ignorés), plafonds
   200 / 100 (paramètres réduits) et temps (horloge injectée), choix par édition selon
   `rankEditions`, remplacement (ajout, mise à jour, retrait), lecture partielle (`total` >
   éditions : pas de retrait), `not_found`, arrêt sur `unavailable` (reste pour plus tard,
   rien d'écrit), 0 édition (liens gardés), liens des morceaux inchangés, rien d'autre sur la
   fiche artiste.
7. **Docs** : `docs/catalogue.md` (« Écouter sur… » : source, validation, import, nuit,
   morceaux non relus la nuit, fiches incomplètes non relues) ; `CLAUDE.md` : commande
   `--links-only` ; `docs/stack-et-limites.md` § 3, « Tâche de nuit » : +300
   requêtes au pire, ≈ 940 requêtes ≈ 17 min ; `docs/jalon-13-en-cours.md`.
8. **Passage réel sur Neon `dev`** : `pnpm catalog:refresh -- --links-only` (aucun import en
   cours ailleurs) ; ligne de sortie et liens par service (requête de comptage) au journal.
   Base attendue : Postgres et hôte ≠ `NEON_MAIN_HOST` (booléens) ; sinon ne pas lancer.
9. **Captures** (dev, visiteur, 1280 et 390) : une fiche album et une fiche artiste réelles
   avec des liens directs, dans `docs/pilote/captures/3/`.

Vérifications : `pnpm check` ; tests touchés ; e2e complet via `verificateur` (aucun écran
changé : ni build de prod, ni axe, ni mesure).

## Avancement

- [x] 1. réponse réelle · - [x] 2. fournisseur · - [x] 3. écriture partagée · - [x] 4. relecture
- [x] 5. script · - [x] 6. tests API · - [x] 7. docs · - [x] 8. passage réel · - [x] 9. captures
- [x] vérifications · - [ ] relecture 1 · - [ ] relecture 2 · - [ ] clôture
