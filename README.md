# Spleen

[![CI](https://github.com/A2ZO/Spleen/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/A2ZO/Spleen/actions/workflows/ci.yml?query=branch%3Adev)

Spleen, c'est le « Letterboxd de la musique » : tu notes, critiques et ranges les disques que tu
écoutes, et tu suis ce qu'écoutent tes amis.

**État** : en développement, pas encore en ligne. Le site vient d'abord (français et anglais),
l'appli iPhone / Android (Expo) ensuite, en réutilisant les mêmes paquets.

## Ce qu'on peut faire aujourd'hui

- Se connecter par lien magique (ou avec Google une fois configuré), choisir son @pseudo, régler son profil.
- Chercher un artiste, un disque ou un morceau (recherche instantanée, tolérante aux fautes) ;
  les fiches viennent de MusicBrainz.
- Noter (de ½ à 5 étoiles), écrire une critique, tenir son journal d'écoute et son Étagère.
- Voir son profil et ses stats.
- Suivre des membres, liker, commenter, signaler ; fil « Amis » et « Populaire », notifications.
- Créer des listes, explorer `/discover`.
- Suivre un artiste, voir ses sorties à venir et être prévenu le jour de la sortie.
- Savoir quoi écouter ce soir (`/pick`), ouvrir un disque sur sa plateforme, voir les amis qui l'ont écouté.
- Retrouver ses souvenirs du jour sur l'accueil, et les disques « Sortis un » jour comme aujourd'hui sur `/discover`.
- Côté équipe : administration et modération, pages légales.
- Installer le site comme une appli (PWA) ; « Annuler » pendant 8 s après une suppression.

## Stack

- Monorepo pnpm + Turborepo, TypeScript, Node ≥ 24.
- Site : Next.js 16 (App Router), React 19, Tailwind CSS 4, next-intl.
- API : tRPC 11 (toute la logique métier, réutilisable par l'appli), validation Zod.
- Base : PostgreSQL (Neon) avec Drizzle ORM ; PGlite en local et dans les tests.
- Connexion : Better Auth. Emails : Brevo. Fichiers : stockage S3 (Cloudflare R2).
- Tests : Vitest (API) et Playwright (e2e).

Versions, coûts, limites et montée en charge : [`docs/stack-et-limites.md`](docs/stack-et-limites.md).

## Structure du monorepo

| Dossier                  | Contenu                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `apps/web`               | Le site Next.js                                                     |
| `packages/api`           | Routers tRPC : toute la logique métier                              |
| `packages/catalog`       | Accès au catalogue (MusicBrainz) derrière `CatalogProvider`         |
| `packages/db`            | Schéma Drizzle, migrations SQL, données de démo                     |
| `packages/auth`          | Configuration Better Auth, emails de connexion                      |
| `packages/infra`         | Emails, stockage, limitation de débit, configuration                |
| `packages/validators`    | Schémas Zod partagés                                                |
| `packages/i18n`          | Textes de l'interface (`fr.json`, `en.json`)                        |
| `packages/design-tokens` | Palette, thèmes, contrastes WCAG → `generated/theme.css`            |
| `packages/config`        | Configurations partagées ESLint, TypeScript, Prettier               |
| `docs/`                  | Cahier des charges, docs de domaine, design, pilote                 |
| `scripts/`               | Scripts du dépôt (e2e résumé, libération du port 3000, status line) |

## Démarrer en local

Prérequis : Node 24 ou plus, pnpm 12.14.0 (`packageManager` du `package.json`).

```sh
pnpm install
cp .env.example .env    # PowerShell : Copy-Item .env.example .env
```

Remplis `.env` en suivant les commentaires de `.env.example` : seul `BETTER_AUTH_SECRET` est
indispensable tout de suite. Sans `DATABASE_URL`, une base PGlite locale est créée dans
`.data/pglite`, sans Docker ni réseau.

```sh
pnpm db:reset           # base locale PGlite : vide, migre, insère les données de démo
pnpm dev                # http://localhost:3000 (redirige vers /fr ou /en)
```

En développement, les liens magiques de connexion s'affichent dans le terminal de `pnpm dev`.

Commandes utiles :

| Commande               | Rôle                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| `pnpm check`           | Prettier, lint, typecheck et tests, n'affiche que les erreurs          |
| `pnpm lint`            | ESLint                                                                 |
| `pnpm typecheck`       | TypeScript                                                             |
| `pnpm test`            | Tests Vitest (sur PGlite)                                              |
| `pnpm format`          | Prettier en écriture                                                   |
| `pnpm e2e`             | Tests Playwright (`PLAYWRIGHT_CHANNEL=chrome` pour le Chrome installé) |
| `pnpm e2e:quiet`       | Les mêmes, avec une ligne de résumé                                    |
| `pnpm db:generate`     | Nouvelle migration SQL après un changement du schéma                   |
| `pnpm db:migrate`      | Applique les migrations                                                |
| `pnpm db:seed`         | Migre et insère les données de démo (jamais en production)             |
| `pnpm db:seed:catalog` | Importe le catalogue de départ depuis MusicBrainz                      |
| `pnpm catalog:refresh` | Relit les discographies des sorties récentes                           |

Variables d'environnement, CI et détails de la base : [`docs/environnement.md`](docs/environnement.md).

## Comment on travaille

- `dev` est la branche par défaut. Chaque travail part de `dev` sur une branche
  `feat/<nn>-<nom>`, `fix/…` ou `chore/…`, et revient par une PR vers `dev`.
- `main` ne reçoit que des PR de release `dev` → `main`, fusionnées par le propriétaire.
- Le projet avance par jalons, listés dans [`CLAUDE.md`](CLAUDE.md) et détaillés dans le cahier
  des charges.
- Un pilote automatique (Claude Code) peut faire avancer un jalon étape par étape, avec une
  relecture à chaque étape : feuille de route, décisions et journal dans [`docs/pilote/`](docs/pilote/).

## Documentation

- [Cahier des charges](docs/cahier-des-charges.md) : la référence fonctionnelle.
- [Stack et limites](docs/stack-et-limites.md) · [Services](docs/services.md) ·
  [Mise en ligne](docs/mise-en-ligne.md).
- [Design « Lilas »](docs/design/README.md) et ses maquettes.
- Domaines : [comptes](docs/accounts.md), [catalogue](docs/catalogue.md),
  [écoute](docs/ecoute.md), [profil et stats](docs/profil-stats.md), [social](docs/social.md),
  [listes et découverte](docs/decouverte.md), [référencement](docs/referencement.md),
  [sorties à venir](docs/sorties.md), [quoi écouter](docs/quoi-ecouter.md),
  [souvenirs](docs/souvenirs.md).
- [Pièges déjà rencontrés](docs/pieges.md).

## Données et crédits

- **[MusicBrainz](https://musicbrainz.org)** : artistes, disques, titres et dates, dans le
  domaine public (CC0). Les genres font partie des données « supplémentaires », sous licence
  non commerciale [CC BY-NC-SA 3.0](https://musicbrainz.org/doc/About/Data_License) : à régler
  avant toute monétisation (`docs/stack-et-limites.md` § 5.2).
- **[Cover Art Archive](https://coverartarchive.org)** (MusicBrainz et Internet Archive) : les
  pochettes, qui restent la propriété de leurs ayants droit et servent seulement à reconnaître
  les disques.
- **[ListenBrainz](https://listenbrainz.org)** : son fil des sorties récentes sert seulement à
  choisir quelles discographies relire ; les dates affichées viennent de MusicBrainz.

Spleen n'est affilié à aucun de ces projets.

## Licence

Pas encore choisie.
