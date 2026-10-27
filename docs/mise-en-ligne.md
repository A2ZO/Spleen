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

## 0. Avant la mise en ligne : repartir propre

Jusqu'au jalon 8, le `.env` local pointait par erreur sur la branche Neon `production`
(endpoint `ep-winter-firefly…`) : elle contient des données de développement (seed de
démo, comptes e2e, catalogue importé, limiteur). Le `BETTER_AUTH_SECRET` de développement
et le mot de passe du rôle Neon ont aussi circulé (fichiers locaux, essais).

**Méthode retenue : un projet Neon séparé pour la production.** C'est la plus sûre :

- aucun lien avec les données de développement (une branche Neon créée depuis `dev`, ou
  « Reset from parent », recopierait le seed) ;
- des identifiants neufs, jamais présents dans un `.env` ;
- une erreur de manipulation sur le projet de développement (`db:reset`, seed, import,
  e2e) ne peut pas atteindre la production ;
- les quotas gratuits (calcul, stockage) sont comptés par projet : le développement ne
  consomme plus ceux du site.

L'autre méthode (vider la branche `production` : `drop schema public cascade`, schéma
`drizzle` compris, puis rejouer les migrations) garde les mêmes identifiants et le même
historique de restauration contenant les données de test : elle n'est à retenir que si
l'offre gratuite refuse un deuxième projet.

- [ ] Console Neon › New project : nom `spleen-prod`, région **AWS Europe Central 1
      (Frankfurt)**, même version majeure de Postgres que le projet actuel (celle de la CI,
      `postgres:18`). Vérifier sur la page de tarifs que l'offre gratuite accepte ce
      deuxième projet.
- [ ] Dans `spleen-prod` › Branches : renommer la branche par défaut en `production`.
- [ ] Copier ses URL (poolée et directe) **uniquement** dans l'hébergeur (§ 3) et dans le
      secret GitHub de l'environnement `production` (§ 9). Jamais dans `.env`.
- [ ] Dans le `.env` local, remplacer `NEON_MAIN_HOST` par l'hôte de la branche
      `production` de `spleen-prod` : le nettoyage e2e refusera la nouvelle base.
- [ ] Ancien projet : il ne sert plus qu'au développement. Sa branche `production`
      (`ep-winter-firefly…`, données de test) peut rester telle quelle (Neon interdit de
      supprimer la branche par défaut) ; ne plus jamais y brancher le site.
- [ ] Mettre à jour `docs/services.md` et `docs/environnement.md` (deux projets Neon).
- [ ] Premier déploiement : il lance `pnpm db:migrate` sur la base vide (§ 3). Puis, une
      fois, `pnpm db:seed:catalog` vers la production (catalogue réel MusicBrainz, pas des
      données de démo), lancé depuis un terminal où `DATABASE_URL` et
      `DATABASE_URL_UNPOOLED` sont posées pour cette seule session
      (`$env:DATABASE_URL="…"`, puis `Remove-Item Env:DATABASE_URL, Env:DATABASE_URL_UNPOOLED`).
      **Jamais** `db:seed` ni `db:reset`.
- [ ] **Vérifier** dans la console de `spleen-prod` › SQL Editor : `select count(*) from
      "user";` renvoie `0` avant la première inscription, et `select count(*) from
      profiles where username in ('nuitblanche', 'vinylvince', 'fouilleuse');` renvoie `0`.

**Secrets qui ont circulé**

- [ ] `BETTER_AUTH_SECRET` : générer une valeur neuve pour la production
      (`openssl rand -base64 32`, § 2), et une autre pour le `.env` local (toutes les
      sessions de développement seront fermées).
- [ ] Mot de passe Neon : réinitialiser le rôle de l'ancien projet (§ 8), puisque ses URL
      ont circulé ; le projet `spleen-prod` part avec des identifiants neufs.

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
- [ ] Console Neon › branche `production` › Connect : copier l'URL **avec pooling** (hôte en
      `-pooler`) dans `DATABASE_URL`, et l'URL **directe** dans `DATABASE_URL_UNPOOLED`, dans
      les réglages de l'hébergeur (environnement Production uniquement).
- [ ] Le déploiement lance `pnpm db:migrate`, **jamais** `pnpm db:seed` ni `pnpm db:reset`.
- [ ] Région de la branche : Europe (Francfort).
- [ ] **Vérifier** : `GET https://<domaine>/api/health` répond `200` avec `{"ok":true,…}`, et
      la branche `production` ne contient aucun membre de démo (`nuitblanche`, `vinylvince`,
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

Les pages existent depuis le jalon 9 : `/legal` (mentions légales et crédits, ancre
`#credits`), `/terms`, `/privacy`, en FR et en EN. Leur texte est dans `packages/i18n`
(clés `legal.*`, les deux fichiers) ; la date de mise à jour est `LEGAL_UPDATED` dans
`apps/web/src/components/legal/LegalPage.tsx`. L'adresse de contact vient de `CONTACT_EMAIL`
(§ 10).

- [ ] Remplacer chaque `[À COMPLÉTER]` (éditeur : nom, statut, adresse, SIRET, directeur de
      la publication ; raisons sociales et adresses de l'hébergeur, de Neon, Cloudflare et
      Brevo) et chaque `[À VÉRIFIER]` (droit applicable, localisation des serveurs Brevo,
      durée des sauvegardes Neon, effacement des sessions expirées et des compteurs
      anti-abus) dans `fr.json` **et** `en.json`. Vérifier : `grep -c "À COMPLÉTER\|À VÉRIFIER"
      packages/i18n/messages/*.json` répond 0.
- [ ] Effacement des sessions expirées et des vieux compteurs `rate_limits` : aujourd'hui
      rien ne les purge. Ajouter une purge à la tâche de nuit, ou écrire la durée réelle dans
      la politique.
- [ ] La politique de confidentialité mentionne l'hébergeur réellement choisi et, s'il traite
      des données hors de l'Union européenne, les garanties (clauses types, DPF).
- [ ] Relecture conseillée (modèles de la CNIL ou juriste) ; **obligatoire avant d'encaisser
      de l'argent** (pubs ou Spleen+).
- [ ] **Vérifier** : les pages s'ouvrent depuis le pied de page, et leurs adresses sont
      celles déclarées dans l'écran de consentement Google (§ 5).

## 8. Réinitialisation du mot de passe Neon

L'ancien mot de passe du rôle Neon a circulé en développement (fichiers locaux, essais).
On repart d'un mot de passe neuf. Avec le projet `spleen-prod` (§ 0), la production a déjà
des identifiants neufs : ce paragraphe vaut alors pour l'ancien projet (développement), et
pour `spleen-prod` si ses URL ont été exposées un jour.

- [ ] Console Neon › projet concerné › Branches › Roles › le rôle de l'application › Reset password.
- [ ] Mettre à jour `DATABASE_URL` et `DATABASE_URL_UNPOOLED` dans l'hébergeur avec les
      nouvelles URL (§ 3).
- [ ] Mettre à jour aussi le secret GitHub `DATABASE_URL_UNPOOLED` de l'environnement
      `production` (§ 9).
- [ ] Si le rôle est partagé avec la branche `dev` : mettre à jour aussi le `.env` local,
      soi-même (Claude ne lit ni n'écrit `.env`).
- [ ] **Vérifier** : `GET https://<domaine>/api/health` répond `200` après redéploiement, et
      l'ancienne URL est refusée (par exemple `psql "<ancienne URL>"` → échec
      d'authentification).

## 9. GitHub Actions : tâches nocturnes

Le workflow « Nightly » (`.github/workflows/catalog-refresh.yml`) tourne chaque nuit
(03 h 17 UTC), en deux tâches indépendantes :

- `refresh` relit sur MusicBrainz la discographie d'au plus 150 artistes (écoutés sur 30
  jours ou présents sur une Étagère), à 1 requête par seconde via le limiteur de la base ;
- `moderation-retention` anonymise les décisions de modération vieilles d'un an et supprime
  les signalements clos depuis un an (`pnpm moderation:anonymize`, voir `docs/social.md`).

Tant que le secret ci-dessous manque, les deux s'arrêtent aussitôt sans rien faire. Le
workflow ne tourne que depuis `main`.

- [ ] GitHub › dépôt › Settings › Environments › New environment : `production`.
- [ ] Dans cet environnement, Deployment branches and tags : « Selected branches and tags »,
      règle `main` (seule `main` lit le secret).
- [ ] Environment secrets › Add secret : `DATABASE_URL_UNPOOLED` = URL **directe** de la
      branche Neon `production` (sans `-pooler`, § 3), après la réinitialisation du § 8.
- [ ] Environment variables › Add variable : `MUSICBRAINZ_USER_AGENT` =
      `Spleen/1.0 ( contact@<domaine> )` (vraie adresse de contact).
- [ ] Ajouter `NEON_MAIN_HOST` (hôte de la branche `production`, pas un secret) dans le `.env`
      local : le nettoyage e2e refuse alors cette base, et accepte `dev`.
- [ ] **Vérifier** : onglet Actions › « Nightly » › Run workflow (sur `main`). Le journal de
      `refresh` affiche `catalog refresh: N artist(s) to re-read (postgres)` puis
      `done, … release(s) added` ; celui de `moderation-retention` affiche
      `moderation retention (postgres): 0 decision(s) anonymised, …`. Le lendemain, une
      exécution planifiée apparaît.

## 10. Modération : adresse de contact et premier admin

Une personne suspendue reçoit le motif par email, avec l'adresse où contester la décision.
Tant que `CONTACT_EMAIL` manque, emails et notifications affichent
`[À COMPLÉTER : adresse de contact]`, et la production refuse de démarrer.

- [ ] `CONTACT_EMAIL` = [À COMPLÉTER : adresse de contact, par exemple `bonjour@<domaine>`]
      dans l'hébergeur. Une boîte réellement lue : les contestations y arrivent.
- [ ] Premier compte admin : se connecter sur le site de production, choisir son pseudo,
      puis **en local**, avec `DATABASE_URL_UNPOOLED` de la production dans la session
      PowerShell (jamais dans un fichier) : `pnpm admin:grant <ton email>`. Le rôle ne se
      donne jamais depuis le site. Retirer la variable de la session ensuite.
- [ ] **Vérifier** : `/fr/admin` s'ouvre pour ce compte, et répond 404 dans une fenêtre de
      navigation privée.

## 11. Performance : cache des pages publiques (avant ou juste après l'ouverture)

Aujourd'hui, le layout lit le cookie de thème côté serveur : chaque page est calculée à chaque
requête et interroge la base (quota de calcul Neon, réveil de la base, usage chez
l'hébergeur). Pas bloquant pour ouvrir, mais à traiter avant ou juste après la mise en ligne.

- [ ] Traiter l'issue [#22](https://github.com/A2ZO/Spleen/issues/22) « Performance :
      appliquer le thème côté navigateur pour permettre le cache des pages publiques ». À
      décider en même temps que la CSP (nonce ou non, jalon 9 étape 7).
- [ ] **Vérifier** : une page publique vue par un visiteur est servie depuis le cache, sans
      flash de mauvais thème, et les e2e passent (contrôle des journaux serveur compris).

## 12. Tests e2e en CI (jalon 10)

Les e2e ne tournent pas en CI : à ajouter avant la mise en ligne (jalon 10), sur une base
Postgres jetable, jamais Neon.

- [ ] Job e2e dans `.github/workflows/ci.yml` : service `postgres` (même image que le job
      `api-postgres`), `pnpm db:seed` sur cette base, puis `pnpm e2e` (contrôle des journaux
      serveur compris). Aucun secret, aucune URL Neon dans la CI.
- [ ] **Vérifier** : le job passe sur une PR, et échoue si on réintroduit volontairement une
      erreur connue (par exemple un `router.refresh()` après une action).

## 13. Vérification finale

- [ ] Les journaux de démarrage de l'hébergeur ne contiennent pas « Missing environment
      variables for production ».
- [ ] `MUSICBRAINZ_USER_AGENT` contient une vraie adresse de contact (jalon 4).
- [ ] Parcours complet en production : inscription par lien magique → choix du pseudo →
      avatar → export → suppression d'un compte de test.
- [ ] Fermer l'issue GitHub « Brancher les services réels avant la mise en ligne ».

## 14. Monétisation (avant la première pub ou le premier abonnement)

Pas nécessaire pour un site gratuit et sans pub : à faire avant de gagner le premier euro.

- [ ] Licence des genres MusicBrainz (CC BY-NC-SA, non commerciale) : licence commerciale
      MetaBrainz ou autre source de genres, avant la première pub ou le premier abonnement —
      voir `docs/stack-et-limites.md` § 5.2.
