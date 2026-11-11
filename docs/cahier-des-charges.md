# Spleen — Cahier des charges

Version 2 du 27 octobre 2026 (v1 : 19 octobre 2026) · @Azzo

La v2 ajoute ce que le développement a changé pendant les jalons 1 à 9 (section « Ce qui a changé depuis la v1 »), la fonction « Sorties à venir de tes artistes » (jalon 11) et la question de la licence des genres. La stack réelle, ses limites en nombre de membres et les chemins de montée en charge sont dans `docs/stack-et-limites.md`.

## Résumé et vision

Spleen est un carnet d'écoute social : on note, critique et range en listes des albums, EP, morceaux et artistes, puis on consulte ses stats et celles des autres. Le site web sort en premier, en français et en anglais ; l'appli iPhone/Android suivra avec React Native (Expo), sur la même base.

- **Promesse** : le Letterboxd de la musique, plus chaleureux et plus fiable que ce qui existe.
- **Ambiance** : cozy et jazzy, clin d'œil assumé au spleen baudelairien.
- **Principe clé** : chacun saisit ce qu'il écoute, sans connexion à Spotify, Deezer ou Apple Music au lancement (voir Contraintes techniques).
- **Modèle** : gratuit et sans pub au lancement, puis pubs pour les comptes gratuits et un abonnement Spleen+ à 1 € qui les retire et débloque la personnalisation et des stats avancées.
- **Contexte** : projet public, porté par une seule personne, budget très serré.

Cible (hypothèse à valider) : 18-35 ans qui écoutent des albums en entier, utilisent déjà Letterboxd ou Goodreads et partagent leurs goûts sur Instagram, TikTok ou X.

## Ce qui a changé depuis la v1 (jalons 1 à 9)

La v1 décrivait l'intention. Voici ce que le développement a ajouté ou tranché, souvent après une question posée pendant un jalon. Le détail est dans la doc de chaque domaine (colonne de droite).

**Ajouts qui n'étaient pas prévus**

| Domaine | Ajout ou décision | Doc |
| --- | --- | --- |
| Catalogue | Imports MusicBrainz réservés aux membres connectés ; 60 recherches et 30 imports par heure et par membre ; un seul limiteur pour tout le site (1 requête toutes les 1,1 s, état gardé dans Postgres) | `docs/catalogue.md` |
| Catalogue | Discographies importées en fiches incomplètes, complétées à la première visite d'un membre ; règle de choix de l'édition de référence pour la liste des titres ; mixtapes comptées comme disques principaux ; pré-remplissage de 158 albums et 9 artistes | `docs/catalogue.md` |
| Catalogue | Pochettes affichées sans optimisation d'image : aucun quota consommé chez l'hébergeur | `docs/catalogue.md` |
| Comptes | Pseudo modifiable une fois par 30 jours ; ancien pseudo et pseudo d'un compte supprimé réservés 30 jours | `docs/accounts.md` |
| Comptes | Avatars recadrés et réduits dans le navigateur (512 px), sans traitement d'image côté serveur | `docs/accounts.md` |
| Écoute | Écoute « sans date » : la note rapide et le cœur donnés depuis une fiche vivent dans une écoute non datée, au plus une par disque. Elle n'apparaît ni dans le journal ni dans le calendrier | `docs/ecoute.md` |
| Écoute | Note actuelle = celle de l'écoute modifiée le plus récemment ; clics rapides remis dans l'ordre ; « aujourd'hui » = fuseau horaire du membre | `docs/ecoute.md` |
| Écoute | 20 humeurs proposées (FR/EN) plus les humeurs personnelles ; 8 formats | `docs/ecoute.md` |
| Profil | L'Étagère accepte tous les types (« Mes 4 disques favoris ») ; onglet **Coups de cœur** | `docs/profil-stats.md` |
| Stats | Quatre compteurs (albums, EP, singles, morceaux journalisés seuls) ; tops comptés en écoutes, réécoutes comprises ; cache versionné par membre ; les écoutes sans date comptent seulement dans les totaux | `docs/profil-stats.md` |
| Social | Onglet Populaire = likes + 2 × commentaires sur 7 jours, par langue ; suggestions de membres quand le fil est vide ; notifications regroupées ; blocage dans les deux sens, jamais annoncé | `docs/social.md` |
| Découverte | Tendances selon la **langue d'interface des membres** (membres distincts, 2 au moins, repli s'il y a peu de données) ; mieux notés en moyenne bayésienne ; sorties récentes alimentées par une tâche de nuit ; page `/discover` | `docs/decouverte.md` |
| Modération | Rôle admin donné uniquement en ligne de commande ; décisions motivées et historisées ; suspension avec email, motif montré seulement après preuve d'identité, adresse pour contester ; contenu masqué visible par son seul auteur ; notes des comptes suspendus exclues des chiffres publics ; historique anonymisé après 1 an | `docs/social.md` |
| Modération | Fusion de doublons du catalogue avec redirection permanente de l'ancienne adresse ; signalement de catalogue à 5 types (erreur, pochette, doublon, ajout manquant, autre) | `docs/social.md` |
| Qualité | Tests aussi sur un vrai Postgres 18 en CI ; nettoyage automatique des comptes de test e2e, qui refuse de toucher la base de production ; contrôle des journaux du serveur ; Dependabot ; compétences `/fin-de-jalon` et `/maintenance` | `docs/environnement.md` |

**Choix techniques tranchés en route**

- Emails : **Brevo** (entreprise française, 300 emails par jour gratuits).
- Base : deux branches Neon (`dev`, `production`) pendant le développement, puis **un projet Neon séparé, `spleen-prod`**, pour la production. Développement hors ligne et tests sur PGlite.
- Hébergement : la taille d'un Worker Cloudflare n'est plus un obstacle (64 Mio sur les deux offres, `docs/services.md`).
- Performance : toutes les pages sont aujourd'hui calculées à chaque visite, à cause du cookie de thème. L'issue #22 (cache des pages publiques) est le plus gros levier avant l'ouverture (`docs/stack-et-limites.md`).

**Ce qui reste du MVP** : pages légales, référencement et images de partage, PWA, finitions et accessibilité (fin du jalon 9) ; branchement des vrais services, e2e en CI et mise en ligne (jalon 10, `docs/mise-en-ligne.md`).

**Ajouté le 27 octobre** : les sorties à venir des artistes suivis (jalon 11, section dédiée plus bas) et la licence des genres MusicBrainz, à régler avant toute monétisation (section Modèle économique).

## Analyse concurrentielle

La place est libre pour un carnet d'écoute stable, joli, chaleureux, francophone et pas cher : les vétérans sont austères ou élitistes, et le clone de Letterboxd le plus connu, Musicboard, est en difficulté.

| Concurrent | Ce qu'il fait bien | Points faibles | Ce que Spleen en tire |
| --- | --- | --- | --- |
| [Musicboard](https://techcrunch.com/?p=3089518) (Suède, 2020, appli iOS/Android) | Concept Letterboxd pour la musique, communauté soudée | Pannes à répétition, site hors ligne, appli Android retirée du Play Store, serveurs à nouveau tombés le 9 février 2026. Les avis citent [recherche lente, déconnexions, impossible de publier une critique sans note](https://justuseapp.com/en/app/1503544789/musicboard-discuss-music/reviews). [Pro à 4,99 $/mois](https://www.techradar.com/computing/software/were-confident-its-going-to-be-bigger-than-imdb-musicboard-founders-on-growing-a-community-and-how-its-earned-its-cult-status) | Fiabilité avant tout, critique sans note, prix bas, accueillir ses utilisateurs déçus |
| [Rate Your Music](https://en.wikipedia.org/wiki/Rate_Your_Music) (2000) | Base énorme, classements par genre, année, pays, listes de qualité | [Interface dense et datée, communauté jugée élitiste et dure](https://factually.co/fact-checks/electronics-tech/rateyourmusic-com-overview-8ded9e), intimidant pour un débutant | Interface simple et belle, ton bienveillant, modération claire |
| [Album of the Year](https://www.jetpunk.com/message-board/t/rym-vs-aoty-which-is-better) | Interface plus moderne que RYM, agrège aussi les critiques presse | [Note sur 100 difficile à utiliser](https://forums.albumoftheyear.org/t/having-troubles-rating-albums-need-advices/6379), découverte faible hors titres populaires, critiques souvent réduites à des blagues. Des fans ont créé l'extension [Better AOTY](https://firefox.marketplace.browsertotal.com/en-US/firefox/addon/betteraoty) pour moderniser le site, masquer les scores et calculer la moyenne des pistes | Étoiles sur 5, option « masquer les moyennes », note piste par piste qui suggère la note de l'album |
| [Record Club](https://digitrendz.blog/newswire/technology/191407/record-club-aims-to-be-letterboxd-for-music-fans/) (lancé en 2026) | Clone propre de Letterboxd : 5 favoris, 5 « en rotation », file d'attente, listes | Trop récent pour juger ; c'est exactement la promesse de Spleen | Concurrent direct à surveiller : se démarquer par l'ambiance, le français et les idées ci-dessous |
| [Airbuds](https://theaggie.org/2025/1/23/track-your-media-in-2025-with-these-three-apps) (2023) | Écoutes des amis en temps réel, récaps hebdo façon Wrapped | Pas de notes ni de critiques ; dépend des API Spotify et Apple Music, fragiles | Spleen ne dépend d'aucune API de streaming |
| Letterboxd (le modèle) | Référence du genre côté films | — | [Pro à 18,99 $/an, Patron à 48,99 $/an](https://www.apppricinglab.com/iap/apple/1054271011) ; [les stats annuelles et totales sont réservées au Pro](https://letterboxd.com/vmly/diary/) : c'est le schéma à reprendre |

## Positionnement et idées pour sortir du lot

Positionnement : « le carnet d'écoute qui a une âme » — fiable comme un outil, chaleureux comme un bar à jazz, en français et en anglais. Les idées ci-dessous corrigent ce que les concurrents ratent, puis ajoutent des rituels propres à Spleen.

| Idée | Ce que ça fait | Pourquoi ça démarque | Quand |
| --- | --- | --- | --- |
| Liberté de notation | Note sans critique, critique sans note, demi-étoiles (0,5 à 5) | Corrige le reproche n°1 fait à Musicboard | MVP |
| Écoute à l'aveugle | Option qui masque la moyenne de la communauté tant qu'on n'a pas noté | Demandé par les fans d'AOTY (extension Better AOTY) | MVP |
| Note piste par piste | On note chaque morceau, Spleen propose une note d'album | Absent ou bricolé ailleurs | MVP |
| Le Carnet d'humeur | Chaque écoute peut porter un format (vinyle, CD, cassette, streaming, concert), un moment (nuit, pluie, dimanche matin, trajet) et « première écoute / réécoute » | Personne ne relie musique et ambiance ; nourrit des stats uniques et la découverte « qu'écoute-t-on quand il pleut ? » | MVP (saisie), V2 (stats) |
| L'Étagère | Les 4 albums favoris présentés comme des vinyles sur une étagère en bois sur le profil | Identité visuelle forte, profil qu'on a envie de montrer | MVP |
| Tendances par langue | Classements FR et EN séparés (« le rap FR de la semaine ») | RYM et AOTY sont pensés pour un public anglophone | MVP |
| Cartes partageables | Image format story pour une critique, un récap du mois, le « Spleen Rewind » annuel | Acquisition gratuite via Instagram et TikTok | V2 |
| Affinité / Toi vs moi | Score de compatibilité entre deux profils et comparaison des stats côte à côte | Répond à l'envie de regarder les stats des autres | V2 |
| Le Club du dimanche | Un album par semaine choisi par la communauté ; les critiques des autres se débloquent après avoir noté | Rituel hebdomadaire qui fait revenir les gens | V2 |
| Prête-moi un disque | Recommander un album à un ami ; il répond par une note ; historique des « disques prêtés » | Social plus intime qu'un fil d'actualité | V2 |
| Import CSV | Récupérer ses notes depuis un autre site ou Last.fm | Facilite l'arrivée des déçus de Musicboard ; optionnel, jamais obligatoire | V2 |
| Appli installable (PWA) | Le site s'installe sur l'écran d'accueil du téléphone, sans store | Une « appli » dès le lancement, sans payer Apple | MVP |
| Sorties à venir de tes artistes | Suivre un artiste, voir ses prochains disques, être prévenu le jour de la sortie | Une raison de revenir même sans rien à noter ; coût presque nul grâce à ListenBrainz | Jalon 11 |
| Quoi écouter ce soir ? | « Écouter sur… » (liens directs quand MusicBrainz les connaît), les notes de mes amis sur une fiche, « Tire un disque » dans « À écouter » | Passer de « je note » à « j'écoute maintenant » ; aide à choisir quand la liste « À écouter » déborde | Jalon 13 |
| Souvenirs | « Il y a un an, tu écoutais… » sur l'accueil ; anniversaires des disques notés ou aimés ; « Sortis un <jour mois> » sur `/discover` | Fait revenir sans rien demander ; s'appuie sur le journal daté, que les autres sites exploitent peu | Jalon 14 |
| Défi de l'année | Objectif annuel de disques découverts, barre de progression sur le profil | Le « reading challenge » de Goodreads, éprouvé ; pousse à découvrir plutôt qu'à réécouter | Jalon 15 (après la mise en ligne) |
| En ce moment et RSS | « J'écoute ça » affiché 2 h sur le profil et dans le fil ; flux RSS public du journal et des critiques | Présence sans dépendre des API de streaming ; le RSS plaît aux blogueurs et aux habitués de Letterboxd | Jalon 16 (après la mise en ligne) |

À éviter : copier tel quel le profil « 5 favoris + 5 en rotation » de Record Club, et tout classement public des « meilleurs critiques », qui nourrit l'élitisme reproché à RYM.

## Périmètre et roadmap

Le site gratuit d'abord, la monétisation ensuite, et l'appli seulement quand Spleen+ rapporte de quoi payer le compte Apple.

1. **Phase 0, fondations** (jalons 1 et 2) : faite.
2. **Phase 1, MVP du site, gratuit et sans pub** (jalons 3 à 14) : jalons 3 à 9 faits ; ordre de réalisation 12 (douceurs, en cours) → 11 (sorties à venir) → 13 (quoi écouter ce soir) → 14 (souvenirs) → 10 (mise en ligne). Après la mise en ligne, toujours gratuits : 15 (défi de l'année) puis 16 (en ce moment et RSS). **Condition de passage** : bêta stable, micro-entreprise créée, hébergement commercial, licence des genres réglée.
3. **Phase 2, monétisation** : Spleen+ (1 €/mois ou 10 €/an via Stripe), stats avancées, thèmes de profil, cartes partageables, Toi vs moi, Club du dimanche, Prête-moi un disque, import CSV, pubs discrètes. **Condition de passage** : Spleen+ rapporte de quoi payer le compte Apple (99 $/an).
4. **Phase 3, appli Spleen** : Expo sur la même API, Se connecter avec Apple, notifications push, achats intégrés Apple et Google.
5. **Phase 4, plus tard** : Apple Music, import Last.fm ; Spotify et Deezer si leurs règles s'assouplissent.

Une phase ne démarre que lorsque sa condition de passage est remplie ; seule la phase 1 est un objectif immédiat, et c'est elle que vise le prompt Claude Code.

## Fonctionnalités du MVP (site web)

Le MVP couvre le cœur Letterboxd — noter, critiquer, tenir son journal, suivre des gens — plus les stats de base, en FR/EN, gratuit et sans pub.

1. **Comptes**
   - Inscription par email (lien magique) et Google ; Apple plus tard (voir Contraintes techniques).
   - Pseudo unique (@pseudo), avatar, bio, langue FR/EN, thème sombre ou clair.
   - Export de ses données et suppression du compte en un clic.
2. **Catalogue**
   - Quatre types : artiste, album, EP/single, morceau.
   - Recherche unifiée avec filtres par type, résultats instantanés sur le catalogue déjà connu de Spleen.
   - Page album : pochette, artistes, date, type, genres, liste des titres, note moyenne et répartition, critiques populaires et de mes amis, listes qui le contiennent, liens « Écouter sur » Spotify, Deezer, Apple Music et YouTube (simples liens de recherche, sans API).
   - Page artiste : discographie par type, note moyenne, morceaux les mieux notés sur Spleen.
   - Bouton « Signaler une erreur / proposer un ajout ».
3. **Noter, critiquer, journal**
   - « J'ai écouté » en un clic ; note de 0,5 à 5 étoiles ; coup de cœur ; critique optionnelle.
   - Date d'écoute (aujourd'hui par défaut), réécoute, format, humeurs (étiquettes proposées + personnelles).
   - Note piste par piste optionnelle, avec suggestion de note d'album.
   - Liste « À écouter ».
4. **Profil**
   - L'Étagère (4 albums favoris), activité récente, journal en vue liste et calendrier, critiques, listes, stats, abonnés et abonnements.
   - Option pour rendre ses stats ou son journal privés.
5. **Social**
   - Suivre, fil d'actualité (amis / populaire), likes et commentaires sur critiques et listes, notifications dans le site.
   - Bloquer, signaler un contenu ou un compte.
6. **Listes** : classées ou non, avec description, mélangeant albums, morceaux et artistes.
7. **Découverte** : tendances de la semaine (FR et EN), sorties récentes, mieux notés par genre, année et décennie (avec un nombre minimum de notes), critiques populaires.
8. **Administration** : file de modération des signalements, fusion des doublons du catalogue, suspension de compte.
9. **Transverse** : responsive mobile d'abord, appli installable (PWA), accessibilité clavier et lecteur d'écran, pages publiques rendues côté serveur pour le référencement, aperçus soignés quand on partage un lien.
10. **Sorties à venir de tes artistes** (ajouté le 27 octobre, jalon 11) : voir la section suivante.
11. **Quoi écouter ce soir ?** et **Souvenirs** (ajoutés le 10 novembre, jalons 13 et 14) : voir leurs sections. Les jalons 15 et 16 viennent après la mise en ligne.

## Sorties à venir de tes artistes (jalon 11)

Suivre un artiste et voir en un coup d'œil ce qu'il va sortir : la semaine prochaine, dans trois mois, ou « annoncé, date à préciser ». Le jour de la sortie, Spleen prévient. C'est une raison de revenir même quand on n'a rien à noter, et ça ne coûte presque rien : une requête par nuit.

**Parcours**

1. Sur la fiche d'un artiste, je clique sur **Suivre**. La page des sorties à venir me propose aussi de suivre en un clic les artistes que j'écoute le plus (tirés de mes stats).
2. La page **Sorties à venir** (`/upcoming`, membres connectés) regroupe les prochains disques de mes artistes : *Cette semaine*, *Ce mois-ci*, *Plus tard*, *Annoncé, date à préciser*. Filtre album / EP / single.
3. Sur l'accueil, un bloc **« Bientôt dans tes oreilles »** montre mes 5 prochaines sorties.
4. Sur la fiche d'un artiste, une section **« À venir »**, visible par tous, liste ses disques annoncés.
5. Sur `/discover`, un bloc **« Les plus attendus »** classe les sorties à venir selon le nombre de membres qui suivent l'artiste ou ont mis le disque dans « À écouter ».
6. Le jour de la sortie, une **notification** : « Sortie aujourd'hui : *Titre* de *Artiste* », regroupée s'il y en a plusieurs (« 3 sorties aujourd'hui chez tes artistes »).
7. Depuis une sortie à venir, je peux l'ajouter à **« À écouter »**. Après la date, la fiche redevient normale et le disque rejoint les sorties récentes.

**Règles (décisions par défaut, à valider au début du jalon)**

| Sujet | Règle proposée | Pourquoi |
| --- | --- | --- |
| Qui peut suivre | Membres connectés ; 500 artistes au plus ; 200 suivis par heure | Bloquer les robots, comme les autres écritures |
| Visibilité | Ma liste d'artistes suivis est **privée** au lancement (visible dans mes réglages) | Rien de plus à modérer ; on pourra l'afficher sur le profil plus tard |
| Ce qui est « à venir » | Disque principal (album, EP, single ; ni live ni compilation) d'un artiste suivi, dont la date de sortie est après aujourd'hui dans **mon** fuseau horaire | Même logique que les sorties récentes (`docs/decouverte.md`) |
| Précision de la date | Jour ou mois : classé par date. Année seule : « Annoncé, date à préciser » | MusicBrainz ne connaît souvent que l'année au début |
| Horizon | 12 mois au plus | Au-delà, les dates bougent trop |
| Avant la sortie | Pas de « J'ai écouté », ni de note, ni de critique ; « À écouter » autorisé | Éviter les notes sur des fuites ou des disques pas encore sortis |
| Date modifiée | On affiche la dernière date connue, avec un badge « date modifiée » si elle a changé depuis l'annonce | Les reports sont fréquents |
| Notifications | Le jour J au matin (fuseau du membre), regroupées par jour ; réglage pour les couper ; jamais pour un compte suspendu | Une notification utile, pas du bruit |
| Doublons fusionnés | La fusion d'artistes transfère les suivis vers la fiche gardée | Comme le reste des données |
| Suppression du compte | Les suivis disparaissent avec le compte | Comme le reste des données |

**D'où viennent les données**

1. **ListenBrainz, une requête par nuit.** [`GET /1/explore/fresh-releases/`](https://listenbrainz.readthedocs.io/en/latest/users/api/misc.html) avec `release_date` = aujourd'hui, `days=90` (le maximum), `past=false`, `future=true` renvoie les sorties annoncées dans MusicBrainz pour les 90 prochains jours, avec l'identifiant MusicBrainz des artistes et du disque. ListenBrainz appartient à la même fondation que MusicBrainz. On garde les sorties d'un artiste suivi par au moins un membre et on crée les fiches incomplètes correspondantes, comme pour les discographies. Respecter les en-têtes `X-RateLimit-*` de ListenBrainz.
2. **La relecture de nuit des discographies** (`catalog:refresh`, déjà en place) s'étend aux artistes suivis, les plus suivis d'abord, chacun au plus une fois par semaine. Elle capte les annonces à plus de 90 jours et les changements de date. Son plafond actuel (150 artistes par nuit) est à revoir avec le budget de la tâche (`docs/stack-et-limites.md` § 3).
3. **Les membres** : une sortie absente se signale avec le bouton « Signaler une erreur / proposer un ajout » (type « ajout manquant »).

Limite assumée : ces données viennent des bénévoles de MusicBrainz. Les grosses sorties sont souvent annoncées tôt ; un petit artiste n'apparaît parfois que le jour J. La page le dit simplement : « Une sortie manque ? Signale-la. »

**Modèle de données (proposition, à confirmer par Claude Code)**

- `artist_follows` : membre, artiste, date ; clé primaire (membre, artiste), index par artiste.
- `releases.announced_at` : première fois que le disque a été vu « à venir » ; `releases.release_date_changed_at` pour le badge « date modifiée ».
- Notification de type `release`, avec une colonne `release_id`.
- `profiles.notify_releases`, activé par défaut.

**Écrans** : bouton Suivre sur la fiche artiste, page `/upcoming`, bloc d'accueil, section « À venir » de la fiche artiste, bloc « Les plus attendus » de `/discover`, réglages (notifications de sorties, liste de mes artistes suivis avec « Ne plus suivre »).

**Coût** : presque nul. Une requête ListenBrainz par nuit, plus un lot plafonné de requêtes MusicBrainz dans la tâche de nuit qui existe déjà.

**Plus tard** : abonnement calendrier `.ics` (une adresse secrète par membre, à ajouter dans Google Agenda ou Calendrier Apple ; candidat pour Spleen+) ; notifications push dans l'appli ; récapitulatif hebdomadaire par email, en option, parce qu'il consomme le quota Brevo.

## Quoi écouter ce soir ? (jalon 13)

Aider à passer de la fiche à l'écoute, et à choisir quand on ne sait pas quoi mettre. Règles ci-dessous = **décisions par défaut, à valider au début du jalon**.

- **Écouter sur…** : sur les fiches album, morceau et artiste, des liens vers Spotify, Deezer, Apple Music, YouTube Music et Bandcamp (remplace les simples liens de recherche prévus au MVP). Lien direct quand MusicBrainz le connaît : relations d'URL demandées dans l'import existant, sans requête en plus ; les fiches déjà importées sont relues peu à peu par la tâche de nuit. Sinon, un lien de recherche (artiste + titre). Aucun lien affilié avant la monétisation.
- **Tes amis sur ce disque** : sur une fiche, les notes et cœurs des membres que je suis (5 au plus, puis « voir tous »). Comptes bloqués ou suspendus et contenus privés exclus. Caché en écoute à l'aveugle tant que je n'ai pas noté.
- **Tire un disque** : un bouton qui pioche au hasard dans ma liste « À écouter », avec des filtres de type et de durée et un bouton « Un autre ». Marche sans JavaScript (tirage côté serveur).

## Souvenirs (jalon 14)

Faire revenir sans rien demander, à partir de ce que le membre a déjà noté. Décisions par défaut, à valider au début du jalon.

- **Ce jour-là** : un bloc d'accueil « Il y a un an, tu écoutais… », à partir des écoutes datées, dans le fuseau du membre. Rien s'il n'y a rien ; un réglage pour le masquer.
- **Anniversaires** : pour les disques que j'ai notés ou aimés, « *Titre* a N ans aujourd'hui », seulement pour les dates connues au jour près. Les anniversaires ronds sont mis en avant (10, 20, 25, 30, 40, 50 ans). Plus un bloc « Sortis un <jour mois> » sur `/discover`.

## Défi de l'année (jalon 15, après la mise en ligne)

Un objectif annuel de disques découverts (première écoute dans l'année) et une barre de progression sur le profil, visible par tous ou par le membre seul. Décisions par défaut, à valider au début du jalon.

## En ce moment et RSS (jalon 16, après la mise en ligne)

Décisions par défaut, à valider au début du jalon.

- **J'écoute ça** : un bouton qui affiche le disque pendant 2 h sur le profil et dans le fil des abonnés.
- **RSS** : un flux public du journal et des critiques d'un membre, sans rien de privé.

## Stats : gratuites et Spleen+

Les stats sont calculées à partir de ce que chacun saisit dans Spleen. Celles d'un membre sont visibles par tous les visiteurs de son profil (sauf s'il les rend privées) ; les stats avancées d'un membre Spleen+ aussi, ce qui sert de vitrine à l'abonnement.

| Statistique | Gratuit | Spleen+ |
| --- | --- | --- |
| Nombre d'albums, EP et morceaux écoutés (année, total) | Oui | Oui |
| Répartition de ses notes | Oui | Oui |
| Top artistes et top genres | Top 5 de l'année en cours | Illimité, par année et depuis toujours |
| Décennies écoutées | Oui | Oui |
| Activité | Par mois | Calendrier jour par jour |
| Humeurs et formats (« la nuit », vinyle vs streaming) | — | Oui |
| Note moyenne par genre et par artiste, « le plus sévère / le plus généreux » | — | Oui |
| Score d'obscurité (popularité sur Spleen de ce qu'on écoute) | — | Oui |
| Premières écoutes vs réécoutes, séries de jours d'affilée | — | Oui |
| Toi vs moi | Score d'affinité | Comparaison détaillée |
| Spleen Rewind annuel (carte partageable) | Version courte | Version longue |

Technique : les stats se calculent avec des requêtes SQL d'agrégation, mises en cache par utilisateur et recalculées quand il ajoute ou modifie une écoute. Aucun traitement lourd en continu.

## Modèle économique

Lancement gratuit et sans pub ; ensuite, pubs discrètes pour les comptes gratuits et Spleen+ à 1 € par mois. Recommandation : mettre en avant l'offre annuelle à 10 €, car les frais fixes de paiement mangent une grosse part d'un paiement de 1 €.

**Ce que contient Spleen+**

- Zéro pub.
- Personnalisation du profil : thèmes d'ambiance (Minuit, Bordeaux, Crème, Bleu nuit…), bannière, vinyle animé sur l'Étagère, choix de l'accent de couleur, badge Spleen+.
- Stats avancées (voir la section Stats) et Spleen Rewind long.
- Critiques épinglées en haut du profil.
- Option « Mécène » à prix libre plus élevé, avec son nom dans une page de remerciements : modèle du Patron de Letterboxd.

Règle d'or : ne jamais faire payer le cœur du produit (noter, critiquer, journal, listes, suivre).

**Prérequis découvert le 27 octobre : la licence des genres.** Les données de base de MusicBrainz (artistes, disques, titres, dates) sont dans le domaine public (CC0). Mais les genres, tags et notes de MusicBrainz sont des [données « supplémentaires » sous licence CC BY-NC-SA 3.0](https://musicbrainz.org/doc/About/Data_License), qui interdit l'usage commercial. Spleen affiche des genres sur les fiches et s'en sert pour les stats et les « mieux notés par genre ». Avant la première pub ou le premier abonnement, il faut donc :

- soit une licence commerciale auprès de MetaBrainz (passer par un compte de soutien, le palier dépend des revenus : `docs/services.md` et `docs/stack-et-limites.md` § 5.2) ;
- soit une autre source de genres, par exemple Wikidata (domaine public) ou des genres choisis par les membres.

Le ticket est à ouvrir dans `docs/mise-en-ligne.md` (rubrique monétisation) ; d'ici là, le site gratuit et sans pub reste dans les clous.

**Ce qui reste vraiment d'un abonnement payé par carte sur le site** (Stripe : [1,5 % + 0,25 € par paiement avec une carte européenne standard](<https://support.stripe.com/questions/pricing-updates-for-businesses-based-in-the-european-economic-area-(eea)>))

| Formule | Prix payé | Frais Stripe | Net sans TVA | Net avec TVA à 20 % |
| --- | --- | --- | --- | --- |
| Mensuelle | 1 € | 0,265 € | 0,74 € par mois | 0,57 € par mois |
| Annuelle | 10 € | 0,40 € | 9,60 € par an (0,80 € par mois) | 7,93 € par an (0,66 € par mois) |

- **Statut** : il faut une structure (micro-entreprise par exemple) avant d'encaisser le premier euro. La TVA dépend du statut et du pays de l'abonné : à valider avec un comptable.
- **Où payer** : sur le site via Stripe. Dans les applis, Apple et Google imposent leurs achats intégrés pour un abonnement numérique, avec une commission (15 % pour les petits développeurs, à revérifier au moment du lancement mobile).
- **Pubs** : un emplacement entre deux blocs du fil ou en bas de page, jamais dans le journal ni pendant la saisie d'une critique. Il faudra un bandeau de consentement conforme au RGPD dès que des pubs ciblées apparaissent.

## Contraintes techniques

Aucune connexion aux services de streaming au lancement : Spotify et Deezer sont fermés aux nouveaux projets, et Apple Music comme « Se connecter avec Apple » demandent un compte développeur Apple payant. Le catalogue vient de MusicBrainz, gratuit et ouvert.

**Services de streaming**

| Service | Situation en octobre 2026 | Décision |
| --- | --- | --- |
| [Spotify](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access) | Accès élargi réservé depuis mai 2025 aux organisations avec au moins 250 000 utilisateurs actifs mensuels ; [le mode développement est limité à 5 utilisateurs](https://community.spotify.com/t5/Spotify-for-Developers/Web-API-Limitations/td-p/7511737) | Abandonné ; liens « Écouter sur Spotify » seulement |
| [Deezer](https://deezer-python.readthedocs.io/en/stable/contributing.html) | Le portail développeur n'accepte plus de nouvelles applications | Abandonné ; liens seulement |
| [Apple Music](https://developer.apple.com/documentation/applemusicapi) | Ouvert, mais exige l'Apple Developer Program (99 $/an) ; donne accès à l'historique récent avec l'accord de l'utilisateur | Plus tard, quand le compte Apple sera payé pour l'appli |

**Catalogue musical : MusicBrainz + Cover Art Archive**

- [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting) est gratuit et sans clé, mais limité à environ 1 requête par seconde par adresse IP, avec un en-tête User-Agent qui donne un contact.
- Conséquence : tout le site partage cette limite (les requêtes partent du même serveur). On ne l'appelle donc jamais à chaque frappe d'un utilisateur.
- Stratégie :
  1. Catalogue local dans Postgres, avec recherche plein texte et tolérante aux fautes.
  2. Import à la demande : si la recherche locale ne trouve rien, une file d'attente unique interroge MusicBrainz à 1 requête par seconde maximum et enregistre l'album, ses artistes et sa liste de titres, une fois pour toutes.
  3. Pré-remplissage avant le lancement avec les albums les plus connus, éventuellement depuis les exports complets de MusicBrainz (licence à vérifier).
- Correspondance : « release group » MusicBrainz = album, EP ou single ; « recording » = morceau ; « artist » = artiste.
- Pochettes : Cover Art Archive, retrouvées par l'identifiant MusicBrainz.
- Le catalogue reste derrière une interface interne (« fournisseur de catalogue ») pour pouvoir brancher une autre source plus tard.

**Connexion**

- Email (lien magique) et Google dès le MVP : gratuits.
- [« Se connecter avec Apple » exige l'Apple Developer Program, même pour un site](https://developer.apple.com/forums/thread/766107) : reporté à la phase appli, où le compte sera payé de toute façon.
- Côté stores, aucun droit spécial n'est nécessaire pour se connecter à un service tiers ; il faudra remplir la fiche de confidentialité d'Apple et la section « Sécurité des données » de Google Play.

## Stack, architecture et hébergement

Un monorepo TypeScript où toute la logique vit dans des paquets partagés : le site Next.js d'aujourd'hui et l'appli Expo de demain appellent la même API, avec les mêmes validations, textes et couleurs.

- `apps/web` (Next.js) appelle l'API tRPC de `packages/api`, qui contient toute la logique ; `packages/db` (Drizzle), `packages/validators` (Zod), les textes et les couleurs sont partagés.
- Services externes : PostgreSQL (Neon), MusicBrainz + Cover Art Archive pour le catalogue, Brevo pour les emails, Cloudflare R2 pour les avatars. ListenBrainz s'ajoute au jalon 11.
- Une tâche de nuit (GitHub Actions) relit les discographies et anonymise l'ancien historique de modération.
- Phase 3 : `apps/mobile` (Expo) se branche sur la même API sans rien réécrire.

Versions exactes, limites de chaque service et paliers de montée en charge : `docs/stack-et-limites.md`.

| Brique | Choix | Pourquoi |
| --- | --- | --- |
| Organisation | Monorepo pnpm + Turborepo : `apps/web`, plus tard `apps/mobile`, et des `packages/` partagés | L'appli réutilise tout sans copier-coller |
| Site | Next.js (App Router), TypeScript strict | Ton choix ; rendu serveur bon pour le référencement |
| Interface | Tailwind CSS + composants maison ; jetons de design dans un paquet partagé | Mêmes couleurs et typo reprises dans l'appli (NativeWind) |
| API | tRPC (ou REST typé) dans `packages/api` | Même API pour le site et l'appli ; aucune logique métier dans les pages |
| Validation | Zod dans un paquet partagé | Mêmes règles côté serveur, site et appli |
| Base | PostgreSQL + Drizzle ORM, migrations versionnées | SQL standard, portable chez n'importe quel hébergeur |
| Connexion | Une bibliothèque qui gère web et Expo (Better Auth par exemple) ; email + Google, Apple plus tard | Pas de réécriture au passage mobile |
| Langues | next-intl ; textes FR/EN en JSON dans un paquet partagé | Réutilisables par l'appli |
| Fichiers | Stockage compatible S3 (Cloudflare R2) pour avatars et bannières | Pas lié à un hébergeur |
| Qualité | ESLint, Prettier, Vitest, Playwright, GitHub Actions | Filet de sécurité quand on code seul |

**Préparer l'appli dès maintenant**

- Sessions utilisables par cookie (site) et par jeton (appli).
- URL stables (`/album/[slug]`, `/u/[pseudo]`) que l'appli ouvrira directement via des liens universels.
- Prévoir dans le modèle la plateforme d'un abonnement (Stripe, Apple, Google) et une table de jetons de notifications push.
- Aucun service propre à un hébergeur (stockage, files d'attente, cache) : uniquement des briques standard.

**Hébergement**

| Moment | Où | Coût |
| --- | --- | --- |
| Développement et lancement sans revenus | Vercel Hobby + Neon Free + Cloudflare R2 | 0 € (+ nom de domaine) |
| Dès les pubs ou Spleen+ | Cloudflare Workers payant (Next.js via OpenNext), ou Vercel Pro | Environ 5 $/mois, ou 20 $/mois |

- [Vercel Hobby interdit tout usage commercial](https://deploywise.dev/blog/vercel-free-tier-limits-2026) : pubs et abonnement imposent de changer d'offre ou d'hébergeur, d'où un code portable.
- [Neon Free](https://neon.com/pricing) : 100 heures de calcul par mois et [1 Go de stockage par projet depuis octobre 2026](https://releases.sh/collections/serverless-postgres/digest/2026-09-28) ; la base s'endort après 5 minutes d'inactivité, d'où un premier chargement plus lent.
- [Cloudflare Workers](https://opennext.js.org/cloudflare) : la taille d'un worker (64 Mio sur les deux offres, revérifié le 22 octobre dans `docs/services.md`) n'est plus un obstacle, mais les 10 ms de calcul par requête de l'offre gratuite sont trop courts pour Next.js, d'où l'offre à 5 $/mois. Tester ce déploiement tôt.
- **Mise à jour du 27 octobre** : avec un peu de trafic, Neon Free sera le premier mur (le site s'arrête quand les 100 heures de calcul sont épuisées). Prévoir Neon Launch à l'ouverture publique (environ 13 à 25 $/mois). Calculs et seuils : `docs/stack-et-limites.md`.
- Les VPS bon marché ont beaucoup augmenté en 2026 ([Hetzner notamment](https://kimmo.suominen.com/stuff/cpc-2026-08.txt)) et demandent de l'administration : pas prioritaire.

## Données et base

Le journal d'écoute daté ne coûtera presque rien : comme chacun saisit ses écoutes à la main, le volume reste faible, et Postgres encaisse des millions de lignes sans effort. Ce qui aurait coûté cher, c'est l'enregistrement automatique de chaque morceau joué, qu'on a écarté.

**Ordre de grandeur (estimation)**

- Une entrée de journal pèse environ 200 octets avec ses index : 1 Go en contient environ 5 millions.
- 1 000 membres actifs qui notent 5 albums par semaine = 260 000 entrées par an, soit environ 50 Mo.
- À comparer : enregistrer automatiquement 40 morceaux par jour pour ces mêmes 1 000 membres ferait 14,6 millions de lignes par an.
- Le plus gros poste sera le catalogue (chaque album + ses titres), d'où l'import à la demande plutôt qu'une copie de toute la base MusicBrainz.

**Modèle de données (première version)**

- **Catalogue** : `artists`, `releases` (album / EP / single, date, pochette, identifiant MusicBrainz), `tracks`, tables de liaison artistes ↔ sorties et sorties ↔ titres (avec position), `genres`.
- **Écoute** : `entries` (le journal : membre, cible, date d'écoute, note, coup de cœur, réécoute, format), `entry_moods` + `moods`, `user_item_state` (dernier état par membre et par cible : note actuelle, coup de cœur, écouté, « à écouter ») pour afficher vite une page album.
- **Contenu** : `reviews`, `lists` + `list_items`, `favorites` (les 4 de l'Étagère, avec position).
- **Social** : `follows`, `likes`, `comments`, `notifications`, `blocks`, `reports`.
- **Compte** : utilisateurs et sessions (gérés par la bibliothèque de connexion), `profiles`, `subscriptions` (plateforme, statut, fin de période).
- **Technique** : `catalog_import_jobs` (file d'import MusicBrainz), `user_stats_cache`.

**Règles**

- Une « cible » (album, morceau ou artiste) = trois colonnes facultatives avec une contrainte « exactement une remplie », pour garder de vraies clés étrangères.
- Notes stockées en entier de 1 à 10 (demi-étoiles), affichées de 0,5 à 5.
- Identifiants UUID partout, slugs lisibles pour les URL.
- Index sur (membre, date d'écoute) pour le journal et sur la cible pour les pages album.

## Identité visuelle cozy et jazzy

L'image directrice : un club de jazz à une heure du matin, lumière tamisée, pluie sur la vitre, un disque qui tourne. Mode sombre par défaut, mode clair « papier crème ».

**Palette proposée**

| Nom | Couleur | Usage |
| --- | --- | --- |
| Encre de nuit | #15131C | Fond du mode sombre |
| Fumée | #2A2633 | Cartes, surfaces |
| Velours bordeaux | #6E2335 | Accent principal, boutons |
| Laiton | #C9A25C | Étoiles, détails, Spleen+ |
| Bleu minuit | #1E2A44 | Accent secondaire, liens |
| Papier crème | #F3EAD8 | Texte en sombre, fond en clair |

**Typographie** : titres en serif à caractère (Fraunces ou DM Serif Display), texte en sans-serif lisible (Inter), chiffres des stats en monospace façon pochette de jazz (IBM Plex Mono). Toutes disponibles sur Google Fonts.

**Matières et mouvements**

- Léger grain de papier, pochettes posées avec une ombre douce, coins peu arrondis.
- Le vinyle sort un peu de sa pochette au survol ; un bras de platine se pose quand on clique sur « J'ai écouté » ; étoiles en laiton.
- Animations courtes et coupées si l'utilisateur a demandé moins de mouvement.
- Contraste vérifié (niveau AA) : le laiton sur fond sombre est à contrôler.

**Ton** : tutoiement, phrases courtes et douces. Exemples : « Qu'as-tu écouté ce soir ? », « Ton étagère prend la poussière ». Clins d'œil à Baudelaire (domaine public) sur la page 404 et les écrans d'attente, par exemple « Je suis comme le roi d'un pays pluvieux ».

**Logo (pistes)** : « Spleen » en serif italique ; un S dessiné par le sillon d'un vinyle ; une lune en croissant posée sur un disque.

## Légal et RGPD

Avant l'ouverture publique, il faut quatre pages, un âge minimum, une modération outillée et des données hébergées en Europe. Rien de coûteux, mais rien d'optionnel.

- [ ] **Mentions légales** : éditeur du site, hébergeur.
- [ ] **Conditions d'utilisation** : règles de la communauté, ce qui est interdit, sanctions.
- [ ] **Politique de confidentialité** : données collectées, pourquoi, combien de temps, droits (accès, correction, suppression, export) et comment les exercer.
- [ ] **Conditions de vente de Spleen+** au moment de l'abonnement, y compris le droit de rétractation.
- [ ] **Âge minimum** : 15 ans, âge du consentement numérique en France.
- [ ] **Cookies** : au lancement, uniquement ceux nécessaires à la session et une mesure d'audience exemptée de consentement (ou aucune). Bandeau de consentement obligatoire le jour où arrivent les pubs.
- [ ] **Modération** (exigée pour les contenus publiés par les utilisateurs) : bouton de signalement partout, file de traitement, motif communiqué à la personne sanctionnée, historique conservé.
- [ ] **Données en Europe** : région européenne pour la base et le stockage.
- [ ] **Catalogue** : citer MusicBrainz et Cover Art Archive comme sources ; afficher les pochettes uniquement pour identifier les disques.

Ces points sont des repères, pas un avis juridique : un passage chez un juriste ou les modèles de la CNIL est conseillé avant d'encaisser de l'argent.

## Budget

Le lancement du site ne coûte que le nom de domaine ; la facture commence avec la monétisation (environ 5 $ par mois) puis l'appli (comptes développeur Apple et Google).

| Poste | Lancement | Avec pubs / Spleen+ | Phase appli |
| --- | --- | --- | --- |
| Nom de domaine | Environ 10 à 20 € par an selon l'extension | Idem | Idem |
| Hébergement du site | 0 € (Vercel Hobby) | Environ 5 $/mois (Cloudflare) ou 20 $/mois (Vercel Pro) | Idem |
| Base de données | 0 € en bêta (Neon Free) ; environ 13 à 25 $/mois dès l'ouverture publique (Neon Launch, estimation dans `docs/stack-et-limites.md`) | Idem, puis selon l'usage | Idem |
| Licence des genres | — | Selon l'accord avec MetaBrainz, ou 0 € avec une autre source | Idem |
| Images et emails | 0 € (offres gratuites) | Idem | Idem |
| Compte Apple Developer | — | — | 99 $ par an |
| Compte Google Play | — | — | 25 $ une seule fois |
| Micro-entreprise | — | Création gratuite | — |

Les montants des offres gratuites et des domaines sont à revérifier au moment de souscrire.

## Risques et questions ouvertes

Le plus gros risque n'est pas technique : c'est un site vide au lancement et un projet trop large pour une personne seule. D'où un MVP serré et une bêta fermée avant l'ouverture.

| Risque | Parade |
| --- | --- |
| Site vide au lancement | Bêta fermée sur invitation auprès de ta communauté (amis, réseaux, stream) ; catalogue pré-rempli ; Club du dimanche dès la V2 |
| Projet trop gros pour une personne | Phases strictes, MVP sans extras, tâches découpées pour Claude Code |
| Catalogue incomplet ou erroné | Import à la demande, bouton « proposer un ajout », fusion des doublons côté admin |
| Limite de 1 requête/s de MusicBrainz | Recherche locale d'abord, file d'import unique, cache permanent |
| Record Club prend la place | Aller vite ; miser sur l'ambiance, le français et les rituels |
| Facture qui explose (robots, aspiration de données) | Plafonds de dépense chez l'hébergeur, limitation de débit, cache |
| Communauté toxique | Outils de modération dès le premier jour, règles claires |
| Les règles des API changent | Le catalogue passe par une couche « fournisseur » remplaçable |
| Quota Neon Free épuisé : site arrêté jusqu'au mois suivant | Passer à Neon Launch à l'ouverture publique ; alerte à 70 % du quota (`docs/stack-et-limites.md`) |
| Genres sous licence non commerciale | Licence MetaBrainz ou autre source de genres avant la monétisation |
| Import trop lent si beaucoup de membres cherchent des disques inconnus en même temps | Pré-remplissage plus large, puis exports complets ou copie locale de MusicBrainz (`docs/stack-et-limites.md` § 5) |

**Questions ouvertes**

- [ ] Quel nom de domaine ? Vérifier aussi que « Spleen » n'est pas déjà déposé comme marque dans la musique (base INPI).
- [x] Liste initiale des humeurs et des formats : 20 humeurs et 8 formats (`docs/ecoute.md`).
- [ ] Bêta : sur invitation seulement, ou liste d'attente publique ?
- [ ] Qui aide à modérer quand la communauté grandit ?
- [ ] Genres : licence commerciale MetaBrainz ou autre source ? (avant la monétisation)
- [ ] Sorties à venir : valider les règles par défaut (liste des suivis privée, pas de note avant la sortie, notification le matin du jour J).

## Sources

Toutes les sources sont liées dans le texte, au fil des sections. Vérifications faites le 19 octobre 2026 ; limites des services revérifiées le 22 octobre (`docs/services.md`) ; licence MusicBrainz et API ListenBrainz vérifiées le 27 octobre.
