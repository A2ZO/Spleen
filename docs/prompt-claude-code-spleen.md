# Prompt Claude Code — Spleen (phase 0 + phase 1 : le site web)

> À coller dans Claude Code, à la racine d'un dépôt vide.
> Avant de lancer : exporte le cahier des charges en Markdown et place-le dans `docs/cahier-des-charges.md`.

---

## Qui tu es et ce qu'on construit

Tu es le développeur principal de **Spleen**, un « Letterboxd de la musique » : on note, critique et range en listes des **albums, EP, singles, morceaux et artistes**, on tient un **journal d'écoute daté**, on suit des gens et on consulte **ses stats et celles des autres**.

- Je travaille **seul**, avec un **budget quasi nul**. Chaque choix doit rester gratuit ou presque.
- On construit **uniquement le site web** pour l'instant (phase 0 + phase 1 du cahier des charges).
- Une **appli iPhone/Android en React Native (Expo)**, appelée aussi Spleen, viendra ensuite. **Tout ce que tu fais doit pouvoir être réutilisé tel quel par cette appli** (voir « Règles d'architecture »).
- Site **bilingue français / anglais dès le départ**.
- Ambiance **cozy et jazzy** (voir « Design »).

La référence fonctionnelle complète est `docs/cahier-des-charges.md`. En cas de doute, ce fichier fait foi ; si quelque chose y est ambigu ou contradictoire, **demande-moi** au lieu de deviner.

## Méthode de travail (obligatoire)

1. **Commence par lire** `docs/cahier-des-charges.md` en entier.
2. **Avant d'écrire du code**, propose-moi : l'arborescence du monorepo, la liste des dépendances principales (avec leurs versions stables actuelles, vérifiées dans leur documentation officielle — ne te fie pas à ta mémoire pour les versions et les API), le schéma de base de données, et le découpage en jalons ci-dessous. **Attends ma validation.**
3. Crée un fichier **`CLAUDE.md`** à la racine qui résume : la stack, les commandes utiles, les conventions, les règles d'architecture ci-dessous, et l'état d'avancement des jalons. Tiens-le à jour à chaque jalon.
4. Avance **jalon par jalon**, en suivant le flux Git ci-dessous. À la fin de chaque jalon : lint + typecheck + tests au vert, une pull request, et un court récapitulatif pour moi (ce qui est fait, ce qui reste, les décisions que tu as prises).
5. Si une décision est coûteuse à défaire (choix de librairie structurante, schéma de données, service payant), **demande avant**.
6. Code, noms de variables, commits et commentaires **en anglais**. Textes de l'interface **en FR et EN via les fichiers de traduction**, jamais en dur.

## Git et GitHub

- **Ne jamais committer ni pousser sur `main`.** Une branche par jalon, nommée `feat/<numéro>-<nom-court>` (ex. `feat/01-fondations`), créée depuis `main` à jour.
- Commits petits et fréquents (Conventional Commits, en anglais).
- En fin de jalon : `git push`, puis ouvre une pull request avec `gh pr create`. Description : ce qui a été fait, comment le tester, les décisions prises, ce qui reste.
- Vérifie que la CI passe sur la PR (`gh pr checks`) et corrige si besoin.
- **Attends que j'aie relu et fusionné la PR** avant de commencer le jalon suivant.
- Jamais de `git push --force`, jamais de réécriture d'historique sur une branche déjà poussée.
- **Ne lis et n'écris jamais** `.env` ni `.env.local` : liste les variables nécessaires dans `.env.example` et dis-moi lesquelles je dois remplir et où obtenir chaque valeur.
- Ne modifie pas le dossier `.claude/` sans me le demander.

## Stack imposée

- **Monorepo** : pnpm workspaces + Turborepo.
  - `apps/web` — le site Next.js.
  - `apps/mobile` — **ne pas créer maintenant**, mais tout doit être prêt pour l'ajouter.
  - `packages/api` — toute la logique métier, exposée via **tRPC** (routers typés).
  - `packages/db` — schéma **Drizzle ORM**, migrations versionnées, client Postgres, scripts de seed.
  - `packages/validators` — schémas **Zod** partagés (entrées d'API, formulaires).
  - `packages/i18n` — fichiers de traduction JSON `fr` / `en` partagés.
  - `packages/design-tokens` — couleurs, typo, espacements, rayons, ombres (consommés par Tailwind côté web, réutilisables par NativeWind côté mobile).
  - `packages/catalog` — le « fournisseur de catalogue » (MusicBrainz) derrière une interface.
  - `packages/config` — configs partagées ESLint / TypeScript / Prettier.
- **Web** : Next.js (App Router), TypeScript strict, Tailwind CSS, `next-intl` pour les langues.
- **Base** : PostgreSQL (hébergé sur Neon, région Europe), via Drizzle. SQL standard uniquement.
- **Connexion** : une bibliothèque d'authentification qui fonctionne **à la fois pour Next.js et pour Expo** (Better Auth est le candidat par défaut ; vérifie sa doc actuelle et son support Expo, sinon propose-moi une alternative). Méthodes au lancement : **email par lien magique** et **Google**. **Pas de « Se connecter avec Apple » pour l'instant** (il exige un compte Apple Developer payant) — mais le modèle doit pouvoir l'ajouter plus tard sans migration douloureuse.
- **Fichiers** (avatars, bannières) : stockage compatible S3 (Cloudflare R2), via le SDK S3 standard.
- **Emails** : un service transactionnel avec offre gratuite, derrière une petite interface (`sendEmail`), pour pouvoir changer de fournisseur.
- **Tests** : Vitest (unitaires, logique de `packages/api` et `packages/catalog`), Playwright (parcours clés).
- **CI** : GitHub Actions (install, lint, typecheck, tests).

## Règles d'architecture (non négociables)

1. **Aucune logique métier dans les composants React ni dans les pages.** Les pages appellent `packages/api`. Si tu utilises des Server Actions, elles ne font qu'appeler les procédures de `packages/api`.
2. **L'API doit être consommable par une appli mobile** : sessions utilisables par cookie (web) **et** par jeton (mobile). Documente dans `CLAUDE.md` comment l'appli Expo s'authentifiera.
3. **Portabilité d'hébergement** : on démarre sur Vercel Hobby (gratuit, mais interdit aux usages commerciaux), et on devra migrer vers Cloudflare Workers (via OpenNext) ou Vercel Pro dès qu'il y aura des pubs ou un abonnement. Donc : **aucun service propriétaire Vercel** (pas de Vercel KV, Blob, Edge Config, Postgres Vercel…), pas de dépendance au runtime Edge, pas de file d'attente ou cron propriétaire. Uniquement Postgres, S3, HTTP standard.
4. **URL stables et lisibles**, réutilisables par l'appli via des liens universels : `/album/[slug]`, `/artist/[slug]`, `/track/[slug]`, `/u/[username]`, `/u/[username]/diary`, `/list/[id]`… (préfixe de langue géré par next-intl).
5. **Identifiants UUID** partout en base ; slugs lisibles en plus pour les URL.
6. **Secrets** : jamais dans le code. Fournis un `.env.example` complet et commenté.

## Catalogue musical (MusicBrainz + Cover Art Archive)

On **n'utilise pas** les API Spotify, Deezer ni Apple Music (fermées ou payantes pour nous). Seuls des **liens « Écouter sur »** (Spotify, Deezer, Apple Music, YouTube) sous forme de liens de recherche, sans API.

- Source : **MusicBrainz** (gratuit, sans clé) et **Cover Art Archive** pour les pochettes. Vérifie leur documentation actuelle.
- Contraintes MusicBrainz : environ **1 requête par seconde maximum** par adresse IP, et un **User-Agent obligatoire** avec un contact (ex. `Spleen/0.1 ( contact@exemple.fr )`, configurable par variable d'environnement). Toutes nos requêtes partent du même serveur : **la limite est globale pour tout le site**.
- Correspondance : `release-group` MusicBrainz = album / EP / single (type conservé) ; `recording` = morceau ; `artist` = artiste. Pour la liste des titres d'un album, choisis une sortie de référence du release-group (règle à documenter).
- Stratégie :
  1. **Catalogue local d'abord** : recherche dans Postgres (plein texte + similarité trigramme `pg_trgm`, tolérante aux fautes et aux accents).
  2. **Import à la demande** quand la recherche locale ne trouve rien ou quand on ouvre une fiche pas encore complète : on interroge MusicBrainz, on enregistre l'entité (+ artistes, titres, genres, URL de pochette), **une fois pour toutes**, avec l'identifiant MusicBrainz comme clé d'unicité.
  3. **Limiteur de débit global stocké dans Postgres** (qui fonctionne sans serveur permanent, donc compatible serverless) pour ne jamais dépasser 1 requête/s, avec gestion des erreurs 503 (attente + nouvelle tentative).
  4. **Script de pré-remplissage** (`pnpm db:seed:catalog`) qui importe une liste d'artistes/albums populaires fournie dans un fichier, en respectant la limite.
- Tout passe par une interface `CatalogProvider` dans `packages/catalog` ; MusicBrainz n'en est qu'une implémentation. Tests avec des réponses enregistrées (pas d'appels réseau en CI).

## Modèle de données (point de départ, à affiner avec moi)

- **Catalogue** : `artists`, `releases` (type album / ep / single, date de sortie, URL de pochette, mbid, slug), `tracks`, `release_artists`, `release_tracks` (position, disque), `track_artists`, `genres`, `release_genres`.
- **Écoute** :
  - `entries` — le journal : membre, cible, date d'écoute, note, coup de cœur, réécoute, format (vinyle, CD, cassette, streaming, concert, autre), créé/modifié.
  - `moods` (étiquettes proposées + personnelles) et `entry_moods`.
  - `user_item_state` — dernier état par membre et par cible : note actuelle, coup de cœur, écouté, « à écouter ». Sert à afficher vite une fiche.
- **Contenu** : `reviews` (texte, langue, lien vers une entrée), `lists` + `list_items` (position, mélange de types), `favorites` (les 4 albums de l'Étagère, avec position).
- **Social** : `follows`, `likes`, `comments`, `notifications`, `blocks`, `reports`.
- **Compte** : tables de la bibliothèque d'auth, `profiles` (username unique, bio, avatar, langue, thème, réglages de confidentialité), `subscriptions` (plateforme `stripe | apple | google`, statut, fin de période — **vide pour l'instant mais présent**).
- **Technique** : `catalog_import_jobs`, `rate_limits`, `user_stats_cache`.

Règles :
- Une **cible** (album, morceau ou artiste) = trois colonnes de clé étrangère facultatives avec une contrainte CHECK « exactement une non nulle ». Pas de polymorphisme sans clé étrangère.
- **Notes** : entier `smallint` de 1 à 10 (demi-étoiles), affiché de 0,5 à 5 étoiles. Une note et une critique sont **indépendantes** : on peut noter sans critiquer et critiquer sans noter.
- Index : `(user_id, listened_on)` sur `entries`, index sur chaque colonne de cible, index trigramme sur les titres et noms.

## Fonctionnalités du MVP (phase 1)

Le détail est dans le cahier des charges (section « Fonctionnalités du MVP »). Résumé :

1. **Comptes** : inscription email (lien magique) + Google, choix du @pseudo à l'arrivée, avatar, bio, langue, thème sombre/clair, export des données (JSON) et suppression du compte.
2. **Catalogue** : recherche unifiée avec filtres ; fiches album, artiste, morceau (pochette, infos, note moyenne + répartition, critiques populaires et des amis, listes, liens « Écouter sur ») ; bouton « signaler une erreur / proposer un ajout ».
3. **Noter / critiquer / journal** : « J'ai écouté » en un clic, étoiles 0,5 à 5, coup de cœur, critique optionnelle, date d'écoute, réécoute, format, humeurs, **note piste par piste** avec suggestion de note d'album, liste « À écouter ».
4. **Profil** : l'**Étagère** (4 albums favoris présentés comme des vinyles), activité récente, journal (liste + calendrier), critiques, listes, stats de base, abonnés/abonnements ; options de confidentialité (stats et journal privés).
5. **Social** : suivre, fil (amis / populaire), likes et commentaires sur critiques et listes, notifications dans le site, bloquer, signaler.
6. **Listes** : classées ou non, description, éléments de types mélangés.
7. **Découverte** : tendances de la semaine **séparées FR / EN**, sorties récentes, mieux notés par genre / année / décennie (seuil minimal de notes configurable), critiques populaires.
8. **Option « écoute à l'aveugle »** : masquer la moyenne de la communauté tant que l'utilisateur n'a pas noté.
9. **Stats de base** (gratuites, visibles sur le profil) : nombre d'albums / EP / morceaux écoutés (année, total), répartition des notes, top 5 artistes et genres de l'année, décennies, activité par mois. Calcul par requêtes SQL d'agrégation, mises en cache par utilisateur et invalidées quand il ajoute/modifie une écoute.
10. **Administration** (rôle admin) : file de modération des signalements, suspension de compte, fusion de doublons du catalogue.
11. **Transverse** : responsive « mobile d'abord », **PWA installable**, accessibilité (clavier, lecteur d'écran, contraste AA, `prefers-reduced-motion`), pages publiques rendues côté serveur pour le référencement, images Open Graph soignées pour le partage, **limitation de débit** sur les routes sensibles (connexion, écriture, recherche).
12. **Pages légales** (FR/EN) : mentions légales, conditions d'utilisation, politique de confidentialité — avec des emplacements `[À COMPLÉTER]` pour mes informations. Âge minimum : 15 ans (case à cocher à l'inscription). Aucun cookie autre que ceux nécessaires.

**Hors périmètre maintenant** (ne pas coder, mais ne rien faire qui l'empêche) : abonnement Spleen+ et Stripe, publicités, stats avancées, thèmes de profil payants, cartes partageables, Club du dimanche, « Prête-moi un disque », affinité / Toi vs moi, imports CSV, appli mobile, connexion Apple, Apple Music.

## Design : cozy et jazzy

Image directrice : un club de jazz à une heure du matin, lumière tamisée, pluie sur la vitre, un disque qui tourne. **Mode sombre par défaut**, mode clair « papier crème ».

Jetons de départ (dans `packages/design-tokens`) :

| Jeton | Valeur | Usage |
| --- | --- | --- |
| `ink` (Encre de nuit) | `#15131C` | fond sombre |
| `smoke` (Fumée) | `#2A2633` | cartes, surfaces |
| `velvet` (Velours bordeaux) | `#6E2335` | accent principal, boutons |
| `brass` (Laiton) | `#C9A25C` | étoiles, détails |
| `midnight` (Bleu minuit) | `#1E2A44` | accent secondaire, liens |
| `cream` (Papier crème) | `#F3EAD8` | texte en sombre, fond en clair |

- Typo : titres en serif à caractère (**Fraunces** ou **DM Serif Display**), texte en **Inter**, chiffres des stats en **IBM Plex Mono**. Via `next/font`.
- Matières : léger grain de papier, pochettes avec ombre douce, coins peu arrondis.
- Micro-interactions : le vinyle sort un peu de sa pochette au survol ; petite animation de bras de platine sur « J'ai écouté » ; étoiles en laiton. Toujours désactivées si `prefers-reduced-motion`.
- **Vérifie les contrastes** (AA), notamment le laiton sur fond sombre ; ajuste les teintes si besoin et dis-le-moi.
- Ton : tutoiement en français, phrases courtes et douces (« Qu'as-tu écouté ce soir ? », « Ton étagère prend la poussière »). Page 404 avec un clin d'œil à Baudelaire (domaine public).
- Composants de base dans `apps/web` (Button, Input, Card, StarRating avec demi-étoiles accessible au clavier, Cover, VinylShelf, Avatar, Tabs, Dialog, Toast…), stylés uniquement avec les jetons.

## Jalons

Chaque jalon se termine par : lint + typecheck + tests verts, commit, mise à jour de `CLAUDE.md`, récap pour moi.

1. **Fondations** — monorepo, configs partagées, CI, jetons de design, Tailwind branché sur les jetons, next-intl FR/EN, layout de base (en-tête, pied de page, sélecteur de langue et de thème), page d'accueil vide mais stylée.
2. **Base de données** — schéma Drizzle complet, migrations, contraintes et index, données de démo (`pnpm db:seed`).
3. **Comptes** — auth email + Google, choix du @pseudo, profil éditable, upload d'avatar vers S3, export et suppression du compte.
4. **Catalogue** — `CatalogProvider` MusicBrainz, limiteur global en Postgres, import à la demande, recherche locale, fiches album / artiste / morceau, pochettes, script de pré-remplissage.
5. **Écoute** — « J'ai écouté », notes, coups de cœur, critiques, journal, humeurs, formats, réécoutes, note piste par piste, « À écouter », écoute à l'aveugle.
6. **Profil et stats de base** — Étagère, journal (liste + calendrier), critiques, stats, confidentialité.
7. **Social** — suivre, fil, likes, commentaires, notifications, blocage, signalement.
8. **Listes et découverte** — listes, tendances FR/EN, sorties récentes, classements par genre / année / décennie.
9. **Admin, légal, finitions** — modération, fusion de doublons, pages légales, PWA, Open Graph, limitation de débit, accessibilité.
10. **Mise en ligne** — tests Playwright des parcours clés (inscription → noter un album → le voir dans son journal et ses stats → suivre quelqu'un), déploiement sur Vercel Hobby + Neon, et une note `docs/deploiement.md` expliquant comment migrer vers Cloudflare Workers (OpenNext) le jour où le site devient commercial (vérifie la taille du worker générée).

## À ne pas faire

- Pas d'intégration Spotify, Deezer ni Apple Music (seulement des liens).
- Pas de service payant sans mon accord.
- Pas de services propriétaires d'un hébergeur.
- Pas de logique métier dans l'interface.
- Pas de texte d'interface en dur.
- Pas de version de librairie ou d'API supposée de mémoire : vérifie la documentation officielle.

**Première action** : lis le cahier des charges, puis présente-moi ton plan (arborescence, dépendances, schéma de données, ajustements aux jalons) et attends ma validation.
