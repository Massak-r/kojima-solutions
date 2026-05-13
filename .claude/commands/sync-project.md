Synchronise un journal projet local avec son state Kojima Solutions (modules / steps / subtasks) via MCP. Argument : slug ou nom du projet (substring suffit). $ARGUMENTS

Comportement :
1. Si pas d'argument : liste les fichiers présents dans `.kojima-journal/projects/` (en excluant `_template.md`) et demande à l'utilisateur lequel synchroniser. Si un seul fichier, le prendre directement.
2. Localise le projet dans MCP :
   - `mcp__kojima__list_projects` puis match fuzzy sur le slug/nom.
   - Si plusieurs matches : `AskUserQuestion` pour trancher. Si zéro match : abandonne avec message clair.
3. Récupère le state actuel **en parallèle** :
   - `mcp__kojima__get_project({ id })`
   - `mcp__kojima__get_project_modules({ project_id })`
   - `mcp__kojima__list_objectives` (pour repérer un objectif lié)
4. Lis `.kojima-journal/projects/<slug>.md` (le slug exact tel qu'utilisé pour le fichier).
5. **Analyse** : compare le contenu du journal au state structuré. Identifie :
   - **Status changes** : un module/step que le journal décrit comme avancé/terminé mais qui est encore `not_started` ou `in_progress` côté MCP.
   - **Nouvelles subtasks** : une action concrète mentionnée dans le journal (verbe d'action, déliverable) qui n'existe pas encore en MCP.
   - **Décisions** : une décision tranchée (`On part sur X au lieu de Y`) → candidat à `create_decision`.
   - **Doutes ouverts** : items "à valider" ou "?" → garder en note ou créer subtask "à clarifier".
6. **Présente un plan de diffs structuré** :
   ```
   Diff proposé pour <projet> :
     ✓ Module "Backend" → status: in_progress (mentionné le 11 mai)
     + Nouvelle subtask "Auth payload" sous Backend
     + Décision "Garder grille 12 colonnes" (du 12 mai)
     ? "À valider avec le client" → laisse en note ou crée subtask "Demander validation client" ?
   ```
7. **Confirmation par batch** avec `AskUserQuestion` :
   - "Appliquer tout" / "Appliquer une partie (je liste)" / "Annuler"
   - Si "une partie", liste les diffs un par un avec Y/N rapide.
8. **Écris** via MCP :
   - Status modules → `mcp__kojima__save_project_modules` (recalcule l'objet complet avec les nouveaux status)
   - Nouvelles subtasks → `mcp__kojima__create_subtask` (parent_id = objectif lié OU note attachée au projet via `create_note`)
   - Décisions → `mcp__kojima__create_decision({ project_id, ... })`
9. **Audit trail** dans le journal :
   - Ajoute une section `## Sync log` (ou append à celle existante) à la fin du fichier :
     ```
     ### 2026-05-13 — sync
     - Module Backend → in_progress
     - + subtask "Auth payload"
     - + décision "Grille 12 colonnes"
     ```
10. Résume à l'utilisateur en 3 bullets max.

Règles :
- **Read avant write** : toujours `get_project_modules` avant `save_project_modules` pour ne pas écraser des champs non gérés.
- **Idempotence** : si une subtask portant exactement le même texte existe déjà côté MCP, ne pas la dupliquer.
- **Si le journal est vide ou contient uniquement le template** : dis-le et arrête sans rien proposer.
