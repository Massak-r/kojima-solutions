# Routine — brief du jour

**Quand** : du lundi au vendredi, tôt. Viser une exécution vers 06:30-07:00 pour
que la ligne poussée arrive avec le réveil.

**Prérequis** : avoir lu `contexte.md` et `donnees.md`.

**Écritures autorisées** : une seule, `POST push_reminders.php`. Rien d'autre.
Ni flag, ni sous-tâche, ni statut.

---

## Étape 0 — préflight

Vérifier `KOJIMA_API_KEY`. Absente ou refusée par l'API : écrire
`Brief impossible : pas d'accès à l'API (<code HTTP>).` et s'arrêter là. Ne rien
pousser sur le téléphone. Un brief muet est lisible ; un brief inventé, non.

## Étape 1 — lire

Sept appels, tous en lecture, parallélisables :

```sh
GET admin_todos.php
GET personal_todos.php
GET todo_subtasks.php?source=admin
GET todo_subtasks.php?source=personal
GET projects.php                 # pour les tâches projet flaggées
GET admin_deadlines.php
GET inbox.php?status=pending&limit=100
```

Deux appels de plus, seulement s'ils servent une section qu'on gardera :

```sh
GET payables.php?status=pending                 # sorties d'argent proches
GET objective_sessions.php?summary=week&all=1   # tendance de la semaine
```

Ne pas appeler `quotes.php` pour le brief du matin : l'argent bouge trop
lentement pour un point quotidien, et c'est le sujet de `point-argent.md`.

## Étape 2 — calculer

**Le sprint du jour** est **transversal** : il additionne deux sources, et un
brief qui n'en lit qu'une raconte une demi-journée.

- les sous-tâches d'objectifs (`todo_subtasks.php`) où `flaggedToday === true`
  et `completed === false`, admin et perso confondus ;
- les tâches de projet (`projects.php` → `tasks[]`) où `flaggedToday === true`
  et `status !== "completed"`.

Les deux portent `sprintTier` (`must` / `nice`) et comptent dans le même
plafond de 5. Rattacher chaque item à son porteur — l'objectif via `parentId`,
le projet via son titre : une tâche sans son contexte ne veut rien dire.

**L'état du sprint**, à qualifier tout de suite :

| Situation | Ce qu'on écrit |
|---|---|
| 1 à 5 items, au moins un `must` | Rien de spécial, on liste. |
| 0 item un jour ouvré | Proposer **exactement 3** candidats classés par le modèle de priorité de `contexte.md`, avec la mention « à flagger si tu valides ». Ne pas en proposer 10. |
| plus de 5 items | Le dire en une phrase et **nommer celui à sortir** : le moins prioritaire, à échéance la plus lointaine. Proposer, pas décider. |
| que des `nice`, aucun `must` | Une ligne : « aucun must aujourd'hui — jour léger ou sprint pas encore arbitré ? ». Sans jugement. |

**À risque** — au maximum 3 lignes, dans cet ordre de gravité :

1. échéance admin dont `dueDate - aujourd'hui <= remindDays`, non terminée ;
2. sous-tâche `status: "blocked"` (travail arrêté, pas lent) ;
3. sous-tâche `dueDate` dépassée ou à ≤ 3 jours, non flaggée ;
4. sortie d'argent `pending` due dans les 7 jours.

Exclure ce qui porte un `scheduledFor` futur : c'est un report assumé, pas un
retard.

**Le fait notable** — facultatif, et c'est important qu'il le reste. Une seule
ligne, uniquement si elle contredit une attente : un objectif ouvert depuis des
semaines à zéro minute, une récurrente ratée trois fois de suite, une catégorie
qui a absorbé toute la semaine. Rien de saillant : on saute la section. Ne
jamais commenter le temps de focus comme une mesure d'effort (voir le piège
dans `contexte.md`).

## Étape 3 — composer

Format cible, à ajuster mais pas à rallonger :

```markdown
## Mardi 19 août

**D'abord :** relire le cadrage PASC et répondre à Anne (≈ 20 min)

**Sprint — 3/5**
- 🔥 Répondre à Anne Rist sur le périmètre — *Unified PASC website*
- 🔥 Boucler la facture FAC-2026-08-003 — *Kojima Solutions*
- ✨ Trier les 7 captures de l'inbox — *Admin*

**À risque**
- OCAS cotisations sociales : échéance dans 4 jours, rien de flaggé dessus
- « Migrer les DNS » bloqué depuis 9 jours — *Dancefloor*

**Vu dans les chiffres**
Trois semaines que « Comptabilité 2025 » est ouvert sans une seule session.

**Inbox** — 7 captures en attente de tri.
```

Règles de coupe, dans l'ordre où on les applique :

- Le brief tient en **une vue de téléphone**. Si ça déborde, couper « à risque »
  à 2 lignes, puis supprimer « vu dans les chiffres ».
- Chaque item du sprint tient sur **une ligne** : l'action, puis l'objectif en
  italique. Pas de description, pas de sous-puce.
- **« D'abord » est obligatoire et unique.** C'est la seule phrase qui compte.
  Elle nomme une action concrète, faisable en moins de 25 minutes, tirée des
  `must` — ou du plus urgent si le sprint est vide.
- Une section sans contenu **disparaît**. Pas de « À risque : rien à signaler ».
  Sauf le sprint, qui a toujours quelque chose à dire, même vide.

## Étape 4 — livrer

**Le canal, c'est Kojima — pas l'outil de push de la plateforme.**
Un agent planifié dispose d'un outil `PushNotification` qui envoie vers
l'application Claude. Ne pas s'en servir : Massaki ne l'a pas installée, l'outil
répond « Mobile push requested » sans confirmer quoi que ce soit, et le message
n'arrive nulle part — un envoi qui se croit réussi est pire qu'un envoi absent.
Le canal qui marche est le push de Kojima : il arrive sur le téléphone, il est
tracé dans `push_log`, et il ouvre `/jour` d'un tap. Vérifié le 19.08.2026, les
deux côte à côte : l'un reçu, l'autre jamais.

Pousser **une seule ligne** sur le téléphone :

```sh
POST push_reminders.php
{
  "title": "<≤ 255 caractères>",
  "body": "<optionnel, une phrase>",
  "url": "/jour",
  "scheduledAt": "<prochaine heure ronde, ISO avec Z>"
}
```

Le titre est le brief compressé à ce qui déclenche une action :

> `3 must aujourd'hui · d'abord : répondre à Anne (PASC) · OCAS dans 4 j`

`url` pointe sur `/jour`, l'atterrissage mobile. Le brief long reste dans la
session de la routine.

**Ne jamais viser une heure entre 21h et 8h.** Les rappels programmés ignorent
délibérément les heures silencieuses — c'est voulu pour un rappel qu'on s'est
posé soi-même, mais un brief du matin qui arrive à 21h00 est au mieux inutile,
au pire il réveille. Si la prochaine heure ronde tombe dans cette plage, viser
**8h00 le lendemain** : un brief se lit au début d'une journée, pas à la fin
d'une autre. Et si la routine tourne le soir, c'est probablement son horaire qui
est à corriger, pas le brief.

**Ne pas pousser** si : le sprint est vide *et* rien n'est à risque *et*
l'inbox est vide. Il n'y a alors rien à dire, et une notification vide est ce
qui apprend à ignorer les suivantes.

## Le même brief au bureau (mode interactif)

Le hook `SessionStart` déclenche ce même fichier quand Massaki ouvre Claude
Code. Deux différences, et deux seulement :

- **On peut poser une question**, et on la pose : « tu veux ajouter, changer ou
  retirer quelque chose du sprint ? ». Une routine, elle, n'a personne à qui
  demander : elle propose et se tait.
- **On n'envoie pas de push.** Il est déjà devant l'écran.

Tout le reste (données, calculs, format, ton) est identique. C'est le but
d'avoir un seul fichier : les deux briefs ne peuvent pas diverger.

## Si ça casse

- Un appel échoue : composer le brief avec ce qu'on a et ajouter en fin de
  brief `Données manquantes : <endpoint> (<code>)`. Ne jamais combler.
- `leads.php` renvoie une erreur fatale en prod : ne pas l'appeler.
- Tout échoue : une ligne, `Brief impossible ce matin : API injoignable.`
  Aucun push.
