# Feuille de route du pilote — jalon 13 « Quoi écouter ce soir ? »

Écrite par le conseiller d'Azzo le 17 novembre 2026. Le pilote (`/pilote`) fait une étape par
exécution, dans l'ordre, **sans s'arrêter entre les étapes**. Branche `feat/13-quoi-ecouter`
(depuis `dev`). Spécification : les règles du conseiller dans `docs/pilote/decisions.md`
(« Décidé par le conseiller »), tirées du cahier des charges (section « Quoi écouter ce soir ?
(jalon 13) »). Issue fermée par le jalon : #31, plus les deux issues des restes du jalon 11
(étape 1).

**Décisions actées par le conseiller.** Chaque étape porte ses décisions déjà prises : elles
priment sur toute autre option, et le relecteur juge les plans d'après elles. Une question
qu'elles ne couvrent pas : l'option la plus prudente, notée dans `decisions.md`, sans s'arrêter.
« Attente » seulement pour ce qui est irréversible, ou touche aux données, à la sécurité ou à
l'argent, **et** que cette feuille de route ne prévoit pas.

## Cadre

- Nouvelle fonction : une table, des procédures tRPC, une page (`/pick`) et des sections de
  fiches sont prévues. Toute la logique dans `packages/api` (utilisable par l'appli). Aucun
  appel à MusicBrainz pendant l'affichage d'une page : les liens d'écoute viennent de la base,
  remplis à l'import et par la tâche de nuit.
- Lecture publique d'une fiche identique pour tous (cache des pages publiques, issue #22) :
  `release.bySlug`, `artist.bySlug` et `track.bySlug` gagnent les liens d'écoute, les mêmes
  pour tout le monde. Ce qui dépend du membre (« Tes amis sur ce disque », « Tire un disque »)
  se lit à part, par slug, en parallèle, comme `artistFollow.status` au jalon 11.
- Migrations : générées par `pnpm db:generate`, additives, et seulement celle listée dans
  « Autorisé à la fusion ». Jamais de suppression ni de réécriture de données existantes. Les
  lignes de `listen_links` sont des données dérivées de MusicBrainz : l'import, la fusion de
  doublons et la relecture de nuit les ajoutent, les mettent à jour ou les retirent selon les
  règles des étapes 2 et 3, comme l'import le fait déjà pour les genres et les crédits. Après
  la migration : `pnpm db:migrate` sur la base de dev (Neon `dev`), jamais ailleurs.
- Écrans : identité Lilas (`docs/design/README.md`) et composants existants, un seul bloc lilas
  par page, jamais de carte vide, AA, cibles de 44 px, tout marche sans JavaScript, pas de
  Suspense ni de `loading.tsx`, pas d'`aria-pressed` sur un bouton dont le libellé change, pas
  de carte entière en lien. Pas de maquette pour ce jalon : s'inspirer des fiches, de
  `/upcoming` et de l'accueil.
- Textes FR et EN dans `packages/i18n`, tutoiement. Dates sans heure, dans la langue du lecteur.
- Aucune donnée personnelle nouvelle : « Tes amis » montre des notes et des cœurs déjà visibles
  des abonnés (fil Amis), « Tire un disque » n'écrit rien. Politique de confidentialité, export
  et suppression du compte inchangés ; textes légaux interdits dans ce jalon (une phrase qui
  semblerait nécessaire se propose à Azzo dans la PR).
- Les URL venues de MusicBrainz sont saisies par des bénévoles : validation stricte (étape 2)
  avant tout enregistrement **et** avant tout affichage ; l'URL affichée est reconstruite, jamais
  recopiée telle quelle.
- MusicBrainz, 1 requête par seconde pour tout le site : l'import ne fait aucune requête de plus
  (seulement des `inc=` en plus) ; la relecture de nuit est plafonnée (étape 3).
- Pas de service payant, pas de compte, pas de clé, pas de nouvelle dépendance, pas de nouvelle
  variable d'environnement, pas de changement de CSP ni de workflow. Aucun logo ni image de
  marque : les services sont des libellés texte. Aucun lien affilié, aucun paramètre de suivi.

## Autorisé à la fusion

En fin de jalon, le pilote fusionne la PR dans `dev` (section 6 du skill) si elle ne touche, en
zone sensible, **que** ce qui suit. Toute autre chose sensible : « Attente ».

- Une seule migration additive générée (étape 2), avec exactement :
  - le type énuméré `listen_service` : `spotify`, `deezer`, `apple_music`, `youtube_music`,
    `bandcamp` ;
  - la table `listen_links` : `id` (uuid, clé primaire, aléatoire), `release_id`, `track_id`,
    `artist_id` (uuid, facultatifs, clés étrangères `restrict` via `targetColumns()`),
    `service` (`listen_service`, non nul), `url` (text, non nul), `created_at` et `updated_at`
    (timestamptz, non nuls, `now()` par défaut) ; contraintes `listen_links_one_target`
    (`targetCheck()`) et `listen_links_https` (`url like 'https://%'`) ; index uniques partiels
    `listen_links_release_uidx` (`release_id`, `service`) où `release_id` non nul,
    `listen_links_track_uidx` (`track_id`, `service`) où `track_id` non nul,
    `listen_links_artist_uidx` (`artist_id`, `service`) où `artist_id` non nul ;
  - la colonne `releases.links_checked_at` (timestamptz, nulle par défaut) ;
  - la colonne `artists.links_checked_at` (timestamptz, nulle par défaut).
  Aucun autre index, aucune autre colonne. Vont avec : les ajouts correspondants dans
  `packages/db/src/schema/*` et les fichiers générés par `pnpm db:generate` (le `.sql` et
  `packages/db/migrations/meta/*`), rien d'autre dans `packages/db` hors du seed.
- Les fichiers de démo `packages/db/src/seed/*` et les réponses enregistrées
  `packages/catalog/test/fixtures/*` ne sont pas des zones sensibles.
- Interdit dans tous les cas : workflows (`.github/workflows/`), logique de connexion,
  `proxy.ts`, en-têtes de sécurité et CSP, variables d'environnement, dépendances, textes
  légaux, `.claude/`.

## Vérifications habituelles (à chaque étape)

- `pnpm check` ; les specs touchés ; puis l'e2e complet via le sous-agent `verificateur`.
- Un test d'API (PGlite) pour chaque règle de l'étape ; la CI les rejoue sur Postgres. Réponses
  MusicBrainz enregistrées, jamais de réseau dans les tests. Dates maîtrisées : date passée en
  paramètre côté API, `page.clock` en e2e. Aléa injecté (étape 5).
- Quand l'étape change des écrans :
  - build de prod (`pnpm run free-port` d'abord ; Brevo, S3 et `CONTACT_EMAIL` en valeurs
    factices dans la commande seulement, jamais dans `.env`) : specs sans compte et
    `overflow.spec` ;
  - axe WCAG 2.2 AA à 1280 et 390 px sur les pages de l'étape : visiteur sur le build de prod,
    membre en dev avec un compte e2e jetable supprimé à la fin (ou un compte de démo quand
    seules ses données donnent du contenu, comme au jalon 11) ;
  - `scripts/measure.mjs` sur le build de prod, deux passages : les pages déjà mesurées restent
    dans les 20 ms de la référence (`docs/jalon-13-en-cours.md`, « Mesures de référence ») ; en
    cas d'écart, mesurer `dev` dans la même session pour séparer le bruit de la machine ;
  - captures 1280 et 390 px dans `docs/pilote/captures/<n>/`, en visiteur et en membre quand la
    page change selon le cas, avec les données de démo (jamais une page vide faute de données).

## Étape 1 — Les restes du jalon 11

Consignes : retrouver les deux issues, notification d'un jour passé, fiche d'un disque pas
encore sorti, tests, docs. Étape courte, sans migration.

Décisions actées :

- **Issues** : `gh issue list --state open` pour retrouver les deux issues ouvertes après la
  PR 40 (notification « Sorti le … », moyenne et critiques d'un disque à venir). La PR de fin de
  jalon dira `Closes #<n>` pour chacune. Introuvables : le noter dans `decisions.md` et
  continuer ; ne pas en créer.
- **Notification d'un jour passé** : `notification.list` ajoute à un groupe `release` son jour
  (`releaseDay`, `YYYY-MM-DD`, le jour de son `group_key` `release:day:<jour>`) et
  `releasedToday` (ce jour est aujourd'hui dans le fuseau du membre : `todayIn`, repli
  Europe/Paris), calculés par l'API, jamais par la page.
  - Aujourd'hui : textes actuels (« Sortie aujourd'hui : … », « N sorties aujourd'hui chez tes
    artistes »).
  - Un autre jour : un disque → « Sorti le {date} : **Titre** de Artiste » (EN « Out on {date}:
    **Title** by Artist ») ; plusieurs → « {count} sorties le {date} chez tes artistes » (EN
    « {count} releases on {date} from your artists »), le reste inchangé (3 liens, « et N
    autres »).
  - Date : jour et mois en toutes lettres dans la langue du lecteur (« 14 novembre »), l'année
    ajoutée hors de l'année en cours, jamais d'heure. Rien ne change en base.
- **Fiche d'un disque pas encore sorti** (le `notOut` de la page : fuseau du membre, jour de
  Paris pour un visiteur) :
  - la carte « Note de la communauté » (`CommunityRating`) n'est pas affichée ; la mosaïque
    recompte ses cartes (pas de carte vide, pas de grille vide) ;
  - « Critiques » sans critique : « Les critiques ouvriront le jour de la sortie. » (EN
    « Reviews open on release day. ») à la place du texte actuel ; des critiques déjà écrites
    (date reportée après coup) restent affichées ;
  - fiche d'un morceau inchangée (les morceaux ne sont pas concernés) ; l'API ne change pas
    (`release.upcoming` et `listening.myState.releaseNotOut` existent).
- **Docs** : `docs/sorties.md`, « Questions laissées à Azzo » : les trois réponses du conseiller
  (« Sorti le … », horaire de nuit inchangé, moyenne masquée et phrase des critiques) ; la
  question de la discographie de la fiche artiste reste ouverte. `docs/decouverte.md` et
  `docs/ecoute.md` suivent.
- Tests : API (`releasedToday` pour un jour passé et pour aujourd'hui, deux fuseaux de part et
  d'autre de minuit). e2e : notification d'un jour passé (catalogue jetable et le helper de
  l'étape 5 du jalon 11, avec un jour passé), fiche d'un disque à venir sans moyenne et avec la
  phrase, en visiteur et en membre.
- Captures : notifications (aujourd'hui et jour passé, un et plusieurs disques), fiche d'un
  disque à venir (visiteur, membre).

## Étape 2 — « Écouter sur… » : les liens à l'import et l'affichage

Consignes :

- **Vérifier avant de coder** (réseau, à la main, quelques requêtes) : ajouter au script
  `packages/catalog/scripts/record-fixtures.ts` un disque récent dont l'édition de référence
  porte des liens de streaming (à choisir sur MusicBrainz : sorti en numérique, avec Spotify,
  Deezer, Apple Music ou Bandcamp), puis réenregistrer (`pnpm --filter @spleen/catalog record`)
  avec les nouveaux `inc=`. **Le script vide `test/fixtures`** : garder
  `listenbrainz-fresh-releases.json` (l'exclure du nettoyage, ou le restaurer depuis git).
  Noter dans le journal la forme réelle des relations (`relations[].type`,
  `relations[].url.resource`, `ended`, `direction`) et les formes d'URL vues pour chaque
  service. Des valeurs attendues par des tests existants qui viennent des réponses enregistrées
  peuvent suivre les nouvelles réponses ; aucune règle ni aucun test retiré (le noter).
- Migration (la seule du jalon) : voir « Autorisé à la fusion ».
- Fournisseur (`packages/catalog`) : `inc=` en plus, types neutres
  `ProviderUrlRelation { type: string; url: string }` sur `Tracklist` (édition),
  `ProviderRecording` et `ProviderArtist` ; champ absent = relations non demandées.
- Validation et construction des liens : `packages/api/src/lib/listen-links.ts` (une seule
  fonction de validation, utilisée à l'écriture et de nouveau à la lecture).
- Import (`lib/catalog/import.ts`), fusion (`lib/catalog/merge.ts`), lectures
  (`lib/catalog/pages.ts`), écran (`components/catalog/ListenOn.tsx`), tests, captures.

Décisions actées :

- **Requêtes** : `getTracklist` → `inc=recordings+artist-credits+url-rels+recording-level-rels` ;
  `getArtist` → `inc=url-rels` ; `getRecording` →
  `inc=artist-credits+releases+release-groups+url-rels`. `getReleaseGroup` inchangé
  (MusicBrainz n'a aucun type de lien de streaming sur un release-group, doc officielle
  « release_group-url »). Aucune requête en plus à l'import. Si MusicBrainz refuse
  `recording-level-rels` avec `url-rels` (400) ou ne renvoie pas les liens des enregistrements :
  retirer `recording-level-rels` ; les morceaux gardent des liens de recherche, sauf ceux
  importés seuls par `getRecording` (le noter).
- **Relations retenues** : sans `ended: true` ; types « free streaming », « streaming »,
  « purchase for download », « download for free » (disque, morceau, artiste) et, pour un
  artiste, « apple music », « bandcamp », « youtube music ». Le service se déduit de l'URL
  validée, jamais du type.
- **Validation** : `new URL()`, `https:` seulement, sans identifiant ni mot de passe, sans port,
  300 caractères au plus, hôte exactement dans le tableau ; chemin conforme au tableau **pour
  le type de fiche** (un lien d'artiste sur un disque est refusé). L'URL gardée est reconstruite
  à partir des morceaux validés, sans paramètre de suivi ni d'affiliation (seul le paramètre
  utile de YouTube Music reste). Un lien refusé est ignoré : la fiche garde la recherche.

  | Service | Hôte exact | Disque | Morceau | Artiste |
  | --- | --- | --- | --- | --- |
  | Spotify | `open.spotify.com` | `/album/{id}` | `/track/{id}` | `/artist/{id}` |
  | Deezer | `www.deezer.com` ou `deezer.com` | `/album/{n}` | `/track/{n}` | `/artist/{n}` |
  | Apple Music | `music.apple.com` | `/{cc}/album/[{slug}/]{n}` | `/{cc}/song/[{slug}/]{n}` | `/{cc}/artist/[{slug}/]{n}` |
  | YouTube Music | `music.youtube.com` | `/playlist?list={id}` ou `/browse/{id}` | `/watch?v={id}` | `/channel/{id}` |
  | Bandcamp | `{nom}.bandcamp.com` | `/album/{slug}` | `/track/{slug}` | `/` |

  Spotify : id de 22 caractères `[0-9A-Za-z]`, préfixe `/intl-xx/` accepté puis retiré.
  Deezer : `n` en chiffres, préfixe de langue (`/fr/`) accepté puis retiré, reconstruit sur
  `www.deezer.com`. Apple Music : `cc` = 2 lettres minuscules, reconstruit sans slug ni
  paramètre ; l'ancien hôte `itunes.apple.com` est accepté seulement s'il apparaît dans les
  réponses réelles, avec la même forme de chemin, et reconstruit sur `music.apple.com`.
  YouTube Music : identifiants `[A-Za-z0-9_-]` (vidéo : 11 caractères ; chaîne : `UC`
  + 22). Bandcamp : `nom` en `[a-z0-9-]`, ni `www` ni `daily` ; slug en `[a-z0-9-]`. Les formes
  YouTube Music et Apple Music sont à confirmer sur les réponses enregistrées : une forme jamais
  vue dans une réponse réelle n'est pas ajoutée ; une forme réelle absente du tableau peut
  l'être si elle reste sur le même hôte avec un identifiant validé (noter dans `decisions.md`).
- **Un service, un lien** : par fiche et par service, le premier lien valide dans l'ordre de la
  réponse.
- **Écriture à l'import** : services trouvés ajoutés ou mis à jour, jamais retirés à l'import.
  - Disque : liens de l'édition qui a servi la liste des titres ; `releases.links_checked_at`
    reste vide (la relecture de nuit lira toutes les éditions, étape 3).
  - Morceaux : liens de leur enregistrement, quand la réponse les contient.
  - Artiste : seulement dans `importArtist` (réponse de `getArtist`), qui remplit aussi
    `artists.links_checked_at`. Un artiste ou un morceau venu d'un crédit (relations non
    demandées) ne touche jamais à ses liens.
- **Fusion de doublons** : dans la même transaction, la fiche gardée reprend les services qui
  lui manquent, puis les liens du doublon sont supprimés, comme ses autres liens de catalogue.
- **Lecture** : `ListenLink` devient `{ service: "spotify" | "deezer" | "appleMusic" |
  "youtubeMusic" | "bandcamp"; url: string; direct: boolean }`, toujours 5 liens dans cet
  ordre : le lien direct s'il existe et passe la validation, sinon la recherche « premier
  artiste crédité + titre » (fiche artiste : son nom). Recherches : Spotify
  `https://open.spotify.com/search/{q}`, Deezer `https://www.deezer.com/search/{q}`, Apple
  Music `https://music.apple.com/search?term={q}`, YouTube Music
  `https://music.youtube.com/search?q={q}`, Bandcamp `https://bandcamp.com/search?q={q}`
  (`q` encodé). Les liens se lisent de préférence avec la ligne de la fiche (sous-requête) ;
  une requête de plus dans le `Promise.all` seulement si la mesure reste dans la référence
  (pool de 5 connexions, leçon de l'étape 4 du jalon 11).
- **Écran** (`ListenOn`, mêmes places sur les trois fiches) : titre « Écouter sur » inchangé ;
  une pastille par service, libellé texte (« Spotify », « Deezer », « Apple Music », « YouTube
  Music », « Bandcamp »), aucun logo ni image externe ; lien direct : `ExternalIcon` ;
  recherche : `SearchIcon` et « (recherche) » / « (search) » pour les lecteurs d'écran ;
  `target="_blank" rel="nofollow noopener noreferrer"` ; cibles de 44 px ; à 390 px les
  pastilles passent à la ligne sans débordement. Clé `services.youtube` remplacée par
  `services.youtubeMusic`, `services.bandcamp` ajoutée.
- **Démo** : aucun lien direct dans le seed (disques fictifs : un faux identifiant mènerait vers
  un vrai disque sans rapport). Les liens directs se voient sur le catalogue réel de Neon `dev`
  (étape 3) ; les e2e insèrent leurs liens dans un catalogue jetable.
- Tests : validation (cas valides et piégés : `http:`, `open.spotify.com.example.com`,
  `user@`, port, mauvais type de fiche, `javascript:`, encodages, longueur, paramètres de suivi
  retirés) ; import depuis les réponses enregistrées (disque, morceaux, artiste ; un crédit
  n'efface rien) ; fusion ; lecture (direct puis recherche, ordre fixe, URL invalide en base →
  recherche). e2e : disque jetable avec liens directs Spotify et Bandcamp (`href` exacts) et
  trois recherches ; fiche artiste ; fiche morceau.
- Captures : fiche album, artiste et morceau (visiteur et membre), recherches seulement : les
  liens directs réels viennent à l'étape 3.

## Étape 3 — « Écouter sur… » : la relecture de nuit

Consignes :

- Fournisseur : `getEditionLinks(releaseGroupMbid)` = navigation
  `release?release-group={mbid}&inc=url-rels&limit=100` (une requête, sans page suivante) →
  éditions (`ReleaseEdition`) avec leurs relations. **Vérifier d'abord** sur une réponse
  enregistrée que la navigation renvoie bien les relations (la doc officielle dit que les
  relations sont disponibles en navigation comme en lecture directe). Sinon : relire l'édition
  de référence (`release/{reference_release_mbid}?inc=url-rels`, une requête) et le noter.
- Relecture dans `packages/api/src/lib/catalog/` (nouveau fichier), appelée par
  `packages/api/scripts/refresh-catalog.ts` ; option `--links-only` pour lancer la seule phase
  des liens.
- Docs : `docs/catalogue.md` (liens d'écoute : source, validation, import, nuit) ;
  `docs/stack-et-limites.md` § 3, ligne « Tâche de nuit », avec le nouveau budget.
- Passage réel sur Neon `dev` : `pnpm catalog:refresh -- --links-only` (jamais pendant un
  import sur une autre base), résultat dans le journal (disques et artistes relus, liens trouvés
  par service).

Décisions actées :

- **Ordre** : la phase des liens passe après ListenBrainz et les discographies, jamais avant.
  Ses erreurs n'effacent rien, n'arrêtent pas les autres phases et ne changent pas le code de
  sortie actuel du script. Workflow inchangé.
- **Plafond** : 200 disques puis 100 artistes, une requête chacun, et 10 minutes au plus pour la
  phase (horloge injectable) ; le reste attend la nuit suivante. Au pire 300 requêtes ≈ 5,5 min
  à 1,1 s : la tâche passe d'environ 640 à 940 requêtes au pire (≈ 17 min), sous le seuil
  d'alerte de 30 min (`docs/stack-et-limites.md` § 6) et les 45 min du workflow.
- **Disques relus** : fiche complète (`tracklist_imported_at` non nul), avec `mbid`, non
  fusionnée ; d'abord celles jamais relues (`links_checked_at` nul, les plus récemment
  complétées d'abord), puis celles relues il y a plus de 30 jours (la plus ancienne d'abord).
  Les fiches incomplètes ne sont jamais relues : elles reçoivent leurs liens à leur import.
- **Choix par service** : le premier lien valide dans l'ordre `rankEditions` des éditions lues.
- **Remplacement** : le résultat remplace les liens du disque (ajout, mise à jour, retrait d'un
  service disparu), sauf si le disque a plus de 100 éditions (lecture partielle) : alors ajout
  et mise à jour seulement. `links_checked_at` = maintenant. Réponse `not_found` :
  `links_checked_at` rempli, liens gardés. MusicBrainz indisponible ou occupé : la phase
  s'arrête pour la nuit, rien d'écrit pour ce disque.
- **Artistes relus** : `mbid`, non fusionné, discographie déjà importée
  (`discography_imported_at` non nul) ; même ordre (jamais relus, puis plus de 30 jours) ;
  `getArtist` ; remplacement de ses liens ; rien d'autre ne change sur la fiche.
- **Morceaux** : pas relus la nuit (une requête de plus par disque) ; liens à l'import
  seulement. Écrit dans `docs/catalogue.md` comme limite assumée.
- **Sortie du script** : une ligne `links: N disque(s), M artiste(s) relus, K lien(s),
  F échec(s), S pour plus tard`.
- Tests (réponses enregistrées) : files et ordre, plafonds (dont le temps), choix par édition,
  remplacement, lecture partielle, `not_found`, arrêt sur indisponibilité, fiches fusionnées
  ignorées, morceaux jamais touchés.
- Captures : une fiche album et une fiche artiste réelles du catalogue de `dev` avec des liens
  directs (1280 et 390, visiteur).

## Étape 4 — « Tes amis sur ce disque »

Consignes : API, section de la fiche d'un disque, démo, tests.

Décisions actées :

- **Où** : fiche d'un disque (album, EP, single) seulement ; ni morceau, ni artiste.
- **Qui** : les membres que je suis (`follows`), avec une note ou un cœur sur ce disque dans leur
  état actuel (`user_item_state.rating` non nul ou `liked`) ; ni « écouté » seul, ni « À
  écouter ». Exclus : blocage dans un sens ou l'autre (`notBlockedWith`), comptes suspendus,
  membres au journal privé (`profiles.diary_private`, comme le fil Amis) ; jamais moi.
- **Rien à montrer** — visiteur, compte suspendu ou sans profil, aucun ami avec un avis, disque
  pas encore sorti dans mon fuseau (`upcomingRelease()` avec mon jour, comme
  `myState.releaseNotOut`), écoute à l'aveugle tant que je n'ai pas noté ce disque
  (`ratedIds`) : l'API renvoie null et la section n'existe pas (ni titre, ni phrase).
- **API** : `release.friends({ slug, all? })`, publique (null pour un visiteur), lue par slug
  dans la même vague que la fiche ; une requête pour les lignes et le total ; renvoie
  `{ items: { member: MemberRef; rating: number | null; liked: boolean }[]; total: number }`
  ou null. Tri : le plus récemment modifié (`user_item_state.updated_at`), puis le pseudo. 5
  lignes, ou 100 avec `all`. Slug inconnu ou fusionné : null. `release.bySlug` ne change pas.
  Si la mesure dépasse la référence de plus de 20 ms, essayer la deuxième vague (avec
  `myState`) et noter le choix.
- **Écran** : section « Tes amis sur ce disque » (EN « Your friends on this record »,
  `id="friends"`) juste après la mosaïque des cartes, avant « Liste des titres ». Liste de
  lignes, pas de carte entière en lien : avatar, nom affiché lié au profil (cible de 44 px),
  étoiles en lecture seule (`Stars`) avec leur texte pour lecteurs d'écran (« 4,5 sur 5 »),
  cœur plein (`HeartIcon`) avec « Coup de cœur » pour lecteurs d'écran ; une ligne avec
  seulement un cœur n'affiche pas d'étoiles vides. Plus de 5 : lien « Voir tous tes amis
  ({total}) » vers `?friends=all#friends` ; ouvert : « Voir moins » vers `#friends`. Plus de
  100 : « et N autres », sans lien. Une colonne sur mobile, 2 ou 3 sur ordinateur. Pas de
  lilas. Le paramètre `friends` ne change rien pour un visiteur.
- **Démo** : nouveau fichier `packages/db/src/seed/friends.ts` (plage d'identifiants libre,
  idempotent) : un disque fictif de plus (titre inventé, artiste de démo existant, date
  ancienne, pistes avec durées), 6 membres fictifs suivis par `nuitblanche` avec une note et/ou
  un cœur dessus (au moins un cœur seul et une note seule), plus un membre suivi, au journal
  privé, qui l'a noté (absent de la section). Écoutes datées de plus de 40 jours avant le seed
  (hors tendances et suggestions), notes de 6 à 8 sur 10 (le disque ne prend pas la tête des
  « mieux notés »). Vérifier que les tests et e2e existants ne comptent pas les abonnements de
  `nuitblanche` ni les membres de la démo ; sinon ajuster la démo, jamais les tests.
- Tests (PGlite) : chaque règle de « Qui » et de « Rien à montrer », tri, 5 + total, `all`,
  slug fusionné ou inconnu. e2e : compte jetable qui suit les membres de la démo → 5 lignes et
  « Voir tous », puis `?friends=all` ; sans JavaScript ; visiteur sans section.
- Captures : fiche du disque de démo en membre (5 lignes et lien, puis tout), membre sans ami
  dessus (pas de section), visiteur ; 1280 et 390.

## Étape 5 — « Tire un disque »

Consignes : lire l'issue #31 (`gh issue view 31`) ; API, page `/pick`, bouton d'accès, démo,
tests, mesure de la nouvelle page. Si #31 demande plus que ces décisions, elles priment : noter
l'écart.

Décisions actées :

- **Candidats** : mes disques « À écouter » (`user_item_state.want_to_listen`, `release_id` non
  nul ; les morceaux n'y sont pas, comme l'onglet du profil), non fusionnés, déjà sortis dans
  mon fuseau (même règle que `requireReleased()` : ce que `upcomingSql(today, false)` retient
  est exclu).
- **Filtres** : `type` = `album` | `ep` | `single` (absent : tous) ; `duration` = `short`
  (moins de 30 min) | `medium` (de 30 à 60 min, bornes comprises) | `long` (plus de 60 min)
  (absent : toutes). Durée connue = au moins une piste et toutes avec une durée
  (`tracks.duration_ms`), somme des pistes ; durée inconnue : exclue dès qu'un filtre de durée
  est choisi, incluse sinon (affichée sans durée).
- **Tirage** : uniforme parmi les candidats filtrés, côté API (`lib/listening/pick.ts`), aléa
  injectable pour les tests ; `not` (le disque affiché) exclu s'il reste au moins un autre
  candidat ; deux vagues de requêtes au plus (candidats légers, puis la carte). Rien n'est écrit
  en base : ni historique, ni compteur, ni limite de débit (c'est une lecture).
- **API** : `toListen.pick({ type?, duration?, not? })` (membre avec profil ; visiteur ou compte
  suspendu refusé comme les autres lectures de membre) → `{ listTotal, matching, pick }` ;
  `pick` = carte du disque (masquée en écoute à l'aveugle comme ailleurs), `durationMs` (ou
  null) et `listenLinks` (étape 2).
- **Page `/[locale]/pick`** (« Tire un disque », `noindex`) : visiteur → `/sign-in`, sans profil
  → `/welcome`, comme `/upcoming`.
  - En-tête en bloc lilas, le seul de la page : étiquette « Quoi écouter ce soir ? », titre
    « Tire un disque », phrase « Le hasard choisit dans ta liste « À écouter ». ».
  - Deux filtres en `LinkTabs` (liens `?type=` et `?duration=`, l'autre filtre gardé) :
    « Tout / Albums / EP / Singles » et « Toutes durées / Moins de 30 min / 30 à 60 min / Plus
    d'une heure ».
  - Le disque tiré dans une carte (pas un lien entier) : grande pochette, titre lié à la fiche,
    artistes liés, « Album · 1959 · 42 min » (durée seulement si connue, clé `album.duration`),
    « Écouter sur… » (les 5 pastilles), bouton principal « Un autre » et lien « Voir ma liste
    « À écouter » » (onglet du profil).
  - « Un autre » : formulaire GET vers `/pick` avec `type`, `duration` et `not` en champs
    cachés ; sans JavaScript, soumission classique ; avec JavaScript, navigation interne
    (`next/form`, inclus dans Next, ou `useNavigate()`), choix noté.
  - Un seul candidat : pas de « Un autre », phrase « C'est le seul disque de ta liste qui
    correspond. ».
  - Liste vide : « Ta liste « À écouter » est vide. Ajoute des disques depuis leur fiche. » et
    le lien « Découvrir des disques » (`/discover`), sans filtres.
  - Rien ne correspond : « Aucun disque de ta liste ne correspond à ces filtres. » et « Retirer
    les filtres » (`/pick`).
  - Rien n'est encore sorti : « Les disques de ta liste ne sont pas encore sortis. » et le lien
    vers la liste.
- **Accès** : dans l'onglet « À écouter » de **mon** profil seulement, en tête quand la liste
  n'est pas vide : bouton-lien secondaire « Tire un disque » vers `/pick` (le profil a déjà son
  bloc lilas). Accueil et barre d'onglets inchangés.
- **Démo** : `nuitblanche` a au moins 6 disques sortis dans « À écouter », qu'elle n'a pas
  écoutés : au moins un par tranche de durée, un EP, un single et un disque sans pistes (durée
  inconnue) ; ses sorties à venir en « À écouter » restent (exclues du tirage). Disques
  fictifs, dans `seed/friends.ts` ou un nouveau fichier.
- Tests (PGlite) : candidats (les miens seulement, disques seulement, pas encore sortis exclus
  selon le fuseau, fusionnés exclus), filtres et bornes (29:59, 30:00, 60:00, 60:01), durée
  inconnue, `not`, un seul candidat, les trois cas vides, aléa injecté. e2e : tirage avec
  filtres, « Un autre » donne un autre disque, sans JavaScript, liste vide (compte jetable),
  bouton présent sur mon onglet et absent du profil d'un autre.
- Mesure : accueil → `/pick`, deux passages : sa référence pour l'étape 6, notée dans
  `docs/jalon-13-en-cours.md`.
- Captures : `/pick` (tirage, filtre actif, un seul candidat, liste vide), onglet « À écouter »
  avec le bouton ; 1280 et 390.

## Étape 6 — La passe finale

1. Doc du domaine : `docs/quoi-ecouter.md` (règles des trois fonctions, données, API, commande
   et phase de nuit, écrans), avec des renvois depuis `docs/catalogue.md`, `docs/ecoute.md`,
   `docs/social.md` et `docs/decouverte.md`.
2. `docs/cahier-des-charges.md` : dans la section du jalon 13, une ligne cochée « Quoi écouter
   ce soir ? : règles retenues… » renvoyant à `docs/quoi-ecouter.md` ; la ligne « liens
   « Écouter sur » … (simples liens de recherche, sans API) » de la page album dit ce qui est
   fait.
3. Captures 1280 et 390 px de tous les écrans du jalon, visiteur et membre, revues par le
   relecteur.
4. axe sur ces écrans, `overflow.spec`, e2e complet en dev, specs sans compte en prod,
   `measure.mjs` complet et `/pick` comparés à la référence.
5. `CLAUDE.md` : jalon 13 coché en une ligne ; l'option `--links-only` de
   `pnpm catalog:refresh` ; la décision « liens d'écoute : relations d'URL MusicBrainz
   seulement, hôtes validés, aucun lien affilié ».
6. Puis la fin de jalon du pilote (sections 5 et 6 du skill) : PR vers `dev` (`Closes #31` et
   les deux issues de l'étape 1, questions pour Azzo de `decisions.md`), fusion dans `dev` si
   elle ne touche en zone sensible que ce qu'autorise « Autorisé à la fusion », puis PR de
   release `dev` → `main` en brouillon, que fusionne Azzo.
