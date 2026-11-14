# Polices des images de partage

Utilisées par `src/app/og/[kind]/[key]/route.tsx` (`next/og` accepte TTF, OTF et WOFF, et
dessine une police variable dans sa graisse par défaut : d'où des instances statiques).

| Fichier             | Rôle                          | Licence                       |
| ------------------- | ----------------------------- | ----------------------------- |
| `Inter-Regular.ttf` | tout le texte, titres compris | SIL OFL 1.1 (`OFL-Inter.txt`) |

Provisoire (jalon 17, décision du pilote) : les titres passeront en Bricolage Grotesque
ExtraBold quand une instance statique `BricolageGrotesque-ExtraBold.ttf` (OFL) sera déposée
ici ; Fraunces, police de l'ancienne charte, a été retirée.

Instances statiques servies par Google Fonts (API css2), réduites aux caractères ASCII,
Latin-1 (accents du français) et à la ponctuation typographique (`« » ’ “ ” — – … € Œ œ`),
(Inter : 60 Ko). Un caractère absent s'affiche avec une police de secours.
