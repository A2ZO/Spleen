# Services externes : limites, coûts, alternatives

Chiffres vérifiés le **22 octobre 2026** dans les documentations officielles (liens dans
chaque section). Les offres changent souvent : `/maintenance` signale ce qui doit être
revérifié. Une ligne marquée _(non vérifié)_ vient d'une source secondaire ou d'une
estimation.

Prix HT, en dollars quand le service facture en dollars.

## Vue d'ensemble

| Service                         | Aujourd'hui      | Premier palier payant                            | Alerte de budget                     |
| ------------------------------- | ---------------- | ------------------------------------------------ | ------------------------------------ |
| Hébergement (Vercel)            | Hobby, gratuit   | Pro 20 $/mois, ou Cloudflare Workers 5 $/mois    | Pro uniquement (Spend Management)    |
| Neon (Postgres)                 | Free             | Launch, à l'usage, sans minimum                  | Launch uniquement (80 % et 100 %)    |
| Cloudflare R2 (avatars)         | Gratuit          | À l'usage au-delà du gratuit                     | Budget alerts Cloudflare             |
| Brevo (emails)                  | Free, 300/jour   | Starter dès 9 $/mois (5 000 emails)              | Aucune : quota, pas de dépassement   |
| MusicBrainz                     | Gratuit          | Soutien commercial demandé dès qu'il y a revenus | —                                    |
| Cover Art Archive               | Gratuit          | —                                                | —                                    |
| Google OAuth                    | Gratuit          | —                                                | —                                    |
| GitHub Actions (dépôt privé)    | 2 000 min/mois   | 0,006 $/min (Linux 2 cœurs)                      | Billing › Budgets and alerts         |
| Stripe (plus tard, Spleen+)     | Pas encore actif | 1,5 % + 0,25 € par paiement (carte EEE)          | Pas de budget : frais proportionnels |

## Hébergement : Vercel, puis Cloudflare Workers ou Vercel Pro

Sources : [Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Vercel Pro](https://vercel.com/docs/plans/pro-plan),
[Spend Management](https://vercel.com/docs/spend-management),
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

**Vercel Hobby (gratuit)**

| Limite gratuite      | Valeur par mois |
| -------------------- | --------------- |
| Fast Data Transfer   | 100 Go          |
| Fast Origin Transfer | 10 Go           |
| Requêtes CDN         | 1 million       |
| Invocations          | 1 million       |
| Active CPU           | 4 heures        |
| Provisioned Memory   | 360 Go-heures   |

- **Usage commercial interdit.** Dès les pubs ou Spleen+, il faut passer en Pro ou changer
  d'hébergeur.
- **Ce qui ferait dépasser :**
  - les robots qui parcourent toutes les fiches album, artiste et morceau : chaque page est
    rendue côté serveur, donc chaque visite consomme une invocation et du CPU ;
  - un pic de trafic.

  Les pochettes ne comptent pas : elles sont affichées sans optimisation et servies par
  archive.org.
- **Au-delà :** pas de facture, mais la fonctionnalité dépassée est suspendue jusqu'à
  30 jours. Concrètement, le site peut tomber.
- **Alertes :** pas de Spend Management sur Hobby. Surveiller le tableau **Usage** du
  projet.

**Vercel Pro**

- 20 $/mois, avec 20 $ de crédit d'usage par mois et 1 siège.
- CDN forfaitaire inclus : 1 million de requêtes et 1 To de transfert par mois.
- Au-delà du crédit, facturation à l'usage.

**Cloudflare Workers Paid (Next.js via OpenNext)**

| Offre | Prix                 | Requêtes incluses     | CPU inclus                     |
| ----- | -------------------- | --------------------- | ------------------------------ |
| Free  | 0 $                  | 100 000 par jour      | 10 ms par requête              |
| Paid  | 5 $/mois au minimum  | 10 millions par mois  | 30 millions de ms CPU par mois |

- Au-delà, sur Paid : 0,30 $ par million de requêtes et 0,02 $ par million de ms CPU.
- 10 ms de CPU par requête, c'est trop court pour un rendu Next.js : il faut l'offre
  payante.
- Taille d'un Worker : **64 Mio non compressés sur les deux offres**. Il n'y a plus de
  limite sur la taille compressée. Ça corrige les 3 / 10 Mio du cahier des charges.

**Alternative si ça devient trop cher :** Cloudflare Workers Paid. Ou un VPS européen avec
`next start` derrière un CDN : le code est portable (Postgres, S3, HTTP standard).

**Où régler les alertes**

- **Vercel Pro :** Settings › Billing › Spend Management.
  - Fixer un « On-Demand Budget » : notifications à 50 %, 75 % et 100 %, plus SMS à 100 %.
  - Activer **Pause Production Deployments** pour un vrai plafond. Le site affiche alors
    une erreur 503 jusqu'à ce qu'on relance les projets à la main.
  - Par défaut, Vercel ne notifie qu'à partir de 200 $ : baisser ce seuil.
- **Cloudflare :** Manage Account › Billing › Billable Usage › _Create budget alert_.
  - L'alerte arrive par email le lendemain : l'usage est compté une fois par jour.
  - Elle ne coupe rien.

## Neon (Postgres)

Source : [Neon pricing](https://neon.com/pricing).

**Free, par projet**

| Ressource                 | Limite gratuite                       |
| ------------------------- | ------------------------------------- |
| Calcul                    | 100 CU-heures par mois                |
| Stockage                  | 1 Go par projet, 20 Go au total       |
| Egress                    | 5 Go par mois                         |
| Branches                  | 10 (Spleen en utilise 2 : `dev`, `production`) |
| Historique de restauration | 6 heures                             |

La base se met en veille après 5 minutes sans requête, et ce n'est pas désactivable.

**Ce qui ferait dépasser :**
- **Un trafic continu, robots compris.** Il empêche la mise en veille. À 0,25 CU (taille
  minimale, _à vérifier dans la console_), 24 h/24 pendant un mois font environ
  180 CU-heures, presque le double du quota. C'est le risque principal.
- **Le stockage**, plus tard : journal d'écoute, critiques et catalogue importé.
  Aujourd'hui, c'est loin d'1 Go.

**Au-delà sur Free :**
- calcul ou egress dépassé : la base est **suspendue** jusqu'au mois suivant, donc le site
  tombe ;
- stockage dépassé : les écritures sont bloquées.

Rien n'est supprimé, et passer en payant lève les limites tout de suite.

**Launch (à l'usage, sans minimum)**

| Ressource        | Prix                                    |
| ---------------- | --------------------------------------- |
| Calcul           | 0,106 $ par CU-heure                    |
| Stockage         | 0,35 $ par Go-mois                      |
| Egress           | 500 Go inclus, puis 0,10 $ par Go       |
| Branche en plus  | 1,50 $ par mois                         |

Une facture de moins de 0,50 $ n'est pas prélevée.

**Alternative :** n'importe quel Postgres 16+ avec `pg_trgm` et `unaccent`, puisque
postgres.js parle le protocole standard. Par exemple Supabase, ou un Postgres géré chez un
hébergeur européen _(prix non vérifiés)_. Il suffit de changer les deux URL de base.

**Alertes :**
- Free : aucune notification de dépense. Surveiller Console › Usage.
- Launch : Organization › Billing, notifications par email à 80 % et 100 %.
- Neon n'a pas de plafond en dollars. Le seul garde-fou est la taille maximale
  d'autoscaling de chaque compute.

## Cloudflare R2 (avatars)

Source : [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

| Ressource (stockage Standard) | Gratuit par mois | Au-delà              |
| ----------------------------- | ---------------- | -------------------- |
| Stockage                      | 10 Go-mois       | 0,015 $ par Go-mois  |
| Opérations classe A (écriture) | 1 million       | 4,50 $ par million   |
| Opérations classe B (lecture) | 10 millions      | 0,36 $ par million   |
| Egress                        | gratuit          | gratuit              |

**Ce qui ferait dépasser :** les lectures d'avatars sur des pages très vues. Le stockage
ne pèse presque rien : les avatars sont redimensionnés dans le navigateur et ne font que
quelques dizaines de Ko. Plus tard, les bannières et les cartes partageables.

**Alternative :** tout stockage compatible S3, par exemple Backblaze B2 ou Scaleway Object
Storage en UE _(prix non vérifiés)_. Il suffit de changer les variables `S3_*`.

**Alertes :** les budget alerts Cloudflare, comme pour Workers. Ou Notifications › Add ›
Billable Usage pour une alerte sur un produit (octets, requêtes).

## Brevo (emails de connexion)

Sources : pages produit Brevo,
[email transactionnel](https://www.brevo.com/products/transactional-email/) et
[SMTP gratuit](https://www.brevo.com/free-smtp-server/). La page
[tarifs](https://www.brevo.com/pricing/) n'a pas pu être lue automatiquement :
**à revérifier à la main**.

- **Free :** 300 emails par jour, sans limite de durée, API comprise.
- **Ce qui ferait dépasser :**
  - chaque connexion par lien magique envoie un email : un pic d'inscriptions, au
    lancement ou après un post viral, épuise vite 300 par jour ;
  - des robots qui demandent des liens. La limite par IP de Better Auth et `rate_limits`
    les freinent.
- **Au-delà :** les emails ne partent plus. Personne ne peut se connecter par email ;
  Google continue de marcher.
- **Starter :** dès 9 $/mois (7 € sur la page européenne) pour 5 000 emails par mois.
- **Alternative :** Amazon SES, Resend, Scaleway TEM _(prix non vérifiés)_. Seul
  `packages/infra/src/email.ts` change.
- **Alertes :** pas de budget à surveiller, c'est un quota. Regarder le compteur du jour
  dans le tableau de bord Brevo pendant les pics.

## MusicBrainz (catalogue)

Sources : [Rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting),
[Live Data Feed](https://musicbrainz.org/doc/Live_Data_Feed),
[types de compte MetaBrainz](https://metabrainz.org/supporters/account-type).

- **Gratuit**, sans clé. Environ **1 requête par seconde par IP**, avec un User-Agent qui
  donne un contact.
- **Ce qui ferait dépasser :** beaucoup d'imports en même temps. Le limiteur global de
  Spleen (`docs/catalogue.md`) tient la cadence ; les imports sont réservés aux membres
  et limités à 30 par heure et par membre.
- **Au-delà :** erreur 503 et refus de toutes les requêtes de l'IP tant que le débit ne
  baisse pas. Pas de facture.
- **Usage commercial :**
  - MetaBrainz demande aux entreprises qui ont, ou attendent, des revenus de choisir un
    palier de soutien. Les paliers commencent à 0 $ (« Stealth Start-Up », avant
    revenus), puis Bronze dès 100 $/mois.
  - **À décider au lancement de Spleen+ ou des pubs.**
- **Alternative :** un miroir MusicBrainz auto-hébergé, alimenté par le Live Data Feed.
  Le jeton est gratuit en non commercial ; en commercial, il passe par un compte de
  soutien. Ça demande un serveur avec beaucoup de disque _(taille non vérifiée)_.

## Cover Art Archive (pochettes)

Source : [Cover Art Archive API](https://musicbrainz.org/doc/Cover_Art_Archive/API).

- Gratuit, sans limite de débit annoncée pour le moment. La page mentionne pourtant un
  code 503 en cas de dépassement : à surveiller.
- Les images sont servies par archive.org, via une redirection 307. Tailles : 250, 500 et
  1200 px.
- Spleen ne paie rien : les pochettes sont affichées sans optimisation, le navigateur les
  charge directement.
- **Risque :** une panne d'archive.org laisse des pochettes vides. Alternative : copier les
  pochettes dans R2 à l'import, ce qui coûte du stockage et des opérations de classe A.

## Google OAuth (connexion Google)

Sources : [vérification des applis OAuth](https://support.google.com/cloud/answer/13463073),
[exigences](https://support.google.com/cloud/answer/13464321).

- Gratuit, sans quota facturé.
- Spleen ne demande que `openid`, `email` et `profile`, des scopes non sensibles : la
  vérification complète de l'application n'est pas obligatoire.
- Afficher le nom et le logo de Spleen sur l'écran de consentement demande une
  « brand verification » plus légère : page d'accueil, politique de confidentialité,
  domaine vérifié.
- Rien à surveiller côté budget. Garder le domaine et la politique de confidentialité à
  jour dans Google Cloud Console › APIs & Services › OAuth consent screen.

## GitHub Actions (CI)

Source : [facturation GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

| Ressource (dépôt privé, offre GitHub Free) | Inclus par mois            | Au-delà                  |
| ------------------------------------------ | -------------------------- | ------------------------ |
| Minutes de runner                          | 2 000                      | 0,006 $/min (Linux 2 cœurs) |
| Artefacts (partagés avec Packages)         | 500 Mo                     | 0,25 $ par Go-mois       |
| Cache                                      | 10 Go par dépôt            | 0,07 $ par Go-mois       |

Les runners standard sont gratuits sur un dépôt public.

**Ce qui ferait dépasser :** les PR Dependabot (une CI par PR et par push) et des tests e2e
ajoutés à la CI. Une CI dure environ 2 minutes aujourd'hui, donc on est très loin des
2 000 minutes.

**Au-delà :** sans moyen de paiement enregistré, les Actions sont bloquées jusqu'au mois
suivant. Pas de facture surprise.

**Alternative :** rendre le dépôt public, et les runners standard deviennent gratuits.

**Alertes :** Settings (du compte) › Billing and licensing › Budgets and alerts. GitHub
envoie un email à 90 % et 100 % de l'usage inclus.

## Stripe (plus tard : Spleen+)

Source : [tarifs Stripe France](https://stripe.com/fr/pricing).

| Type de carte                   | Frais par paiement                               |
| ------------------------------- | ------------------------------------------------ |
| Carte standard de l'EEE         | 1,5 % + 0,25 €                                   |
| Carte britannique               | 2,5 % + 0,25 €                                   |
| Carte internationale            | 3,15 % + 0,25 €, plus 2 % s'il y a une conversion |

- Stripe Billing (abonnements) ajoute 0,7 % du volume.
- Pas de frais mensuels ni de frais d'installation.
- Sur un paiement de 1 € par carte de l'EEE, il reste environ 0,73 € avant TVA. D'où la
  recommandation de l'offre annuelle à 10 € dans le cahier des charges.
- **Ce qui ferait grimper les frais :** des petits paiements (la part fixe de 0,25 € pèse
  lourd), les cartes hors EEE et les litiges.
- **Alternative :** une plateforme « merchant of record », comme Paddle ou Lemon Squeezy,
  qui gère la TVA européenne à la place de Spleen _(prix non vérifiés)_.
- **Alertes :** pas de budget, puisque les frais sont proportionnels aux ventes. Activer
  les notifications email des litiges (disputes) et des paiements échoués.
