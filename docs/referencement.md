# Référencement et partage (jalon 9)

Une seule règle décide de ce qui mérite d'être indexé : `packages/api/src/lib/seo.ts`. Le
sitemap et la balise `robots` de chaque page l'utilisent tous les deux, pour ne jamais se
contredire. L'API est appelée **sans session** (`getPublicApi()`, `apps/web/src/server/api.ts`)
pour tout ce qui est mis en cache et partagé : ce qu'un auteur voit de son contenu masqué ne
peut pas finir dans un cache public.

## Ce qui est indexé

| Page | Indexée si… | Sitemap |
| --- | --- | --- |
| Disque `/album/[slug]` | complet (pas une fiche incomplète), pas fusionné | `releases-N.xml` |
| Artiste `/artist/[slug]` | pas fusionné, au moins un disque complet | `artists-N.xml` |
| Liste `/list/[id]` | pas masquée, propriétaire non suspendu, au moins un élément | `lists-N.xml` |
| Profil `/u/[username]` | non suspendu, avec une activité publique (critique visible, liste non vide, écoute d'un journal public) ; sans `?tab=` | `profiles-N.xml` |
| Critique `/review/[id]` | 200 caractères de texte au moins (`REVIEW_INDEX_MIN_LENGTH`, espaces non comptés), pas masquée, auteur non suspendu ; plus courte : `noindex` (page pauvre), mais toujours partageable | `reviews-N.xml` |
| Journal `/u/[username]/diary` | journal public | non |
| Morceau, accueil (sans paramètre), découverte, pages légales | toujours | accueil, découverte et pages légales dans `static.xml` |
| Recherche, réglages, connexion, bienvenue, notifications, édition, abonnés, admin | jamais (`noindex`) | non |

Plus tard : `/upcoming` (jalon 11) en `noindex`, hors sitemap.

Chaque page indexable a un lien `canonical` et ses versions FR, EN et `x-default` (FR),
construits depuis `BETTER_AUTH_URL` (`siteUrl()`, `packages/infra/src/config.ts` ;
`apps/web/src/lib/seo.ts`).

## Sitemaps

Écrits à la main (route handlers, pas de `generateSitemaps`) : `/sitemap.xml` (index) →
`/sitemaps/static.xml` et `/sitemaps/<type>-<n>.xml`, 5 000 pages par fichier
(`SITEMAP_CHUNK`), chaque page en FR et EN avec ses `hreflang` et son `lastmod`. Mis en cache
une heure (`s-maxage=3600`).

## robots.txt

`apps/web/src/app/robots.ts` : tout le monde est admis, sauf `/api/`, l'admin, les réglages,
les notifications et la bienvenue. Les robots d'**entraînement d'IA** sont refusés partout :
ils consomment le quota de calcul sans amener de visiteurs. Jetons relevés le 27 octobre 2026
dans la documentation de chaque entreprise :

| Jeton | Entreprise | Rôle | Source |
| --- | --- | --- | --- |
| `GPTBot` | OpenAI | entraînement | developers.openai.com/api/docs/bots |
| `Google-Extended` | Google | entraînement Gemini, sans effet sur la recherche Google | developers.google.com/search/docs/crawling-indexing/google-common-crawlers |
| `ClaudeBot` | Anthropic | entraînement | support.claude.com, article 8896518 |
| `Applebot-Extended` | Apple | entraînement, sans effet sur la recherche | support.apple.com/119829 |
| `CCBot` | Common Crawl | jeu de données ouvert servant à l'entraînement | commoncrawl.org/ccbot |
| `meta-externalagent` | Meta | entraînement | developers.facebook.com/docs/sharing/webmasters/web-crawlers |

Restent admis : les robots de recherche (Googlebot, Bingbot, Applebot, `OAI-SearchBot`,
`Claude-SearchBot`…) et ceux des aperçus de liens (`facebookexternalhit`…). `Bytespider`
(ByteDance) n'est pas listé : aucune page officielle trouvée. À revoir une fois par an.

## Images Open Graph

`apps/web/src/app/og/[kind]/[key]/route.tsx` (`next/og`, runtime Node.js ; pris en charge
par OpenNext sur Cloudflare, qui le teste dans son e2e) : disques, critiques, listes,
profils.

- **Jamais** pour un contenu masqué, un compte suspendu ou un journal privé : `seo.og` répond
  null, la route 404, et la page n'annonce pas d'image.
- URL versionnée `?v=<date de mise à jour>` ; la bonne version est mise en cache un an
  (`immutable`), toute autre URL 5 minutes.
- Pochettes et avatars : 3 s au plus et 3 Mo au plus, JPEG ou PNG (Cover Art Archive redirige
  vers archive.org, parfois lent). Sinon, une pochette de repli dessinée, et un cache de
  5 minutes seulement, pour qu'une demande suivante montre la vraie pochette.
- Polices : Fraunces SemiBold (titres) et Inter Regular (reste), instances statiques TTF
  réduites au latin, 101 Ko en tout (`apps/web/assets/fonts/`, licences OFL). Les polices
  fournies remplacent celle par défaut de `next/og` : d'où Inter. Fichiers déclarés à
  `outputFileTracingIncludes` (`next.config.ts`) pour partir au déploiement.
- Coût : 16 à 62 ms de CPU par image sur un poste rapide (`docs/stack-et-limites.md` § 3).
