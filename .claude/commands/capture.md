Capture une note libre dans `.kojima-journal/`. Texte (et flag optionnel `--project <slug>`) : $ARGUMENTS

Comportement :
1. Parse l'argument :
   - Si `--project <slug>` est présent, la cible est `.kojima-journal/projects/<slug>.md`. Si le fichier n'existe pas encore, copie d'abord `.kojima-journal/projects/_template.md` en remplaçant `{Nom du projet}` par le slug, puis ajoute le contenu.
   - Sinon la cible est `.kojima-journal/inbox.md`.
2. Construis l'entrée à ajouter :
   - Horodatage local format `YYYY-MM-DD HH:mm` (utilise la timezone système).
   - Format ligne pour `inbox.md` : `- [ ] {timestamp} — {texte}`
   - Format paragraphe pour un journal projet : sous la section `## Avancées`, ajoute `- {date} — {texte}`. Si la section n'existe pas, l'ajouter à la fin du fichier.
3. Append au fichier cible (jamais d'écrasement). Préserve les sauts de ligne existants.
4. Confirme à l'utilisateur en une ligne : `Capturé dans <chemin> à <timestamp>`.

Pas d'appel MCP — pure écriture fichier. Marche offline. Ne demande aucune confirmation avant d'écrire si le texte est non vide.
