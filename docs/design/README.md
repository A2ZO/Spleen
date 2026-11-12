# Design « Lilas » (jalon 17)

Direction visuelle validée le 11 novembre 2026. Elle remplace l'identité « cozy & jazzy »
(bois, laiton, serif italique). Référence visuelle : les quatre maquettes de `maquettes/`
(accueil membre et fiche album sur ordinateur, fiche album et profil dans l'appli).
Chaque maquette existe en image (`.png`, la cible à comparer aux captures) et en HTML
statique (`.html`, pour lire les valeurs exactes : couleurs, ombres, rayons, tailles).
On en reprend l'apparence, pas le code.

## Principes

1. **Une couleur récurrente, en aplat.** Le lilas sert au bouton principal, aux étoiles, à
   un grand bloc plein par page et au point du logo. Jamais de dégradé, jamais de halo.
2. **Des objets qu'on peut toucher.** Boutons avec une tranche et un reflet, cartes et
   barres avec une ombre portée, pochettes qui se détachent du fond.
3. **Grosses cartes arrondies en mosaïque**, boutons en pilule, navigation flottante.
4. **Titres en grotesque très gras, chiffres énormes.** Les stats sont des éléments graphiques.
5. **Même interface sur le site et dans l'appli** : mêmes jetons, mêmes cartes, empilées
   sur une colonne sur mobile, avec une barre d'onglets flottante en bas.

## Jetons (thème sombre, par défaut)

| Rôle | Valeur |
| --- | --- |
| bg | `#0E0C12` |
| surface (cartes, barres) | `#18151F` |
| surface-raised (boutons secondaires, onglet actif) | `#2A2536` |
| ligne alternée des listes | `#15121B` |
| border | `#2E2939` (boutons secondaires : `#3A3348`) |
| fg | `#F4F1FA` |
| fg-muted | `#BDB6CC` |
| accent | `#B79CFF` |
| accent-fg (texte sur lilas) | `#17102B` |
| tranche du bouton lilas | accent mélangé à 45 % de noir |
| tranche des boutons sombres | `#050408` |

**Pas de thème clair.** Décidé le 11 novembre : Spleen n'a plus qu'un thème, le sombre.
Le thème clair, son bouton et son cookie sont supprimés.

L'avatar garde la même tranche que les boutons.

Rayons : cartes 28–32 px (22–24 px sur mobile), pochettes 20–28 px, vignettes 12–14 px,
boutons et champs en pilule. Cibles tactiles : 44 px au moins, bouton principal 52 px.

Polices (libres, à héberger soi-même) : **Bricolage Grotesque** 700/800 pour les titres et
les grands chiffres (interlettrage serré, −0,02 à −0,04 em), **Geist** 400/500/600 pour le
texte, **Geist Mono** pour les petites étiquettes en capitales.

## Relief

- Bouton principal : reflet intérieur en haut, tranche pleine de 5 px, ombre portée douce.
  À l'appui, le bouton descend sur sa tranche (translateY), puis remonte en ressort.
- Bouton secondaire : même principe, tranche de 3–4 px en `#050408`.
- Carte, barre de navigation, barre d'onglets : reflet intérieur de 1 px + ombre portée.
- Pochette : ombre portée profonde. Bloc lilas : reflet + ombre portée.
- Les valeurs exactes sont dans les maquettes (`box-shadow`).

## Mouvement

Uniquement des déplacements et des fondus (transform, opacity), pour être refaits à
l'identique dans l'appli. Tout se coupe sous `prefers-reduced-motion`.

- Les étoiles se remplissent une à une avec un léger rebond quand on note.
- Les boutons s'enfoncent à l'appui.
- Les cartes montent de quelques pixels au survol.
- Les pochettes des tendances arrivent en cascade au défilement (animation CSS liée au défilement).
- Sur une fiche, la pochette rétrécit et se range dans la barre du haut au défilement.
- Les chiffres des stats comptent jusqu'à leur valeur.
- Petite réaction rapide (150 ms), grand changement plus lent (300 ms).
- Pas de transitions de page (issue #29), pas de Suspense ni de `loading.tsx`.

## Ce qui disparaît

Le bois de l'Étagère (remplacé par une grille de 4 pochettes arrondies avec le titre en
pilule), le laiton, le serif italique, les vinyles qui dépassent, le thème clair.

## Logo

**La lune reste**, en lilas : le croissant actuel recoloré avec l'accent, suivi de
« spleen » en Bricolage Grotesque 800. La lune reste à sa place, devant le mot ; pas de
point après « spleen ».
