# Jalon 13 « Quoi écouter ce soir ? » — passation

Passer de la fiche à l'écoute : des liens « Écouter sur… » directs quand MusicBrainz les
connaît, les notes et cœurs de mes amis sur une fiche, et « Tire un disque » dans « À
écouter ». Spécification : règles du conseiller du 17 novembre dans `docs/pilote/decisions.md`
(« Décidé par le conseiller »), tirées du cahier des charges (section « Quoi écouter ce soir ?
(jalon 13) »). Consignes de chaque étape : `docs/pilote/feuille-de-route.md`. Branche
`feat/13-quoi-ecouter`, depuis `dev`.

## Contraintes (rappel)

- Toute la logique dans `packages/api`, utilisable par l'appli Expo. Aucun appel à MusicBrainz
  pendant l'affichage d'une page : les liens viennent de la base (import, tâche de nuit).
- Lecture publique d'une fiche identique pour tous (issue #22) ; ce qui dépend du membre se lit
  à part, par slug, en parallèle.
- Une seule migration, générée et additive : `listen_links`, `releases.links_checked_at`,
  `artists.links_checked_at` (« Autorisé à la fusion ») ; `pnpm db:migrate` sur Neon `dev`.
- URL de MusicBrainz validées (https, hôte exact, chemin selon le type de fiche) et
  reconstruites avant d'être enregistrées et affichées. Aucun logo, aucun lien affilié.
- MusicBrainz : aucune requête de plus à l'import ; relecture de nuit plafonnée à 300 requêtes
  et 10 minutes.
- Identité Lilas (`docs/design/README.md`) : un seul bloc lilas par page, jamais de carte vide,
  AA (texte 4,5:1, non-texte 3:1, cibles de 44 px), marche sans JavaScript.
- Pas de Suspense, pas de `loading.tsx`, pas de transitions de page. Animations en transform et
  opacity seulement.
- Aucune donnée personnelle nouvelle : politique de confidentialité, export et suppression du
  compte inchangés. Pas de nouvelle dépendance, variable d'environnement, CSP ni workflow.

## Étapes

1. **Les restes du jalon 11** : notification d'un jour passé « Sorti le … » ; disque pas encore
   sorti sans moyenne, avec « Les critiques ouvriront le jour de la sortie. ».
2. **« Écouter sur… » à l'import** : migration, relations d'URL MusicBrainz, validation,
   écriture à l'import et à la fusion, cinq services sur les trois fiches.
3. **« Écouter sur… » la nuit** : relecture plafonnée des fiches déjà importées dans
   `pnpm catalog:refresh`, passage réel sur Neon `dev`.
4. **« Tes amis sur ce disque »** : `release.friends`, section de la fiche d'un disque, démo.
5. **« Tire un disque »** : `toListen.pick`, page `/pick`, bouton dans « À écouter » (issue #31).
6. **La passe finale** : `docs/quoi-ecouter.md`, captures, axe, mesures, `CLAUDE.md`, cahier,
   puis fin de jalon.

## Mesures de référence

- `measure.mjs` (fin du jalon 11, étape 6, build de prod, médianes de 6, deux passages,
  `nuitblanche`) : accueil → album 215 / 213, album → artiste 136 / 135, artiste → profil
  231 / 219, profil → `/discover` 182 / 180, `/discover` → accueil 228 / 225 ms. Référence par
  page : la plus haute des deux, **215 / 136 / 231 / 182 / 228 ms**. Une page déjà mesurée ne
  doit pas prendre plus de 20 ms.
- `/upcoming` (fin du jalon 11, accueil → `/upcoming`, mêmes conditions) : 158 / 160 ms,
  référence **160 ms**.
- `/pick` : à mesurer à l'étape 5 (accueil → `/pick`, deux passages), puis noté ici comme sa
  référence.
- Pages qui changent dans ce jalon et figurent dans `measure.mjs` : la fiche album (liens lus
  avec la fiche, `release.friends` en parallèle) et la fiche artiste (liens). Le pool Postgres a
  5 connexions : une lecture parallèle de plus peut coûter 25 à 30 ms (étape 4 du jalon 11).
