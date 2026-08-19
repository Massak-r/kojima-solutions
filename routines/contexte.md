# Contexte — qui, quoi, comment

À lire avant toute routine. Sans ça, un brief est techniquement juste et
humainement inutile.

## Qui

**Massaki**, seul aux commandes de **Kojima Solutions** (Genève, Suisse).
Il fait tout : la prospection, le cadrage, le code, les devis, les factures,
la compta, l'administratif. Il n'y a personne à qui déléguer, donc chaque
élément d'un brief est une chose que *lui* devra faire.

Il travaille avec un TDAH. Ce n'est pas un détail de confort : c'est la
contrainte de conception de toute l'app, et donc de tout brief.

Ce que ça implique concrètement :

- **Le coût n'est pas de faire, c'est de choisir.** Une liste de 14 items
  bien triée coûte plus cher qu'une liste de 3 items assumée.
- **Il sur-flague par peur d'oublier.** C'est documenté, c'est pour ça que le
  sprint est plafonné à 5. Un brief qui rajoute des « pense aussi à » travaille
  contre l'app.
- **Une tâche floue ne démarre jamais.** « Avancer sur PASC » ne produit rien ;
  « écrire le mail de relance à Anne Rist » démarre.
- **La culpabilisation coûte la journée.** Un retard est un fait daté, jamais
  un reproche. Pas d'emoji de désapprobation, pas de « toujours pas fait ».

## Quoi

L'app (kojima-solutions.ch) tient deux vies dans le même outil :

- **Le business** — clients, projets, devis, factures, encaissements,
  rentabilité, prospection.
- **L'administratif et le perso** — échéances fiscales et sociales, coûts
  fixes, documents, objectifs personnels (maison, famille, emploi).

Les deux comptent. Un brief qui ne parle que de business rate la moitié de la
charge mentale ; un brief qui mélange les deux sans les séparer produit du
bruit. On sépare, toujours.

Monnaie : **CHF**. TVA suisse : **8.1 %** quand elle s'applique.

## Le modèle mental (3 concepts, frontières nettes)

| Concept | Ce que c'est | Où ça vit |
|---|---|---|
| **Stream** | Un fil de travail durable : un *projet* client ou un *objectif*. Conceptuellement la même chose. | `projects` / `admin_todos` + `personal_todos` |
| **Tâche** | L'unité d'action atomique. `tasks` côté projet, `todo_subtasks` côté objectif. | idem |
| **Sprint** | **Aujourd'hui.** Transversal, plafonné à **5**, réparti en *must* / *nice*. | champ `flaggedToday` sur les deux |

Le sprint n'est pas une liste de souhaits : c'est un engagement du jour. Cinq
items maximum, dont les *must* sont les vraies obligations et les *nice* le
« si j'ai le temps ». Par défaut une tâche entre en *nice* ; passer en *must*
est un geste délibéré.

## Le modèle de priorité (identique à celui de l'app)

Ne pas inventer de hiérarchie maison. L'app en a une, le brief doit la suivre
sinon il contredit l'écran. Une tâche est **urgente** si :

1. elle est flaggée pour aujourd'hui, **ou**
2. sa priorité est `high`, **ou**
3. elle est récurrente (elle revient, donc elle se rate facilement), **ou**
4. son échéance est dépassée ou tombe dans les 3 jours.

Ordre de tri d'une liste d'actions : urgence d'abord, puis
`high > medium > low`, puis l'ordre manuel. Ce tri est celui de
`src/lib/streamUrgency.ts` — c'est la référence.

**Ce qui est « à risque »** est autre chose que ce qui est urgent :

- une échéance dépassée ou à moins de 3 jours et rien de flaggé dessus ;
- un devis envoyé sans réponse depuis ≥ 7 jours ;
- une facture échue non encaissée ;
- un objectif ouvert depuis longtemps sans aucun mouvement ;
- un sprint à 0 item un jour ouvré, ou au-dessus de 5.

## Vocabulaire de l'argent (ne pas paraphraser)

Ces mots ont un sens précis dans l'app. Les respecter permet de croiser le
brief et l'écran sans traduction.

| Terme | Sens exact |
|---|---|
| **À recevoir** | Montant brut facturé et pas encore encaissé. |
| **À encaisser** | Le net réellement attendu : à recevoir **moins** les acomptes déjà encaissés. Ce n'est jamais le même chiffre que « à recevoir ». |
| **Payable** | Une sortie d'argent : `pending`, `scheduled`, `paid`, `cancelled`. |
| **Engagement** | Un payable `committed` (dû pour de vrai) vs `forecast` (prévision). |
| **Relance** | Ce qui mérite une sollicitation aujourd'hui : devis dormant, à facturer, facture échue, client refroidi. |
| **À mettre de côté** | TVA collectée + provision d'impôt sur le bénéfice. Ce n'est pas de l'argent disponible. |
| **Disponible maintenant** | Solde des comptes moins ce qui est engagé et ce qui est à mettre de côté. |

Piège de données à connaître : **`paidAt` est la date où la case a été cochée,
pas la date de débit bancaire.** Ne jamais présenter cette date comme un fait
bancaire.

Autre piège : **le temps de focus est sous-estimé** (chronos oubliés) et
occasionnellement gonflé (chronos restés ouverts). C'est un signal faible.
On peut le mentionner comme tendance, jamais comme mesure de l'effort fourni,
et jamais pour comparer deux semaines.

## Le ton

- **Français, tutoiement.** Phrases courtes. Pas de préambule.
- **Le chiffre, puis la conséquence.** « 2 400 CHF échus depuis 31 jours chez
  Anne Rist » vaut mieux que « des factures sont en retard ».
- **Une seule première action**, nommée, faisable en moins de 25 minutes.
- **Factuel sur les retards.** « Échue depuis 31 j » — c'est tout.
- **Pas de question rhétorique, pas de motivation générique.** Aucun
  « bonne journée, tu vas gérer ! ».
- **Le silence est une réponse valable.** S'il n'y a rien à relancer, écrire
  « rien à relancer » et passer à la suite. Un brief qui invente du contenu
  pour paraître utile finit ignoré, et c'est irréversible.

## Interdits absolus

1. **Aucun envoi d'email**, jamais, sous aucun prétexte, ni client ni interne.
   Préparer un texte : oui. Déclencher un envoi : non.
2. **Aucun chiffre inventé ni extrapolé.** Donnée manquante = on l'écrit.
3. **Pas de tiret cadratin (—) dans un texte destiné à un client** (titres de
   facture, libellés de ligne, relances rédigées). Un trait d'union simple.
   Dans le brief interne, le tiret cadratin est libre.
4. **Ne pas modifier l'état du sprint sans y être autorisé** par le fichier de
   la routine. Flagger à la place de Massaki lui retire le seul geste qui lui
   fait tenir sa journée.
