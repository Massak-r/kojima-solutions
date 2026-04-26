import type { ModuleComplexity } from "@/types/module";

export const TOTAL_STEPS = 5;
export const DRAFT_KEY = "kojima-intake-draft-v2";
export const BASE_PROJECT_COST = 1500;

export const PROJECT_TYPES = [
  { emoji: "🖥️", label: "Web App / Outil interne", slug: "webapp" },
  { emoji: "🏢", label: "PME / Corporate", slug: "pme-corporate" },
  { emoji: "🍽️", label: "Restaurant / Hôtellerie", slug: "restaurant" },
  { emoji: "📅", label: "Événementiel", slug: "evenementiel" },
  { emoji: "📄", label: "Landing page", slug: "landing-page" },
  { emoji: "❓", label: "Autre", slug: "autre" },
];

export const TIMELINE_OPTIONS = [
  { emoji: "⚡", label: "Urgent", sub: "Moins d'1 mois", value: "urgent" },
  { emoji: "📅", label: "Normal", sub: "1 à 3 mois", value: "normal" },
  { emoji: "🌿", label: "Flexible", sub: "3 mois ou plus", value: "flexible" },
];

export const HOSTING_OPTIONS = [
  { value: "simple" as const, label: "Hébergement inclus", sub: "360 CHF/an", yearly: 360 },
  { value: "custom" as const, label: "J'ai déjà un hébergement", sub: "0 CHF/an", yearly: 0 },
];

export const PAGE_COUNT_OPTIONS = [
  { value: "single", label: "Page unique", sub: "Landing page, one-pager", extra: 0 },
  { value: "multi", label: "Multi-pages", sub: "3 à 10 pages", extra: 500 },
  { value: "large", label: "Site étendu", sub: "Plus de 10 pages", extra: 1500 },
];

export const POPULAR_MODULES = new Set(["contact-form", "gallery", "seo", "blog"]);

export const COMPLEXITY_LABELS: Record<ModuleComplexity, string> = {
  simple: "Simple",
  advanced: "Avancé",
  custom: "Sur mesure",
};

export const INTAKE_COMPLEXITY_TIPS: Record<ModuleComplexity, string> = {
  simple: "L'essentiel, fonctionnel et efficace",
  advanced: "Plus de fonctionnalités et de personnalisation",
  custom: "Solution 100% adaptée à vos besoins",
};

export const CATEGORY_LABELS: Record<string, string> = {
  content: "Contenu",
  interaction: "Interaction",
  commerce: "Commerce",
  system: "Système",
};

export function formatCHF(n: number): string {
  return n.toLocaleString("fr-CH");
}
