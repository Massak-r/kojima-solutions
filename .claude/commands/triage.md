Trie les entrées non filées de `.kojima-journal/inbox.md` vers Kojima Solutions via MCP. Argument optionnel : un index ou plage d'entrées à traiter (ex. `1`, `1-3`, `all`). Défaut : toutes les non barrées.

Comportement :
1. Lis `.kojima-journal/inbox.md`. Une "entrée à traiter" = ligne qui commence par `- [ ]` ET n'est PAS entourée de `~~...~~` (les barrées sont déjà filées).
2. Si aucune entrée à traiter : dis-le clairement et arrête.
3. Récupère le contexte en parallèle (un seul tool call par appel) :
   - `mcp__kojima__list_objectives` pour mapper "ça sonne comme l'objectif X"
   - `mcp__kojima__list_projects` pour les destinations type "subtask projet"
4. Pour chaque entrée à traiter, dans l'ordre :
   a. Propose **une** destination concrète + raison, ex. *"Cette ligne 'créer logo SARL' colle à l'objectif SARL > Création SARL en tant que subtask. OK ?"*
   b. Utilise `AskUserQuestion` avec 3-4 options : la destination proposée, 1-2 alternatives plausibles, "garder dans l'inbox" (skip).
   c. Selon le choix :
      - Subtask sous un objectif → `mcp__kojima__create_subtask({ parent_id, text, source: "admin" })`
      - Note d'un projet → `mcp__kojima__create_note({ project_id, content })`
      - Décision → `mcp__kojima__create_decision`
      - Skip → ne rien faire en MCP
   d. Si écriture MCP réussie : barre l'entrée dans `inbox.md` en encadrant le contenu après `- [ ]` avec `~~...~~`. Garde le checkbox `- [ ]` intact pour préserver la mise en forme. Append en fin de ligne ` <!-- filed: <destination-courte> -->`.
   e. Si écriture échoue : laisser l'entrée non barrée, signaler l'erreur, continuer.
5. À la fin, résume : `X triés, Y skippés, Z erreurs`. Liste les destinations en bullets courts.

Règles :
- **Pas de batch silencieux** : une confirmation par entrée. L'utilisateur peut interrompre à tout moment.
- **Si l'entrée est très courte ou ambiguë** (< 5 mots), propose 2-3 destinations et laisse l'utilisateur trancher.
- **Mémoire courte** : si l'utilisateur dicte "tout ce qui parle de devis va dans WD2026" plus tôt dans la session, applique cette règle aux entrées suivantes sans redemander.
