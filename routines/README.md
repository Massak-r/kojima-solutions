# routines/ — le pack d'instructions des agents planifiés

Ce dossier contient ce qu'il faut savoir pour tenir, **sans humain devant
l'écran**, le rôle que Claude tient au bureau sur kojima-solutions : lire l'état
réel du workspace, trier, hiérarchiser, et rendre un brief qu'on peut suivre.

Une routine (agent planifié Claude Code, qui tourne dans le cloud hors CLI)
démarre à froid : pas de mémoire de session, pas de MCP locale, pas de contexte
implicite. **Tout ce qui lui manque est ici.**

---

## Le prompt d'une routine

Une routine planifiée démarre dans un conteneur **vide** : ni dépôt monté, ni
mémoire, ni MCP. Constaté le 19.08.2026 — `/home/user` vide, aucun `routines/`
nulle part. Le prompt commence donc par aller chercher son propre mode d'emploi.

```
Tu es l'assistant d'organisation de Massaki (Kojima Solutions).

Le dépôt n'est pas monté dans cet environnement. Récupère d'abord ton mode
d'emploi, il est public :

mkdir -p ~/routines/lib && for f in contexte.md donnees.md brief-quotidien.md lib/kojima.sh; do curl -fsSL "https://raw.githubusercontent.com/Massak-r/kojima-solutions/main/routines/$f" -o ~/routines/"$f" || echo "ECHEC: $f"; done

Si un fichier manque, dis-le et arrête-toi : sans mode d'emploi, pas de brief.

Lis ensuite ~/routines/contexte.md et ~/routines/donnees.md, puis exécute
~/routines/brief-quotidien.md.
```

Pour une autre routine, remplacer `brief-quotidien.md` aux deux endroits.
Rien d'autre à écrire dans le prompt : une consigne qui mérite d'être répétée à
chaque exécution a sa place dans un fichier du pack, pas dans le prompt.

**Ni dépôt attaché, ni connecteur Google Drive, ni script de configuration ne
sont nécessaires.** Un agent qui ne trouve pas ses fichiers réclame spontanément
l'un des deux premiers : c'est une fausse piste, le dépôt est public et `curl`
suffit.

Quant au champ « script de configuration » de l'environnement : **le laisser
vide**. Deux tentatives, deux échecs — il s'exécute avant que le dépôt existe
(exit 127), puis il découpe la commande et `curl` part sans URL (exit 2). Et un
champ qui échoue bloque la session entière, donc le garde-fou empêchait le
travail qu'il devait protéger. `lib/setup.sh` reste utile en diagnostic manuel,
et pour le jour où un dépôt sera monté.

Ces fichiers ne contiennent aucun secret — c'est une contrainte de conception,
pas un hasard, et elle doit le rester : les clés arrivent par l'environnement
de la routine, jamais par le dépôt.

**Si tu ajoutes un fichier au pack**, ajoute-le à la liste `FILES` de
`lib/setup.sh` et à la boucle ci-dessus, sinon il n'atterrira jamais dans le
conteneur.

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
  caractères. Le cron le pousse à l'heure ronde suivante, à la seconde près
  (rappel de 13:00 parti à 13:00:14, pulse de 08:00 à 08:00:11). Une ligne, la
  plus utile.
  **Ne jamais utiliser l'outil `PushNotification` de la plateforme** : il vise
  l'application Claude, que Massaki n'a pas, et il répond « Mobile push
  requested » sans confirmer la réception. Les deux ont été comparés le
  19.08.2026 : celui de Kojima est arrivé, l'autre non.
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
