# Polices des images de partage

Utilisées par `src/app/og/[kind]/[key]/route.tsx` (`next/og` accepte TTF, OTF et WOFF, et
dessine une police variable dans sa graisse par défaut : d'où des instances statiques).

| Fichier                 | Rôle           | Licence                          |
| ----------------------- | -------------- | -------------------------------- |
| `Fraunces-SemiBold.ttf` | titres         | SIL OFL 1.1 (`OFL-Fraunces.txt`) |
| `Inter-Regular.ttf`     | reste du texte | SIL OFL 1.1 (`OFL-Inter.txt`)    |

Instances statiques servies par Google Fonts (API css2), réduites aux caractères ASCII,
Latin-1 (accents du français) et à la ponctuation typographique (`« » ’ “ ” — – … € Œ œ`),
d'où 101 Ko en tout. Un caractère absent s'affiche avec une police de secours.
