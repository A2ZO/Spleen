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
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL`    | 32+ caractères / URL publique       | Better Auth                       |
| `GOOGLE_CLIENT_ID` / `_SECRET`              | client OAuth Google (Web)           | bouton Google (caché si absent)   |
| `BREVO_API_KEY` / `EMAIL_FROM`              | clé Brevo v3 / expéditeur vérifié   | liens magiques (dev : terminal)   |
| `S3_*` (endpoint, bucket, clés, URL)        | Cloudflare R2, bucket UE            | avatars (dev : `.data/uploads`)   |
| `MUSICBRAINZ_USER_AGENT`                    | `Spleen/0.1 ( contact@… )`          | imports du catalogue (obligatoire)|

La production refuse de démarrer sans les variables d'auth, Brevo et S3
(`assertProductionConfig()`, `apps/web/src/instrumentation.ts`).

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
