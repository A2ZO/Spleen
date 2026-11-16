# Sorties à venir de tes artistes (jalon 11)

Suivre un artiste, voir ses prochains disques, être prévenu le jour de la sortie. Spécification :
`docs/cahier-des-charges.md`, « Sorties à venir de tes artistes ». Ce fichier est le point
d'entrée du domaine ; le détail reste dans les docs citées.

## Règles retenues (validées par Azzo le 16 novembre 2026)

- **Suivre** : membres connectés, non suspendus ; 500 artistes au plus (erreur `ARTIST_FOLLOW_LIMIT`),
  200 écritures par heure. Un doublon fusionné est suivi sur la fiche gardée.
- **Visibilité** : la liste des artistes suivis est privée (réglages, « Sorties à venir »).
- **À venir** : disque principal (album, EP, single ; ni live ni compilation), non fusionné,
  daté après aujourd'hui dans le fuseau du lecteur (Europe/Paris pour un visiteur), 12 mois au
  plus. Au mois ou à l'année : la période suivante, ou celle en cours si la sortie a été
  annoncée. Année seule : « Annoncé, date à préciser ». Règle unique :
  `lib/catalog/upcoming.ts` (`upcomingSql()`), détail dans `docs/decouverte.md`.
- **Avant la sortie** : seulement « À écouter ». Écoute, note et critique sont refusées
  (`RELEASE_NOT_OUT`, `requireReleased()`, `docs/ecoute.md`).
- **Jour J** : notification « Sortie aujourd'hui » dans le site, sans email ni push, pour les
  membres qui ont `notify_releases` (vrai par défaut, case dans les réglages).
- **Dates** : MusicBrainz est la seule source ; ListenBrainz ne sert qu'à choisir quoi relire
  (`docs/catalogue.md`, « Dates annoncées et sorties annoncées »).

## Données

- Migration 0014 : `artist_follows` (cascade membre, `restrict` artiste) et
  `profiles.notify_releases`.
- Migration 0015 : `releases.announced_at` et `releases.release_date_changed_at` (badge « Date
  modifiée »). `releases.release_date_precision` existait avant le jalon.
- Migration 0016 : type de notification `release` et `notifications.release_id` (`restrict`,
  une ligne par membre et par disque : `notifications_release_once_uidx`).
- Les suivis et les notifications partent dans l'export et disparaissent avec le compte ; la
  fusion de doublons repointe suivis et notifications. Politique de confidentialité à jour.

## API (`packages/api`)

- `artistFollow.follow / unfollow / status / mine`, `account.setNotifyReleases` :
  `lib/catalog/artist-follows.ts`.
- `upcoming.mine` (membre, groupes `week` / `month` / `later` / `tba`), `upcoming.byArtist`
  (public), `upcoming.home` (accueil, `soon` de l'issue #32), `upcoming.suggestions` ;
  `discovery.awaited` (« Les plus attendus ») ; `release.bySlug.upcoming`.
- Dates : `lib/catalog/release-dates.ts` ; fil de nuit : `lib/catalog/upcoming-feed.ts` ;
  jour J : `lib/catalog/release-notifications.ts` (`notifyReleasesOfDay`, export
  `@spleen/api/jobs`), lu par `notification.list`.

## Commandes et tâches de nuit

- `pnpm catalog:refresh` : d'abord le fil ListenBrainz « fresh releases » (40 relectures
  MusicBrainz au plus), puis les discographies, artistes suivis en tête.
- `pnpm releases:notify` : crée les « Sortie aujourd'hui » du jour de chaque membre (son
  fuseau, repli Europe/Paris) ; relançable sans doublon, affiche seulement le nombre créé.
- `.github/workflows/catalog-refresh.yml` (03:17 UTC) : les deux, dans cet ordre ; la
  notification tourne même si la relecture a échoué (`!cancelled()`).

## Écrans (détail dans `docs/decouverte.md`)

- Fiche artiste : bouton « Suivre » (visiteur : lien de connexion), section « À venir »,
  « Une sortie manque ? ».
- `/upcoming` : « Mes sorties à venir », filtre par type, suggestions d'artistes.
- Accueil membre : « Bientôt dans tes oreilles », carte « Sort demain » / « Sort vendredi ».
- `/discover` : « Les plus attendus ». Fiche d'un disque à venir : « Sort le … », contrôles
  réduits, sans note de la communauté, critiques ouvertes à la sortie. Notifications : « Sortie aujourd'hui », regroupées par jour.
- Démo : `packages/db/src/seed/upcoming.ts` (`nuitblanche` suit trois artistes, `vinylvince`
  deux, six sorties annoncées, dates recalculées à chaque seed).

## Questions laissées à Azzo (PR du jalon)

- Retirer les sorties à venir de la discographie de la fiche artiste ?
- Notification d'un jour passé : garder « Sortie aujourd'hui » ou dire « Sorti le … » ?
- La tâche de 03:17 UTC prévient les Amériques le soir de la sortie : acceptable ?
