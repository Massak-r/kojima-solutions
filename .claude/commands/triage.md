Trie les captures pendantes de l'inbox Kojima vers les bonnes destinations via MCP. Argument optionnel : un index ou plage à traiter (ex. `1`, `1-3`, `all`). Défaut : toutes les pendantes (max 12 par session pour éviter la fatigue décisionnelle).

## Source principale : DB via MCP

1. Appelle `mcp__kojima__list_inbox_captures({ status: "pending" })`. Si la liste est vide ET aucune ligne pendante dans `.kojima-journal/inbox.md` non plus, dis-le et arrête.
2. Si la MCP est indisponible, bascule en mode dégradé (voir plus bas).

## Contexte (en parallèle)

Récupère pour chaque session de triage :
- `mcp__kojima__list_objectives({ include_completed: false })` pour mapper les destinations possibles
- `mcp__kojima__list_projects()` pour les références projet

## Pour chaque capture pendante

a. Propose **une destination concrète** + raison en 1 ligne. Tiens compte du `project_hint` s'il existe (la capture a été faite depuis une page projet).

b. Utilise `AskUserQuestion` avec 3-4 options :
   - La destination proposée
   - 1-2 alternatives plausibles
   - "Garder pending" (skip)

c. Selon le choix, écris via MCP :
   - **Subtask sous objectif** → `mcp__kojima__create_subtask({ parent_id, text, source })`
   - **Note d'objectif** → `mcp__kojima__create_note({ source, objective_id, content })`
   - **Décision** → `mcp__kojima__create_decision({ source, objective_id, title, rationale })`
   - **Note projet brute** → ajoute à `.kojima-journal/projects/<slug>.md` sous `## Avancées` (en attendant que la prochaine sync structure ça)
   - **Skip** → ne fait rien côté MCP

d. Si l'écriture MCP réussit, appelle `mcp__kojima__mark_capture_triaged({ id, destination })` avec un label audit court (ex. `subtask:PASC 2026 / Email send 16 mai`).

e. Si l'écriture échoue : laisse la capture pending, signale l'erreur, continue avec la suivante.

## Mode dégradé (MCP indisponible)

Fallback sur le legacy file-based :
1. Lis `.kojima-journal/inbox.md`. Pour chaque ligne `- [ ]` non barrée de `~~`, demande à l'utilisateur où la filer (mais tu ne peux que SUGGÉRER — tu ne peux pas écrire via MCP).
2. Pour chaque, après confirmation, encadre le texte de `~~...~~` dans le fichier et append un commentaire ` <!-- pending-resync: <destination-suggérée> -->` en fin de ligne.
3. Avertis l'utilisateur : `MCP down — les destinations sont notées dans inbox.md, à appliquer manuellement ou à reprendre quand la MCP revient.`

## Règles

- **Une confirmation par capture.** Pas de batch silencieux. L'utilisateur peut interrompre à tout moment.
- **Mémoire courte de session :** si l'utilisateur dicte "tout ce qui parle de devis va dans WD2026" plus tôt, applique cette règle aux suivantes sans redemander.
- **Captures très courtes ou ambiguës** (< 5 mots) : propose 2-3 destinations et laisse l'utilisateur trancher.
- **Plafond 12 par session** : si plus de 12 pending, traite les 12 premières et propose de relancer /triage plus tard.
- À la fin, résume : `X triés, Y skippés, Z erreurs`.
