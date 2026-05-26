Traite la file des notes de réunion en attente de processing Claude.

Le bouton **« Envoyer à Claude »** dans `MeetingNoteDrawer` flagge une note avec un `claude_intent` (free-form) et met `claude_requested_at = NOW()`. Cette skill consomme cette file via l'endpoint `GET /api/meeting_notes.php?pending_claude=1`.

## Étapes

1. **Récupérer la file.** Lance un fetch (via Bash, curl, ou si un MCP tool dédié existe : `list_meeting_notes_pending_claude`). L'endpoint retourne un tableau de `MeetingNote` avec les champs `id`, `projectId`, `title`, `content`, `meetingDate`, `claudeIntent`, `claudeRequestedAt`.

2. **Pour chaque note,** lis le `claudeIntent` :
   - "Extraire les actions à faire" → propose une liste de checkboxes à créer comme subtasks sous l'objectif lié au projet (via `mcp__kojima__list_objectives` filtré par `linkedProjectId`, puis `create_subtask` pour chaque action).
   - "Résumer pour le client" → produis un résumé Markdown que tu présentes à l'utilisateur ; il décidera ensuite où le coller (devis description, email, etc.).
   - "Extraire les décisions" → crée des decisions via `create_decision` sur l'objectif lié.
   - "Libre" / autre → suis les instructions du `claudeIntent` text + le contenu de la note. Toujours valider avec l'utilisateur avant d'écrire.

3. **Présente à l'utilisateur** ce que tu comptes créer avant de l'écrire. Toujours demander confirmation. Aucune action automatique.

4. **Une fois la note traitée**, clear le flag :
   ```bash
   curl -X PUT --cookie "kojima_admin_session=$TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"claudeIntent": null}' \
        "https://kojima-solutions.ch/api/meeting_notes.php?id=$NOTE_ID"
   ```

5. **Recap final** : combien de notes traitées, combien de subtasks/décisions créées.

## Garde-fous

- **Toujours demander confirmation** avant d'écrire dans Kojima (memory : `feedback_ux_judgment_trust` permet les taste calls mais pas les écritures silencieuses sur des données client).
- **Ne lance jamais d'email** depuis cette skill (memory : `feedback_no_real_emails`).
- **N'utilise pas l'API Anthropic directement** — toute analyse passe par toi (Claude Code) via MCP (memory : `feedback_no_anthropic_api`).

## Quand l'utilisateur invoque cette skill sans note en attente

Affiche simplement « Aucune note flaggée pour Claude. » et propose à l'utilisateur d'aller sur `/project/:id` → drawer Notes de réunion → bouton ✨ Sparkles à côté d'une note.
