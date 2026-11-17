# Journal du pilote — jalon 13 « Quoi écouter ce soir ? »

Une entrée par exécution qui a fait quelque chose (10 lignes au plus). Journal du jalon 11 :
`docs/pilote/archives/jalon-11/journal.md`.

- 2026-11-17 — Jalon 13 préparé par le conseiller : feuille de route en 6 étapes (restes du
  jalon 11, liens « Écouter sur… » à l'import puis la nuit, « Tes amis sur ce disque », « Tire
  un disque », passe finale), règles du cahier retenues ou ajustées dans `decisions.md`, une
  seule migration autorisée. Prochaine : étape 1.
- 2026-11-17 — Étape 1 (restes du jalon 11, issues #41 et #42) : commits e5d5497..d8e18bf.
  `notification.list` donne `releaseDay` / `releasedToday`, « Sorti le {date} » un autre jour ;
  disque à venir sans moyenne, « Les critiques ouvriront le jour de la sortie. ». `pnpm check`
  vert ; e2e complet 248 passed, 0 failed, 0 flaky, 10 skipped ; specs sans compte en prod
  114 passed, 2 failed (`hydration.spec.ts:17`, clé Brevo factice refusée, passe en dev).
  axe 0 violation (fiche visiteur et membre, notifications × 4 cas, 1280 et 390). Mesures prod
  clicMs 220/219 · 141/140 · 244/230 · 187/187 · 236/242 ms (max +14). Relecteur : OK au
  premier tour. Décision : année de « Sorti le » comparée au jour de Paris. Prochaine : étape 2.
- 2026-11-17, étape 2, réponses réelles (MusicBrainz, `inc=url-rels`, `recording-level-rels`
  accepté) : `relations[]` = `{ type: "free streaming" | "streaming" | "purchase for download"
  | "youtube music" | "bandcamp"…, direction: "forward", ended, url: { resource } }`, relations
  des enregistrements présentes (vides parfois). Formes vues : `open.spotify.com/{album,track,
  artist}/{22}`, `www.deezer.com/{album,track,artist}/{n}`, `music.apple.com/{cc}/{album,song,
  artist}/{n}` (sans slug), `music.youtube.com/channel/UC…` (artiste), `{nom}.bandcamp.com/`
  (artiste) ; bruit : `shop.spotify.com`, `itunes.apple.com/gb/artist/id…` (terminé), Tidal,
  Qobuz, Amazon. Disque de test : BRAT (édition XW `ab55ac76`). Valeurs des tests : inchangées.
