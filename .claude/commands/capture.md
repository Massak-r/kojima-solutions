Capture une idée/todo/note libre dans l'inbox Kojima. Texte (et flag optionnel `--project <slug>`) : $ARGUMENTS

## Comportement

### Chemin principal (MCP disponible)
Si la MCP Kojima est connectée, appelle directement :

```
mcp__kojima__add_inbox_capture({
  text: "<le texte>",
  project_hint: "<slug si --project fourni, sinon omet>",
  source: "admin"
})
```

Confirme à l'utilisateur en UNE ligne : `Capturé dans l'inbox.` Pas besoin de mentionner où ça va — la capture apparaît immédiatement dans le widget /home et sera proposée lors du prochain /triage.

### Chemin de secours (MCP indisponible)
Si l'appel MCP échoue (réseau down, serveur en pause, etc.) :
1. Append à `.kojima-journal/inbox.md` au format `- [ ] YYYY-MM-DD HH:mm — <texte>` (avec le flag `<!-- offline -->` en fin de ligne pour signaler le mode dégradé).
2. Si `--project <slug>` est fourni, append plutôt à `.kojima-journal/projects/<slug>.md` sous `## Avancées` avec `- {date} — <texte>`.
3. Préviens l'utilisateur : `Inbox MCP indisponible. Capturé en local dans <chemin> — sera resync au prochain /triage.`

### Règles
- N'essaie JAMAIS d'écrire dans la DB par d'autres moyens (curl, etc.). MCP ou fichier, point.
- Ne demande aucune confirmation avant d'écrire si le texte est non vide.
- Ne lance JAMAIS /triage automatiquement après /capture — l'utilisateur le fait quand il a 10 min.
