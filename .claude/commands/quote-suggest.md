Propose des lignes de facturation basées sur le temps tracé pour le projet dont l'ID est : $ARGUMENTS

Étapes :
1. Appelle `suggest_quote_lines` avec project_id=$ARGUMENTS pour récupérer le détail des sessions par objectif.
2. Sur la base du breakdown heures/objectif, propose des lignes de devis :
   - Regroupe les tâches similaires si pertinent
   - Arrondi les heures au 0.5h supérieur
   - Tarif standard : 100 CHF/h
   - Descriptions professionnelles et claires
3. Présente les lignes suggérées avec le total estimé en CHF.
4. Si l'utilisateur valide, appelle `create_quote` avec les lignes et les infos projet.
