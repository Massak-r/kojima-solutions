import type { ModuleDefinition } from "@/types/module";

export const MODULE_CATALOG: ModuleDefinition[] = [
  // ─── CONTENT ───────────────────────────────────────────
  {
    id: "blog",
    slug: "blog",
    name: "Blog / Actualités",
    icon: "FileText",
    category: "content",
    description: "Publiez des articles et actualités sur votre site",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "Articles statiques",
        price: 800,
        estimatedHours: 6,
        features: ["Liste d'articles", "Page détail", "Pagination"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "Catégories + recherche",
        price: 1500,
        estimatedHours: 12,
        features: ["Catégories et tags", "Recherche intégrée", "Partage social", "Images optimisées"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Multi-blog + CMS",
        price: 3000,
        estimatedHours: 24,
        features: ["Blogs multiples", "CMS complet", "Planification", "SEO avancé", "Newsletter auto"],
      },
    ],
    taskTemplates: [
      { title: "Design blog", description: "Maquettes pour la liste et la page article", subtasks: ["Layout liste", "Layout article", "Responsive mobile"] },
      { title: "Développement blog", description: "Intégration frontend du blog", subtasks: ["Composant liste", "Composant article", "Pagination", "Filtres"] },
      { title: "Contenu initial", description: "Rédaction et import des premiers articles", subtasks: ["Rédaction 3 articles", "Optimisation images"] },
    ],
    quoteLineDescription: "Blog / Actualités",
    previewType: "blog",
  },
  {
    id: "gallery",
    slug: "gallery",
    name: "Galerie / Portfolio",
    icon: "Image",
    category: "content",
    description: "Présentez vos réalisations et photos en galerie",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "Grille d'images",
        price: 400,
        estimatedHours: 3,
        features: ["Grille responsive", "Lightbox", "Lazy loading"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "Filtrable + lightbox",
        price: 800,
        estimatedHours: 6,
        features: ["Filtres par catégorie", "Lightbox avancée", "Animations", "Téléchargement"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Proofing client + download",
        price: 1800,
        estimatedHours: 14,
        features: ["Espace de validation client", "Téléchargement HD", "Commentaires sur images", "Galeries privées"],
      },
    ],
    taskTemplates: [
      { title: "Design galerie", description: "Maquettes grille et lightbox", subtasks: ["Layout grille", "Vue lightbox", "Filtres"] },
      { title: "Développement galerie", description: "Intégration de la galerie", subtasks: ["Composant grille", "Lightbox", "Optimisation images"] },
    ],
    quoteLineDescription: "Galerie / Portfolio",
    previewType: "gallery",
  },
  {
    id: "map",
    slug: "map",
    name: "Carte / Map",
    icon: "MapPin",
    category: "content",
    description: "Affichez votre emplacement sur une carte interactive",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "Embed statique",
        price: 200,
        estimatedHours: 1,
        features: ["Google Maps embed", "Marqueur unique", "Responsive"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "Interactive + marqueurs",
        price: 500,
        estimatedHours: 4,
        features: ["Carte interactive", "Marqueurs multiples", "Popups info", "Itinéraire"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Store locator + recherche",
        price: 1200,
        estimatedHours: 10,
        features: ["Recherche par adresse", "Filtres par type", "Géolocalisation", "Calcul distance"],
      },
    ],
    taskTemplates: [
      { title: "Intégration carte", description: "Mise en place de la carte interactive", subtasks: ["Configuration API", "Composant carte", "Marqueurs"] },
    ],
    quoteLineDescription: "Carte / Map",
    previewType: "map",
  },

  // ─── INTERACTION ───────────────────────────────────────
  {
    id: "contact-form",
    slug: "contact-form",
    name: "Formulaire de contact",
    icon: "Mail",
    category: "interaction",
    description: "Vos visiteurs vous contactent directement depuis le site",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "Nom / email / message",
        price: 300,
        estimatedHours: 2,
        features: ["3 champs standards", "Validation", "Email de notification"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "Multi-étapes + fichiers",
        price: 600,
        estimatedHours: 5,
        features: ["Formulaire multi-étapes", "Upload fichiers", "Champs conditionnels", "Confirmation email"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Intégration CRM",
        price: 2400,
        estimatedHours: 18,
        features: ["Intégration CRM (HubSpot, Salesforce)", "Workflows automatisés", "Scoring leads", "Dashboard analytics"],
      },
    ],
    taskTemplates: [
      { title: "Design formulaire", description: "Maquettes du formulaire de contact", subtasks: ["Layout formulaire", "États validation", "Confirmation"] },
      { title: "Développement formulaire", description: "Backend + frontend du formulaire", subtasks: ["Composant formulaire", "Validation", "Envoi email", "Tests"] },
    ],
    quoteLineDescription: "Formulaire de contact",
    previewType: "contact-form",
  },
  {
    id: "booking",
    slug: "booking",
    name: "Réservation",
    icon: "CalendarCheck",
    category: "interaction",
    description: "Vos clients réservent un créneau en ligne",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "Widget calendrier",
        price: 500,
        estimatedHours: 4,
        features: ["Calendrier de sélection", "Créneaux horaires", "Email confirmation"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "Disponibilités + notifications",
        price: 1200,
        estimatedHours: 10,
        features: ["Gestion des disponibilités", "Rappels email/SMS", "Annulation en ligne", "Dashboard admin"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Paiement + multi-service",
        price: 2500,
        estimatedHours: 20,
        features: ["Paiement à la réservation", "Multi-services / praticiens", "Récurrence", "API synchronisation"],
      },
    ],
    taskTemplates: [
      { title: "Design réservation", description: "UX du parcours de réservation", subtasks: ["Sélection date", "Sélection créneau", "Confirmation"] },
      { title: "Développement réservation", description: "Système de réservation complet", subtasks: ["Calendrier", "Backend créneaux", "Notifications", "Tests"] },
    ],
    quoteLineDescription: "Système de réservation",
    previewType: "booking",
  },
  {
    id: "newsletter",
    slug: "newsletter",
    name: "Newsletter",
    icon: "Send",
    category: "interaction",
    description: "Vos visiteurs peuvent s'inscrire pour recevoir vos nouvelles",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "Formulaire d'inscription",
        price: 200,
        estimatedHours: 1,
        features: ["Champ email + bouton CTA", "Stockage abonnés", "Double opt-in"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "Configuration outil externe",
        price: 600,
        estimatedHours: 5,
        features: ["Intégration Mailchimp ou Infomaniak Newsletter", "Formulaire connecté", "Listes et segments", "Confirmation automatique"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Configuration avancée + automation",
        price: 1500,
        estimatedHours: 12,
        features: ["Intégration plateforme newsletter au choix", "Workflows d'automation", "Formulaires multi-listes", "Analytics intégrées"],
      },
    ],
    taskTemplates: [
      { title: "Intégration newsletter", description: "Mise en place du système newsletter", subtasks: ["Formulaire inscription", "Backend abonnés", "Template email"] },
    ],
    quoteLineDescription: "Newsletter",
    previewType: "newsletter",
  },
  {
    id: "dashboard",
    slug: "dashboard",
    name: "Tableau de bord",
    icon: "BarChart3",
    category: "interaction",
    description: "Visualisez vos statistiques et données en un coup d'oeil",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "Stats basiques",
        price: 600,
        estimatedHours: 5,
        features: ["Compteurs clés", "Graphiques simples", "Période sélection"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "Charts + filtres",
        price: 1500,
        estimatedHours: 12,
        features: ["Graphiques interactifs", "Filtres avancés", "Export CSV", "Temps réel partiel"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Real-time + exports",
        price: 3500,
        estimatedHours: 28,
        features: ["WebSocket temps réel", "Dashboards personnalisables", "Export PDF/Excel", "Alertes automatiques"],
      },
    ],
    taskTemplates: [
      { title: "Design dashboard", description: "Maquettes du tableau de bord", subtasks: ["Layout widgets", "Composants graphiques", "Responsive"] },
      { title: "Développement dashboard", description: "Intégration des graphiques et données", subtasks: ["API données", "Composants charts", "Filtres", "Export"] },
    ],
    quoteLineDescription: "Tableau de bord",
    previewType: "dashboard",
  },
  {
    id: "chat",
    slug: "chat",
    name: "Chat / Messagerie",
    icon: "MessageCircle",
    category: "interaction",
    description: "Vos visiteurs peuvent vous écrire en direct depuis votre site",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "Widget contact",
        price: 300,
        estimatedHours: 2,
        features: ["Bouton de contact flottant", "Formulaire rapide", "Notification email"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "Live chat",
        price: 800,
        estimatedHours: 6,
        features: ["Chat en temps réel", "Historique conversations", "Indicateur en ligne", "Réponses rapides"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Chatbot IA",
        price: 2000,
        yearlyFee: 480,
        estimatedHours: 16,
        features: ["Chatbot intelligent", "Base de connaissances", "Escalade humaine", "Analytics conversations"],
      },
    ],
    taskTemplates: [
      { title: "Design chat", description: "UI du widget de chat", subtasks: ["Widget flottant", "Fenêtre conversation", "États"] },
      { title: "Développement chat", description: "Intégration du système de chat", subtasks: ["Backend messages", "Frontend widget", "Notifications"] },
    ],
    quoteLineDescription: "Chat / Messagerie",
    previewType: "chat",
  },
  {
    id: "client-portal",
    slug: "client-portal",
    name: "Espace client",
    icon: "UserCircle",
    category: "interaction",
    description: "Vos clients accèdent à leur espace personnel et leurs documents",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "Portail basique",
        price: 800,
        estimatedHours: 6,
        features: ["Connexion sécurisée", "Page profil", "Liste documents", "Historique"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "Documents + messagerie",
        price: 1800,
        estimatedHours: 14,
        features: ["Upload/download fichiers", "Messagerie interne", "Notifications", "Suivi commandes"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Dashboard complet + CRM",
        price: 8000,
        estimatedHours: 60,
        features: ["Dashboard personnalisé", "Intégration CRM", "Workflows", "API tierces", "Analytics client"],
      },
    ],
    taskTemplates: [
      { title: "Design espace client", description: "UX du portail client", subtasks: ["Dashboard", "Liste documents", "Profil", "Messagerie"] },
      { title: "Développement portail", description: "Backend + frontend du portail", subtasks: ["Auth", "API documents", "Interface", "Tests"] },
    ],
    quoteLineDescription: "Espace client",
    previewType: "client-portal",
  },

  // ─── COMMERCE ──────────────────────────────────────────
  {
    id: "ecommerce",
    slug: "ecommerce",
    name: "E-commerce / Boutique",
    icon: "ShoppingBag",
    category: "commerce",
    description: "Vendez vos produits directement sur votre site",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "Catalogue produits",
        price: 1500,
        estimatedHours: 12,
        features: ["Catalogue produits", "Pages produit", "Catégories", "Recherche"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "Panier + paiement",
        price: 3500,
        estimatedHours: 28,
        features: ["Panier d'achat", "Paiement Stripe", "Gestion commandes", "Emails transactionnels"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Shop complet + inventaire",
        price: 8000,
        estimatedHours: 60,
        features: ["Gestion inventaire", "Multi-variantes", "Promotions/codes", "Livraison intégrée", "Dashboard vendeur"],
      },
    ],
    taskTemplates: [
      { title: "Design e-commerce", description: "Maquettes boutique en ligne", subtasks: ["Catalogue", "Page produit", "Panier", "Checkout"] },
      { title: "Développement boutique", description: "Backend + frontend e-commerce", subtasks: ["API produits", "Panier", "Paiement", "Commandes"] },
      { title: "Configuration produits", description: "Import catalogue initial", subtasks: ["Structure catégories", "Fiches produits", "Photos"] },
    ],
    quoteLineDescription: "E-commerce / Boutique",
    previewType: "ecommerce",
  },
  {
    id: "payment",
    slug: "payment",
    name: "Paiement en ligne",
    icon: "CreditCard",
    category: "commerce",
    description: "Acceptez les paiements en ligne par carte bancaire",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "Stripe checkout",
        price: 500,
        estimatedHours: 4,
        features: ["Checkout Stripe", "Paiement unique", "Confirmation email", "Webhook"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "Abonnements + factures",
        price: 1200,
        estimatedHours: 10,
        features: ["Abonnements récurrents", "Factures automatiques", "Portail client", "Gestion plans"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Multi-gateway + split",
        price: 3000,
        estimatedHours: 24,
        features: ["Multi-passerelles", "Split payments", "Marketplace", "Reporting financier"],
      },
    ],
    taskTemplates: [
      { title: "Intégration paiement", description: "Mise en place du système de paiement", subtasks: ["Configuration Stripe", "Checkout flow", "Webhooks", "Tests"] },
    ],
    quoteLineDescription: "Paiement en ligne",
    previewType: "payment",
  },

  // ─── SYSTEM ────────────────────────────────────────────
  {
    id: "auth",
    slug: "auth",
    name: "Authentification",
    icon: "Lock",
    category: "system",
    description: "Vos utilisateurs peuvent créer un compte et se connecter",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "Login basique",
        price: 400,
        estimatedHours: 3,
        features: ["Email + mot de passe", "Inscription", "Mot de passe oublié"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "OAuth + rôles",
        price: 1000,
        estimatedHours: 8,
        features: ["OAuth (Google, GitHub)", "Rôles et permissions", "Profil utilisateur", "Sessions"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "SSO + 2FA",
        price: 5000,
        estimatedHours: 36,
        features: ["SSO entreprise (SAML)", "2FA / MFA", "Audit logs", "Politiques de sécurité", "API tokens"],
      },
    ],
    taskTemplates: [
      { title: "Design auth", description: "Pages login / inscription", subtasks: ["Login", "Inscription", "Reset password", "Profil"] },
      { title: "Développement auth", description: "Système d'authentification complet", subtasks: ["Backend auth", "Frontend pages", "Middleware", "Tests sécurité"] },
    ],
    quoteLineDescription: "Authentification",
    previewType: "auth",
  },
  {
    id: "i18n",
    slug: "i18n",
    name: "Multi-langue",
    icon: "Globe",
    category: "system",
    description: "Votre site disponible en plusieurs langues",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "2 langues",
        price: 500,
        estimatedHours: 4,
        features: ["Français + Anglais", "Sélecteur de langue", "URLs localisées"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "3-5 langues + switcher",
        price: 1000,
        estimatedHours: 8,
        features: ["3-5 langues", "Détection automatique", "SEO multilingue", "Switcher avancé"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Auto-translate + CMS",
        price: 2500,
        yearlyFee: 600,
        estimatedHours: 20,
        features: ["Traduction IA automatique", "CMS multilingue", "Langues illimitées", "Révision humaine", "Glossaire"],
      },
    ],
    taskTemplates: [
      { title: "Configuration i18n", description: "Mise en place du système multilingue", subtasks: ["Framework i18n", "Extraction textes", "Traductions"] },
    ],
    quoteLineDescription: "Multi-langue",
    previewType: "i18n",
  },
  {
    id: "seo",
    slug: "seo",
    name: "SEO",
    icon: "Search",
    category: "system",
    description: "Votre site apparaît plus haut dans les résultats Google",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "Meta + sitemap",
        price: 300,
        estimatedHours: 2,
        features: ["Balises meta", "Sitemap XML", "Robots.txt", "Google Analytics"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "Schema + analytics",
        price: 1400,
        estimatedHours: 10,
        features: ["Schema.org / JSON-LD", "Search Console", "Performance audit", "Rich snippets"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Stratégie complète + audit",
        price: 3000,
        estimatedHours: 22,
        features: ["Audit SEO complet", "Stratégie de contenu", "Backlinks", "Reporting mensuel", "Optimisation continue"],
      },
    ],
    taskTemplates: [
      { title: "Configuration SEO", description: "Mise en place du SEO technique", subtasks: ["Balises meta", "Sitemap", "Schema.org", "Analytics"] },
    ],
    quoteLineDescription: "SEO",
    previewType: "seo",
  },
  {
    id: "backend-admin",
    slug: "backend-admin",
    name: "Backend / Admin",
    icon: "Settings",
    category: "system",
    description: "Gérez le contenu de votre site vous-même",
    tiers: [
      {
        complexity: "simple",
        label: "Simple",
        description: "Dashboard lecture seule",
        price: 400,
        estimatedHours: 3,
        features: ["Vue d'ensemble", "Statistiques basiques", "Export données"],
      },
      {
        complexity: "advanced",
        label: "Avancé",
        description: "Panel CRUD complet",
        price: 1200,
        estimatedHours: 10,
        features: ["Gestion contenu CRUD", "Upload médias", "Utilisateurs", "Filtres et recherche"],
      },
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Workflows + rôles",
        price: 3500,
        estimatedHours: 28,
        features: ["Workflows personnalisés", "Rôles granulaires", "Validation contenu", "Historique modifications", "API REST"],
      },
    ],
    taskTemplates: [
      { title: "Design admin", description: "Maquettes du panneau d'administration", subtasks: ["Dashboard", "Listes CRUD", "Formulaires", "Navigation"] },
      { title: "Développement admin", description: "Backend d'administration complet", subtasks: ["API CRUD", "Interface admin", "Auth admin", "Tests"] },
    ],
    quoteLineDescription: "Backend / Administration",
    previewType: "backend-admin",
  },
  {
    id: "automation",
    slug: "automation",
    name: "Automation",
    icon: "Settings",
    category: "system",
    description: "Automatisez vos tâches répétitives pour gagner du temps",
    tiers: [
      {
        complexity: "custom",
        label: "Sur mesure",
        description: "Évaluation sur devis",
        price: 0,
        estimatedHours: 0,
        features: ["Analyse des processus à automatiser", "Intégrations API tierces", "Workflows personnalisés", "Rapports automatiques"],
      },
    ],
    taskTemplates: [
      { title: "Analyse automation", description: "Identification et conception des processus à automatiser", subtasks: ["Audit processus", "Conception workflows", "Intégrations API", "Tests"] },
    ],
    quoteLineDescription: "Automation",
    previewType: "automation",
  },
];

export const MODULE_CATEGORIES = [
  { id: "all" as const, label: "Tous", icon: "LayoutGrid" },
  { id: "content" as const, label: "Contenu", icon: "FileText" },
  { id: "interaction" as const, label: "Interaction", icon: "MousePointerClick" },
  { id: "commerce" as const, label: "Commerce", icon: "ShoppingBag" },
  { id: "system" as const, label: "Système", icon: "Settings" },
];

export const MAINTENANCE_OPTIONS = [
  { tier: "none" as const, label: "Aucune", price: 0, description: "Pas de maintenance" },
  { tier: "basic" as const, label: "Basique", price: 500, description: "500 CHF/an - Mises à jour et 1h de correction" },
  { tier: "custom" as const, label: "Sur mesure", price: 1000, description: "1'000 CHF/an - 10h d'interventions incluses" },
] as const;

export const COMPLEXITY_LABELS: Record<string, string> = {
  simple: "Simple",
  advanced: "Avancé",
  custom: "Sur mesure",
};

// ── Project type → default module presets ──

export const PROJECT_TYPE_PRESETS: Record<string, { id: string; complexity: "simple" | "advanced" | "custom" }[]> = {
  "webapp": [
    { id: "contact-form", complexity: "advanced" },
    { id: "dashboard", complexity: "advanced" },
    { id: "auth", complexity: "advanced" },
    { id: "backend-admin", complexity: "advanced" },
  ],
  "pme-corporate": [
    { id: "contact-form", complexity: "simple" },
    { id: "blog", complexity: "simple" },
    { id: "gallery", complexity: "simple" },
    { id: "seo", complexity: "simple" },
  ],
  "restaurant": [
    { id: "contact-form", complexity: "simple" },
    { id: "booking", complexity: "simple" },
    { id: "gallery", complexity: "simple" },
    { id: "map", complexity: "simple" },
  ],
  "evenementiel": [
    { id: "contact-form", complexity: "simple" },
    { id: "newsletter", complexity: "simple" },
    { id: "gallery", complexity: "simple" },
  ],
  "landing-page": [
    { id: "contact-form", complexity: "simple" },
    { id: "seo", complexity: "simple" },
  ],
  "autre": [
    { id: "contact-form", complexity: "simple" },
  ],
};

export function getModuleById(id: string): ModuleDefinition | undefined {
  return MODULE_CATALOG.find((m) => m.id === id);
}

export function getModulePrice(moduleId: string, complexity: string): number {
  const mod = getModuleById(moduleId);
  if (!mod) return 0;
  const tier = mod.tiers.find((t) => t.complexity === complexity);
  return tier?.price ?? 0;
}

export function getModuleYearlyFee(moduleId: string, complexity: string): number {
  const mod = getModuleById(moduleId);
  if (!mod) return 0;
  const tier = mod.tiers.find((t) => t.complexity === complexity);
  return tier?.yearlyFee ?? 0;
}
