Classifie le document PDF dont l'ID est : $ARGUMENTS

Étapes :
1. Appelle `classify_pdf` avec doc_id=$ARGUMENTS pour récupérer le texte extrait et les métadonnées.
2. Sur la base du nom de fichier, du titre actuel et du texte extrait, détermine :
   - Un titre court et descriptif (max 60 caractères)
   - Une catégorie parmi : Comptabilité, Contrats, Administratif, Technique, RH, Clients, Autre
   - 2–4 tags pertinents
3. Présente ta suggestion à l'utilisateur.
4. Si l'utilisateur valide (ou ne dit rien), appelle `update_admin_doc` avec `{id: doc_id, data: {title, category}}` pour sauvegarder.
