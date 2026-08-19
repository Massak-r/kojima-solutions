# routines/ — le pack d'instructions des agents planifiés

Ce dossier contient ce qu'il faut savoir pour tenir, **sans humain devant
l'écran**, le rôle que Claude tient au bureau sur kojima-solutions : lire l'état
réel du workspace, trier, hiérarchiser, et rendre un brief qu'on peut suivre.

Une routine (agent planifié Claude Code, qui tourne dans le cloud hors CLI)
démarre à froid : pas de mémoire de session, pas de MCP locale, pas de contexte
implicite. **Tout ce qui lui manque est ici.**

---

## Le prompt d'une routine

Il tient en deux lignes. Il ne décrit pas le travail, il pointe ici :

```
Tu es l'assistant d'organisation de Massaki (Kojima Solutions).
Lis routines/README.md, routines/contexte.md et routines/donnees.md,
puis exécute routines/brief-quotidien.md.
```

Remplacer le dernier fichier selon la routine voulue. Rien d'autre à écrire
dans le prompt : si une consigne mérite d'être répétée à chaque exécution,
c'est qu'elle a sa place dans un fichier de ce dossier, pas dans le prompt.

### Où la routine trouve ces fichiers

Un environnement cloud n'a **pas** de dépôt attaché : constaté le 19.08.2026,
`/home/user` vide, aucun clone nulle part sur le système. Le conteneur tourne
chez Anthropic et n'a évidemment aucun accès à la machine de Massaki.

Le script de démarrage (`lib/setup.sh`) résout ça : il télécharge le pack depuis
le dépôt public dans `~/routines`. La routine lit donc de vrais fichiers, avec
les outils habituels, sans avoir à deviner une URL.

Le prompt référence ce chemin :

```
Tu es l'assistant d'organisation de Massaki (Kojima Solutions).
Lis ~/routines/README.md, ~/routines/contexte.md et ~/routines/donnees.md,
puis exécute ~/routines/brief-quotidien.md.
```

Si le dépôt *est* monté, `setup.sh` le détecte et ne télécharge rien : le pack
du dépôt fait foi, et la routine lit `routines/` depuis la racine du dépôt.
Le script annonce le chemin retenu à chaque démarrage.

En dernier recours, les fichiers restent lisibles en HTTP :
`https://raw.githubusercontent.com/Massak-r/kojima-solutions/main/routines/<fichier>.md`

Ces fichiers ne contiennent aucun secret — c'est une contrainte de conception,
pas un hasard, et elle doit le rester : les clés arrivent par l'environnement
de la routine, jamais par le dépôt.

**Si tu ajoutes un fichier au pack**, ajoute-le à la liste `FILES` de
`lib/setup.sh`, sinon il n'atterrira jamais dans le conteneur.

## Ce qu'il faut fournir à la routine

Une seule variable d'environnement, à poser en secret dans la config de la
routine (jamais dans le dépôt) :

| Variable | Valeur | Requis |
|---|---|---|
| `KOJIMA_API_KEY` | même valeur que `API_SECRET` dans `public/api/config.php` | oui |
| `KOJIMA_API_BASE` | défaut `https://kojima-solutions.ch` | non |
| `RECAP_UPLOAD_SECRET` | uniquement pour `recap-hebdo.md` | non |

En local (Claude Code au bureau), la clé est déjà dans
`tools/mcp-server/.env` — `lib/kojima.sh` la retrouve tout seul.

**Sans clé, une routine ne devine pas : elle dit qu'elle n'a pas pu lire et
elle s'arrête.** Un brief inventé est pire que pas de brief.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `contexte.md` | Qui est Massaki, ce qu'est Kojima, le vocabulaire, le modèle de priorité, le ton. **À lire en premier, toujours.** |
| `donnees.md` | Comment lire et écrire les données : MCP en local, HTTP ailleurs. Carte des endpoints, sémantique des champs, pièges. |
| `brief-quotidien.md` | Routine : le brief du matin (lun-ven). |
| `point-argent.md` | Routine : relances, encaissements, sorties à venir. |
| `echeances-admin.md` | Routine : échéances administratives et fiscales. |
| `recap-hebdo.md` | Routine : le récap dominical, publié dans l'app. |
| `lib/kojima.sh` | Helper curl (résolution de clé, GET/POST). Optionnel mais recommandé. |

## Les règles d'or

1. **Lecture par défaut.** Une routine lit. Elle n'écrit que ce que son fichier
   l'autorise explicitement à écrire (liste blanche par routine). Rien d'autre.
2. **Jamais d'email.** Aucune routine ne déclenche d'envoi, ni client ni interne.
   Elle peut préparer un texte de relance ; l'envoi reste manuel.
3. **Pas de chiffre inventé.** Si un appel échoue, la section correspondante dit
   « donnée indisponible » et le brief continue. On ne comble jamais un trou.
4. **Pas de culpabilisation.** Un retard est un fait, pas un reproche. Voir le
   ton dans `contexte.md` — c'est la règle qui compte le plus.
5. **Court.** Un brief se lit sur un téléphone en 40 secondes. Ce qui ne tient
   pas là-dedans n'est pas du brief, c'est de l'archive.
6. **Une routine ne pose pas de question.** Personne ne répondra. Là où le mode
   interactif demanderait un arbitrage, la routine propose et laisse trancher
   plus tard.

## Ce qui tourne déjà côté serveur (ne pas doublonner)

- **`digest.php`** — cron horaire. Envoie une *pulse admin* poussée sur le
  téléphone, une fois par jour à 08:00, composée uniquement des données du
  Centre admin (échéances + sprint + argent, en alternance). Court, factuel,
  pas de raisonnement. Le brief d'une routine est l'autre moitié : le
  raisonnement, la hiérarchisation, le « pourquoi celui-là d'abord ».
- **`todo_subtasks.php`** — dégage tout seul du sprint ce qui a été terminé la
  veille et re-flague les récurrentes. Aucune routine n'a à faire ce ménage.
- **Hook `SessionStart`** (`tools/scripts/morning-briefing.sh`) — le pendant
  interactif, au bureau. Il pointe sur les mêmes fichiers que les routines,
  pour que les deux briefs ne divergent jamais.

## Livrer le résultat

Une routine produit du texte dans sa propre session. Personne ne va le lire
spontanément. Pour que ça atterrisse quelque part :

- **Sur le téléphone** — `POST /api/push_reminders.php` avec un titre ≤ 255
  caractères. Le cron le pousse à l'heure ronde suivante (observé : envois à
  08:00 et 12:00, quelques secondes après l'heure). Une ligne, la plus utile.
- **Dans l'app** — `POST /api/weekly_recap.php` (hebdo uniquement) s'affiche en
  haut du brief du lundi. Voir `recap-hebdo.md`.
- Il n'existe pas encore de surface *quotidienne* dans l'app pour un brief
  rédigé. Tant qu'elle n'existe pas, le brief long vit dans la session de la
  routine et seule la ligne poussée arrive à Massaki. Le dire, ne pas faire
  semblant.

## Maintenance

Ces fichiers décrivent un système qui bouge. Quand un endpoint, un statut ou
une règle métier change, `donnees.md` est le premier fichier à corriger — une
routine qui lit une carte périmée produit un brief faux avec aplomb.
