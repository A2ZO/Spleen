# Mise en ligne — services réels à brancher

Checklist à suivre **avant tout déploiement en production** (jalon 10). En développement,
Spleen tourne sans ces services grâce aux solutions de repli (liens magiques dans le
terminal, fichiers sur le disque, bouton Google masqué). En production, le serveur refuse
de démarrer s'il manque une variable obligatoire (`assertProductionConfig()`,
`apps/web/src/instrumentation.ts`).

Règles :

- Les valeurs secrètes vont **uniquement** dans les réglages de l'hébergeur, jamais dans un
  fichier du dépôt, jamais dans un chat ou une issue.
- Le détail de chaque variable est dans `.env.example`.
- Coche une case seulement après avoir fait la vérification indiquée.

## 1. Nom de domaine

À faire en premier : Google, Brevo et R2 dépendent du domaine.

- [ ] Acheter le domaine (par exemple chez Cloudflare Registrar, OVH ou Gandi) et noter
      le registrar dans les mentions légales.
- [ ] Brancher le domaine sur l'hébergeur (enregistrements DNS donnés par l'hébergeur).
- [ ] **Vérifier** : `https://<domaine>` ouvre le site avec un certificat HTTPS valide, et
      `https://www.<domaine>` redirige vers le domaine principal (ou l'inverse).

## 2. `BETTER_AUTH_URL` et `BETTER_AUTH_SECRET` de production

- [ ] `BETTER_AUTH_URL` = `https://<domaine>` (sans `/` final) dans l'hébergeur.
- [ ] `BETTER_AUTH_SECRET` : **nouvelle** valeur de 32 caractères ou plus
      (`openssl rand -base64 32`), différente de celle du développement.
- [ ] **Vérifier** : après connexion, le cookie de session porte le domaine de production et
      l'attribut `Secure` (outils du navigateur › Application › Cookies).

## 3. Neon : base de production

- [ ] Réinitialiser le mot de passe du rôle Neon (voir § 8) **avant** de copier les URL.
- [ ] Console Neon › branche `main` › Connect : copier l'URL **avec pooling** (hôte en
      `-pooler`) dans `DATABASE_URL`, et l'URL **directe** dans `DATABASE_URL_UNPOOLED`, dans
      les réglages de l'hébergeur (environnement Production uniquement).
- [ ] Le déploiement lance `pnpm db:migrate`, **jamais** `pnpm db:seed` ni `pnpm db:reset`.
- [ ] Région de la branche : Europe (Francfort).
- [ ] **Vérifier** : `GET https://<domaine>/api/health` répond `200` avec `{"ok":true,…}`, et
      la base `main` ne contient aucun membre de démo (`nuitblanche`, `vinylvince`,
      `rainydaysam`, `fouilleuse`).

## 4. Brevo : emails des liens magiques

- [ ] Créer le compte Brevo (offre gratuite : 300 emails par jour).
- [ ] Brevo › Senders, domains & dedicated IPs › Domains : ajouter `<domaine>` et publier
      les enregistrements DNS demandés (code Brevo, DKIM, DMARC). Attendre « Authenticated ».
- [ ] Créer l'expéditeur, par exemple `bonjour@<domaine>`.
- [ ] `EMAIL_FROM` = `"Spleen <bonjour@<domaine>>"` dans l'hébergeur.
- [ ] Brevo › SMTP & API › API keys › Generate a new API key : `BREVO_API_KEY` dans
      l'hébergeur.
- [ ] Vérifier la localisation des serveurs Brevo et la noter dans la politique de
      confidentialité (`[À VÉRIFIER]` dans `docs/legal/politique-de-confidentialite.md`).
- [ ] **Vérifier** : demander un lien sur `https://<domaine>/fr/sign-in` avec une vraie
      adresse Gmail et une adresse Outlook. L'email arrive en boîte de réception (pas en
      spam), le lien ouvre une session, et l'envoi apparaît dans Brevo › Transactional › Logs.

## 5. Google OAuth : bouton « Continuer avec Google »

- [ ] Google Cloud console : créer un projet « Spleen ».
- [ ] APIs & Services › OAuth consent screen : type External, nom « Spleen », logo, email
      de support, domaine `<domaine>`, liens vers la politique de confidentialité et les
      conditions d'utilisation (pages du § 7). Scopes : `openid`, `email`, `profile`.
      Publier l'application (statut « In production »).
- [ ] APIs & Services › Credentials › Create credentials › OAuth client ID › Web
      application :
  - Authorized JavaScript origins : `https://<domaine>`
  - Authorized redirect URI : `https://<domaine>/api/auth/callback/google`
- [ ] `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans l'hébergeur.
- [ ] **Vérifier** : le bouton Google apparaît sur `/fr/sign-in`. La connexion avec un
      compte Google mène à `/fr/welcome` (nouveau membre) ou à son étagère. Avec une
      adresse déjà inscrite par lien magique, on retrouve le même compte.

## 6. Cloudflare R2 : avatars

- [ ] Cloudflare › R2 › Create bucket, par exemple `spleen-files`, **juridiction European
      Union**.
- [ ] `S3_ENDPOINT` = `https://<account-id>.eu.r2.cloudflarestorage.com` (le `.eu.` confirme
      la juridiction), `S3_BUCKET` = nom du bucket, `S3_REGION` = `auto`.
- [ ] R2 › Manage API tokens › Create API token (Object Read & Write, ce bucket
      uniquement) : `S3_ACCESS_KEY_ID` et `S3_SECRET_ACCESS_KEY`.
- [ ] Bucket › Settings › Custom domains : brancher `files.<domaine>`. Garder l'accès public
      `r2.dev` désactivé.
- [ ] `S3_PUBLIC_URL` = `https://files.<domaine>` (sans `/` final).
- [ ] **Vérifier** : dans `/fr/settings`, changer d'avatar. L'image s'affiche, son adresse
      commence par `https://files.<domaine>/avatars/`, et elle s'ouvre dans une fenêtre de
      navigation privée. Retirer l'avatar : le fichier disparaît du bucket.

## 7. Pages légales finalisées (jalon 9)

- [ ] Mentions légales, conditions d'utilisation et politique de confidentialité publiées en
      FR et en EN, sans aucun `[À COMPLÉTER]` ni `[À VÉRIFIER]` restant (partir de
      `docs/legal/`).
- [ ] La politique de confidentialité mentionne Neon, Brevo, Cloudflare R2, l'hébergeur, la
      réservation anonyme des pseudos pendant 30 jours, l'export et la suppression du compte.
- [ ] Relecture conseillée (modèles de la CNIL ou juriste).
- [ ] **Vérifier** : les pages s'ouvrent depuis le pied de page, et leurs adresses sont
      celles déclarées dans l'écran de consentement Google (§ 5).

## 8. Réinitialisation du mot de passe Neon

L'ancien mot de passe du rôle Neon a circulé en développement (fichiers locaux, essais).
On repart d'un mot de passe neuf avant la production.

- [ ] Console Neon › Branches › `main` › Roles › le rôle de l'application › Reset password.
- [ ] Mettre à jour `DATABASE_URL` et `DATABASE_URL_UNPOOLED` dans l'hébergeur avec les
      nouvelles URL (§ 3).
- [ ] Mettre à jour aussi le secret GitHub `DATABASE_URL_UNPOOLED` de l'environnement
      `production` (§ 9).
- [ ] Si le rôle est partagé avec la branche `dev` : mettre à jour aussi le `.env` local,
      soi-même (Claude ne lit ni n'écrit `.env`).
- [ ] **Vérifier** : `GET https://<domaine>/api/health` répond `200` après redéploiement, et
      l'ancienne URL est refusée (par exemple `psql "<ancienne URL>"` → échec
      d'authentification).

## 9. GitHub Actions : sorties récentes (rafraîchissement nocturne)

Le workflow `.github/workflows/catalog-refresh.yml` relit chaque nuit (03 h 17 UTC) sur
MusicBrainz la discographie d'au plus 150 artistes (écoutés sur 30 jours ou présents sur une
Étagère), à 1 requête par seconde via le limiteur de la base. Tant que le secret ci-dessous
manque, il s'arrête aussitôt sans rien faire. Il ne tourne que depuis `main`.

- [ ] GitHub › dépôt › Settings › Environments › New environment : `production`.
- [ ] Dans cet environnement, Deployment branches and tags : « Selected branches and tags »,
      règle `main` (seule `main` lit le secret).
- [ ] Environment secrets › Add secret : `DATABASE_URL_UNPOOLED` = URL **directe** de la
      branche Neon `main` (sans `-pooler`, § 3), après la réinitialisation du § 8.
- [ ] Environment variables › Add variable : `MUSICBRAINZ_USER_AGENT` =
      `Spleen/1.0 ( contact@<domaine> )` (vraie adresse de contact).
- [ ] Ajouter `NEON_MAIN_HOST` (hôte de la branche `main`, pas un secret) dans le `.env`
      local : le nettoyage e2e refuse alors cette base, et accepte `dev`.
- [ ] **Vérifier** : onglet Actions › « Catalog refresh » › Run workflow (sur `main`). Le
      journal affiche `catalog refresh: N artist(s) to re-read (postgres)` puis
      `done, … release(s) added`. Le lendemain, une exécution planifiée apparaît.

## 10. Vérification finale

- [ ] Les journaux de démarrage de l'hébergeur ne contiennent pas « Missing environment
      variables for production ».
- [ ] `MUSICBRAINZ_USER_AGENT` contient une vraie adresse de contact (jalon 4).
- [ ] Parcours complet en production : inscription par lien magique → choix du pseudo →
      avatar → export → suppression d'un compte de test.
- [ ] Fermer l'issue GitHub « Brancher les services réels avant la mise en ligne ».
