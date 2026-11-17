# Plan — étape 1 : les restes du jalon 11
Issues #41 (« Sorti le … ») et #42 (disque à venir), retrouvées par `gh issue list` ; la PR de
fin de jalon dira `Closes #41` et `Closes #42`. Pas de migration, rien ne change en base.

## 1. API — `notification.list` (#41)
- `types.ts`, `NotificationGroup` : `releaseDay: string | null` (`YYYY-MM-DD` tiré de
  `release:day:<jour>`, groupes `release` seulement, null sinon ou clé mal formée) et
  `releasedToday: boolean` (false hors `release`).
- `lib/social/notifications.ts`, `listNotifications(…, now)` : fuseau du membre lu en parallèle
  de la requête groupée (première vague ; la seconde garde ses 6 requêtes, pool de 5) ;
  aujourd'hui = `todayOf(timeZone, now)` exporté de `lib/catalog/release-notifications.ts`
  (repli Europe/Paris) ; `releasedToday = releaseDay === aujourd'hui`. `root.ts` passe `ctx.now`.
- PGlite (`release-notifications.test.ts`) : groupe du 16 lu le 16 → vrai, le 18 → faux,
  `releaseDay` = `2026-11-16` ; même `now`, Tokyo déjà au 17 et Los Angeles au 16 → vrai pour
  Los Angeles seulement ; fuseau inconnu → Paris ; groupe `follow` → null / faux.

## 2. Écran des notifications (#41)
- `notifications/page.tsx` : `releasedToday` → textes actuels ; sinon `notifications.releasePast`
  (« Sorti le {date} : <b>{title}</b> de {artists} » / « Out on {date}: <b>{title}</b> by
  {artists} ») et `notifications.releasesPast` (« {count} sorties le {date} chez tes artistes »
  / « {count} releases on {date} from your artists »). 3 liens et « et N autres » inchangés.
- `lib/release-date.ts`, `formatDayMonth(format, day, today)` : jour et mois en lettres (UTC),
  année ajoutée si elle diffère de celle de `today` (défaut : jour de Paris, comme
  `formatUpcomingDate`). Jamais d'heure.

## 3. Fiche d'un disque pas encore sorti (#42)
- `album/[slug]/page.tsx`, `notOut` existant : `CommunityRating` non rendu ; `cards` et
  `phoneCards` recomptent (`hasLists ? 1 : 0` puisque `showMine` est déjà faux) ; à 0, pas de
  grille du tout.
- « Critiques » sans critique et `notOut` → `album.reviewsOnRelease` (« Les critiques ouvriront
  le jour de la sortie. » / « Reviews open on release day. »). Critiques existantes affichées.
  Fiche morceau et API inchangées.

## 4. e2e (`upcoming.spec.ts`)
- Jour passé : `now` = il y a 3 jours, catalogue jetable de ce jour (1 disque, puis 4 d'un autre
  artiste), `notifyReleasesInDatabase(…, now)` → « Sorti le {date} : … » puis « 5 sorties le
  {date} chez tes artistes ». Jour attendu = jour de `now` dans le fuseau du compte e2e
  (Europe/Paris), jamais celui de la machine ; date par `Intl` fr avec la règle de l'année.
- « a record not out yet » étendu : visiteur et membre voient la phrase des critiques, pas
  « Note de la communauté ».

## 5. Docs
- `docs/sorties.md` « Questions laissées à Azzo » : les trois réponses du conseiller ; la
  discographie reste ouverte. `docs/social.md` (type `release`) : « Sorti le {date} »,
  `releaseDay`, `releasedToday`. `docs/decouverte.md` et `docs/ecoute.md` : moyenne masquée et
  phrase des critiques d'un disque à venir, groupes d'un jour passé.
Vérifications d'écran :
- Captures `captures/1/` 1280 et 390 : notifications (jour, jour passé ; un, plusieurs) ; fiche
  d'un disque à venir (visiteur, membre). axe sur ces pages ; `overflow.spec` ; specs sans
  compte en prod ; `measure.mjs` deux passages contre la référence.
## Avancement
- [ ] 1. API `releaseDay` / `releasedToday` et tests PGlite
- [ ] 2. Écran des notifications et textes FR/EN
- [ ] 3. Fiche d'un disque à venir (moyenne, critiques)
- [ ] 4. e2e
- [ ] 5. Docs
- [ ] vérifications
- [ ] relecture 1
- [ ] relecture 2
- [ ] clôture
