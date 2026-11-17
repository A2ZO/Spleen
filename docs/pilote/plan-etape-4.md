# Plan de l'étape 4 — « Tes amis sur ce disque »

Décisions actées : `feuille-de-route.md`, « Étape 4 ». Données, toutes existantes : `follows`,
`user_item_state` (`rating`, `liked`, `updated_at`), `profiles` (`diary_private`, `suspended_at`,
`time_zone`, `avatar_url`), `notBlockedWith`, `releases.slug` / `merged_into_id`,
`upcomingSql(today, false)` (alias `r`, règle de `upcomingRelease`), `ctx.account()`, `todayIn`.

1. **API** `src/lib/social/release-friends.ts`, `releaseFriends(db, { id, timeZone, blind },
   slug, now, all)`, **une seule requête** : `releases r` (slug, non fusionné) →
   `user_item_state s` → `follows` (moi → `s.user_id`) → `profiles p` ; `rating is not null or
   liked`, non suspendu, `not diary_private`, pas moi, `notBlockedWith`, `not upcomingSql(mon
   jour, false)`, en aveugle `exists` d'une note de moi sur `r.id` ; `count(*) over ()`, tri
   `s.updated_at desc, p.username`, `limit 5 | 100`. Aucune ligne → null, sinon `{ items: {
   member: MemberRef (forme de memberRefs); rating; liked }[]; total }` (`ReleaseFriends`).
2. **`release.friends`** (`root.ts`) : `publicProcedure`, `{ slug, all?: boolean }` ; compte
   absent, suspendu ou sans profil → null (`ctx.account()`) ; aucun import ; `bySlug` inchangé.
3. **Fiche album** : `searchParams.friends === "all"` ; appel lancé dans la première vague
   (avec `getRelease`, slug validé, son propre `.catch(() => {})`), attendu avec `myState` ;
   section après la mosaïque, avant « Liste des titres », si non null. Mesure prod deux
   passages : au-delà de +20 ms, deuxième vague, choix noté dans `decisions.md`.
4. **`components/release/FriendsOnRecord.tsx`** (serveur, sans JS) : `SectionHeading
   id="friends"`, `ul` `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` ; ligne : `Avatar`, nom lié à
   `/u/<username>` (`min-h-11`), `Stars` + `sr-only` `rating.outOfFive` (`format.number(
   ratingToStars())`) si note, `HeartIcon filled role="img"` + `profile.liked` si cœur. Si
   total > 5 : fermé → « Voir tous tes amis ({total}) » (`?friends=all#friends`), ouvert →
   « Voir moins » (`#friends`) et, au-delà de 100, « et {count} autres » sans lien. Ni lilas,
   ni carte en lien.
5. **i18n** `album.friends*` FR/EN : « Tes amis sur ce disque » / « Your friends on this
   record », « Voir tous tes amis ({total}) » / « See all your friends ({total}) », « Voir
   moins » / « See less », « et # autre(s) » / « and # more » (pluriel ICU).
6. **Démo** `packages/db/src/seed/friends.ts` (plage 46_000+), appelé après `seedModeration` :
   disque inventé « Dernier métro pour Belleville » (album, `lune-basse`, 2019-10-04, 6 pistes
   avec durées) ; 7 membres fictifs FR (`@example.test`) suivis par `nuitblanche` (60 j) : 6
   visibles (l'e2e attend « (6) »), au moins un cœur seul et une note seule, et un au journal
   privé avec une note (absent) ; écoutes 41 à 70 j avant le seed, notes 6 à 8,
   `recomputeItemState` ; idempotent. `pnpm db:seed` sur Neon `dev`.
7. Tests et e2e existants : aucun ne compte les abonnements de `nuitblanche` ni les membres de
   la démo, sinon ajuster la démo.
8. **Tests d'API** `release-friends.test.ts` (PGlite vide) : note seule, cœur seul ; « écouté »
   seul et « À écouter » exclus ; non suivi, blocage dans chaque sens, suspendu, journal privé,
   moi exclus ; visiteur, compte suspendu, sans profil, aucun ami → null ; à venir dans mon
   fuseau → null ; aveugle sans note → null, avec note → lignes ; tri (`updated_at` posé par
   UPDATE, égalité départagée par le pseudo) ; 5 + total ; `all` → 100 ; slug inconnu ou
   fusionné → null.
9. **e2e** `release-friends.spec.ts` (Postgres seulement) : compte jetable sans abonnement →
   pas de section ; `followMembersInDatabase` → 5 lignes et « Voir tous tes amis (6) », clic →
   6 lignes et « Voir moins » ; idem sans JavaScript ; visiteur sans section, `?friends=all`
   sans effet.

Captures 1280 et 390 : membre (5 lignes et lien, puis ouvert), membre sans ami, visiteur.

## Avancement

- [ ] 1. `releaseFriends` · [ ] 2. `release.friends` · [ ] 3. fiche album
- [ ] 4. `FriendsOnRecord` · [ ] 5. i18n · [ ] 6. démo · [ ] 7. tests existants vs démo
- [ ] 8. tests d'API · [ ] 9. e2e
- [ ] vérifications
- [ ] relecture 1
- [ ] relecture 2
- [ ] clôture
