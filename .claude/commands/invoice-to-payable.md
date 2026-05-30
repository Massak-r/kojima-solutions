Crée un payable (Trésorerie → À payer) depuis la facture fournisseur dont l'ID de document est : $ARGUMENTS

Contexte : l'extraction heuristique in-app (bouton « Payable » sur une carte de tri) suffit pour les factures simples. Lance cette commande quand elle se trompe ou quand la facture est complexe — tu lis le texte toi-même et tu remplis mieux les champs.

Étapes :
1. Appelle `classify_pdf` avec doc_id=$ARGUMENTS pour récupérer le texte extrait et le nom de fichier.
2. Analyse le texte et détermine :
   - **Fournisseur** (émetteur de la facture) → libellé `Facture <fournisseur>`.
   - **Montant total à payer** (le TTC / « net à payer »), en CHF. Ignore les sous-totaux et la TVA isolée.
   - **Échéance** : la date « payable au / échéance / due », au format `YYYY-MM-DD`. Si seule une date de facture + un délai (« 30 jours ») figurent, calcule l'échéance. Sinon `null`.
   - **Catégorie** courte (ex. Logiciel, Hébergement, Assurance, Sous-traitance, Matériel, Télécom).
   - **IBAN** et **référence QR** (27 chiffres) ou numéro de facture, s'ils sont présents.
3. Présente le payable proposé à l'utilisateur : libellé, montant, échéance, catégorie. Signale ce dont tu n'es pas sûr.
4. Si l'utilisateur valide (ou ne dit rien), appelle `create_payable` avec :
   ```json
   {
     "data": {
       "label": "<libellé>",
       "amount": <nombre>,
       "currency": "CHF",
       "direction": "out",
       "commitment": "committed",
       "dueDate": "<YYYY-MM-DD ou null>",
       "status": "pending",
       "category": "<catégorie>",
       "notes": "Depuis « <titre du doc> »<si IBAN/réf : · IBAN … · réf …>"
     }
   }
   ```
   - `direction` reste `out` (c'est une dépense fournisseur).
   - `commitment` = `committed` (facture due = obligatoire) ; mets `forecast` seulement si c'est une estimation non confirmée.
   - Si la facture est récurrente (abonnement mensuel/annuel), propose d'ajouter `recurrence` (`monthly`/`yearly`) + `recurrenceDay`, mais demande confirmation d'abord.
5. Confirme la création et rappelle de vérifier dans Trésorerie → À payer.
