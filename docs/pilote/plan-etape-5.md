# Plan de l'étape 5 — « Tire un disque »

Décisions actées : `feuille-de-route.md`, « Étape 5 » (elles priment sur l'issue #31 : accueil
inchangé, écart noté). Données existantes : `user_item_state` (`want_to_listen`, `release_id`,
`rating`), `releases` (`type`, `merged_into_id`), `release_tracks` → `tracks.duration_ms`,
`listen_links`, `upcomingSql(today, false)`, `todayIn`, `loadReleaseCards`, `maskRelease`,
`buildListenLinks`, `ctx.account()`.

1. **Validateur** : `pickSchema` = `{ type?: releaseTypeSchema, duration?: short|medium|long,
   not?: uuid }`.
2. **API** `lib/listening/pick.ts`, `pickToListen(db, { id, timeZone, blind }, input, now,
   random = Math.random)`. Vague 1, une requête : mes `want_to_listen` à `release_id` non nul →
   `releases r` non fusionné ; `id`, `type`, `out` (`not coalesce(upcomingSql(mon jour, false),
   false)`), `rated` (`rating` non nul), `duration_ms` (somme si ≥ 1 piste et toutes avec durée,
   sinon null). En JS : `listTotal` = toutes ; candidats `out` ; filtres (`short` < 30 min,
   `medium` 30..60 min bornes comprises, `long` > 60 min ; durée null exclue avec un filtre de
   durée) ; `matching` ; `not` retiré s'il reste un autre candidat ; index `floor(random()·n)`
   borné. Vague 2 en parallèle : `loadReleaseCards([id])` + liens stockés ; carte masquée
   (`maskRelease`) en aveugle sans `rated` ; `buildListenLinks(…, "release", titre, 1er
   artiste)`. Renvoie `{ listTotal, matching, pick: (ReleaseCard & { durationMs, listenLinks })
   | null }` (`ToListenPick`). Rien n'est écrit.
3. **`toListen.pick`** (nouveau routeur) : `protectedProcedure` ; sans profil
   `PRECONDITION_FAILED`/`PROFILE_REQUIRED` (comme `artistFollow.status`) ; fuseau du profil.
4. **Page `/[locale]/pick`** (`noindex`) : visiteur → `/sign-in`, sans profil → `/welcome` ;
   `type`/`duration`/`not` en `safeParse` (invalide = absent). Bloc lilas ; `listTotal` 0 :
   « liste vide » + « Découvrir des disques », sans filtres ; sinon deux `LinkTabs` (`hrefWith`,
   l'autre filtre gardé, `not` retiré) puis : `matching` 0 sans filtre → « pas encore sortis » +
   lien vers ma liste ; avec filtre → « aucun ne correspond » + « Retirer les filtres » ; sinon
   `components/pick/PickCard.tsx` (`Card`, pas un lien entier) : grande `Cover`, titre et
   artistes liés, « Album · 1959 · 42 min », `ListenOn`, « Un autre » ou (un seul) la phrase
   « seul disque », lien « Voir ma liste « À écouter » » (onglet du profil, forme réelle).
   « Un autre » : `AnotherPick.tsx` (client), `<form method="get" action="/<locale>/pick">`,
   champs cachés, bouton `primary` ; avec JS `useNavigate().push` (barre du haut ; `next/form`
   écarté, noté). Sans JS : soumission classique.
5. **Accès** : onglet « À écouter » de mon profil, liste non vide : en tête, `ButtonLink
   secondary` « Tire un disque » (comme « Créer une liste »).
6. **i18n** FR/EN : `pick.*`, `profile.pick`, tutoiement.
7. **Démo** `seed/pick.ts` (ids 47 000+, idempotent, après `seedFriends`) : 6 disques fictifs
   sortis (2012–2021), artistes de démo, dans « À écouter » de `nuitblanche`, jamais écoutés :
   albums ~45, ~72 et ~38 min, EP ~18 min, single ~7 min, album sans pistes. Mettre à jour
   inventaire `db.test.ts` et « demo members » (`toEqual` complet, ordre réel), notés ; avant,
   vérifier fiches artiste, recherche, `/discover`, specs mockup/a11y/overflow (sinon la démo).
8. **Tests API** `pick.test.ts` (`now` fixe, aléa injecté) : les miens seulement, morceaux
   exclus, pas sorti selon le fuseau (Paris / Los Angeles), fusionné exclu, types, bornes
   29:59 / 30:00 / 60:00 / 60:01, durée inconnue (piste sans durée, sans pistes) avec et sans
   filtre, `not`, un seul, les trois cas vides, aveugle, visiteur / suspendu / sans profil refusés.
9. **e2e** `pick.spec.ts` : compte jetable, liste vide ; ajoute l'EP et le single de démo via
   « À écouter » → bouton sur mon onglet ; `?type=ep` → l'EP seul ; « Un autre » → l'autre ;
   sans JS ; profil de `nuitblanche` sans bouton ; visiteur → `/sign-in`.
10. **Mesure** : `MEASURE_ONLY=<chemin>` dans `measure.mjs` (accueil → chemin) ; `/fr/pick`,
    deux passages, build de prod (sans la variable : comportement inchangé) ; référence dans
    `docs/jalon-13-en-cours.md` ; plus `measure.mjs` complet (l'onglet du profil change).
11. **Écrans** : titre et artistes en `text-balance` + `clamp`, jamais coupés ; année en chaîne.
    Captures 1280/390 (`captures/5/`) : tirage, filtre actif, un seul, liste vide, onglet avec
    bouton ; axe AA sur `/pick` et l'onglet ; `/fr/pick` dans `overflow.spec`.

## Avancement

- [x] 1 validateur · [x] 2 API · [x] 3 procédure · [x] 4 page · [x] 5 bouton · [x] 6 i18n
- [x] 7 démo · [x] 8 tests API · [x] 9 e2e · [x] 10 mesure · [x] 11 écrans · [x] vérifications · [x] relecture 1 · [x] relecture 2 · [ ] clôture
