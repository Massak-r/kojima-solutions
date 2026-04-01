-- ============================================================
-- Decision Flow — Production Templates Seed
-- Run: mysql -h HOST -u USER -p DB_NAME < seed_templates.sql
-- Safe to re-run: uses INSERT IGNORE (idempotent)
-- ============================================================

-- ── 1. Site Vitrine (Essentiel) ──────────────────────────────
INSERT IGNORE INTO project_templates (id, name, description, icon, default_tier, budget_range_min, budget_range_max, phases_json) VALUES (
  'tpl-site-vitrine-001',
  'Site Vitrine',
  'Site de présentation classique : stratégie, design, développement, lancement. Idéal pour PME, indépendants ou portfolios.',
  'Globe',
  'essentiel',
  2500, 6000,
  '[
    {
      "title": "Stratégie & Contenu",
      "budget": 800,
      "gates": [
        {
          "title": "Direction artistique",
          "description": "Choisir le style visuel parmi 3 propositions (couleurs, typographies, ambiance)",
          "gateType": "choice",
          "revisionLimit": 2,
          "options": [
            { "title": "Moderne & Épuré", "description": "Lignes fines, beaucoup de blanc, typographie sans-serif", "isRecommended": true },
            { "title": "Chaleureux & Organique", "description": "Tons terre, formes arrondies, typographie humaniste" },
            { "title": "Corporate & Structuré", "description": "Grille stricte, bleu/gris, typographie classique" }
          ]
        },
        {
          "title": "Structure du contenu",
          "description": "Valider l arborescence des pages et la hiérarchie de l information",
          "gateType": "approval",
          "revisionLimit": 2
        },
        {
          "title": "Mots-clés SEO",
          "description": "Approuver la liste des mots-clés cibles pour le référencement naturel",
          "gateType": "approval",
          "revisionLimit": 1
        }
      ]
    },
    {
      "title": "Design",
      "budget": 1200,
      "gates": [
        {
          "title": "Maquette homepage",
          "description": "Choisir le design de la page d accueil parmi 2 propositions",
          "gateType": "choice",
          "revisionLimit": 2,
          "options": [
            { "title": "Option A — Hero plein écran", "description": "Grande image hero avec CTA central, sections empilées", "isRecommended": true },
            { "title": "Option B — Split layout", "description": "Texte à gauche, visuel à droite, navigation rapide" }
          ]
        },
        {
          "title": "Maquettes pages internes",
          "description": "Valider les maquettes des pages secondaires (À propos, Services, Contact)",
          "gateType": "approval",
          "revisionLimit": 2
        },
        {
          "title": "Revue responsive",
          "description": "Valider le rendu sur mobile, tablette et desktop",
          "gateType": "approval",
          "revisionLimit": 1
        }
      ]
    },
    {
      "title": "Développement",
      "budget": 1500,
      "gates": [
        {
          "title": "Version bêta",
          "description": "Tester le site en ligne sur un lien de preview. Vérifier navigation, contenus et formulaires",
          "gateType": "approval",
          "revisionLimit": 2
        },
        {
          "title": "Ajustements",
          "description": "Soumettre les retours finaux sur la bêta (textes, images, alignements)",
          "gateType": "feedback",
          "revisionLimit": 3
        },
        {
          "title": "Performance & accessibilité",
          "description": "Valider les scores Lighthouse (performance > 90, accessibilité > 90)",
          "gateType": "approval",
          "revisionLimit": 1
        }
      ]
    },
    {
      "title": "Lancement",
      "budget": 500,
      "gates": [
        {
          "title": "Contenu final",
          "description": "Confirmer que tous les textes, images et liens sont corrects avant publication",
          "gateType": "approval",
          "revisionLimit": 1
        },
        {
          "title": "Mise en ligne",
          "description": "Approuver la mise en production du site sur le domaine définitif",
          "gateType": "approval",
          "revisionLimit": 1
        }
      ]
    }
  ]'
);

-- ── 2. Site Événementiel (Essentiel) ──────────────────────────
INSERT IGNORE INTO project_templates (id, name, description, icon, default_tier, budget_range_min, budget_range_max, phases_json) VALUES (
  'tpl-evenementiel-001',
  'Site Événementiel',
  'Site pour événement, festival, conférence ou soirée : programme, inscriptions, compte à rebours. Clé en main.',
  'PartyPopper',
  'essentiel',
  2000, 5000,
  '[
    {
      "title": "Stratégie & Contenu",
      "budget": 600,
      "gates": [
        {
          "title": "Direction visuelle",
          "description": "Choisir le style graphique de l événement parmi les propositions",
          "gateType": "choice",
          "revisionLimit": 2,
          "options": [
            { "title": "Élégant & Sobre", "description": "Tons foncés, typographie fine, ambiance premium", "isRecommended": true },
            { "title": "Festif & Coloré", "description": "Couleurs vives, formes dynamiques, énergie" },
            { "title": "Nature & Organique", "description": "Tons verts/terre, textures, ambiance outdoor" }
          ]
        },
        {
          "title": "Structure du site",
          "description": "Valider les sections : programme, intervenants, lieu, inscriptions, FAQ",
          "gateType": "approval",
          "revisionLimit": 2
        }
      ]
    },
    {
      "title": "Design & Développement",
      "budget": 1800,
      "gates": [
        {
          "title": "Maquette page principale",
          "description": "Choisir le design de la page d accueil de l événement",
          "gateType": "choice",
          "revisionLimit": 2,
          "options": [
            { "title": "Hero immersif + compte à rebours", "description": "Grande image, countdown animé, programme en timeline", "isRecommended": true },
            { "title": "Layout compact", "description": "Infos clés en haut, sections empilées, inscription rapide" }
          ]
        },
        {
          "title": "Formulaire d inscription",
          "description": "Valider le parcours d inscription (champs, options, confirmation)",
          "gateType": "approval",
          "revisionLimit": 2
        },
        {
          "title": "Version bêta",
          "description": "Tester le site complet et soumettre les retours",
          "gateType": "feedback",
          "revisionLimit": 3
        }
      ]
    },
    {
      "title": "Lancement",
      "budget": 500,
      "gates": [
        {
          "title": "Contenu final",
          "description": "Confirmer tous les textes, dates, liens et visuels avant publication",
          "gateType": "approval",
          "revisionLimit": 1
        },
        {
          "title": "Mise en ligne",
          "description": "Approuver la publication du site événementiel",
          "gateType": "approval",
          "revisionLimit": 1
        }
      ]
    }
  ]'
);

-- ── 3. Web App / Outil Interne (Professionnel) ───────────────
INSERT IGNORE INTO project_templates (id, name, description, icon, default_tier, budget_range_min, budget_range_max, phases_json) VALUES (
  'tpl-webapp-001',
  'Web App / Outil Interne',
  'Application web sur mesure : dashboard, gestion de données, workflows. Pour startups ou équipes internes.',
  'LayoutDashboard',
  'professionnel',
  8000, 25000,
  '[
    {
      "title": "Cadrage & Spécifications",
      "budget": 2000,
      "gates": [
        {
          "title": "User stories",
          "description": "Valider la liste des fonctionnalités et scénarios utilisateur prioritaires",
          "gateType": "approval",
          "revisionLimit": 2
        },
        {
          "title": "Architecture technique",
          "description": "Approuver le choix technique (stack, hébergement, bases de données, intégrations)",
          "gateType": "approval",
          "revisionLimit": 1
        },
        {
          "title": "Priorisation des fonctionnalités",
          "description": "Choisir le périmètre du MVP parmi les options proposées",
          "gateType": "choice",
          "revisionLimit": 1,
          "options": [
            { "title": "MVP Essentiel", "description": "Core features uniquement : auth, CRUD principal, dashboard basique", "isRecommended": true },
            { "title": "MVP Étendu", "description": "Core + notifications, exports, rôles utilisateurs" },
            { "title": "MVP Complet", "description": "Toutes les fonctionnalités phase 1, y compris intégrations tierces" }
          ]
        }
      ]
    },
    {
      "title": "UX / UI Design",
      "budget": 3000,
      "gates": [
        {
          "title": "Wireframes",
          "description": "Choisir la structure des écrans principaux parmi les propositions",
          "gateType": "choice",
          "revisionLimit": 2,
          "options": [
            { "title": "Layout sidebar", "description": "Navigation latérale fixe, contenu principal à droite", "isRecommended": true },
            { "title": "Layout top-nav", "description": "Navigation horizontale en haut, contenu pleine largeur" }
          ]
        },
        {
          "title": "Design system",
          "description": "Valider les composants UI (boutons, formulaires, cartes, couleurs, typographies)",
          "gateType": "approval",
          "revisionLimit": 2
        },
        {
          "title": "Revue prototype",
          "description": "Tester le prototype interactif et soumettre les retours",
          "gateType": "feedback",
          "revisionLimit": 3
        }
      ]
    },
    {
      "title": "Sprint 1 — MVP",
      "budget": 5000,
      "gates": [
        {
          "title": "Démo fonctionnalités core",
          "description": "Tester les fonctionnalités principales sur l environnement de staging",
          "gateType": "approval",
          "revisionLimit": 2
        },
        {
          "title": "Retours & ajustements",
          "description": "Soumettre les bugs et améliorations à apporter avant la phase suivante",
          "gateType": "feedback",
          "revisionLimit": 3
        }
      ]
    },
    {
      "title": "Sprint 2 & Finalisation",
      "budget": 4000,
      "gates": [
        {
          "title": "Fonctionnalités secondaires",
          "description": "Valider les fonctionnalités additionnelles (notifications, exports, rôles)",
          "gateType": "approval",
          "revisionLimit": 2
        },
        {
          "title": "Tests & QA",
          "description": "Confirmer que tous les scénarios critiques fonctionnent correctement",
          "gateType": "approval",
          "revisionLimit": 1
        },
        {
          "title": "Déploiement production",
          "description": "Approuver la mise en production de l application",
          "gateType": "approval",
          "revisionLimit": 1
        }
      ]
    }
  ]'
);

-- ── 4. Landing Page (Essentiel) ──────────────────────────────
INSERT IGNORE INTO project_templates (id, name, description, icon, default_tier, budget_range_min, budget_range_max, phases_json) VALUES (
  'tpl-landing-page-001',
  'Landing Page',
  'Page d atterrissage conversion : stratégie CTA, design percutant, A/B testing. Pour campagnes marketing ou lancements.',
  'Rocket',
  'essentiel',
  1500, 3500,
  '[
    {
      "title": "Stratégie & Contenu",
      "budget": 500,
      "gates": [
        {
          "title": "Objectif & CTA",
          "description": "Valider l objectif principal (inscription, achat, contact) et le call-to-action",
          "gateType": "approval",
          "revisionLimit": 2
        },
        {
          "title": "Contenu & Copywriting",
          "description": "Soumettre vos retours sur les textes, accroches et arguments de vente",
          "gateType": "feedback",
          "revisionLimit": 3
        }
      ]
    },
    {
      "title": "Design & Développement",
      "budget": 1500,
      "gates": [
        {
          "title": "Maquette landing page",
          "description": "Choisir le design de la page parmi 2 propositions",
          "gateType": "choice",
          "revisionLimit": 2,
          "options": [
            { "title": "Long-form storytelling", "description": "Page longue avec sections narratives, témoignages, preuves sociales", "isRecommended": true },
            { "title": "Short & direct", "description": "Page courte, hero + bénéfices + CTA, conversion rapide" }
          ]
        },
        {
          "title": "Développement",
          "description": "Valider la version développée (animations, formulaire, responsive)",
          "gateType": "approval",
          "revisionLimit": 2
        },
        {
          "title": "A/B test setup",
          "description": "Approuver les variantes A/B à tester (titres, CTA, couleurs)",
          "gateType": "approval",
          "revisionLimit": 1
        }
      ]
    },
    {
      "title": "Lancement",
      "budget": 500,
      "gates": [
        {
          "title": "Revue finale",
          "description": "Vérification complète : liens, formulaires, tracking, vitesse de chargement",
          "gateType": "approval",
          "revisionLimit": 1
        },
        {
          "title": "Mise en ligne",
          "description": "Approuver la publication de la landing page",
          "gateType": "approval",
          "revisionLimit": 1
        }
      ]
    }
  ]'
);
