# Environnement, base de données et CI

## Variables d'environnement

Un seul fichier de secrets pour tout le monorepo : `.env` à la racine (ignoré par git,
modèle `.env.example`, qui dit où obtenir chaque valeur). Ne jamais lire ni écrire `.env` /
`.env.local` : pour vérifier une variable, n'afficher que « définie / absente » (ou des
booléens comme « commence par postgres:// », « contient -pooler »).

- Next ne lit les fichiers d'environnement que dans `apps/web` : ses scripts passent par
  dotenv-cli (`--no-expand`). Les scripts db, drizzle-kit et les configs Vitest appellent
  `loadRootEnv()` (`@spleen/db/env`).
- Les variables déjà présentes dans l'environnement (CI, hébergeur) priment sur `.env`.
- Turborepo filtre les variables : déclarer toute nouvelle variable dans `turbo.json`
  (`globalEnv` si elle change les sorties, `globalPassThroughEnv` / `passThroughEnv` sinon),
  sinon elle disparaît sans bruit.

| Variable                                    | Valeur                              | Utilisée par                      |
| ------------------------------------------- | ----------------------------------- | --------------------------------- |
| `DATABASE_URL`                              | URL Neon **poolée** (`-pooler`)     | l'appli (`getDb()`)               |
| `DATABASE_URL_UNPOOLED`                     | URL Neon **directe**                | migrations, seed, drizzle-kit     |
| `DATABASE_URL` absente                      | → PGlite dans `.data/pglite`        | repli local hors ligne            |
| `NEON_MAIN_HOST`                            | hôte (ou `ep-…`) de la base du site en ligne | garde-fou du nettoyage e2e        |
| `SERVICE_WORKER_DISABLED`                   | `1` en cas d'urgence seulement               | retire le service worker (ci-dessous) |
| `SPLEEN_QUERY_TRACE`                        | `1` en dev seulement (jamais en ligne)       | traçage SQL de la mesure (ci-dessous) |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL`    | 32+ caractères / URL publique       | Better Auth                       |
| `GOOGLE_CLIENT_ID` / `_SECRET`              | client OAuth Google (Web)           | bouton Google (caché si absent)   |
| `BREVO_API_KEY` / `EMAIL_FROM`              | clé Brevo v3 / expéditeur vérifié   | liens magiques (dev : terminal)   |
| `S3_*` (endpoint, bucket, clés, URL)        | Cloudflare R2, bucket UE            | avatars (dev : `.data/uploads`)   |
| `MUSICBRAINZ_USER_AGENT`                    | `Spleen/0.1 ( contact@… )`          | imports du catalogue (obligatoire)|

La production refuse de démarrer sans les variables d'auth, Brevo et S3
(`assertProductionConfig()`, `apps/web/src/instrumentation.ts`).

## Mesurer la navigation (`apps/web/scripts/measure.mjs`)

Cinq parcours de membre connecté (accueil → album → artiste → profil → /discover → accueil),
cliqués dans Chrome : temps jusqu'au changement d'URL (`clicMs`), jusqu'à la page affichée,
titre de la page affiché (`pageMs`), préchargements déclenchés à l'arrivée (`prefetch`), puis chaque
requête RSC rejouée seule (`serveurMs`). Les colonnes SQL (`sql`, `vagues` = allers-retours en
série, `baseMs`) demandent le traçage :

```
$env:SPLEEN_QUERY_TRACE="1"; pnpm dev        # terminal 1 (base démo : nuitblanche)
cd apps/web; $env:PLAYWRIGHT_CHANNEL="chrome"; node scripts/measure.mjs   # terminal 2
```

Le traçage (`packages/db/src/trace.ts`) ne note que le début de chaque requête SQL et sa durée,
jamais ses paramètres ; il est coupé dès que `NODE_ENV=production`, et
`/api/trace-debug` répond alors 404. Pour un build de production local (temps réels, sans
SQL) : se connecter une fois contre `pnpm dev` avec `$env:MEASURE_STATE="<fichier>"` (la
session y est enregistrée), arrêter le dev, `pnpm build`, `pnpm start` (la production exige
les variables Brevo et S3 : des valeurs factices suffisent en local, aucun email ne part), puis
relancer le script avec le même `MEASURE_STATE`. Jamais de `next build` pendant `pnpm dev`.

### Mesurer la recherche instantanée (`apps/web/scripts/measure-search.mjs`)

Tape quelques requêtes dans le champ de `/search` (Chrome, visiteur) et mesure dernière frappe
→ résultats affichés, puis appelle `/api/search/suggest` seul (espacé de 400 ms pour rester
sous le limiteur) et lit l'en-tête `Server-Timing` (base, CPU, total), présent seulement
avec le traçage :

```
$env:SPLEEN_QUERY_TRACE="1"; pnpm dev        # terminal 1
cd apps/web; $env:PLAYWRIGHT_CHANNEL="chrome"; node scripts/measure-search.mjs [url] [passages]
```

Sur un build de production local, seules les durées d'affichage sont mesurées.

## Service worker (PWA)

`/sw.js` est un route handler (`apps/web/src/app/sw.js/route.ts`), servi avec
`Cache-Control: no-cache` : le navigateur revérifie le script à chaque visite. Il ne met en
cache que la page hors ligne (`/offline.html?lang=fr|en`), les fichiers statiques versionnés
(`/_next/static`, en production seulement) et les icônes ; jamais une page, jamais `/api`
(donc jamais `/api/auth`, le lien magique va toujours au serveur). Le nom du cache porte le
numéro de build, lu à l'exécution par la route (le commit sur Vercel, sinon le `BUILD_ID` de
`next build`, sinon l'heure de démarrage du serveur ; `dev` en développement) ; les anciens caches sont supprimés à l'activation. Une
nouvelle version attend que tous les onglets Spleen soient fermés et prend la main au lancement
suivant : pas de `skipWaiting`, pas de rechargement forcé.

**Désactiver en urgence** (un service worker raté qui casse le site chez les gens) :

1. Dans les réglages de l'hébergeur, poser `SERVICE_WORKER_DISABLED=1` (environnement
   Production) et redéployer.
2. `/sw.js` sert alors un script qui vide tous les caches et se désinscrit, et le site cesse
   d'enregistrer le service worker (composant `ServiceWorker`, qui désinscrit au contraire).
   Comme `/sw.js` n'est jamais mis en cache, chaque navigateur le récupère à sa prochaine
   visite.
3. **Vérifier** : `curl -s https://<domaine>/sw.js` contient `unregister` ; dans Chrome,
   DevTools › Application › Service workers ne liste plus rien après une visite.
4. Corriger, retirer la variable, redéployer : le service worker revient.

En local : DevTools › Application › Service workers › Unregister, ou « Clear site data ».

## Base de données

- Neon Postgres, UE (Francfort), offre gratuite. Branches : `dev` = développement local
  (URL dans `.env`) ; `production` = site en ligne (URL chez l'hébergeur et dans le secret GitHub de
  l'environnement `production`, jamais dans un fichier). Les déploiements lancent
  `pnpm db:migrate`, jamais `db:seed`.
- `createDb(url)` (`packages/db/src/client.ts`) : `postgres://…` → postgres.js ;
  `memory://` → PGlite en mémoire ; vide → PGlite sur disque. Migrations et seed prennent
  leur URL dans `migrationDatabaseUrl()`, qui refuse de passer par le pooler.
- Basculer PGlite ↔ Neon : commenter / rétablir `DATABASE_URL` dans `.env`, ou pour une
  commande `$env:DATABASE_URL=""; pnpm dev` (puis `Remove-Item Env:DATABASE_URL`).
- L'appli garde un pool par processus (`apps/web/src/server/db.ts`). Le contexte de l'API
  ouvre la base à la demande (`ctx.db()`). `GET /api/health` (`system.health`) la vérifie.
- Migrations : `0000_search_extensions.sql` est écrite à la main (pg_trgm, unaccent et
  l'enveloppe `immutable_unaccent()` des index de recherche) ; le reste est généré par
  drizzle-kit.

## CI

`.github/workflows/ci.yml` : job `check` = install --frozen-lockfile, format:check, lint,
typecheck, test (PGlite). Job `api-postgres` = les tests de l'API à nouveau sur un conteneur
`postgres:18` (version majeure de Neon, `C.UTF-8`) via postgres.js comme l'appli :
`TEST_DATABASE_URL` fait créer par `createTestDb()` (`@spleen/db/testing`) une base jetable
par fichier de test. Monter l'image quand Neon change de version majeure. Aucun secret en CI.

`.github/workflows/catalog-refresh.yml` (planifié, la nuit) : rafraîchit les discographies
pour les sorties récentes, sur la base de production ; voir `docs/decouverte.md`.

## e2e

En local, Playwright tourne sur 2 workers (à 4, le serveur de dev décroche et des tests
différents dépassent leur délai à chaque passage) ; `$env:PLAYWRIGHT_WORKERS="4"` change ce
nombre. La CI garde le défaut de Playwright. `pnpm e2e:quiet [args Playwright]`
(`scripts/e2e-quiet.mjs`) n'affiche que les erreurs, puis une ligne de résumé (réussis,
échoués, instables, ignorés, durée) écrite par `apps/web/e2e/summary-reporter.ts`.

Ne pas lancer les e2e pendant que le serveur de développement recompile (juste après une
modification de `next.config.ts`, d'un paquet partagé ou un redémarrage) : attendre qu'une page
s'ouvre normalement. Des tests de recherche ont échoué ainsi au jalon 9. Signe d'un problème
plus grave : une page qui se recharge en boucle (« [Fast Refresh] rebuilding » sans fin dans la
console) ; au jalon 9, une valeur de `env` dans `next.config.ts` qui changeait d'une évaluation à
l'autre en était la cause (jamais de `Date.now()` dans `env`). Le serveur de dev garde aussi
l'instance Better Auth en mémoire : après une modification de `packages/auth`, le redémarrer.

Comptes `e2e-<id>@example.test`. `apps/web/e2e/cleanup.ts` (setup et teardown globaux) les
supprime avec leurs données, même après un passage raté ou interrompu (Postgres seulement),
et leurs pseudos ne sont pas réservés (développement et tests seulement). Il refuse de
s'exécuter en production (`NODE_ENV`), sur la base désignée par `NEON_MAIN_HOST` (hôte poolé ou
direct : la branche `production` du projet Neon séparé `spleen-prod`, ou en attendant celle du
projet de développement, voir `docs/mise-en-ligne.md` § 0), et sur tout hôte Neon tant que
`NEON_MAIN_HOST` manque.

Journal du serveur : `apps/web/e2e/server-log.ts` fait échouer le passage si le serveur de
développement a journalisé, pendant les tests, une erreur invisible depuis le navigateur
(« The destination stream errored », « Unexpected end of JSON input »). Il n'affiche que des
comptes. Pour trouver le test fautif : `--workers=1`, les lignes `[WebServer]` suivent alors
le test qui les provoque.
