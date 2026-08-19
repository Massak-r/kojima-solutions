# Routine — récap hebdomadaire

**Quand** : dimanche en fin de journée.

**Où ça atterrit** : en haut du brief du lundi matin, dans l'app, sous le titre
« Récap de l'agent dominical ». C'est la seule routine qui écrit dans une
surface que Massaki voit sans rien faire — donc la seule dont la qualité se
paie comptant.

**Prérequis** : `contexte.md`, `donnees.md`.

**Écritures autorisées** : `POST weekly_recap.php`. Rien d'autre. Pas de push :
le récap est fait pour être lu lundi matin, pas pour interrompre un dimanche.

---

## Le piège de la semaine ISO (à lire avant d'écrire du code)

Le récap est publié **dimanche**, mais lu **lundi**. Or une semaine ISO va du
lundi au dimanche : le dimanche est le dernier jour de la semaine N, le lundi
qui suit est le premier jour de la semaine **N+1**.

L'app lit `weekly_recap.php?week=current`, c'est-à-dire la semaine ISO du jour
où on la consulte. Un récap publié dimanche avec **sa propre** semaine ISO n'est
donc **jamais affiché**.

**Poster la semaine ISO de demain**, pas celle d'aujourd'hui. Concrètement :
calculer l'année et la semaine ISO de `aujourd'hui + 1 jour`.

Se relire après coup : `GET weekly_recap.php?year=<Y>&week=<W>` doit répondre
`exists: true`. Si ce n'est pas le cas, le récap n'existe pas, quoi qu'ait
renvoyé le POST.

## Étape 1 — lire

```sh
GET admin_todos.php
GET personal_todos.php
GET todo_subtasks.php?source=admin
GET todo_subtasks.php?source=personal
GET subtask_completions.php?source=admin
GET objective_sessions.php?summary=week&all=1
GET admin_deadlines.php
GET payables.php?status=pending
GET inbox.php?status=pending&limit=100
```

Pour l'argent, le détour par projet de `point-argent.md` si le récap doit
chiffrer quelque chose. Sinon, s'en passer : un récap n'a pas à tout couvrir.

Rappel : lire les sous-tâches déclenche le ménage quotidien, donc « ce qui a
été terminé cette semaine » ne se lit pas dans le sprint. Il se lit dans
`subtask_completions.php`.

## Étape 2 — écrire le récap

Cinq blocs, dans cet ordre, aucun optionnel sauf le dernier :

1. **Ce qui a avancé** — 2 à 4 lignes. Nommer les choses terminées, par
   objectif. C'est le seul endroit du système où le travail fait est dit à voix
   haute ; ne pas l'expédier.
2. **Ce qui a glissé** — 1 à 3 lignes. Factuel. Ce qui était flaggé et ne l'est
   plus, ce qui traîne depuis plusieurs semaines. Pas de « encore une fois ».
3. **La semaine qui vient** — ce qui tombe : échéances, sorties d'argent,
   engagements pris. Des dates, pas des intentions.
4. **Une seule chose à décider** — la question qui bloque plusieurs autres.
   Une, pas trois. Formulée en question fermée.
5. **Un constat**, facultatif — seulement s'il apprend quelque chose. Sinon on
   s'arrête au point 4.

Contraintes de forme, imposées par le rendu (encart réduit en haut d'un
dialogue) :

- **15 lignes maximum**, tout compris.
- Titres en `###` au plus. Pas de `#`, pas de `##`.
- Listes à puces courtes, pas de tableau, pas de bloc de code.
- Markdown standard (GFM). Le gras fonctionne, s'en servir avec parcimonie.

Exemple de calibrage :

```markdown
### Ce qui a avancé
- **PASC** : cadrage validé, 4 étapes fermées.
- **Admin** : cotisations OCAS 2025 réglées.

### Ce qui a glissé
- Le bouclement 2025 n'a pas bougé depuis trois semaines.

### La semaine qui vient
- 22.08 — charges sociales trimestrielles.
- 24.08 — Webflow, 35 CHF.

### À décider
Dancefloor : on facture le solde maintenant ou on attend la mise en ligne ?
```

## Étape 3 — publier

```sh
POST weekly_recap.php
En-tête : X-Recap-Upload-Key: $RECAP_UPLOAD_SECRET
Corps   : { "iso_year": <année ISO de demain>,
            "iso_week": <semaine ISO de demain>,
            "content_md": "<le markdown>" }
```

Le secret est **distinct** de la clé API : il n'autorise que cette écriture-là,
pour que le prompt d'une routine distante puisse le porter sans exposer le
reste. Ne jamais y substituer `KOJIMA_API_KEY`.

Réponses possibles : `401` clé invalide, `503` secret non configuré côté
serveur, `200` avec `created` ou `updated`. Republier écrase le récap de la
même semaine et le fait réapparaître même s'il avait été marqué lu — donc on ne
publie qu'une fois.

Vérifier ensuite avec le `GET` de la section précédente. Un POST qui répond 200
sans que le GET confirme `exists: true` veut dire que la semaine ISO envoyée
n'est pas celle qu'on croit.

## Si ça casse

- `503` : `RECAP_UPLOAD_SECRET` n'est pas configuré dans `config.php` côté
  serveur. Rien à faire depuis la routine, le signaler dans la sortie de
  session.
- `401` : le secret de la routine ne correspond plus à celui du serveur.
- Données partiellement indisponibles : publier quand même, avec les blocs
  qu'on peut remplir. Un récap incomplet et honnête vaut mieux qu'un lundi
  matin vide.
