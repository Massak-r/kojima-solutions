# Données — comment lire et écrire l'état de Kojima

L'API PHP est **la seule source de vérité**. Tout le reste (SPA, MCP, routines)
n'en est qu'un client.

## Deux modes d'accès

| Contexte | Mode | Remarque |
|---|---|---|
| Claude Code au bureau | outils MCP `mcp__kojima__*` | Le serveur MCP proxifie exactement les endpoints ci-dessous. |
| Routine planifiée (cloud) | `curl` sur l'API HTTP | **La MCP locale n'est pas attachable à distance.** C'est du stdio, lié au process. |

Une routine n'essaie donc jamais d'appeler un outil MCP : elle fait du HTTP.

## Authentification

```
Base    : https://kojima-solutions.ch/api/
En-tête : X-API-Key: $KOJIMA_API_KEY
```

La clé vaut `API_SECRET` dans `public/api/config.php` (jamais déployé depuis un
poste de dev, jamais commité). En local elle se lit dans
`tools/mcp-server/.env`. `lib/kojima.sh` gère les deux cas.

Pas de clé, pas de brief : on s'arrête et on le dit. Voir règle 3 du README.

## Ce qui répond à la clé API (vérifié en prod le 19.08.2026)

| Endpoint | Sert à |
|---|---|
| `admin_todos.php` | Objectifs pro/admin (liste plate). |
| `personal_todos.php` | Objectifs perso. |
| `todo_subtasks.php?source=admin` | **Toutes** les sous-tâches admin d'un coup. `&parent_id=<id>` pour cibler un objectif. Idem `source=personal`. |
| `objective_sessions.php?summary=week&all=1` | Focus de la semaine : `totalSec`, `byDay[]`, `byObjective[]`. |
| `subtask_completions.php?source=admin` | Historique de complétion (récurrentes, séries). `source` est **obligatoire**. |
| `inbox.php?status=pending&limit=100` | Captures rapides non triées, sous la forme `{ pendingCount, items[] }`. |
| `clients.php` | Clients. `archived: true` = retiré volontairement, jamais à relancer. |
| `payables.php` | Sorties d'argent. Filtre `?status=pending`, `scheduled`, `paid`, `cancelled`. |
| `accounts.php` | Comptes et soldes. `?type=perso` ou `?type=entreprise`. |
| `personal_costs.php` | Coûts fixes récurrents. |
| `expenses.php` | Charges. `?year=YYYY`. |
| `admin_deadlines.php` | Échéances admin et fiscales, triées `completed ASC, due_date ASC`. |
| `admin_docs.php` | Documents classés (factures fournisseurs, contrats, assurances). |
| `notifications.php?limit=50` | File de notifications in-app. |
| `push_reminders.php?status=upcoming` | Rappels poussés programmés, pas encore partis. |
| `project_profitability.php?project_id=<id>` | Rentabilité d'un projet. |
| `renewals.php` | Renouvellements (vide aujourd'hui). |
| `quotes.php?project_id=<id>` | Devis et factures **d'un projet**. |
| `quotes.php?id=<id>` | Un devis précis. |
| `push_health.php` | État du pipeline de push : abonnements, derniers envois. |

## Ce qui ne répond PAS à la clé API, et le contournement

Trois endpoints exigent un cookie de session admin, que seule la SPA possède —
une routine ne peut pas en obtenir un. Constaté en prod, pas supposé :

| Endpoint | Symptôme | Contournement |
|---|---|---|
| `quotes.php` (liste non scopée) | **HTTP 401** | Lister `projects.php`, puis un `quotes.php?project_id=<id>` par projet. Les devis sans projet restent invisibles : le dire dans le brief plutôt que de laisser croire à un total complet. |
| `projects.php` | Répond 200 mais en **vue client** : `flaggedToday` forcé à `false` sur toutes les tâches, `notes` / `initialQuote` / `revisedQuote` / `invoiceNumber` vidés, projets non-`client` masqués. | Aucun. Une routine ne voit pas les **tâches projet flaggées** : elle raisonne sur les sous-tâches d'objectifs, et signale l'angle mort si le contexte l'exige. |
| `leads.php` | **Erreur fatale PHP** en prod (table absente). | Aucun. Ne pas appeler : la réponse est du HTML d'erreur qui pollue tout parsing. |

Ce sont des limitations serveur, pas des règles produit. Si elles sont
corrigées, **c'est ce tableau qu'il faut mettre à jour en premier**, sinon les
routines continueront à s'auto-censurer sans raison.

## Effets de bord des lectures

Certains GET écrivent. Ce n'est pas un bug, c'est l'auto-guérison de l'app —
mais ça change ce qu'on lit juste après :

- **`GET todo_subtasks.php`** déclenche le rafraîchissement quotidien : sort du
  sprint ce qui a été terminé un jour précédent, re-flague les tâches reportées
  dont la date est arrivée, remet à zéro les récurrentes dues.
  Conséquence directe : **« ce qui a été terminé hier » n'est plus lisible dans
  le sprint**, c'est déjà sorti. Pour l'historique, passer par
  `subtask_completions.php` ou `objective_activity.php`.
- **`GET projects.php`** déflague les tâches projet terminées la veille.
- **`GET admin_deadlines.php`** crée les notifications d'échéance dues.

Aucun de ces effets n'est destructif, et les trois sont idempotents.

## Le piège qui fait raconter n'importe quoi

Un chemin d'API inexistant (faute de frappe, endpoint renommé) **ne renvoie pas
404** : le serveur sert l'index de la SPA, en `HTTP 200` avec
`Content-Type: text/html`. Une routine qui ne vérifie que le code HTTP parsera
donc du HTML comme du JSON, obtiendra un objet vide, et en conclura tranquillement
qu'il n'y a rien à signaler.

Toujours vérifier que la réponse est bien du JSON avant de l'interpréter.
`lib/kojima.sh` le fait déjà et échoue explicitement dans ce cas.

## Sémantique des champs qui comptent

### Sous-tâche (`todo_subtasks.php`)

| Champ | Sens |
|---|---|
| `flaggedToday` | Dans le sprint du jour. C'est *la* définition d'« aujourd'hui ». |
| `sprintTier` | `must` (vraie obligation) ou `nice` (si le temps le permet). Défaut `nice`. |
| `completed` / `completedAt` | Fait, et quand. |
| `dueDate` | `YYYY-MM-DD`, échéance réelle. |
| `scheduledFor` | Reporté à cette date ; le serveur re-flaguera tout seul le jour venu. Ne jamais présenter comme un retard. |
| `recurrence` | `daily` / `weekdays` / `weekly` / `monthly`. Une récurrente ratée ne s'accumule pas, elle revient. |
| `priority` | `low` / `medium` / `high`. |
| `status` | `not_started` / `in_progress` / `done` / `blocked`. **`blocked` se signale toujours** : c'est du travail arrêté, pas du travail lent. |
| `effortSize` | `rapide` / `moyen` / `complexe`. |
| `parentId` | L'objectif porteur. |

### Devis et facture (`quotes.php`) — même table pour les deux

| Champ | Sens |
|---|---|
| `docType` | `quote` (devis) ou `invoice` (facture). |
| `invoiceStatus` | `draft`, `to-validate` (envoyé, en attente de signature), `validated`, `paid`, `on-hold`. |
| `validityDate` | Validité d'un devis. Dépassée = à relancer ou à clore. |
| `sourceQuoteId`, `billingKind`, `billedPct` | Lien acompte/solde vers le devis d'origine. Le « déjà facturé » d'un devis est la **somme des `billedPct`** de ses factures liées. |
| `paidAt` | Date où la case « payé » a été cochée. **Pas** la date bancaire. |
| `isTemplate` | À exclure de tout calcul. |

### Payable (`payables.php`)

`status` ∈ `pending | scheduled | paid | cancelled`, `commitment` ∈
`committed | forecast`, plus `direction`, `dueDate`, `recurrence`.

Marquer un payable récurrent comme payé fait avancer la chaîne d'un cran. Des
chaînes en double subsistent d'anciens imports : un même montant qui apparaît
deux fois n'est pas forcément une erreur de lecture — le signaler comme « à
vérifier », pas comme un fait.

### Échéance admin (`admin_deadlines.php`)

`dueDate`, `remindDays` (fenêtre d'alerte propre à chaque échéance),
`recurring`, `completed`, `category`. La règle d'alerte est
`dueDate - aujourd'hui <= remindDays`, jamais un seuil fixe maison.

## Écritures

Par défaut : **aucune**. Une routine qui écrit sans y être autorisée casse la
confiance dans tout le dispositif.

Écritures permises, uniquement quand le fichier de la routine les nomme :

| Action | Appel |
|---|---|
| Pousser une ligne sur le téléphone | `POST push_reminders.php` avec `{ title (≤ 255 car.), body, url, scheduledAt }`. `scheduledAt` en ISO absolu (`2026-08-20T06:00:00Z`), stocké en UTC par le serveur. |
| Publier le récap hebdo | `POST weekly_recap.php` avec l'en-tête `X-Recap-Upload-Key` (secret distinct de la clé API). Voir `recap-hebdo.md`. |
| Déposer une note pour Massaki | `POST inbox.php` avec `{ text, source: "admin" }` — atterrit dans les captures à trier. Réservé à ce qui doit survivre à la session. |

Interdit sans demande explicite : flagger ou déflagger, créer ou terminer une
sous-tâche, modifier un devis, marquer un payable payé, envoyer un email.

## Dates et fuseau

Le serveur raisonne en heure locale suisse (Europe/Zurich) et les dates du
domaine sont en `YYYY-MM-DD`. Le `scheduledAt` d'un push part en ISO absolu
avec `Z`. Le cron d'envoi tourne à l'heure ronde (envois observés à 08:00 et
12:00, quelques secondes après l'heure) : viser une heure ronde et compter
jusqu'à une heure de latence.
