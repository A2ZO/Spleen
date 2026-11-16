# Feuille de route du pilote — jalon 11 « Sorties à venir »

Écrite par le conseiller d'Azzo le 16 novembre 2026. Le pilote (`/pilote`) fait une étape par
exécution, dans l'ordre. Branche `feat/11-sorties-a-venir` (depuis `dev`). Spécification :
`docs/cahier-des-charges.md`, section « Sorties à venir de tes artistes (jalon 11) ». Règles
validées par Azzo : `docs/pilote/decisions.md`, « Déjà décidé avec Azzo ».

**Plans validés par Azzo** : après chaque plan relu par le relecteur, le pilote s'arrête en
`attente` (« plan de l'étape <n> à valider ») et ne code qu'après la validation.

## Cadre

- Nouvelle fonction : nouvelles tables, procédures tRPC et écrans sont prévus. Toute la logique
  dans `packages/api` (utilisable par l'appli). Aucun appel à ListenBrainz ni à MusicBrainz
  pendant l'affichage d'une page.
- Migrations : générées par `pnpm db:generate`, additives, et seulement celles écrites dans un
  plan validé. Jamais de suppression ni de réécriture de données existantes. Après chaque
  migration : `pnpm db:migrate` sur la base de dev (Neon `dev`), jamais ailleurs.
- Écrans : identité Lilas (`docs/design/README.md`) et composants existants, un seul bloc lilas
  par page, jamais de carte vide. Pas de maquette pour ce jalon : s'inspirer des fiches, de
  l'accueil et de `/discover`.
- Textes FR et EN dans `packages/i18n`, tutoiement.
- Données personnelles nouvelles (suivis, réglage des notifications) : politique de
  confidentialité, export des données et suppression du compte mis à jour dans la même étape.
  `TERMS_VERSION` ne change pas (prévu au jalon 10).
- Pas de service payant, pas de compte, pas de clé. ListenBrainz s'appelle sans clé, avec le
  User-Agent de MusicBrainz, en respectant ses en-têtes `X-RateLimit-*`.
- Fin de jalon : la PR touche les migrations et le workflow de nuit, donc la section 6 du skill
  la laissera à Azzo. C'est attendu.

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

- Migration : `artist_follows` (membre, artiste, date ; clé primaire (membre, artiste), index
  par artiste ; cascade à la suppression du membre, `restrict` côté catalogue) et
  `profiles.notify_releases` (vrai par défaut).
- API : suivre, ne plus suivre, état pour un artiste, liste de mes artistes suivis. 500 artistes
  au plus (code d'erreur dédié), 200 suivis par heure (limiteur existant). Un compte suspendu ne
  peut pas suivre. La liste est privée : aucune procédure ne montre les suivis d'un autre membre.
- Fusion de doublons d'artistes (admin) : les suivis passent sur la fiche gardée, sans doublon.
- Export des données : les suivis et le réglage y figurent. Suppression du compte : les suivis
  disparaissent (vérifié par un test).
- Politique de confidentialité (`legal.privacy`) : les artistes suivis et le réglage des
  notifications de sorties.
- Fiche artiste : bouton « Suivre » / « Suivi » (`aria-pressed`), écriture instantanée comme
  les réactions existantes, formulaire qui marche sans JavaScript ; un visiteur va vers la
  connexion.
- Réglages : section « Sorties à venir » avec l'interrupteur des notifications de sorties et la
  liste de mes artistes suivis, chacun avec « Ne plus suivre ».
- Captures : fiche artiste (visiteur, membre qui suit, membre qui ne suit pas), réglages.

## Étape 2 — Alimentation de nuit et lectures

- Migration : `releases.announced_at` (première fois que le disque est vu « à venir ») et
  `releases.release_date_changed_at` (pour le badge « date modifiée »).
- Client ListenBrainz dans `packages/catalog`, à côté de MusicBrainz :
  `GET /1/explore/fresh-releases/` avec `release_date` = aujourd'hui, `days=90`, `past=false`,
  `future=true`. Vérifier ces paramètres sur la documentation officielle avant de coder.
  Réponses enregistrées pour les tests.
- `pnpm catalog:refresh`, en plus de ce qu'il fait déjà :
  1. une requête ListenBrainz ; garder les disques principaux (album, EP, single ; ni live ni
     compilation) d'un artiste suivi par au moins un membre ; créer les fiches incomplètes comme
     pour les discographies ; remplir `announced_at` à la première vue ;
  2. la relecture des discographies inclut les artistes suivis, les plus suivis d'abord, chacun
     au plus une fois par semaine, dans le plafond existant de 150 artistes par nuit ;
  3. une date de sortie qui change met à jour la fiche et `release_date_changed_at`.
- Lectures (API, aucun appel externe) :
  - mes sorties à venir : disques principaux de mes artistes suivis, datés après aujourd'hui
    dans mon fuseau, 12 mois au plus ; groupes *Cette semaine*, *Ce mois-ci*, *Plus tard* et
    *Annoncé, date à préciser* (année seule) ; filtre album / EP / single ;
  - les sorties à venir d'un artiste, pour tous.
- Démo : `pnpm db:seed` ajoute des suivis (dont `nuitblanche`) et quelques sorties à venir, aux
  dates calculées depuis le jour du seed : au jour, au mois, à l'année seule, et une date
  modifiée. Toujours idempotent. Ces données servent aux écrans et aux e2e des étapes suivantes.
- Pas d'écran dans cette étape. Lancer `pnpm catalog:refresh` une fois sur la base de dev et
  noter le résultat dans le journal.

## Étape 3 — Les écrans des sorties à venir

- Page `/[locale]/upcoming`, pour les membres (un visiteur va vers la connexion) : les quatre
  groupes, filtre album / EP / single en contrôle segmenté (liens, marche sans JavaScript).
  Chaque disque : pochette, titre, artiste, date (jamais un jour inventé pour une date
  partielle), badge « date modifiée », bouton « À écouter ».
- Suggestions : suivre en un clic les artistes que j'écoute le plus (stats existantes), hors
  ceux déjà suivis. Sans aucun suivi, la page montre ces suggestions et une phrase d'invitation.
- « Une sortie manque ? Signale-la. » : vers le signalement de catalogue existant, type « ajout
  manquant ».
- Fiche artiste : section « À venir », visible par tous, cachée quand il n'y a rien.
- Fiche d'un disque pas encore sorti : ni « J'ai écouté », ni note, ni critique, et l'API les
  refuse aussi avec un code d'erreur (`docs/ecoute.md` à jour) ; « À écouter » autorisé ; date
  de sortie et badge. Après la date, la fiche redevient normale.
- Accès à `/upcoming` : un lien sobre (depuis l'accueil membre à l'étape 4, et depuis la fiche
  artiste ou les réglages) ; la barre d'onglets mobile ne change pas.
- Captures : `/upcoming` avec et sans suivis, fiche artiste avec « À venir », fiche d'un disque
  à venir.

## Étape 4 — Accueil et découverte

- Accueil membre : bloc « Bientôt dans tes oreilles » avec mes 5 prochaines sorties et un lien
  vers `/upcoming`. Aucun suivi : une phrase courte qui invite à suivre ses artistes. Des suivis
  mais rien d'annoncé : bloc caché.
- Issue #32 (« Sort vendredi ») : lire l'issue et la résoudre avec ces données ; la PR la
  fermera (`Closes #32`).
- `/discover` : bloc « Les plus attendus » : sorties à venir classées par nombre de membres
  distincts qui suivent l'artiste ou ont mis le disque dans « À écouter » ; 2 membres au moins
  par disque ; comptes suspendus exclus ; bloc caché s'il est vide. Lecture d'API et tests.
- Après sa date de sortie, le disque rejoint les sorties récentes : un test le vérifie, avec une
  date maîtrisée.
- Captures : accueil membre (avec sorties, sans suivi), `/discover`.

## Étape 5 — Les notifications du jour J

- Migration : type de notification `release`, avec une colonne `release_id`.
- Commande `pnpm releases:notify` : pour chaque membre qui suit l'artiste, une notification
  « Sortie aujourd'hui : *Titre* de *Artiste* » quand la date du disque (au jour près) est
  aujourd'hui dans son fuseau ; regroupée s'il y en a plusieurs le même jour (« 3 sorties
  aujourd'hui chez tes artistes ») ; jamais deux fois (relançable sans doublon) ; jamais pour un
  compte suspendu ni quand le réglage est coupé.
- Workflow Nightly : `pnpm releases:notify` après la relecture, sur le code de `main` comme les
  autres tâches, avec la même garde « base de production configurée ».
- Page des notifications : rendu du type `release`, chaque disque lié à sa fiche.
- Tests : API (fuseaux, regroupement, doublons, compte suspendu, réglage coupé) et e2e de la
  page des notifications avec les données de démo.
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
6. Puis la fin de jalon du pilote (section 5 du skill) : PR vers `dev`. La fusion reviendra à
   Azzo (migrations et workflow).
