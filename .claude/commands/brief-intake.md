Génère un brief de projet depuis le formulaire d'intake dont l'ID est : $ARGUMENTS

Étapes :
1. Appelle `generate_brief_from_intake` avec intake_id=$ARGUMENTS pour récupérer les données du formulaire.
2. Rédige un brief de projet structuré en markdown (en français) avec :
   - **Contexte** — qui est le client, quel problème il veut résoudre
   - **Objectifs** — ce que le projet doit accomplir
   - **Périmètre proposé** — fonctionnalités clés
   - **Points à clarifier** — questions à poser au client
   - **Recommandation** — approche technique et forfait suggéré
3. Présente le brief à l'utilisateur.
4. Si l'utilisateur valide, appelle `create_note` avec :
   - source + objective_id depuis `linkedObjective` (si présent dans la réponse)
   - title: "Brief client — {clientName}"
   - content: le brief markdown
   - pinned: true
