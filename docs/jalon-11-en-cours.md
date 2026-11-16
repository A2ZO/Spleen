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
- `/upcoming` n'a pas de référence : la première mesure (étape 3) devient la sienne.

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

## Prochaine étape : 2 « Alimentation de nuit et lectures »

Brief : `docs/pilote/feuille-de-route.md`, « Étape 2 ». Commencer par le plan
(`docs/pilote/plan-etape-2.md`), validé par Azzo avant tout code (nouvelle migration possible).
