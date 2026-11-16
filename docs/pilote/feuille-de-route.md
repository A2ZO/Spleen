# Feuille de route du pilote — jalon 11 « Sorties à venir »

Écrite par le conseiller d'Azzo le 16 novembre 2026. Le pilote (`/pilote`) fait une étape par
exécution, dans l'ordre, **sans s'arrêter entre les étapes**. Branche `feat/11-sorties-a-venir`
(depuis `dev`). Spécification : `docs/cahier-des-charges.md`, section « Sorties à venir de tes
artistes (jalon 11) ». Règles validées par Azzo : `docs/pilote/decisions.md`, « Déjà décidé avec
Azzo ».

**Décisions actées par le conseiller.** Chaque étape porte ses décisions déjà prises : elles
priment sur toute autre option, et le relecteur juge les plans d'après elles. Une question
qu'elles ne couvrent pas : l'option la plus prudente, notée dans `decisions.md`, sans s'arrêter.
« Attente » seulement pour ce qui est irréversible, ou touche aux données, à la sécurité ou à
l'argent, **et** que cette feuille de route ne prévoit pas.

## Cadre

- Nouvelle fonction : nouvelles tables, procédures tRPC et écrans sont prévus. Toute la logique
  dans `packages/api` (utilisable par l'appli). Aucun appel à ListenBrainz ni à MusicBrainz
  pendant l'affichage d'une page.
- Migrations : générées par `pnpm db:generate`, additives, et seulement celles listées dans
  « Autorisé à la fusion ». Jamais de suppression ni de réécriture de données existantes. Après
  chaque migration : `pnpm db:migrate` sur la base de dev (Neon `dev`), jamais ailleurs.
- Écrans : identité Lilas (`docs/design/README.md`) et composants existants, un seul bloc lilas
  par page, jamais de carte vide. Pas de maquette pour ce jalon : s'inspirer des fiches, de
  l'accueil et de `/discover`.
- Textes FR et EN dans `packages/i18n`, tutoiement. Dates affichées sans heure, formatées dans la
  langue du lecteur ; jamais un jour inventé pour une date au mois ou à l'année.
- Une seule règle « à venir », écrite une fois dans `packages/api` et partagée par toutes les
  lectures (voir étape 2).
- Données personnelles nouvelles (suivis, réglage des notifications) : politique de
  confidentialité, export des données et suppression du compte mis à jour dans la même étape.
  `TERMS_VERSION` ne change pas (prévu au jalon 10).
- Pas de service payant, pas de compte, pas de clé, pas de nouvelle dépendance, pas de nouvelle
  variable d'environnement. ListenBrainz s'appelle avec `fetch`, sans clé, avec le User-Agent de
  MusicBrainz (`MUSICBRAINZ_USER_AGENT`), en respectant ses en-têtes `X-RateLimit-*`.

## Autorisé à la fusion

En fin de jalon, le pilote fusionne la PR dans `dev` (section 6 du skill) si elle ne touche, en
zone sensible, **que** ce qui suit. Toute autre chose sensible : « Attente ».

- Migrations additives générées : table `artist_follows` (étape 1), colonne
  `profiles.notify_releases` (étape 1), colonnes `releases.announced_at` et
  `releases.release_date_changed_at` (étape 2), type de notification `release` et colonne
  `notifications.release_id` (étape 5), avec leurs index.
- `.github/workflows/catalog-refresh.yml` : une étape `pnpm releases:notify` dans le job
  `refresh` (étape 5), rien d'autre.
- Textes de la politique de confidentialité (`legal.privacy`) et date `LEGAL_UPDATED.privacy`.
- Interdit dans tous les cas : logique de connexion, `proxy.ts`, en-têtes de sécurité et CSP,
  variables d'environnement, dépendances.

## Vérifications habituelles (à chaque étape)

- `pnpm check` ; les specs touchés ; puis l'e2e complet via le sous-agent `verificateur`.
- Un test d'API (PGlite) pour chaque règle de l'étape ; la CI les rejoue sur Postgres. Réponses
  ListenBrainz et MusicBrainz enregistrées, jamais de réseau dans les tests. Dates maîtrisées :
  date passée en paramètre côté API, `page.clock` en e2e.
- Quand l'étape change des écrans :
  - build de prod (`pnpm run free-port` d'abord ; Brevo, S3 et `CONTACT_EMAIL` en valeurs
    factices dans la commande seulement, jamais dans `.env`) : specs sans compte et
    `overflow.spec` ;
  - axe WCAG 2.2 AA à 1280 et 390 px sur les pages de l'étape : visiteur sur le build de prod,
    membre en dev avec un compte e2e jetable supprimé à la fin ;
  - `scripts/measure.mjs` sur le build de prod, deux passages : les pages déjà mesurées restent
    dans les 20 ms de la référence (`docs/jalon-11-en-cours.md`, « Mesures de référence ») ;
  - captures 1280 et 390 px dans `docs/pilote/captures/<n>/`, en visiteur et en membre quand la
    page change selon le cas, avec les données de démo (jamais une page vide faute de données).

## Étape 1 — Suivre un artiste

Plan validé par Azzo le 16 novembre (`docs/pilote/plan-etape-1.md`), avec deux corrections dans
`decisions.md` : pas d'`aria-pressed` sur un bouton dont le libellé change (`FollowButton`
compris) ; retour sur la fiche artiste après connexion seulement si un mécanisme existe déjà
(aujourd'hui, tout le monde arrive sur `/welcome` : ne pas en créer, le noter).

- Migration : `artist_follows` (membre, artiste, date ; clé primaire (membre, artiste), index
  par artiste ; cascade à la suppression du membre, `restrict` côté catalogue) et
  `profiles.notify_releases` (vrai par défaut).
- API : suivre, ne plus suivre, état pour un artiste, liste de mes artistes suivis. 500 artistes
  au plus (code d'erreur dédié), 200 suivis par heure (limiteur existant). Un compte suspendu ne
  peut pas suivre. La liste est privée : aucune procédure ne montre les suivis d'un autre membre.
- Fusion de doublons d'artistes (admin) : les suivis passent sur la fiche gardée, sans doublon.
- Export des données : les suivis et le réglage y figurent. Suppression du compte : les suivis
  disparaissent (vérifié par un test).
- Politique de confidentialité : les artistes suivis et le réglage des notifications.
- Fiche artiste : bouton « Suivre » / « Ne plus suivre », écriture instantanée, formulaire qui
  marche sans JavaScript ; un visiteur va vers la connexion.
- Réglages : section « Sorties à venir » avec la case des notifications et « Mes artistes
  suivis », chacun avec « Ne plus suivre ».
- Captures : fiche artiste (visiteur, membre qui suit, membre qui ne suit pas), réglages.

## Étape 2 — Alimentation de nuit et lectures

Consignes :

- Migration : `releases.announced_at` et `releases.release_date_changed_at`.
- Client ListenBrainz dans `packages/catalog`, à côté de MusicBrainz :
  `GET /1/explore/fresh-releases/` avec `release_date` = aujourd'hui, `days=90`, `past=false`,
  `future=true`. Vérifier les paramètres et la forme de la réponse sur la documentation
  officielle avant de coder. Réponses enregistrées pour les tests.
- `pnpm catalog:refresh`, en plus de ce qu'il fait déjà : la requête ListenBrainz, les fiches
  incomplètes des sorties d'artistes suivis, la relecture des discographies étendue aux artistes
  suivis, les changements de date.
- Lectures d'API : mes sorties à venir ; les sorties à venir d'un artiste.
- Données de démo, puis un passage de `pnpm catalog:refresh` sur la base de dev (il peut durer une
  vingtaine de minutes à 1 requête par seconde), résultat dans le journal. Pas d'écran.

Décisions actées :

- **Disque principal** : même définition que les sorties récentes (`docs/decouverte.md`, sans
  live ni compilation ; mixtapes comprises). Une seule fonction, partagée.
- **ListenBrainz** : on rapproche par identifiant MusicBrainz d'artiste (`artists.mbid`). Seuls
  les artistes suivis par au moins un membre comptent ; les autres sorties sont ignorées (pas de
  fiche créée). Une sortie déjà connue garde sa fiche : seules sa date et ses dates de suivi
  changent. Une erreur de ListenBrainz (503, délai, réponse invalide) est notée dans la sortie
  de la commande et n'arrête jamais la relecture des discographies.
- **Relecture** : les artistes suivis passent en tête de la file, les plus suivis d'abord,
  chacun au plus une fois par semaine (`discography_refreshed_at`), dans le plafond existant de
  150 artistes par nuit. Le reste de la file ne change pas.
- **`announced_at`** : rempli la première fois qu'une sortie est vue avec une date après le jour
  du passage ; jamais réécrit ensuite.
- **`release_date_changed_at`** : rempli quand la date d'une sortie qui a un `announced_at`
  change (jour, mois ou année). Le badge « date modifiée » ne s'affiche que tant que la sortie
  est à venir.
- **Règle « à venir »**, pour une date du lecteur (son fuseau ; Europe/Paris pour un visiteur) :
  - au jour : à venir si la date est après aujourd'hui ;
  - au mois : à venir si le mois est après le mois en cours ; pendant le mois en cours,
    seulement si la fiche a un `announced_at`, jusqu'à la fin du mois ;
  - à l'année : à venir si l'année est après l'année en cours ; pendant l'année en cours,
    seulement si la fiche a un `announced_at` ;
  - jamais au-delà de 12 mois (une année seule : l'année suivante au plus).
  Une sortie à venir ne figure pas dans les sorties récentes ; elle y entre dès qu'elle n'est
  plus à venir.
- **Groupes** de « mes sorties à venir » : *Cette semaine* (au jour, dans les 7 prochains
  jours), *Ce mois-ci* (au jour dans le mois en cours après ces 7 jours, ou au mois, mois en
  cours), *Plus tard* (au jour ou au mois au-delà), *Annoncé, date à préciser* (à l'année). Tri
  par date, puis par titre. Filtre `album` / `ep` / `single`, tous par défaut. 200 sorties au
  plus.
- **Sorties à venir d'un artiste** : lecture publique, identique pour tous (cache des pages
  publiques, issue #22), triée par date, 20 au plus.
- **Démo** (`pnpm db:seed`, idempotent) : `nuitblanche` suit 3 artistes de la démo,
  `vinylvince` en suit 2, dont un en commun (pour « Les plus attendus » à l'étape 4). 6 sorties
  à venir aux dates calculées depuis le jour du seed : dans 3 jours, dans 10 jours, le mois
  prochain au jour, dans deux mois au mois seulement, l'année prochaine à l'année seulement, et
  une avec une date modifiée. Titres inventés, comme le reste de la démo.

## Étape 3 — Les écrans des sorties à venir

Consignes : page `/upcoming`, section « À venir » de la fiche artiste, fiche d'un disque pas
encore sorti, refus côté API.

Décisions actées :

- **`/[locale]/upcoming`** : réservée aux membres, avec la même redirection que `/notifications`
  pour un visiteur. En-tête en bloc lilas comme `/discover` (le seul de la page) : titre
  « Sorties à venir » et une phrase courte. Puis les quatre groupes, chacun caché s'il est vide.
  Filtre en contrôle segmenté « Tout / Albums / EP / Singles » fait de liens (`?type=`), qui
  marche sans JavaScript.
- **Une sortie** : rangée avec pochette (la pochette générée si la fiche n'en a pas), titre lié à
  la fiche, artiste lié, date (« ven. 21 nov. » au jour, « novembre 2026 » au mois, « 2027 » à
  l'année), badge « Date modifiée » et bouton « À écouter » (réaction instantanée existante).
  Pas de carte entière en lien.
- **Suggestions** : « Tes artistes les plus écoutés » : le top artistes de l'année des stats,
  hors artistes déjà suivis, chacun avec le bouton « Suivre » de l'étape 1 ; section cachée s'il
  n'y en a aucun. Sans aucun suivi, la page montre l'en-tête, une phrase d'invitation (« Suis tes
  artistes depuis leur fiche pour voir ici leurs prochains disques ») et les suggestions.
- **Sortie manquante** : en bas de `/upcoming`, une phrase sans lien : « Une sortie manque ?
  Signale-la depuis la fiche de l'artiste. » Sur la fiche artiste, sous « À venir », la même
  phrase renvoie au bouton de signalement de catalogue existant (type « ajout manquant »), pour
  les membres seulement.
- **Fiche artiste** : section « À venir » au-dessus de la discographie, en tuiles comme la
  discographie, avec la date sous le titre ; visible par tous ; cachée quand il n'y a rien.
- **Fiche d'un disque à venir** : sous le titre, « Sort le 21 novembre 2026 » (ou « Sort en
  novembre 2026 », « Annoncé pour 2027 ») et le badge. Pas de « J'ai écouté », d'étoiles, de
  cœur ni de critique ; « À écouter » et « Ajouter à une liste » restent. Les blocs vides de la
  fiche (moyenne, critiques) suivent leurs règles actuelles.
- **Refus côté API** : écoute, note, cœur et critique sur un **disque** à venir → code
  `RELEASE_NOT_OUT` (FR/EN), `docs/ecoute.md` à jour. Les morceaux ne sont pas concernés (un
  single peut sortir avant l'album).
- **Accès à `/upcoming`** : depuis la section « Sorties à venir » des réglages (« Voir mes sorties
  à venir ») et depuis l'accueil membre (étape 4). La barre d'onglets mobile ne change pas.
- Captures : `/upcoming` avec et sans suivis, filtre actif, fiche artiste avec « À venir »,
  fiche d'un disque à venir (au jour, à l'année).

## Étape 4 — Accueil et découverte

Consignes : bloc d'accueil, issue #32, « Les plus attendus », passage vers les sorties récentes.

Décisions actées :

- **« Bientôt dans tes oreilles »** (accueil membre), sous le bloc « Ton mois » : les 5
  prochaines sorties de mes artistes, en tuiles avec la date, et un lien « Toutes tes sorties à
  venir » vers `/upcoming`. Aucun artiste suivi : une phrase courte qui invite à suivre ses
  artistes depuis leur fiche, avec le même lien. Des suivis mais rien d'annoncé : bloc caché.
- **Issue #32** (carte « Vient de sortir » de l'accueil, premier disque de `discovery.recent`) :
  pour un membre qui a une sortie à venir au jour dans les 6 prochains jours, la carte devient
  « Sort demain » ou « Sort vendredi » (jour de la semaine, dans le fuseau du membre) avec cette
  sortie. Sinon, et toujours pour un visiteur, elle reste « Vient de sortir ». La même sortie peut
  aussi figurer dans « Bientôt dans tes oreilles ». La PR ferme l'issue (`Closes #32`).
- **« Les plus attendus »** (`/discover`), juste avant « Sorties récentes » : sorties à venir
  classées par nombre de membres distincts qui suivent l'artiste ou ont mis le disque dans « À
  écouter » ; 2 membres au moins par disque ; comptes suspendus exclus ; toutes langues
  confondues ; égalité : la date la plus proche ; 10 au plus ; bloc caché s'il est vide. Aucun nom
  de membre affiché, seulement le disque, l'artiste et la date.
- **Passage aux sorties récentes** : un test d'API vérifie qu'une sortie quitte les sorties à
  venir et entre dans les sorties récentes le jour où elle n'est plus à venir.
- Captures : accueil membre (avec sorties, sans suivi, carte « Sort … »), accueil visiteur
  (carte inchangée), `/discover`.

## Étape 5 — Les notifications du jour J

Consignes : migration, commande `pnpm releases:notify`, étape dans le workflow de nuit, rendu
dans la page des notifications, tests.

Décisions actées :

- **Donnée** : type `release`, colonne `notifications.release_id` (→ `releases`, `restrict`,
  comme le reste du catalogue) ; la fusion de doublons de disques repointe aussi cette colonne.
- **Qui reçoit** : chaque membre qui suit un artiste crédité sur le disque, a
  `notify_releases` vrai, n'est pas suspendu, et pour qui la date du disque (au jour près
  seulement) est aujourd'hui dans son fuseau au moment du passage.
- **Regroupement** : `group_key` par jour dans le fuseau du destinataire, comme les abonnés. Un
  seul disque : « Sortie aujourd'hui : *Titre* de *Artiste* », lié à la fiche. Plusieurs :
  « 3 sorties aujourd'hui chez tes artistes », avec les 3 premiers titres liés à leur fiche et
  « et N autres » au-delà.
- **Jamais deux fois** : un membre reçoit au plus une notification par disque (contrainte ou
  vérification dans la même requête) ; la commande se relance sans doublon.
- **Workflow** : une étape `pnpm releases:notify` dans le job `refresh`, après la relecture,
  qui tourne même si la relecture a échoué (`!cancelled()`), avec la même garde « base de
  production configurée ». Toujours sur le code de `main`.
- **Pas d'email, pas de push** : notification dans le site seulement.
- Tests : API (fuseaux de part et d'autre de minuit, regroupement, doublons, compte suspendu,
  réglage coupé, date au mois ignorée) et e2e de la page des notifications avec les données de
  démo et `page.clock`.
- Captures : notifications avec une sortie, puis avec plusieurs.

## Étape 6 — La passe finale

1. Doc du domaine : `docs/sorties.md` (règles, commandes, tâches de nuit), avec des renvois
   depuis `docs/decouverte.md` et `docs/catalogue.md`.
2. `docs/cahier-des-charges.md` : cocher la question ouverte « Sorties à venir : valider les
   règles », avec les règles retenues.
3. Captures 1280 et 390 px de tous les écrans du jalon, visiteur et membre, revues par le
   relecteur.
4. axe sur ces écrans, `overflow.spec`, e2e complet en dev, specs sans compte en prod,
   `measure.mjs` complet comparé à la référence.
5. `CLAUDE.md` : jalon 11 coché en une ligne, décisions et commandes nouvelles.
6. Puis la fin de jalon du pilote (sections 5 et 6 du skill) : PR vers `dev`, fusion dans `dev`
   si elle ne touche en zone sensible que ce qu'autorise « Autorisé à la fusion », puis PR de
   release `dev` → `main` en brouillon, que fusionne Azzo.
