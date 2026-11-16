# Jalon 11 « Sorties à venir » — passation

Suivre un artiste, voir ses prochains disques, être prévenu le jour de la sortie. Spécification :
`docs/cahier-des-charges.md`, section « Sorties à venir de tes artistes (jalon 11) ». Règles
validées par Azzo le 16 novembre : `docs/pilote/decisions.md`. Consignes de chaque étape :
`docs/pilote/feuille-de-route.md`. Branche `feat/11-sorties-a-venir`, depuis `dev`.

## Contraintes (rappel)

- Toute la logique dans `packages/api`, utilisable par l'appli Expo. Aucun appel à ListenBrainz
  ni à MusicBrainz pendant l'affichage d'une page.
- Migrations générées et additives, seulement celles d'un plan validé par Azzo ;
  `pnpm db:migrate` sur Neon `dev` après chacune.
- Identité Lilas (`docs/design/README.md`) : un seul bloc lilas par page, jamais de carte vide,
  AA (texte 4,5:1, non-texte 3:1, cibles de 44 px), marche sans JavaScript.
- Pas de Suspense, pas de `loading.tsx`, pas de transitions de page. Animations en transform et
  opacity seulement.
- Données personnelles nouvelles : politique de confidentialité, export et suppression du compte
  à jour. `TERMS_VERSION` inchangée (jalon 10).

## Étapes

1. **Suivre un artiste** : données, API, bouton de la fiche artiste, réglages. **Fait**
   (e2fce69..79c6a35, voir « Étape 1 » plus bas).
2. **Alimentation de nuit et lectures** : ListenBrainz, `catalog:refresh` étendu, lectures
   d'API, données de démo.
3. **Les écrans des sorties à venir** : `/upcoming`, section « À venir » de la fiche artiste,
   fiche d'un disque pas encore sorti.
4. **Accueil et découverte** : « Bientôt dans tes oreilles », issue #32, « Les plus attendus ».
5. **Les notifications du jour J** : `releases:notify`, workflow de nuit, page des
   notifications.
6. **La passe finale** : `docs/sorties.md`, captures, axe, mesures, `CLAUDE.md`, puis fin de
   jalon.

## Mesures de référence

- `measure.mjs` (fin du jalon 17, build de prod, `main`, médianes de 3) :
  237 / 140 / 225 / 208 / 210. Une page déjà mesurée ne doit pas prendre plus de 20 ms.
- `/upcoming` (étape 3, build de prod, accueil → `/upcoming` par `router.push`, page affichée,
  médianes de 6, deux passages, `nuitblanche`) : **149 / 151 ms**, sa référence.

## Étape 1 — faite (16 novembre)

- Données : `artist_follows` (migration 0014, cascade membre, `restrict` artiste) et
  `profiles.notify_releases` (vrai par défaut). API `artistFollow.follow / unfollow / status /
  mine` et `account.setNotifyReleases` (`packages/api/src/lib/catalog/artist-follows.ts`) :
  200 écritures par heure, 500 suivis au plus (`ARTIST_FOLLOW_LIMIT`), comptes suspendus
  refusés, doublons fusionnés suivis sur la fiche gardée, export et suppression du compte,
  confidentialité FR/EN. 8 tests PGlite.
- Web : `ArtistFollowButton` (formulaire, marche sans JavaScript, erreur affichée via
  `useActionState`, instantané avec `useInstantWrites`), sous le nom de la fiche artiste ;
  visiteur : lien secondaire vers `/sign-in`. Réglages : section « Sorties à venir » (case
  `NotifyReleasesForm`, liste « Mes artistes suivis »). e2e `artist-follow.spec.ts`.
- Pas d'`aria-pressed` sur un bouton dont le libellé change (`FollowButton` aussi) ; les e2e
  lisent l'état dans le nom accessible.

Appris en route :

- Le statut de suivi lu après la fiche ajoutait 60 ms : le lire par slug, dans le même
  `Promise.all` que `getArtist`.
- Pas de retour après connexion dans Spleen (tout le monde arrive sur `/welcome`).
- La case « Me prévenir » existe dès maintenant mais n'agit qu'à l'étape 5.

## Étape 2 — faite (16 novembre)

- Données : migration 0015 (`releases.release_date_precision`, `announced_at`,
  `release_date_changed_at`) ; suivi des dates dans `lib/catalog/release-dates.ts` (une
  précision ajoutée n'est pas un report ; dates passées jamais réécrites).
- Règle partagée `lib/catalog/upcoming.ts` (jour : après aujourd'hui ; mois / année : plus tard,
  ou en cours si annoncée ; 12 mois au plus ; sortie principale album / EP / single), groupes
  `week` / `month` / `later` / `tba`. Lectures tRPC `upcoming.mine` (membre, son fuseau, 200
  au plus, filtre par type) et `upcoming.byArtist` (public, jour de Paris, 20 au plus, doublon
  fusionné suivi). `discovery.recent` exclut ce qui est à venir.
- Nuit (`pnpm catalog:refresh`) : `lib/catalog/upcoming-feed.ts` d'abord (ListenBrainz « fresh
  releases » → artistes suivis → MusicBrainz, 40 relectures : imports, fiches à compléter,
  dates plus tôt, puis plus tard), puis les discographies, artistes suivis en tête.
- Démo : `seed/upcoming.ts` (suivis de `nuitblanche` et `vinylvince`, six sorties annoncées).
- Docs : `catalogue.md` « Dates annoncées et sorties annoncées », `decouverte.md` « Sorties à
  venir ».

Appris en route :

- ListenBrainz donne la date d'une édition : MusicBrainz reste la seule source de date ; une
  date ListenBrainz plus tard n'est relue qu'avec le budget restant (souvent une édition,
  parfois un report).
- À date égale, `upcoming.mine` trie par titre.

## Étape 3 — faite (16 novembre)

- API : refus `RELEASE_NOT_OUT` (`requireReleased()`, `lib/listening/targets.ts`) pour ce qui
  ajoute sur un disque pas encore sorti (fuseau du membre) ; `release.bySlug.upcoming`,
  `listening.myState.releaseNotOut`, `upcoming.suggestions`, état « À écouter » dans
  `upcoming.mine`.
- Web : `/upcoming` (`app/[locale]/upcoming/page.tsx`, `components/upcoming/`), section « À
  venir » et « Une sortie manque ? » sur la fiche artiste (lue en parallèle de l'artiste),
  fiche d'un disque à venir (`ListenControls notOut`), lien depuis `/settings`,
  `formatUpcomingDate()`, `ArtistFollowButton quiet` pour les listes.
- e2e `upcoming.spec.ts` ; helper `throwawayCatalog()` (sorties datées + artiste jetables).
- Docs : `decouverte.md` (écrans), `ecoute.md` (refus et contrôles).
- Mesures : voir « Mesures de référence » (`/upcoming` 149 / 151 ms).
- Décisions (`docs/pilote/decisions.md`) : doublon « À venir » / discographie gardé (à
  trancher par Azzo dans la PR) ; ligne de date au jour de Paris, contrôles au fuseau du membre.

Appris en route :

- axe 2.2 (`target-size`) : deux lignes de liens empilées en `text-sm` / `leading-tight`
  échouent ; `leading-6` / `leading-7` suffit.
- Une lecture ajoutée après `await` de la fiche crée une vague de plus (+36 ms) : la lancer
  dans le même `Promise.all`, par le slug demandé (`NOT_FOUND` → liste vide).
- Build de prod : `hydration.spec` échoue (lien magique absent de `.data/outbox` avec un Brevo
  factice), attendu.

## Étape 4 — faite (16 novembre)

- API : `upcoming.home` (publique, `null` pour un visiteur ou un compte suspendu) →
  `{ following, items, soon }` en une seule requête (5 prochaines sorties suivies, année seule
  en dernier ; `soon` = sortie suivie au jour entre J+1 et J+6) ; `discovery.awaited` (10 au
  plus, membres distincts qui suivent un artiste ou ont le disque dans « À écouter », 2 au
  moins, suspendus exclus, jour de Paris, sans données du lecteur). Constantes dans
  `lib/catalog/upcoming.ts`. Tests PGlite, dont le passage « à venir » → « sorties récentes ».
- Web : `components/upcoming/UpcomingGrid.tsx` (accueil, `/discover`, fiche artiste) ;
  accueil membre « Bientôt dans tes oreilles » (invitation sans suivi, rien si rien
  d'annoncé) ; `JustOutCard` « Sort demain » / « Sort {weekday} » (issue #32, la PR doit
  dire `Closes #32`) ; `/discover` « Les plus attendus » (`#awaited`). e2e dans
  `upcoming.spec.ts`. Doc : `docs/decouverte.md`.
- Mesures prod (médianes de 6, deux passages) : 211/205 · 135/130 · 218/216 · 171/157 ·
  219/220 contre 237 / 140 / 225 / 208 / 210.
- Décisions (`docs/pilote/decisions.md`) : section pleine largeur sous la grille ; « Les plus
  attendus » sans nombre affiché ; année seule en dernier.

Appris en route :

- Le pool Postgres a 5 connexions : trois lectures parallèles de plus sur l'accueil le
  ralentissaient de 25 à 32 ms ; les fondre en une requête (`left join lateral` + `union all`)
  a suffi.
- Captures membre sur le build de prod : réutiliser une session enregistrée (`storageState`) ;
  un compte sans session se capture en dev (lien magique dans `.data/outbox`).

## Étape 5 — faite (16 novembre)

- Migration `0016` (générée) : type `release`, `notifications.release_id` → `releases`
  (`restrict`), index unique partiel `notifications_release_once_uidx` ; la fusion de doublons
  repointe la colonne.
- `pnpm releases:notify` (`lib/catalog/release-notifications.ts`, export `@spleen/api/jobs`) :
  « aujourd'hui » dans le fuseau de chaque membre (`todayIn`, repli Europe/Paris), date au jour,
  disque principal ; une fois par membre et par disque. Étape « Notify today's releases » dans
  `catalog-refresh.yml` après la relecture des discographies (`!cancelled()`).
- Page des notifications : un disque → carte liée « Sortie aujourd'hui : **Titre** de
  Artiste » ; plusieurs → « N sorties aujourd'hui chez tes artistes », 3 liens (titre, artiste
  dessous), « et N autres ». Tests API (6) et e2e dans `upcoming.spec.ts`.
- Écart à la feuille de route (à redire dans la PR) : e2e sans données de démo ni `page.clock`.
- Mesures prod : 217 / 136 / 228 / 181 / 227 contre 237 / 140 / 225 / 208 / 210.

Appris en route :

- Une valeur d'enum ajoutée ne peut pas servir dans la migration qui la crée : index partiel
  sur `release_id is not null` plutôt que sur le type.
- e2e : `notifyReleasesInDatabase` (helpers) lance la tâche pour le seul compte du test ; le
  nettoyage supprime ces notifications avant les disques jetables.

## Prochaine étape : 6 « La passe finale »

Brief : `docs/pilote/feuille-de-route.md`, « Étape 6 ». `docs/sorties.md` (déjà cité par
`release-notifications.ts`), renvois depuis `decouverte.md` et `catalogue.md` ; question
ouverte du cahier cochée ; captures de tous les écrans du jalon ; axe, `overflow.spec`, e2e
complet, mesures complètes ; `CLAUDE.md`. Puis la PR vers `dev` (`Closes #32`, écart e2e de
l'étape 5, questions pour Azzo de `decisions.md`).
