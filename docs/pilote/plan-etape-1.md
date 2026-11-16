# Plan — étape 1 « Suivre un artiste » (jalon 11)

Règles : `docs/pilote/decisions.md` (« Déjà décidé avec Azzo »). Relu par le relecteur (OK avec
corrections, appliquées). Branche `feat/11-sorties-a-venir`.

## Données (une migration générée, additive)

- `schema/social.ts` : table `artist_follows` — `user_id` (→ `user.id`, `cascade`), `artist_id`
  (→ `artists.id`, `restrict`), `created_at` ; clé primaire (`user_id`, `artist_id`) (sert au
  compte et à la lecture par membre) ; index `artist_follows_artist_idx` (`artist_id`).
- `schema/auth.ts` : `profiles.notify_releases boolean not null default true`.
- `pnpm db:generate`, puis `pnpm db:migrate` (Neon `dev`). Aucune donnée réécrite.

## API (`packages/api`)

- `packages/validators` : `ARTIST_FOLLOWS_MAX = 500` (comme `PERSONAL_MOODS_MAX`).
- `src/lib/catalog/artist-follows.ts` (nouveau) : `followArtist(db, userId, artistId, now)` :
  artiste fusionné → on suit la fiche gardée (`merged_into_id`) ; artiste inconnu →
  `ITEM_NOT_FOUND` ; transaction (compte puis insertion, comme `createMood`) ; plafond atteint →
  `ARTIST_FOLLOW_LIMIT` (nouveau code, `errors.*` FR/EN) ; insertion `onConflictDoNothing`
  (double envoi sans erreur). `unfollowArtist`, `artistFollowStatus`, `myFollowedArtists` (id,
  slug, nom, image, date ; triés par nom ; ≤ 500).
- `root.ts` : routeur `artistFollow` — `follow` / `unfollow` (`limitedWrite("artist-follow-write",
  { window: 3600, max: 200 })`, entrée `{ artistId: uuid }`), `status({ artistId })` et `mine`.
  Toutes exigent un profil (`PROFILE_REQUIRED` sinon) ; suspendu → `ACCOUNT_SUSPENDED`
  (`protectedProcedure`). Aucune procédure ne prend un autre membre ; rien dans les lectures
  publiques (profil, `findProfile`).
- `account.setNotifyReleases({ enabled })` (profil requis) ; `getMe` expose
  `profile.notifyReleases`.
- `artist.bySlug` ne change pas (même lecture pour tous, cache public de l'issue #22).
- Fusion (`mergeArtist`) : `repoint(tx, "artist_follows", "artist_id", keepId, dupId, "user_id")`.
- Export (`lib/account.ts`) : `artistFollows` (id, slug, nom, date) ; `profile` porte déjà
  `notifyReleases`. Format `spleen-export/1` (ajout de clé). Suppression : cascade.

## Web (`apps/web`)

- `components/catalog/ArtistFollowButton.tsx` (client) : « Suivre » / « Ne plus suivre »
  (`aria-pressed`, nom de l'artiste en `sr-only`), `useInstantWrites` (clé `artist-follow:<id>`)
  comme `FollowButton`, erreurs via `ReactionStatus`. Dans un `<form action>` (champs cachés) :
  sans JS, la Server Action écrit puis `refresh()` ; avec JS, `onSubmit` empêche l'envoi et
  écrit tout de suite. Compte suspendu : l'action renvoie l'erreur (`ACCOUNT_SUSPENDED`).
- `app/[locale]/artist/actions.ts` : `setArtistFollowAction` et `artistFollowFormAction`,
  qui n'appellent que l'API.
- Fiche artiste : bouton sous le nom (centré en mobile), si `me?.profile` (état par
  `artistFollow.status`, une requête pour les membres seulement). Visiteur (`!me`) : lien
  « Suivre » (nom en `sr-only`) vers `/sign-in`.
- Réglages : section « Sorties à venir » (`id="releases"`, avant « Compte ») : case « Me
  prévenir le jour de la sortie » (formulaire + `setNotifyReleasesAction`, `refresh()`, marche
  sans JS), puis « Mes artistes suivis » (titre sans compteur) : liste (avatar, nom lié,
  `ArtistFollowButton` ; « Suivre » réapparaît au clic, ce qui sert d'annulation). Aucun suivi :
  une phrase qui invite à suivre depuis une fiche artiste.
- i18n FR/EN : `artist.follow`, `artist.unfollow`, `settings.releasesTitle`, `notifyReleases`,
  `followedArtists`, `followedArtistsEmpty`, `errors.ARTIST_FOLLOW_LIMIT` ; `legal.privacy` :
  `data` (artistes suivis, réglage des notifications), `visibility` (liste privée) ;
  `LEGAL_UPDATED.privacy` à la date du jour.

## Tests

- API (PGlite, `artist-follows.test.ts`) : suivre / ne plus suivre / double suivi sans erreur ;
  fiche fusionnée → fiche gardée ; inconnu → `ITEM_NOT_FOUND` ; 500 → code dédié ; limiteur
  (201ᵉ → `RATE_LIMITED`) ; suspendu, visiteur, sans profil refusés ; `status` ; fusion (suivi
  déplacé ; membre qui suit les deux → une seule ligne) ; export ; suppression du compte efface
  les suivis ; absent du profil public ; `setNotifyReleases` et `me.profile.notifyReleases`.
- e2e court (`artist-follow.spec.ts`) : membre suit depuis la fiche, retrouve l'artiste dans les
  réglages, ne plus suivre ; visiteur → connexion ; sans JS le formulaire suit.
- `pnpm check`, axe fiche artiste et réglages, `overflow.spec`, mesures (fiche artiste ≤
  référence + 20 ms), captures (fiche : visiteur, membre suit / ne suit pas ; réglages).
- Note : la case des notifications n'agit qu'à l'étape 5 ; tout part dans la PR de fin de jalon.
