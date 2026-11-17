# Plan — étape 2 : « Écouter sur… », les liens à l'import et l'affichage

Consignes et décisions : `feuille-de-route.md`, « Étape 2 ». Existant vérifié : `targetColumns()`,
`buildListenLinks`, `ListenLink`, `ListenOn.tsx` (3 pages), `SearchIcon`, `services.*`, import,
fusion (`merge.ts`), dernière migration `0016`. Relu : OK avec 5 corrections, appliquées.

1. **Réponses réelles.** `record-fixtures.ts` : ne plus vider `listenbrainz-fresh-releases.json`
   (le supprimer du `rm` : effacer seulement les `NN.json` et `manifest.json`) ; ajouter un
   disque récent sorti en numérique avec liens de streaming sur l'édition (choisi sur
   MusicBrainz, constante `FIXTURE_STREAMING_ALBUM` dans `test-fixtures.ts`). Changer les `inc=`
   (point 3) puis `pnpm --filter @spleen/catalog record`. Noter au journal la forme réelle des
   relations et des URL par service. Tests existants : suivre les nouvelles valeurs si besoin.
   Si MusicBrainz refuse `recording-level-rels` : le retirer (règle actée), le noter.
2. **Migration** (la seule) : `listen_service` + `listen_links` + `links_checked_at` sur
   `releases` et `artists`, exactement « Autorisé à la fusion », dans `schema/catalog.ts` ;
   `pnpm db:generate`, relire le `.sql`, `pnpm db:migrate` (Neon `dev`).
3. **Fournisseur** : `MbRelation { type; ended?; direction?; url?: { resource } }` dans `raw.ts`
   (`relations` sur `MbRelease`, `MbRecording`, `MbArtist`) ; type neutre
   `ProviderUrlRelation { type: string; url: string }` ; champ facultatif `urlRelations` sur
   `Tracklist`, `ProviderRecording`, `ProviderArtist`, présent seulement quand demandé (sans
   `ended: true`, `url` présente). `inc=` actés (`getTracklist`, `getArtist`, `getRecording`).
   Recherches et crédits : champ absent.
4. **Validation** : `listen-links.ts` → `validListenUrl(raw, kind)` (seule fonction, tableau acté,
   URL reconstruite, `null` sinon) et `pickListenLinks(relations, kind)` (types retenus selon la
   fiche, service déduit de l'URL validée, premier valide par service). Formes Apple Music /
   YouTube Music / `itunes.apple.com` ajustées aux réponses réelles (`decisions.md`).
5. **Lecture** : `buildListenLinks(stored, title, firstArtist)` → 5 liens dans l'ordre fixe
   (`spotify`, `deezer`, `appleMusic`, `youtubeMusic`, `bandcamp`), `direct: true` si la ligne
   en base repasse `validListenUrl` **et** que le service déduit est celui de la ligne ; on
   affiche l'URL renvoyée par `validListenUrl`, jamais la chaîne en base ; sinon recherche « premier artiste crédité + titre » (nom
   seul sur l'artiste ; aujourd'hui tous les artistes : le test existant suit). `ListenLink`
   gagne `direct`, `youtube` → `youtubeMusic`, `bandcamp`. Artiste et morceau : sous-requête
   `json_agg` sur la ligne de la fiche, dans `artistIdBySlug` (ligne `known` du visiteur,
   `root.ts`) **et** dans la lecture de repli de `getArtistDetail` (de même pour le morceau) ; disque (la ligne peut arriver déjà lue, `known`) :
   une requête dans le `Promise.all`, gardée si la mesure tient la référence, sinon sous-requête
   dans la lecture des genres (noté au journal).
6. **Import** (`import.ts`) : `upsertListenLinks(tdb, target, links)` (insert … on conflict
   sur l'index partiel : `target: [colonne, service]` + `targetWhere: isNotNull(colonne)` →
   update `url`, `updated_at` ; jamais de suppression ; couvert par le test de ré-import) ; disque : liens
   de l'édition de la liste des titres dans `writeReleaseGroup`, `links_checked_at` laissé
   vide ; morceaux : dans `upsertTrack` quand `urlRelations` existe ; artiste : seulement
   `importArtist` (+ `artists.links_checked_at = now`). `upsertArtist` des crédits n'y touche pas.
   `importRecording` : écrire aussi les `urlRelations` de `getRecording` quand le morceau est
   déjà dans la liste des titres (retour anticipé, l. 673-677).
7. **Fusion** (`merge.ts`) : dans `mergeRelease` / `mergeTrack` / `mergeArtist`, insérer pour la
   fiche gardée les services qui lui manquent (`on conflict do nothing`), puis supprimer les
   liens du doublon.
8. **Écran** : `ListenOn` : libellé texte, direct → `ExternalIcon`, recherche → `SearchIcon` +
   « (recherche) » en `sr-only` ; `rel="nofollow noopener noreferrer"` ; `min-h-11` ;
   `flex-wrap`. i18n FR/EN : `services.youtubeMusic`, `services.bandcamp`,
   `album.listenSearch` ; `services.youtube` retirée (vérifier qu'aucun autre usage).
9. **Tests API** (PGlite) : validation (valides par service et pièges actés), import depuis les
   réponses enregistrées (disque, morceaux, artiste ; artiste de crédit sans effet ;
   ré-import : ajout/mise à jour, jamais de retrait), fusion, lecture (direct puis recherche,
   ordre fixe, URL invalide en base → recherche). Test catalogue : `urlRelations` lues.
10. **e2e** `listen-on.spec.ts` : disque jetable avec Spotify + Bandcamp directs (`href`
    exacts, `rel`) et trois recherches ; fiche artiste ; fiche morceau.
11. **Docs** : `docs/catalogue.md` (relations, validation), `docs/jalon-13-en-cours.md`.

Vérifications (écrans changés) : `pnpm check`, specs touchés, e2e complet (`verificateur`) ;
build de prod : specs sans compte et `overflow.spec` ; axe 1280 / 390 px sur album, artiste,
morceau, visiteur et membre ; `measure.mjs` deux passages (tranche le choix du point 5, noté au
journal) ; captures des trois fiches, visiteur et membre, 1280 / 390, dans `captures/2/`.

Seed : aucun lien direct (acté). Aucune dépendance, variable, CSP ni workflow.

## Avancement

- [x] 1. réponses réelles · - [x] 2. migration · - [x] 3. fournisseur · - [ ] 4. validation
- [ ] 5. lecture · - [ ] 6. import · - [ ] 7. fusion · - [ ] 8. écran
- [ ] 9. tests API · - [ ] 10. e2e · - [ ] 11. docs
- [ ] vérifications · - [ ] relecture 1 · - [ ] relecture 2 · - [ ] clôture
