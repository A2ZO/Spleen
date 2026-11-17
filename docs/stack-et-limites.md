# Stack technique, limites et montée en charge

État au **27 octobre 2026** (jalon 9 en cours), mis à jour le 16 novembre (dépôt public, jalons 12 et 17 faits) et le 17 novembre (jalon 11 fait : ListenBrainz et notifications dans la tâche de nuit). Ce document répond à trois questions :
quelles technologies Spleen utilise, à partir de combien de membres chaque service gratuit
lâche, et comment desserrer chaque limite sans réécrire le code.

En bref :

- Le premier mur n'est pas le nombre de membres, c'est **la base Neon gratuite** : elle
  coupe dès que le site reçoit des visites régulières une bonne partie de la journée, même
  avec quelques dizaines de membres. Prévoir l'offre Launch (à l'usage) dès l'ouverture
  publique.
- Le deuxième est **l'hébergement Vercel Hobby** : environ 1 000 à 1 500 membres actifs
  (estimation), et interdit dès qu'il y a des pubs ou Spleen+.
- **MusicBrainz** ne limite pas le nombre de membres mais la vitesse d'ajout de nouveaux
  disques : 1 requête par seconde pour tout le site.
- Le levier le plus rentable est l'issue [#22](https://github.com/A2ZO/Spleen/issues/22)
  (mettre en cache les pages publiques) : elle divise la charge de la base et de
  l'hébergeur.

Les prix et quotas détaillés de chaque service, avec leurs sources et les réglages
d'alertes, sont dans `docs/services.md` (vérifiés le 22 octobre). Ce document s'appuie
dessus et ne les répète pas tous. Toute ligne marquée **(estimation)** repose sur les
hypothèses du § 3 et doit être recalculée avec les vraies mesures après la mise en ligne.

## 1. La stack en un coup d'œil

Versions relevées dans les `package.json` du dépôt le 27 octobre 2026.

| Couche | Technologie | Rôle dans Spleen | Coût |
| --- | --- | --- | --- |
| Langage et outillage | TypeScript 6.0.3, Node ≥ 24, pnpm 12.14, Turborepo 2.11.9, ESLint 9.39.5, Prettier 3.9.10, tsx 4.23 | Monorepo, scripts, qualité | Gratuit |
| Site | Next.js 16.4.2 (App Router, Turbopack, `proxy.ts`), React 19.3.1 | Pages rendues côté serveur, Server Actions | Gratuit |
| Interface | Tailwind CSS 4.3.3, `packages/design-tokens` (palette, thèmes, contrastes WCAG) | Style uniquement par jetons | Gratuit |
| Langues | next-intl 4.14.9, `packages/i18n` (fr.json / en.json, clés identiques testées) | FR / EN, tutoiement | Gratuit |
| API | tRPC 11.19.0, Zod 4.6.7 (`packages/validators`) | Toute la logique métier, réutilisable par l'appli Expo | Gratuit |
| Base de données | PostgreSQL sur Neon (Francfort), extensions `pg_trgm` + `unaccent` | Données, recherche tolérante aux fautes, limiteurs | Free, puis Launch |
| Accès à la base | Drizzle ORM 0.45.4, drizzle-kit 0.31.11, postgres.js 3.4.9 | Schéma, migrations SQL, requêtes | Gratuit |
| Base locale et tests | PGlite 0.5.10 (Postgres en WebAssembly) ; Postgres 18 dans la CI | Développement hors ligne, tests sans Docker | Gratuit |
| Connexion | Better Auth 1.7.12 (+ adaptateur Drizzle, plugin Expo) | Lien magique, Google ; Apple plus tard sans migration | Gratuit |
| Emails | Brevo (API HTTP, sans SDK) | Liens de connexion, emails de suspension | Free 300/jour |
| Fichiers | Cloudflare R2 via `@aws-sdk/client-s3` 3.1152 | Avatars (bannières plus tard) | Free 10 Go |
| Catalogue | MusicBrainz WS/2 (simple `fetch`) derrière `CatalogProvider` | Artistes, disques, titres, genres, dates | Gratuit, 1 req/s |
| Sorties à venir (jalon 11) | ListenBrainz « fresh releases » (simple `fetch`, sans clé, `packages/catalog/src/listenbrainz.ts`) | Choisit chaque nuit les sorties annoncées à relire sur MusicBrainz, seule source des dates (`docs/sorties.md`) | Gratuit, une requête par nuit |
| Pochettes | Cover Art Archive (servies par archive.org) | Affichées sans optimisation, chargées par le navigateur | Gratuit |
| Limitation de débit | Table Postgres `rate_limits` (pas de Redis) | Limiteur MusicBrainz global, quotas par membre, connexion | Inclus dans la base |
| Tests | Vitest 5.0.5, Playwright 1.64.1 (axe prévu au jalon 9) | ~200 tests d'API, ~60 e2e | Gratuit |
| CI et tâches planifiées | GitHub Actions : `ci.yml` (check + api-postgres), « Nightly » à 03:17 UTC (`catalog-refresh.yml` : sorties à venir et discographies, puis notifications « Sortie aujourd'hui » ; rétention de modération ; ne fait rien tant que la base de production n'est pas configurée), Dependabot | Contrôles à chaque PR, tâches de nuit | Illimité (dépôt public depuis novembre) |
| Hébergement (jalon 10) | Vercel Hobby, puis Vercel Pro ou Cloudflare Workers (OpenNext) | Servir le site | Gratuit, puis 5 à 20 $/mois |
| Plus tard | Expo (appli), Stripe (Spleen+) | — | — |

Règles qui rendent tout remplaçable (rappel de `CLAUDE.md`) : aucun service propre à un
hébergeur, Postgres standard (postgres.js, pas le pilote Neon), stockage S3 standard,
emails derrière `packages/infra/src/email.ts`, catalogue derrière `CatalogProvider`.
Changer de fournisseur = changer des variables d'environnement, ou un seul fichier.

## 2. Comment Spleen consomme ses services

Pour comprendre les limites, il faut savoir ce que coûte une visite :

- **Chaque page est calculée à chaque visite**, pour les visiteurs comme pour les robots,
  à cause de la session lue dans le layout, l'en-tête du membre (`loadShell()`) et le nonce CSP
  (issue #22). Une page vue = une exécution
  côté serveur + quelques requêtes SQL. C'est ce qui consomme l'hébergement et réveille la
  base.
- **Chaque écriture d'un membre** (écoute, note, like, commentaire…) = une transaction
  Postgres + un compteur dans `rate_limits`.
- **MusicBrainz n'est jamais appelé à l'affichage.** Seulement quand un membre connecté
  importe un disque ou ouvre une fiche incomplète, et la nuit pour les sorties récentes et
  les sorties à venir des artistes suivis.
- **ListenBrainz n'est appelé que la nuit** : une requête « fresh releases » (90 jours), qui
  dit seulement quelles sorties relire sur MusicBrainz (jalon 11).
- **Les notifications « Sortie aujourd'hui »** sont créées la nuit, dans la base, sans email
  ni push : aucun quota Brevo consommé.
- **Les pochettes ne coûtent rien à Spleen** : le navigateur les télécharge directement
  depuis archive.org.
- **Un email part à chaque connexion par lien magique.** Les sessions Better Auth durent
  7 jours par défaut et se prolongent à l'usage : un membre régulier ne redemande presque
  jamais de lien.

## 3. Les limites, en nombre de membres

### Hypothèses (à remplacer par les vraies mesures)

- Un **membre actif** consulte environ 100 pages par mois (5 pages, 20 jours).
- Les **robots** (moteurs de recherche, aspirateurs) font autant de pages que les humains.
- Une page coûte **50 ms de CPU** côté serveur en moyenne.
- La base Neon reste éveillée tant qu'une requête arrive dans les 5 minutes.

Formule pour recalculer l'hébergement :
`membres max ≈ CPU inclus (en ms) ÷ (CPU par page × pages par membre × (1 + part des robots))`.

### Mesure : une image de partage (jalon 9)

Temps CPU de `next/og` pour une image 1200 × 630 avec Fraunces et Inter, mesuré le 27 octobre
2026 avec `process.cpuUsage()` sur 30 rendus, en Node.js de production, sur un Ryzen 7 7800X3D
(processeur de bureau rapide). Le téléchargement de la pochette (≈ 2 s chez Cover Art Archive)
n'est pas compté : une attente réseau ne consomme pas de CPU actif.

| Image | CPU médian | Premier rendu (à froid) |
| --- | --- | --- |
| Disque ou critique avec pochette | 47 ms | 173 ms |
| Sans pochette (repli dessiné) | 16 ms | 15 ms |
| Liste à 4 pochettes | 62 ms | 46 ms |

Sur un serveur mutualisé, compter **2 à 3 fois plus** (estimation) : de 100 à 150 ms par
image, soit 2 à 3 pages. Ce qui change aux seuils :

- Chaque version d'image n'est calculée qu'**une fois par cache** : l'URL change avec le
  contenu et la réponse est gardée un an (`docs/referencement.md`). Ce sont les robots
  d'aperçu (messageries, réseaux sociaux) qui la demandent, pas chaque visiteur.
- Même avec 1 000 partages par mois de contenus nouveaux, cela ferait au plus
  1 000 × 150 ms = 150 000 ms, **≈ 1 % des 4 h** de Vercel Hobby (14,4 millions de ms). Les
  seuils du tableau ci-dessous ne bougent donc pas.
- À surveiller : une image dont la pochette a dépassé son délai n'est gardée que 5 minutes,
  et sera recalculée. Un Cover Art Archive lent multiplie donc les rendus d'une même image.
- Pages et images restent à mesurer sur l'hébergeur réel après la mise en ligne (§ 6).

### Mesure : CSP à nonce et cache des pages publiques (jalon 9)

Build de production local, `next start`, 30 requêtes par page, visiteur sans session, même
Ryzen 7 7800X3D. Le nonce ne coûte pas de CPU mesurable (de 8 à 34 ms par page avec ou sans,
écart dans le bruit, ≈ 17 ms en moyenne, soit 35 à 50 ms estimés sur un serveur). Son coût
est ailleurs : une page à nonce est calculée à chaque visite et ne peut pas venir du cache.

- **Nonce partout** (choisi au jalon 9) : toutes les pages sont calculées, humains et robots.
  Avec 50 ms par page : **≈ 1 400 membres actifs** sur Vercel Hobby (le seuil du tableau).
- **Hybride** (avec l'issue #22) : pages publiques en cache pour les visiteurs et les robots,
  nonce pour les membres connectés. Seules leurs pages coûtent : **≈ 2 600 membres actifs**
  (estimation, 90 % de réussite du cache ; un fichier en cache coûte 0,6 ms au serveur, 0
  depuis le CDN).

### Mesure : vitesse de navigation (jalon 12, étape 0)

`apps/web/scripts/measure.mjs` (`docs/environnement.md`), membre démo `nuitblanche`, base
Neon de dev, médianes de 5 à 7 passages. SQL et vagues (allers-retours en série) en dev tracé ;
page affichée (titre de la nouvelle page présent) sur un build de production local.

| Parcours | Requêtes SQL | Vagues | Temps en base | Page affichée (prod) |
| --- | --- | --- | --- | --- |
| accueil → album | 29 → 27 | 12 → 6 | 330 → 225 ms | 351 → 267 ms |
| album → artiste | 12 → 9 | 8 → 4 | 207 → 107 ms | 227 → 133 ms |
| artiste → profil | 28 → 26 | 11 → 4 | 316 → 209 ms | 343 → 229 ms |
| profil → /discover | 20 → 20 | 5 → 6 | 178 → 172 ms | 248 → 211 ms |
| /discover → accueil | 28 → 26 | 6 → 4 | 248 → 181 ms | 263 → 219 ms |

- Les gains viennent surtout des requêtes lancées ensemble (vagues) et des lignes non chargées
  (trois blocs de l'accueil, discographie limitée à 12 par groupe). Par page de membre, la
  session coûte 3 requêtes (session, utilisateur, profil), partagées par l'en-tête et la page.
- Pas de squelette (`loading.tsx`) : essayé, il faisait attendre les pages rapides au moins
  300 ms (plancher de React après un `Suspense`) et bloquait l'affichage sans JavaScript
  (`docs/pieges.md`). Un clic lent affiche à la place une fine barre en haut après 150 ms.
- Préchargement : 17 à 21 requêtes au chargement d'une page, 31 à 46 après défilement
  (accueil, /discover, profils remplis), avant. Après : 4 ou 5 (les liens de l'en-tête) ; les
  autres liens préchargent au survol, au focus ou au toucher (`apps/web/src/i18n/link.tsx`).
  Chaque préchargement est une requête serveur, donc une invocation dans le quota Vercel.
- Pool postgres.js laissé à `max: 5`. La session de Better Auth était déjà lue une seule fois
  par requête : mesurer avant de « corriger ».
- Transitions de page (étape 6) : abandonnées, aucune régression mais elles ne démarraient
  presque jamais en production (issue #29, `docs/pieges.md`).

### Mesure : coût d'une frappe dans la recherche (jalon 12, étape 1)

`apps/web/scripts/measure-search.mjs` (`docs/environnement.md`), base démo sur Neon de dev.
Temps entre la dernière frappe et les résultats affichés (frappes espacées de 70 ms).

| | Avant : page `/search` rendue à chaque pause | Après : suggestions |
| --- | --- | --- |
| Affichage (build de prod local) | 269 à 314 ms (1 258 à froid) | ≈ 133 ms (≈ 190 à froid) |
| Requêtes serveur | 1 rendu complet (session + recherche + page) par pause | 1 ou 2 par recherche (`/api/search/suggest`), une seule si la frappe ne s'arrête pas |
| Temps en base par requête | — | ≈ 53 ms, une seule requête SQL (surtout l'aller-retour réseau) |
| CPU serveur par requête | — | ≈ 1 à 9 ms (moyenne ; Windows compte par tranches de 15,6 ms) |
| Réponse | page RSC | 450 à 900 octets de JSON |

- Une suggestion déjà vue par le CDN (60 s, puis 10 min servie périmée pendant le recalcul)
  ne coûte rien au serveur ni à la base. Le cache n'existe qu'avec une règle Cloudflare
  (`docs/mise-en-ligne.md` § 11) : sans elle, chaque frappe après 200 ms de pause est une
  invocation.
- Ordre de grandeur sans cache : 10 recherches par membre actif et par jour × 2 requêtes ×
  10 ms ≈ 0,2 s de CPU par membre et par mois, négligeable devant les pages (≈ 50 ms chacune).
- Limite par IP : 30 d'un coup, puis 3/s ; au-delà, 429 sans toucher la base.

### Mesure : sorties à venir (jalon 11)

`measure.mjs` sur un build de production local, deux passages, contre la référence de la fin
du jalon 17 (237 / 140 / 225 / 208 / 210 ms pour les cinq parcours ci-dessus).

- Fin du jalon : 215/213 · 136/135 · 231/219 · 182/180 · 228/225 ms, dans les 20 ms de la
  référence. Nouvelle page `/upcoming` (accueil → `/upcoming`) : 158/160 ms (149/151 à
  l'étape 3).
- Pool de 5 connexions : trois lectures parallèles de plus sur l'accueil le ralentissaient de
  25 à 32 ms ; les fondre en une seule requête a suffi. Une lecture lancée après celle de la
  fiche ajoute une vague (+36 à +60 ms) : la lancer dans le même `Promise.all`, par le slug.

### Tableau des seuils

| Service | Limite gratuite | Ce qui la consomme | Casse vers… (estimation) | Ce qui se passe | Sortie |
| --- | --- | --- | --- | --- | --- |
| **Neon Free** | 100 CU-heures par mois ; compute de 0,25 CU minimum | Les heures où la base est éveillée, pas le nombre de membres | Dès que le site a des visites régulières plus de ~13 h par jour : 0,25 CU × 13 h × 30 j ≈ 100 CU-h. Quelques dizaines de membres répartis sur la journée, ou des robots, suffisent | Base suspendue jusqu'au mois suivant : **le site tombe** | Neon Launch : ≈ 13 $/mois éveillée 16 h/jour, ≈ 19 $/mois 24 h/24 à 0,25 CU (0,106 $ par CU-heure) |
| **Vercel Hobby** | 4 h de CPU actif et 1 million d'exécutions par mois | Chaque page vue (humains + robots) | 4 h = 14,4 millions de ms ÷ 50 ms = 288 000 pages ; avec autant de robots, **~1 400 membres actifs** (CSP à nonce partout) ; **~2 600** avec l'hybride de l'issue #22 | Fonction suspendue jusqu'à 30 jours : le site tombe | Workers Paid 5 $/mois (30 millions de ms de CPU ≈ 600 000 pages), ou Vercel Pro 20 $/mois |
| **Vercel Hobby (règle)** | Usage non commercial uniquement | Pubs, Spleen+, liens affiliés, dons | **Le jour de la monétisation**, quel que soit le nombre de membres | Hors des conditions d'utilisation | Même sortie que ci-dessus |
| **Brevo Free** | 300 emails par jour | Connexions par lien magique, emails de suspension | Un jour à plus de ~300 inscriptions ou reconnexions (lancement, post viral). Au quotidien, plusieurs milliers de membres actifs tiennent grâce aux sessions longues | Plus de connexion par email ce jour-là ; Google marche toujours | Brevo Starter (dès 9 $/mois, 5 000 emails, tarif à revérifier) ou Amazon SES ; mettre Google en avant |
| **Cloudflare R2** | 10 Go, 1 million d'écritures, 10 millions de lectures par mois | Avatars (≈ 100 Ko, 512 px) | ~100 000 avatars stockés ; lectures absorbées par le cache Cloudflare devant `files.<domaine>` | Facturation à l'usage, quelques centimes | Rien à faire avant longtemps |
| **MusicBrainz** | 1 requête par seconde pour tout le site | Imports de disques jamais vus, fiches incomplètes, tâche de nuit | ~1 000 à 1 600 imports d'albums par heure au maximum (2 à 3 requêtes chacun). Saturation quand **~150 à 200 membres en ligne au même moment** ajoutent des disques absents | Une page attend 8 s son créneau puis affiche « catalogue occupé » ; le reste du site marche | § 5.1 |
| **ListenBrainz** | Limites annoncées dans les en-têtes `X-RateLimit-*` | Une requête par nuit (jalon 11) | Ne dépend pas des membres | Erreur, ou attente de plus de 60 s refusée : les sorties à venir ne sont pas relues cette nuit-là, la suite de la tâche continue | — |
| **Tâche de nuit** | 45 min de délai dans le workflow | Sorties à venir (une requête ListenBrainz, puis 40 relectures MusicBrainz au plus, jalon 11) et relecture des discographies (150 artistes ≈ 600 requêtes) : ≈ 640 requêtes ≈ 12 min (estimation). Les notifications qui suivent ne font aucune requête externe | ~2 400 requêtes par nuit au maximum à 1,1 s | Tâche coupée, reprise la nuit suivante | Plafonner et prioriser (déjà fait), § 5.1 |
| **GitHub Actions** | Illimité : le dépôt est public (2 000 min par mois s'il redevenait privé) | CI ≈ 2 min par push ; e2e en CI ajoutera ≈ 10 min | Ne dépend pas des membres | — | Rien à faire tant que le dépôt reste public |
| **Cover Art Archive** | Pas de limite annoncée | Les navigateurs des visiteurs | Ne dépend pas de Spleen | Panne d'archive.org : pochettes vides | Copier les pochettes dans R2 (§ 5.3) |
| **Google OAuth** | Pas de quota pour `openid` / `email` / `profile` | — | Jamais, une fois l'appli publiée « In production » | — | — |
| **Recherche locale** (`pg_trgm`) | Pas de limite, mais du temps de calcul | Taille du catalogue | Rapide jusqu'à quelques centaines de milliers de disques ; à surveiller si on importe les dumps complets (§ 5.1) | Recherche plus lente | Index dédiés, puis un moteur de recherche (Meilisearch, Typesense) |

## 4. Le plan de montée en charge, palier par palier

| Palier | Membres actifs (estimation) | Ce qui change | Coût mensuel (estimation) |
| --- | --- | --- | --- |
| **0. Bêta fermée** | ≤ 100 | Tout gratuit. Mesurer le CPU par page et les heures Neon. Alertes réglées (`docs/services.md`). | Domaine seulement |
| **1. Ouverture publique** | 100 à 1 000 | **Neon Launch** dès l'ouverture. Traiter **#22** (cache des pages publiques). `robots.txt` strict pour les aspirateurs. Encore Vercel Hobby si pas de revenus. | 13 à 25 $ |
| **1 bis. Monétisation** (pubs ou Spleen+) | n'importe quand | Changer d'hébergement (Workers Paid ou Vercel Pro). Micro-entreprise. Licence des genres MusicBrainz (§ 5.2) et palier de soutien MetaBrainz. Stripe. | + 5 à 20 $, + soutien MetaBrainz |
| **2. Croissance** | 1 000 à 10 000 | Pré-remplir le catalogue depuis les dumps MusicBrainz (§ 5.1). Copier les pochettes dans R2. Brevo Starter ou SES. Autoscaling Neon jusqu'à 2–4 CU. e2e en CI. Un outil de suivi d'erreurs. | 30 à 80 $ |
| **3. Grande échelle** | 10 000 à 100 000+ | Miroir MusicBrainz auto-hébergé ou accord commercial MetaBrainz. Réplique en lecture Neon. Moteur de recherche dédié. Limiteurs hors de Postgres si `rate_limits` devient un point chaud (rester sur du HTTP standard). Notifications push (appli). | Plusieurs centaines de $ |

Rien de tout ça ne demande de réécrire l'application : chaque étape est soit un changement
d'offre, soit un ajout derrière une interface qui existe déjà.

## 5. Desserrer chaque étau

### 5.1 MusicBrainz : 1 requête par seconde pour tout le site

Déjà en place (jalon 4) : recherche locale d'abord, import une fois pour toutes, fiches
incomplètes complétées à la visite, limiteur global dans Postgres, quotas par membre
(60 recherches et 30 imports par heure), imports réservés aux membres.

Les sorties, de la moins chère à la plus lourde :

1. **Le catalogue se remplit tout seul.** Chaque disque importé ne coûte plus jamais de
   requête. La pression baisse avec le temps : les disques populaires sont importés les
   premiers.
2. **ListenBrainz pour les données de masse.** ListenBrainz appartient à la même fondation
   (MetaBrainz) et expose des vues agrégées des données MusicBrainz. Par exemple,
   [`/1/explore/fresh-releases/`](https://listenbrainz.readthedocs.io/en/latest/users/api/misc.html)
   donne en **une seule requête** toutes les sorties des 90 jours passés ou à venir, avec
   les identifiants MusicBrainz des artistes et des disques. Il a ses propres limites de
   débit, annoncées dans les en-têtes `X-RateLimit-*`
   ([doc](https://listenbrainz.readthedocs.io/en/latest/users/api/)). En service depuis le
   jalon 11 (sorties à venir) : une requête par nuit, qui choisit quoi relire ; les dates
   viennent toujours de MusicBrainz (`docs/sorties.md`).
3. **Pré-remplissage massif depuis les dumps.** MusicBrainz publie des
   [dumps JSON](https://wiki.musicbrainz.org/Development/JSON_Data_Dumps) complets, une ligne
   par entité, au format de l'API. Importer tous les artistes et disques (sans les listes de
   titres) rendrait la recherche locale presque exhaustive. L'API ne servirait plus qu'à
   compléter une fiche à sa première visite.
   - Coût : du stockage Neon (plusieurs Go, donc l'offre Launch à 0,35 $ par Go-mois) et un
     script d'import à écrire.
   - Attention à la licence : le cœur des données est CC0, mais les genres et les tags ne le
     sont pas (§ 5.2).
4. **Un miroir MusicBrainz auto-hébergé**
   ([musicbrainz-docker](https://github.com/metabrainz/musicbrainz-docker)) : plus aucune
   limite de débit, puisque les requêtes ne partent plus chez MusicBrainz.
   - Sans moteur de recherche : 2 cœurs, 4 Go de RAM, 100 Go de disque.
   - Avec moteur de recherche : 16 threads, 16 Go de RAM, 350 Go de disque.
   - Mise à jour par réplication, avec un jeton MetaBrainz (gratuit en non commercial, via un
     compte de soutien en commercial, voir `docs/services.md`).
   - Coût : un serveur à louer et à administrer. Ça ne vaut le coup qu'au palier 3.
   - Il suffit d'une variable pour pointer `CatalogProvider` vers le miroir au lieu de
     `musicbrainz.org`.
5. **D'autres fournisseurs** derrière `CatalogProvider` (Discogs, Deezer, iTunes…) :
   possibles techniquement, mais leurs conditions d'usage commercial et leurs limites sont
   **à vérifier** avant d'y penser.

La documentation de MusicBrainz ne prévoit pas de débit plus élevé contre paiement : pour
aller au-delà, la voie prévue est le miroir. À confirmer avec MetaBrainz le moment venu.

### 5.2 Licence des genres : à régler avant de gagner de l'argent

Les données de base de MusicBrainz (artistes, disques, dates, titres) sont dans le domaine
public (CC0). **Les genres et les tags n'en font pas partie** : ce sont des données
« supplémentaires » sous licence Creative Commons non commerciale (CC BY-NC-SA 3.0)
([annonce des genres](https://blog.musicbrainz.org/2018/11/02/musicbrainz-introducing-genres/),
[licence des données](https://musicbrainz.org/doc/About/Data_License)).

Spleen importe et affiche les genres : fiches, filtres des « mieux notés », top genres des
stats. Tant que Spleen ne gagne rien, c'est permis, avec crédit. **Dès les pubs ou
Spleen+**, il faut l'une de ces solutions :

- une **licence commerciale** de la fondation MetaBrainz, qui passe par un compte de
  soutien (paliers dans `docs/services.md`, à confirmer avec eux) ;
- ou des **genres d'une autre source** sous licence libre (par exemple Wikidata, CC0, à
  étudier), ou des genres proposés par les membres.

### 5.3 Pochettes (Cover Art Archive)

- Aujourd'hui : zéro coût, zéro quota, mais dépendance à la disponibilité d'archive.org.
- Sortie : copier la pochette 500 px dans R2 au moment de l'import et la servir depuis
  `files.<domaine>`. Avec ~100 Ko par pochette, les 10 Go gratuits tiennent environ
  100 000 disques (estimation). Ça coûte une écriture R2 par import.
- Les pochettes restent la propriété de leurs ayants droit : les afficher pour identifier
  un disque, pas pour décorer (déjà dans le cahier des charges).

### 5.4 Emails

- Sessions longues (7 jours prolongés à l'usage) et bouton Google mis en avant : moins de
  liens magiques.
- La limite par IP sur les demandes de lien (5 par 10 minutes) freine déjà les robots.
- Au-delà de 300 par jour : Brevo Starter ou Amazon SES. Seul
  `packages/infra/src/email.ts` change.

### 5.5 Hébergement et base

- **Issue #22 d'abord** : une fois l'en-tête du membre et la session sortis du rendu
  serveur (et la CSP hybride en place), les pages publiques
  vues par les visiteurs et les robots peuvent être servies depuis un cache, sans toucher
  la base. C'est ce qui repousse le plus les paliers 1 et 2. À décider avec la CSP du
  jalon 9.
- Neon : régler la taille maximale d'autoscaling (le seul plafond de dépense qui existe chez
  Neon), garder la mise en veille activée.
- Hébergeur : plafond de dépense sur Vercel Pro (« Pause Production Deployments ») ou
  alertes Cloudflare (`docs/services.md`).

## 6. Ce qu'il faut mesurer dès la mise en ligne

| Mesure | Où la lire | Seuil d'alerte proposé |
| --- | --- | --- |
| Heures de calcul Neon consommées | Console Neon › Usage | 70 % du quota avant le 20 du mois → passer en Launch |
| CPU moyen par page et nombre d'exécutions | Vercel › Usage, ou analytics Workers | 70 % du quota → changer d'offre |
| Part des robots dans le trafic | Journaux de l'hébergeur | > 50 % → durcir `robots.txt`, limiter par IP |
| Emails envoyés par jour | Brevo › Transactional › Logs | > 200 par jour → préparer Starter |
| File d'import et erreurs « catalogue occupé » | `catalog_import_jobs`, journaux | Erreurs quotidiennes → § 5.1 |
| Durée de la tâche de nuit | GitHub › Actions › Nightly | > 30 min → réduire le lot ou étaler |

Une fois ces chiffres connus, remplacer les hypothèses du § 3 et recalculer les seuils.

## Sources

- Prix et quotas des services, avec leurs sources officielles : `docs/services.md`
  (vérifiés le 22 octobre 2026).
- Neon, taille de compute par offre :
  [Configure autoscaling](https://neon.com/docs/guides/autoscaling-guide).
- Better Auth, durée des sessions :
  [Session management](https://better-auth.com/docs/concepts/session-management).
- ListenBrainz : [fresh releases](https://listenbrainz.readthedocs.io/en/latest/users/api/misc.html),
  [limites de débit](https://listenbrainz.readthedocs.io/en/latest/users/api/).
- MusicBrainz : [dumps JSON](https://wiki.musicbrainz.org/Development/JSON_Data_Dumps),
  [miroir Docker](https://github.com/metabrainz/musicbrainz-docker),
  [licence des données](https://musicbrainz.org/doc/About/Data_License),
  [licence des genres](https://blog.musicbrainz.org/2018/11/02/musicbrainz-introducing-genres/).
- Versions des bibliothèques : `package.json` du dépôt au 27 octobre 2026.
- Jalon 11 (ListenBrainz, tâche de nuit, mesures) : `docs/sorties.md`, `docs/catalogue.md`,
  `docs/jalon-11-en-cours.md`, `.github/workflows/catalog-refresh.yml`.
