# Jalon 9 — en cours (reprise de session)

Document de passation : une nouvelle session reprend le jalon 9 à partir d'ici, **sans rien
redemander**. Branche `feat/09-admin-legal` (créée depuis `main` à jour après la PR #21).
À supprimer à la fin du jalon (`/fin-de-jalon`), une fois son contenu reporté dans
`CLAUDE.md` et les docs de domaine.

Sources : `docs/prompt-claude-code-spleen.md` (règles), `docs/cahier-des-charges.md`
(sections « Légal et RGPD », « Transverse »), `CLAUDE.md`, `docs/social.md` (modération).

## Avancement

| Étape | Contenu | État | Commits |
| --- | --- | --- | --- |
| 0 | Erreurs « Unexpected end of JSON input » et « destination stream errored » des e2e | fait | `7fd2cd6` |
| 1 | Rôle admin (`pnpm admin:grant` / `admin:revoke`), contrôles serveur, tests | fait | `7a91f5e` |
| 2 | Modération : file, décisions, historique, suspension, notifications, conservation | fait | `7a91f5e`, `907a46b` |
| — | Issue « Performance : thème côté navigateur… » | fait | issue [#22](https://github.com/A2ZO/Spleen/issues/22), `b59ee28` |
| 2 bis | Réponses 1 et 2 ci-dessous (bandeau auteur, notes des suspendus) | fait | voir `git log` |
| 3 | Fusion de doublons + bouton « Signaler une erreur / proposer un ajout » (réponse 3) | fait | voir `git log` |
| 4 | Pages légales FR/EN | fait | voir `git log` |
| 5 | Référencement et partage (sitemap, robots, canonical/hreflang, métadonnées, OG) | fait | voir `git log` |
| 6 | PWA (manifeste, icônes, page hors ligne) | fait (connexion sur iPhone : proposition en attente) | voir `git log` |
| 7 | Finitions : 404/500 Baudelaire, en-têtes de sécurité (CSP **mesurée d'abord**), axe | à faire | — |
| fin | Seed à jour, vérification visuelle Chrome bureau + mobile, `/fin-de-jalon` | à faire | — |

État vérifié au dernier commit : lint, typecheck, format, tests unitaires et 84 e2e verts, CI verte,
contrôle des journaux serveur propre.

## Ce qui est fait (résumé)

- **Étape 0.** Deux causes. (a) `generateStaticParams` dans le layout `[locale]` : en dev,
  Next réécrit `prerender-manifest.json` au premier rendu de chaque route ; deux routes
  compilées en même temps le lisaient à moitié écrit (→ 500). Retiré (inutile : le cookie de
  thème rend tout dynamique), interdit par lint sous `app/`. Même défaut corrigé dans la boîte
  d'envoi de dev (écriture atomique, test). (b) `router.refresh()` client après une Server
  Action : second aller-retour annulé en plein rendu par le routeur. Remplacé par `refresh()`
  (`next/cache`) dans les actions. Deux e2e quittaient la page trop tôt. Garde-fou :
  `apps/web/e2e/server-log.ts` fait échouer les e2e si le serveur journalise l'une des deux
  erreurs.
- **Avant l'étape 5.** CLAUDE.md et les docs alignés sur `spleen-prod` ; mentions légales de la bêta (LCEN art. 1-1 II), Brevo, sauvegardes Neon, droit applicable, Vercel à Francfort (`apps/web/vercel.json`, `fra1`) ; purge de nuit (`pnpm retention`, job `retention`, `lib/retention.ts`) des sessions, liens de connexion et compteurs. Captures mobiles avec Playwright (Pixel 7) : l'indicateur « 1 Issue » de Next venait du style `caret-color` injecté par l'outil de capture, pas du site.
- **Étape 6.** `app/manifest.ts` (standalone, encre de nuit, icônes 192 / 512 / maskable), icônes générées depuis `icon.svg` par `pnpm --filter @spleen/web icons` (`scripts/generate-icons.mjs`, avec `next/og`, sans `sharp`), `app/apple-icon.png`, `appleWebApp` (barre d'état sombre) ; `app/sw.js/route.ts` (service worker), `app/offline.html/route.ts` (page hors ligne autonome, FR/EN), `components/layout/ServiceWorker.tsx`, interrupteur `SERVICE_WORKER_DISABLED` (`docs/environnement.md`). e2e `pwa.spec.ts`. **Connexion sur iPhone** (cookies séparés de Safari, WWDC23) : proposition d'un code à 6 chiffres dans le même email, en attente de décision.
- **Étape 5.** Voir `docs/referencement.md`. API `lib/seo.ts` (`seo.sitemapFiles`, `seo.sitemap`, `seo.page`, `seo.og`), web `lib/seo.ts` (`seoMetadata`), `lib/sitemap.ts`, routes `sitemap.xml`, `sitemaps/[file]`, `og/[kind]/[key]`, `robots.ts` ; `getPublicApi()` sans session. Tests `seo.test.ts`, e2e `seo.spec.ts`.
- **Étape 4.** Pages `/legal` (mentions et crédits, ancre `#credits`), `/terms`, `/privacy`, FR/EN, composant `components/legal/LegalPage.tsx` (sections et date `LEGAL_UPDATED`), textes dans `packages/i18n` (`legal.*`, balises riches `<p>`, `<ul>`, `<contact>`, liens), adresse de contact par `system.contact`. Liens dans le pied de page. Crédits : MusicBrainz (CC0 pour le cœur, genres sous CC BY-NC-SA 3.0 avec lien vers la licence) et Cover Art Archive. Informations personnelles en `[À COMPLÉTER]`, points non vérifiables en `[À VÉRIFIER]` : liste dans `docs/mise-en-ligne.md` § 7. e2e `legal.spec.ts`. Constat : rien ne purge les sessions expirées ni les vieux compteurs `rate_limits` (noté § 7).
- **Étape 3.** Migration `0011_catalog_merges.sql` (`merged_into_id` sur releases/tracks/artists, raisons `catalog_cover` / `catalog_duplicate`, colonnes `duplicate_*` des signalements ; CHECK comparé en `::text` car la valeur d'enum ajoutée ne peut pas servir dans la même transaction). API : `lib/catalog/merge.ts` (`mergeCatalog`, `previewMerge`, `mergedSlug`), `lib/catalog/reports.ts` (`report.catalog`), procédures `admin.merge`, `admin.mergePreview`, `catalog.mergedInto` ; l'import suit `merged_into_id` ; recherche et sorties récentes ignorent les fiches fusionnées. Web : `CatalogReportButton` sur album/artiste/morceau, `/admin/merge` (onglet « Fusion de doublons »), lien « Fusionner » sur un signalement doublon, redirection permanente `lib/catalog-redirect.ts` (308, équivalent 301 pour les moteurs). Tests : `merge.test.ts` (un par type, rollback par déclencheur, import, signalements), validators, 2 e2e. **Ne jamais tester une fusion sur Neon `dev` : elle ne se défait pas.** Règles : `docs/social.md` § « Fusion de doublons ». Vérifié dans Chrome (bureau et mobile) : aperçu de fusion et dialogue de signalement, sans envoi. **Vérifié sur un vrai Postgres** : job `api-postgres` vert sur la PR [#23](https://github.com/A2ZO/Spleen/pull/23) (brouillon, à réutiliser par `/fin-de-jalon`), et e2e de fusion réelle depuis la file sur la base `dev` (disques jetables `e2e-…` sans MBID créés par `throwawayReleases()`, supprimés au teardown : décisions et signalements des comptes e2e, signalements des disques jetables, fiche fusionnée, fiche gardée — `deleteE2eAccounts`). Les deux e2e « signalement » et « fusion » laissent leurs comptes au teardown (un signalement survit à son auteur).
- **Étape 2 bis.** Voir `docs/social.md` § « Modération » (Masquer, Compte suspendu) et
  `docs/decouverte.md`. Contenu masqué : `visibleTo()` + `lib/moderation/holds.ts`,
  composant `ModerationBanner`, clés i18n `moderationHold.*`. Notes des suspendus :
  `countsPublicly()` (`lib/ratings.ts`) dans `ratingSummaries`, `ratingDistribution`,
  tendances et mieux notés. Tests : `moderation.test.ts` (« hidden content… »),
  `discovery.test.ts` (« suspended members »). Pas de contenu masqué dans le seed (il
  changerait les compteurs des snapshots) : pour voir le bandeau, masquer une critique
  depuis `/fr/admin`.
- **Étapes 1–2.** Voir `docs/social.md` § « Modération (jalon 9) » (rôle, procédures,
  décisions, suspension, conservation, seed). Migration `0010_moderation.sql` (colonnes
  `hidden_at` / `hidden_by` sur critiques, listes, commentaires ; table
  `moderation_actions` ; notification `moderation`). Variable `CONTACT_EMAIL` (obligatoire en
  production, `[À COMPLÉTER : adresse de contact]` sinon), déclarée dans `.env.example`,
  `turbo.json`, `assertProductionConfig`, `docs/mise-en-ligne.md` § 10.

## Décisions de l'utilisateur (en entier)

### Plan validé (réponses au plan)

1. **Conservation** : 1 an après la décision, puis anonymisation (on garde l'action et le
   motif, on retire les liens vers les personnes). L'anonymisation tourne dans le workflow
   GitHub nocturne existant, avec un script lançable aussi en local et un test.
   → Fait : `anonymizeModerationHistory`, aujourd'hui dans `pnpm retention`, job `retention`
   du workflow « Nightly » (`catalog-refresh.yml`).
2. **Personne suspendue** :
   - ne jamais afficher le motif sur la page de connexion : n'importe qui peut y taper
     l'email d'un autre. Le motif s'affiche uniquement après la preuve d'identité (clic sur le
     lien magique ou connexion Google), sur une page « Compte suspendu ». Avant ça, message
     neutre ;
   - email via Brevo (repli dans le terminal en développement) avec le motif ;
   - dans le message et l'email : comment contester la décision (adresse de contact, à mettre
     en `[À COMPLÉTER]` et à ajouter dans `docs/mise-en-ligne.md`) ;
   - garder la notification, visible si la suspension est levée.
   Un test pour chacun de ces points. → Fait.
3. **Signalements de catalogue** : résolus ou rejetés avec une note, sans notification.
   → Fait.
4. **CSP** : dans Next.js, un nonce force le rendu dynamique de toutes les pages. **Mesurer
   l'impact sur la performance et le cache avant de coder la CSP**, et proposer une
   alternative si le coût est réel (par exemple une CSP sans nonce sur les pages publiques).
   **L'utilisateur choisit.** Constat déjà fait : aujourd'hui toutes les pages sont déjà
   dynamiques (cookie de thème), donc le nonce ne change rien *tant que l'issue #22 n'est pas
   traitée* ; la mesure et le choix doivent tenir compte de #22 (les deux choix se font
   ensemble, voir l'issue).

### Issue #22 (demandée après les étapes 1–2)

Créée telle quelle : thème appliqué côté navigateur (script inline dans `<head>`) pour
permettre le cache des pages publiques ; lien avec la CSP (nonce ou hash pour ce script) ;
piège du manifeste (ne pas réintroduire `generateStaticParams`, ne pas retirer le contrôle
des journaux ; sinon e2e sur `next build` + `next start`). Ne **pas** la traiter dans ce
jalon. Notée dans `docs/mise-en-ligne.md` § 11.

### Réponses du 26/10 (après les étapes 1–2) — à implémenter

1. **Contenu masqué** : l'auteur, et lui seul, voit son contenu masqué avec un bandeau
   « Masqué par la modération », le motif et le lien pour contester. Pour tous les autres,
   invisible. Ajouter un test.
   - Pistes : aujourd'hui les filtres `hidden_at is null` s'appliquent à tous (auteur
     compris) dans `loadReviewCards`, `resolveSubject`, `getListDetail`, `listComments` /
     `liveCommentsOf`, profils (`getProfileReviews`, `getProfileLists`), `myLists`. Il faut
     « `hidden_at is null` **ou** auteur = lecteur », et exposer `hidden: { reason }` au seul
     auteur (motif = dernière action `hide` sur ce contenu dans `moderation_actions` ; pour
     `hidden_by = 'suspension'` le compte est suspendu, l'écran de suspension suffit). Le
     contenu masqué ne doit pas redevenir likable/commentable (likes et commentaires restent
     refusés, y compris pour l'auteur). Lien pour contester : `ctx.contactEmail`
     (placeholder sinon).
2. **Notes d'un compte suspendu** : exclues des calculs publics (moyennes, répartition,
   tendances, mieux notés). N'invalider que le cache des disques que ce membre a notés, pas
   tout. Lever la suspension les fait revenir. Ajouter des tests.
   - **Constat** : il n'existe aucun cache par disque. Moyennes et répartitions sont calculées
     à la volée depuis `user_item_state` (`lib/catalog/cards.ts`, `lib/catalog/pages.ts`,
     `lib/ratings.ts`), tendances et mieux notés aussi (`lib/discovery.ts`, SQL brut). Le seul
     cache est `user_stats_cache` (stats **personnelles** d'un membre, pas concernées). Donc :
     ajouter un filtre « membre non suspendu » à ces agrégats (sous-requête sur
     `profiles.suspended_at`), rien à invalider. **Validé par l'utilisateur** : un simple
     filtre dans les requêtes publiques, rien à invalider. Tests : moyenne, répartition,
     tendance, mieux notés avant/pendant/après suspension.
3. **Bouton « Signaler une erreur / proposer un ajout »** sur les fiches album, artiste et
   morceau, avec des types : information erronée, pochette incorrecte, doublon (avec un lien
   vers l'autre fiche), ajout manquant, autre. Un signalement « doublon » doit pouvoir ouvrir
   l'outil de fusion de l'étape 3 avec les deux fiches présélectionnées. **À faire pendant
   l'étape 3.**
   - Pistes : l'enum `report_reason` n'a que `catalog_error` / `catalog_addition` ; il faut
     une colonne de type (ou de nouvelles valeurs) et une référence vers « l'autre fiche »
     pour le doublon (vraies clés étrangères vers `releases` / `tracks` / `artists`, même
     type que la fiche signalée). Nouvelle procédure `report.catalog` (limitée comme
     `report.create`), validators, i18n FR/EN, dialogue client calqué sur `ReportDialog`.
     Dans la file admin, une action « Fusionner » sur un doublon ouvre l'outil de fusion
     prérempli ; la fusion ferme le signalement avec une décision `resolve` dans
     l'historique.

## Étapes restantes (plan validé, détails)

- **3. Fusion** (album, artiste ou morceau) : page admin pour choisir la fiche gardée et le
  doublon ; transfert dans **une transaction** des écoutes, notes de pistes, critiques,
  éléments de listes, Étagères, `user_item_state` (recalculé avec `recomputeItemState()`),
  signalements, crédits, pistes et genres ; conflits (un membre a les deux fiches dans
  l'Étagère, une liste, des notes) → on n'en garde qu'une. Le doublon n'est **jamais**
  supprimé (règle `restrict`) : `merged_into_id`, l'ancienne URL redirige en 301 vers la
  fiche gardée, l'import MusicBrainz suit ce lien et ne recrée pas le doublon. Un test par
  type + un test de rollback (erreur provoquée au milieu). Décision enregistrée dans
  `moderation_actions` (sujet `catalog`).
- **4. Pages légales FR/EN** : mentions légales, conditions d'utilisation, politique de
  confidentialité, à partir de `docs/legal/politique-de-confidentialite.md`. `[À COMPLÉTER]`
  pour les informations personnelles. Inclure : réservation des pseudos (30 jours),
  conservation des signalements (1 an puis anonymisation), âge minimum 15 ans, aucun cookie
  de suivi (session + thème seulement), crédits MusicBrainz et Cover Art Archive, adresse de
  contact. Liens dans le pied de page. Note dans `docs/mise-en-ligne.md` : à faire relire
  avant d'encaisser de l'argent.
- **5. Référencement et partage** : `sitemap.xml` découpé (catalogue grand), `robots.txt`
  (bloque `/admin`, `/settings`, `/api`), canonical + hreflang FR/EN depuis
  `BETTER_AUTH_URL`, titres et descriptions par page, images Open Graph `next/og` (albums,
  profils, critiques, listes) dans l'ambiance cozy/jazzy (encre de nuit, Fraunces, laiton).
- **6. PWA** : `app/manifest.ts`, icônes 192/512/maskable depuis `icon.svg`, service worker
  écrit à la main qui ne met en cache que la page hors ligne et les fichiers statiques
  (jamais les pages des membres). Installable sur téléphone.
- **7. Finitions** : pages 404/500 (`not-found`, `error`, `global-error`) avec clin d'œil à
  Baudelaire (domaine public), FR/EN ; en-têtes de sécurité dans `proxy.ts` (CSP compatible
  Cover Art Archive : `img-src` avec `coverartarchive.org` **et** `*.archive.org`, car CAA
  redirige ; plus l'URL publique R2 ; HSTS, `frame-ancestors 'none'`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`) — **mesurer puis faire choisir** (décision 4) ;
  audit axe (`@axe-core/playwright`, version vérifiée sur npm) sur accueil, recherche, album,
  profil, liste, découverte, admin ; corriger `serious` et `critical`. **La CSP devra autoriser
  `worker-src 'self'` et `manifest-src 'self'`** (service worker et manifeste de l'étape 6),
  et `/sw.js`, `/offline.html` (styles en ligne : `style-src` ou un hash) ne doivent pas casser.
- **Fin** : seed (admin de démo et signalements déjà là), un test par règle, vérification
  visuelle dans Chrome bureau et mobile, mise à jour de `CLAUDE.md` (cocher le jalon 9,
  reporter ce document), `/fin-de-jalon`.

## Appris en route (absent de CLAUDE.md)

- **Outils de cette machine** :
  - les heredocs Bash et `node -e '…'` cassent dès qu'un texte contient une apostrophe
    (français) : écrire le script avec l'outil Write puis `node fichier.cjs`, ou utiliser
    Edit ;
  - le shell a gardé `apps/web/.next/dev/logs` comme dossier courant, ce qui a fait échouer
    `pnpm dev` (`EBUSY … rmdir`) : refaire un `cd` à la racine seul, puis relancer ;
  - arrêter un `next` resté vivant : `netstat -ano | grep ":3000 " | grep LISTENING` puis
    `taskkill //PID <pid> //T //F` (la commande PowerShell `Get-NetTCPConnection`, modifier
    `node_modules` et `rm -rf .next` ont été refusés par le classificateur) ;
  - dans un YAML écrit via le shell, `== 'true'` perdait ses guillemets : relire le fichier.
- **Diagnostic Next** : `__NEXT_SHOW_IGNORE_LISTED=true` affiche les piles complètes ;
  `--workers=1` en e2e place les lignes `[WebServer]` juste après le test fautif. Un
  contrôle côté navigateur des requêtes RSC annulées est inutilisable (le routeur en annule
  normalement) : seul le journal serveur est fiable.
- **Les e2e ne tournent pas en CI : à ajouter avant la mise en ligne (jalon 10), sur une base
  Postgres jetable, jamais Neon.** (Noté aussi dans `docs/mise-en-ligne.md` § 12.)
- **e2e** : aujourd'hui local seulement, sur la base seedée. Deux projets
  (bureau, mobile) qui se connectent au même compte de démo se volent le lien magique : créer
  un compte e2e par test et lui donner le rôle admin avec `grantAdmin()` (helpers.ts, même
  fonction que `pnpm admin:grant`, Postgres seulement).
- **Tests API** : `ctx.account()` est mémorisé par contexte ; pour compter des allers-retours,
  un contexte par requête (`api(user)` à chaque appel). Le seed change des compteurs (snapshot
  du fil mis à jour pour le commentaire de spam sur la critique 502).
- **Divers** : `hrefWith` ignore `null` (pas `undefined`) ; `drizzle-kit generate --name x`
  passe sans question pour des ajouts ; `account.suspension` est public (null pour un
  visiteur) car le layout l'appelle sur chaque page.

## Vérifier où on en est

```
git switch feat/09-admin-legal; git log --oneline main..HEAD
gh issue view 22
pnpm install
pnpm db:seed                                   # migration 0010 + seed de modération
pnpm lint; pnpm typecheck; pnpm format:check; pnpm test
$env:PLAYWRIGHT_CHANNEL="chrome"; pnpm e2e     # échoue si le journal serveur a une erreur connue
pnpm admin:grant lacontrebasse@example.test    # « nothing to do » : l'admin de démo existe
pnpm retention                                 # « 0 decision(s) anonymised, … »
pnpm dev                                       # /fr/admin avec lacontrebasse@example.test
```
