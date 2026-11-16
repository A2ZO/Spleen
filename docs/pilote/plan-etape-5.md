# Plan — étape 5 « Les notifications du jour J »

Brief : `feuille-de-route.md`, « Étape 5 ». Données vérifiées : `notifications` (schéma
`social.ts`, `group_key`, `actor_id` nullable), `profiles.notify_releases` / `time_zone` /
`suspended_at`, `release_artists`, `artist_follows`, `mainReleaseSql()`, `todayIn()`
(`@spleen/validators`), `repoint()` de `lib/catalog/merge.ts`.

1. [x] **Migration** (`packages/db/src/schema/social.ts`, puis `pnpm db:generate`, jamais
   retouchée) : valeur `release` ajoutée à `notification_type` ; colonne `release_id` →
   `releases.id` `on delete restrict` ; index unique partiel `notifications_release_once_uidx`
   (`user_id, release_id`) `where release_id is not null` (une notification par membre et par
   disque, sans utiliser la nouvelle valeur d'enum dans la même migration) ; index partiel
   `notifications_release_idx` (`release_id`) pour la contrainte et la fusion. `pnpm db:migrate`
   sur la base de dev.
2. [x] **Tâche** `packages/api/src/lib/catalog/release-notifications.ts` :
   `notifyReleasesOfDay(db, now, { userIds? })` → nombre de lignes créées.
   - Fuseaux distincts des suiveurs concernés (notifs actives, non suspendus) lus en SQL ;
     « aujourd'hui » de chaque fuseau calculé en JS avec `todayIn()` (même règle que le reste) ;
     fuseau vide ou que `todayIn()` refuse → `DEFAULT_TIME_ZONE`, comme les lectures « à venir ».
   - Un seul `insert … select distinct … on conflict do nothing` : disques
     `release_date_precision = 'day'` dont la date = jour du fuseau du membre, `mainReleaseSql()`,
     un artiste crédité suivi ; `type 'release'`, `actor_id` null,
     `group_key = 'release:day:<jour>'`, `created_at = now`.
   - `userIds` limite aux membres donnés (e2e et captures uniquement).
   - Export pour l'e2e : sous-chemin `@spleen/api/jobs` (`src/jobs.ts`) dans `exports`.
3. [x] **Commande** `packages/api/scripts/notify-releases.ts` (modèle `retention.ts`, n'écrit
   que le nombre créé), script `notify:releases`, alias racine `pnpm releases:notify`.
   Workflow `catalog-refresh.yml`, job `refresh` : étape après `pnpm catalog:refresh`,
   `if: ${{ !cancelled() && steps.config.outputs.ready == 'true' }}`, mêmes secrets de base.
4. [x] **Fusion de doublons** : `repoint(tx, "notifications", "release_id", keep, dup,
   "user_id")` dans `mergeRelease` (un membre qui avait les deux garde une seule ligne).
5. [x] **Lecture** `listNotifications` : par groupe `release`, `releaseIds` agrégés et
   `releaseCount` (sans jointure dans la requête groupée : comptage et curseur inchangés) ;
   titres, slugs et artistes lus dans une seconde requête comme `reviewRows`, triés par titre ; `NotificationGroup.releases: { slug, title, artists }[]` (3
   au plus, disques fusionnés lus sur la fiche gardée) et `releaseCount`. Les autres types
   renvoient `[]` / `0`. `unreadCount` et `visible()` acceptent déjà `actor_id` null.
6. [x] **Rendu** `notifications/page.tsx`, branche `release` explicite avant le `<Link>`
   générique (`text()` et `hrefOf()` retombent sinon sur `comment`) : un disque → carte-lien
   entière vers la fiche, petite pochette décorative (`Cover`, pochette générée sans image) à la
   place des avatars, « Sortie aujourd'hui : **Titre** de Artiste » ; plusieurs →
   carte non cliquable (comme `ModerationItem`) : « N sorties aujourd'hui chez tes artistes »,
   les 3 premiers titres liés, chacun sur sa rangée de 44 px, puis « et N autres » (pluriel
   ICU) ; point non lu et `unreadLabel` comme les autres cartes. Titres en gras, jamais
   d'italique ; cibles ≥ 44 px ; jetons seulement. Clés FR/EN `notifications.release`,
   `notifications.releases`, `notifications.releasesMore`.
7. [x] **Tests API** (`release-notifications.test.ts`, PGlite) : membre à Tokyo et à Los
   Angeles de part et d'autre de minuit UTC ; deux disques le même jour → un groupe ; relance →
   aucun doublon ; fuseau invalide → jour de Paris ; deux artistes suivis sur le même disque → une ligne ; compte suspendu et
   réglage coupé → rien ; date au mois ou à l'année → rien ; compilation exclue ; lecture
   (`releases`, `releaseCount`, « et N autres ») ; fusion de doublons repointe sans doublon.
8. [x] **e2e** (`upcoming.spec.ts`) : `throwawayCatalog` avec un disque du jour puis trois,
   inscription, suivi de l'artiste, `notifyReleasesOfDay` limité au membre, page des
   notifications (texte, lien vers la fiche, « et 1 autre » à 4 disques). Le jour du disque
   est calculé avec le même `now` que celui passé à la tâche et le fuseau du compte (stable à
   minuit). Écart à la feuille de route : ni données de démo ni `page.clock` (voir décision,
   redit dans la PR).
9. [x] **Docs** : `docs/social.md` (type `release`, clé, tâche de nuit), `docs/decouverte.md`
   (renvoi). Vérifié : `legal.privacy` cite déjà les notifications et leur réglage, l'export
   fait `select()` sur `notifications` (la colonne suit) : pas de changement.
10. [x] **Vérif** : `pnpm check`, e2e complet via `verificateur`, captures 1280/390
    (`captures/5`, une sortie puis plusieurs, compte e2e jetable en dev), axe, mesures prod.

Décisions (`decisions.md`) : unicité par index partiel sur `release_id` plutôt que d'étendre
`notifications_once_uidx` ; `todayIn()` en JS par fuseau plutôt que `timezone()` SQL ; pas de
`page.clock` (rendu serveur) et pas de données de démo figées (une date « aujourd'hui » ne
reste pas vraie) : catalogue jetable comme les autres e2e du jalon.
