# Catalogue musical (jalon 4)

Le catalogue vient de **MusicBrainz** (données CC0, gratuit, sans clé) et les pochettes de
**Cover Art Archive**. Tout passe par l'interface `CatalogProvider` (`packages/catalog`) :
MusicBrainz n'en est qu'une implémentation, une autre source pourra être branchée plus tard.

## Correspondance

| MusicBrainz     | Spleen                       | Clé d'unicité    |
| --------------- | ---------------------------- | ---------------- |
| `release-group` | `releases` (album/EP/single) | `releases.mbid`  |
| `recording`     | `tracks`                     | `tracks.mbid`    |
| `artist`        | `artists`                    | `artists.mbid`   |
| `release`       | sortie de référence (titres) | `reference_release_mbid` |

- Type principal Album / EP / Single → `album` / `ep` / `single` ; Broadcast, Other ou absent →
  `album`. Les types secondaires (live, compilation, soundtrack, remix…) sont gardés dans
  `releases.secondary_types`. Les mixtapes (`mixtape/street`) comptent comme sorties
  principales (`isMainRelease`), les autres sont rangées à part sur la page artiste et
  passent après les sorties principales dans la recherche.
- Page artiste : 4 groupes (albums, EP, singles, autres), les 12 plus récents de chacun
  (`DISCOGRAPHY_PREVIEW`) ; « Tout voir » est un lien simple vers `?all=<groupe>`, rendu côté
  serveur, donc sans JavaScript. Seules les fiches affichées chargent artistes et notes.
- Date : `first-release-date` du release-group, avec sa précision (année / mois / jour).
- Genres : les 5 genres les plus votés du release-group ; à défaut, ceux de l'artiste
  principal. Les genres sont partagés par slug.
- Langue : celle de la sortie de référence (`fra` → `fr`, `eng` → `en`, sinon code ISO 639-3).
- Slugs : choisis une fois pour toutes (URL stables) : titre, puis titre + artiste, puis
  titre + artiste + année, puis suffixe numérique. Morceaux : titre + artiste.

## Sortie de référence (liste des titres)

Un release-group a souvent des dizaines d'éditions. La liste des titres vient d'une seule,
choisie par `rankEditions` (`packages/catalog/src/rules.ts`) :

1. éditions officielles d'abord ;
2. l'année la plus ancienne (l'original, pas une réédition avec bonus) ;
3. dans cette année, le pays préféré : XW (monde), FR, GB, US, XE (Europe), puis les autres ;
4. la date la plus précise et la plus ancienne ;
5. l'identifiant, pour un choix stable.

Si MusicBrainz ne peut pas servir cette édition (erreur répétée), l'import essaie la suivante.

## Flux

1. **Recherche locale d'abord** (`catalog.search`, publique) : similarité trigramme
   (`pg_trgm`, `word_similarity` dans les deux sens) sur `lower(immutable_unaccent(...))`,
   donc insensible à la casse, aux accents et tolérante aux fautes ; « artiste + titre »
   fonctionne ; préfixe pour les requêtes très courtes.
2. **Recherche MusicBrainz** (`catalog.searchRemote`, membres connectés) quand le catalogue
   local ne suffit pas. Chaque mot doit apparaître dans le titre ou le nom d'artiste.
3. **Import à la demande** (`catalog.import`, membres connectés) : release-group (+ artistes,
   genres, liste des titres, pochette), artiste (+ discographie en « stubs »), ou morceau
   (importé via l'album où il est paru en premier). Une fois pour toutes, upsert par `mbid`.
   Chaque import est tracé dans `catalog_import_jobs` (statut, tentatives, dernière erreur).
4. **Stubs** : une sortie connue seulement par la discographie d'un artiste
   (`tracklist_imported_at` nul) est complétée quand un membre ouvre sa page. Un visiteur
   non connecté ne déclenche jamais d'appel à MusicBrainz : il voit une invitation à se
   connecter. Même chose pour la discographie d'un artiste (`discography_imported_at`).

## Recherche instantanée (jalon 12, étape 1)

Suggestions sous le champ de l'en-tête (plein écran sur mobile) et sous celui de `/search`
(`components/search/SearchCombobox.tsx`, motif combobox APG). La page `/search` n'est
recalculée qu'à la validation (Entrée, « Voir tous les résultats »), jamais à la frappe.

- **Route** `GET /api/search/suggest?q=…` (`apps/web/src/app/api/search/suggest/route.ts`) :
  appelle `catalog.suggest` sans aucune session (cookies jamais lus), donc la réponse est la
  même pour tous et ne contient **aucune donnée personnelle** (ni note, ni état d'écoute).
  `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=600`, jamais de
  `Set-Cookie` ; erreurs et 429 en `no-store`. Utilisable telle quelle par l'appli Expo.
- **Limiteur en mémoire** par IP (`@spleen/infra/memory-rate-limit`) : seau de 30, recharge
  3/s, 10 000 IP au plus (les plus anciennes oubliées). Approximatif (par instance), aucune
  écriture en base ; les réponses servies par le CDN ne l'atteignent pas.
- **Règles** (`packages/api/src/lib/catalog/suggest.ts`, une seule requête SQL) : dès 2
  caractères, après 200 ms sans frappe ; « Meilleur résultat » puis 3 artistes, 3 disques,
  3 morceaux ; ordre = préfixe du titre ou du nom, puis popularité (membres distincts ayant
  écouté), puis similarité trigramme. La page `/search` suit le même ordre. Fusionnés exclus.
- **Membres** seulement si la requête commence par `@` (préfixe sur le pseudo, puis nom
  affiché ; suspendus et masqués exclus), 5 au plus, sans catalogue.
- **Jamais MusicBrainz** pendant la frappe. Rien trouvé : « Rien dans Spleen pour l'instant »,
  puis « Chercher sur MusicBrainz » pour un membre connecté (`/search?q=…&remote=1`, qui lance
  `RemoteSearch` : même chemin et mêmes 60/h qu'avant) ou une invitation à se connecter.
- Partie trouvée en gras : `highlightParts` (`@spleen/api/highlight`, importable côté client),
  insensible aux accents et à la casse.
- Navigateur : requête précédente annulée (`AbortController`), cache mémoire de 50 réponses ;
  les 5 dernières recherches restent dans le `localStorage` de ce navigateur
  (`lib/recent-searches.ts`), jamais envoyées au serveur, supprimables (× ou Suppr).
- Clavier : « / » ouvre la recherche (hors champ de saisie), flèches, Entrée, Échap (un 2e
  vide le champ). Les options sont de vrais liens (préchargement à l'intention).
- Sans JavaScript : formulaire GET vers `/search`, et l'icône mobile est un lien.
- Coût d'une frappe : `docs/stack-et-limites.md` § 3.

Discographie : 2 pages de 100 albums/EP et 1 page de 100 singles au plus (4 requêtes), et
les pochettes des 100 premières sorties principales.

## Limiteur global (1 requête/s pour tout le site)

MusicBrainz limite à environ 1 requête par seconde **par adresse IP**, et toutes nos requêtes
partent du même serveur. Le créneau suivant est réservé dans Postgres
(`rate_limits.next_allowed_at`, clé `musicbrainz`) par une seule requête atomique
(`reserveSlot`, `packages/infra/src/rate-limit.ts`) : ça marche entre instances serverless
et à travers le pooler Neon (pas de verrou de session). Intervalle : 1,1 s.

- Une requête de page attend au plus 8 s son créneau, sinon erreur `CATALOG_BUSY` ; le
  script de pré-remplissage attend jusqu'à 2 min.
- 503 / 429 : tout le site recule (`deferSlots`, en respectant `Retry-After`), puis nouvel
  essai (3 au plus) ; échec → `CATALOG_UNAVAILABLE`. 404 / 400 → `CATALOG_NOT_FOUND`.
- En plus, par membre : 60 recherches MusicBrainz et 30 imports par heure.
- User-Agent obligatoire : `MUSICBRAINZ_USER_AGENT` (`Spleen/0.1 ( contact@… )`).
- Le créneau est stocké **dans la base** : deux bases différentes (PGlite local et Neon
  `dev`) utilisées en même temps depuis la même machine font deux limiteurs, donc jusqu'à
  2 requêtes/s. Ne lance pas `db:seed:catalog` sur l'une pendant que l'autre importe.

## Pochettes

URL `https://coverartarchive.org/release-group/{mbid}/front-500`, vérifiée à l'import (HEAD :
redirection = pochette, 404 = pas de pochette → pochette générée). Affichées sans optimisation
d'image (pas de service propre à un hébergeur, pas de quota) : le navigateur suit la
redirection vers archive.org. Usage : identifier le disque, avec crédit des sources en pied
de page.

## Pré-remplissage

```
pnpm db:seed:catalog
```

Importe les artistes et albums de `packages/api/scripts/catalog-seed.json` (artiste + titre,
résolus par la recherche MusicBrainz : titre et artiste identiques, sortie principale de préférence ; les scores MusicBrainz sont relatifs, pas de seuil). Idempotent ; les introuvables sont listés
à la fin. Passe par le même limiteur que le site. Jamais en CI.

## Tests

Les tests rejouent des réponses MusicBrainz enregistrées (`packages/catalog/test/fixtures`,
faux `fetch` de `@spleen/catalog/testing`). Pour les réenregistrer (réseau, à la main) :

```
pnpm --filter @spleen/catalog record
```
