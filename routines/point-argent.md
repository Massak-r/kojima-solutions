# Routine — point argent

**Quand** : une fois par semaine, lundi matin. Deux fois par semaine si la
trésorerie est tendue, jamais tous les jours : l'argent bouge trop lentement
pour qu'un point quotidien dise autre chose que la veille.

**Prérequis** : `contexte.md` et `donnees.md`, en particulier le vocabulaire
(« à recevoir » n'est pas « à encaisser ») et le piège `paidAt`.

**Écritures autorisées** : `POST push_reminders.php`, une ligne. Rien d'autre.
**Aucun email, jamais** — cette routine prépare des relances, elle n'en envoie
aucune.

---

## Étape 1 — lire

```sh
GET quotes.php                        # devis ET factures, même table
GET clients.php
GET projects.php                      # rattachement des documents
GET payables.php                      # toutes, on filtrera par statut
GET accounts.php
GET personal_costs.php                # charges fixes, pour le contexte du mois
```

Ignorer partout les documents `isTemplate: true`.

## Étape 2 — calculer les quatre listes

Ce sont exactement celles de `/relances` dans l'app. Mêmes seuils, sinon le
point contredit l'écran.

**1. Devis à relancer** — `docType !== "invoice"` et
`invoiceStatus === "to-validate"`, retenu si la `validityDate` est dépassée
**ou** si le devis a plus de **7 jours**.
Formule : « Expiré depuis N j » ou « Envoyé il y a N j, sans réponse ».

**2. À facturer** — devis `validated` dont la somme des `billedPct` des
factures liées (`sourceQuoteId`) est **< 100**. Le montant en jeu est le
**reste**, pas le total : `total × (100 − déjà facturé) / 100`.

**3. Factures échues** — `docType === "invoice"`, `invoiceStatus === "validated"`,
`validityDate` dépassée. Montant : le total. C'est la liste la plus grave, elle
passe en premier.

**4. Clients refroidis** — clients non archivés, en contact par le passé, sans
mouvement depuis **60 jours**, et **absents des trois listes précédentes**
(quelqu'un qu'on relance déjà n'est pas froid). Un projet terminé ne retire pas
un client de cette liste : seul l'archivage le fait.

**En jeu** = reste à facturer + factures échues. C'est le seul total à
annoncer : ce sur quoi une action de la semaine peut réellement agir.

**Sorties d'argent** : payables `pending` ou `scheduled` à échéance dans les 14
jours, en séparant `committed` (dû) de `forecast` (prévu). Rappel du piège :
une chaîne récurrente peut afficher un doublon hérité d'un import — le signaler
« à vérifier », pas comme un fait.

**Soldes** : `accounts.php`, en distinguant `entreprise` et `perso`. Ne jamais
présenter un solde comme disponible : il faut en retirer les engagements et ce
qui est à mettre de côté (TVA + provision d'impôt).

## Étape 3 — composer

```markdown
## Point argent — lundi 19 août

**En jeu cette semaine : 4 850 CHF**

**Factures échues**
- Anne Rist · FAC-2026-07-002 · 2 400 CHF · échue depuis 31 j

**À facturer**
- Dancefloor · DEV-2026-06-004 · reste 2 450 CHF (acompte 50 % déjà facturé)

**Devis sans réponse**
- Kaleido · DEV-2026-08-001 · envoyé il y a 12 j

**Sorties à venir (14 j)**
- Webflow WD · 35 CHF · le 24.08 (dû)
- Loyer · 850 CHF · le 01.09 (dû)

**Comptes** — entreprise 6 210 CHF · perso 1 940 CHF
Dont à mettre de côté : TVA collectée + provision d'impôt, non calculées ici.

**Clients refroidis** — 2 : Kaleido (74 j), Unitec (91 j)
```

Règles de coupe : trois lignes maximum par liste, la plus ancienne d'abord.
Une liste vide disparaît, sauf « en jeu » qui vaut la peine d'être annoncé à
zéro — « rien à encaisser cette semaine » est une bonne nouvelle explicite.

## Étape 4 — les textes de relance

Pour chaque facture échue et chaque devis sans réponse, proposer **un texte
court, prêt à copier**, regroupé par client (un client relancé deux fois le
même jour, c'est une relance ratée).

Contraintes de rédaction, non négociables :

- Trois à cinq lignes. Le montant, la référence, la date. Une question fermée
  à la fin.
- Ton neutre et cordial. Pas de menace, pas d'excuse non plus.
- **Trait d'union simple, jamais de tiret cadratin** : c'est du texte
  client-facing.
- Ne rien envoyer. Le texte va dans le point, l'envoi est manuel, toujours.

## Étape 5 — livrer

Une ligne poussée, seulement si « en jeu » dépasse zéro ou si une facture est
échue depuis plus de 30 jours. Elle parle de ce qu'on **encaisse**, jamais des
sorties : les grosses sorties ont déjà leur propre alerte automatique, et le
répéter ici ferait sonner le téléphone deux fois pour une seule facture.

> `4 850 CHF en jeu · Anne Rist échue depuis 31 j · 2 devis sans réponse`

`url` : `/relances`.

## Si ça casse

- `quotes.php` indisponible : aucune des quatre listes n'est calculable. Écrire
  `Point argent impossible : les devis ne sont pas accessibles (<code>).` et
  livrer quand même les payables et les soldes, qui ne dépendent pas de lui.
- `clients.php` indisponible : les trois premières listes restent valables,
  seule celle des clients refroidis saute. Le dire, ne pas la remplacer par une
  approximation tirée des devis.
