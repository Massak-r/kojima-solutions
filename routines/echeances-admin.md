# Routine — échéances administratives

**Quand** : lundi matin, une fois par semaine. L'administratif suisse se joue en
semaines, pas en heures.

**Prérequis** : `contexte.md`, `donnees.md`.

**Écritures autorisées** : `POST push_reminders.php`, une ligne, et seulement si
quelque chose entre dans sa fenêtre d'alerte cette semaine.

---

## Ce que cette routine apporte de plus que la pulse

La pulse quotidienne de `digest.php` pousse déjà les échéances dues à 08:00.
Répéter ça n'apporte rien. Ce que cette routine fait et qu'elle ne fait pas :

- **anticiper** — ce qui tombe dans 3 à 8 semaines et demande de préparer
  quelque chose maintenant (rassembler des pièces, demander un document,
  provisionner un montant) ;
- **regrouper par domaine** plutôt que par date, parce qu'on traite les
  cotisations sociales en un bloc, pas échéance par échéance ;
- **repérer les trous** — une échéance sans document associé, une obligation
  récurrente qui n'a pas de prochaine occurrence.

## Étape 1 — lire

```sh
GET admin_deadlines.php
GET todo_subtasks.php?source=admin&parent_id=96c0b590-8edf-45b2-a93f-9aff24c2ffd2
GET admin_docs.php
GET payables.php?status=pending
```

Le `parent_id` ci-dessus est l'objectif « Sàrl — Checklists admin », l'id est
stable. C'est lui qui porte les obligations récurrentes du Centre admin.

## Étape 2 — classer

Les domaines, dans l'ordre où on les présente (c'est celui du Centre admin) :
**Salaire**, **Charges sociales**, **Comptabilité**, **TVA (seuil)**,
**Bouclement**, **Impôts**, **Gouvernance (AG)**.

Trois seaux, et un seul seuil par échéance :

| Seau | Règle |
|---|---|
| **En retard** | `dueDate` dépassée, `completed: false`. |
| **À traiter** | `dueDate - aujourd'hui <= remindDays`. La fenêtre est propre à chaque échéance, ne pas la remplacer par un seuil maison. |
| **À préparer** | Au-delà de la fenêtre mais dans les 60 jours, **et** demandant un travail préalable. Sinon ça n'a rien à faire dans le point. |

Les obligations saisonnières (bouclement, impôts, AG) hors saison ne sont pas en
retard : elles sont **hors saison**. Ne pas les colorer en rouge parce que la
date est passée d'un an — elles se répètent.

**La règle d'honnêteté** : sur les domaines dont la vérité vit dans la
comptabilité (salaire réellement comptabilisé, saisie et rapprochement, seuil
TVA réel), l'app ne dit jamais « en règle » ni « en faute » — elle dit
« à confirmer ». Une routine s'aligne : elle constate ce que Kojima sait, et
nomme ce qu'elle ne peut pas savoir. Personne n'a besoin d'un agent qui déclare
une conformité qu'il n'a pas vérifiée.

## Étape 3 — composer

```markdown
## Échéances admin — semaine du 19 août

**En retard**
- OCAS · cotisations sociales 2025 (1er acompte) · échue depuis 6 j

**À traiter cette semaine**
- Charges sociales · déclaration trimestrielle · le 22.08 (dans 3 j)

**À préparer**
- Bouclement 2025 · le 30.09 · rassembler les relevés bancaires manquants
  (2 mois absents des documents)

**À confirmer**
Salaire et comptabilité : Kojima ne sait pas si c'est comptabilisé. Statut réel
côté compta.
```

Une seule ligne par échéance : l'objet, la date, le nombre de jours. Le
« comment faire » n'a pas sa place ici — il vit dans le Centre admin.

## Étape 4 — livrer

Pousser seulement s'il y a du retard ou une échéance dans les 7 jours :

> `OCAS échue depuis 6 j · charges sociales le 22.08`

`url` : `/admin`.

Rien dans la fenêtre : ne rien pousser. Une semaine sans échéance est une bonne
semaine, elle n'a pas besoin d'être annoncée sur un téléphone.
