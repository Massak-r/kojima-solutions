/**
 * Une nomenclature unique pour l'argent qui sort.
 *
 * Les payables et les coûts récurrents ont toujours stocké leur catégorie en
 * texte libre, et ça a dérivé exactement comme on pouvait le craindre : « Frais
 * admin » cohabite avec « Fais admin » (faute de frappe), « Maison » avec
 * « Logement », « Taxe » avec « Impots », « Charges » avec « Charges sociales ».
 * Impossible d'additionner quoi que ce soit de fiable là-dessus.
 *
 * Plutôt qu'une migration risquée sur des données financières, la normalisation
 * se fait **à la lecture** : le texte historique reste en base, et tout ce qui
 * agrège passe par resolveMoneyCategory(). Rien à casser, et les anciennes
 * saisies se rangent toutes seules.
 */

export type MoneyCategory =
  | "logement" | "assurance" | "sante" | "taxes" | "social"
  | "telecom" | "banque" | "entreprise" | "formation" | "autre";

export const MONEY_CATEGORY_LABELS: Record<MoneyCategory, string> = {
  logement:   "Logement",
  assurance:  "Assurances",
  sante:      "Santé",
  taxes:      "Impôts & taxes",
  social:     "Charges sociales",
  telecom:    "Télécom",
  banque:     "Frais bancaires",
  entreprise: "Entreprise",
  formation:  "Formation",
  autre:      "Autre",
};

/** Ordre d'affichage quand les montants sont à égalité (et ordre du sélecteur). */
export const MONEY_CATEGORIES: MoneyCategory[] = [
  "logement", "assurance", "sante", "taxes", "social",
  "telecom", "banque", "entreprise", "formation", "autre",
];

/** Sans accents, en minuscules, espaces compactés — pour comparer du texte saisi. */
function fold(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// L'ordre compte : « charges sociales » doit gagner avant que « charges » ne
// l'attrape pour l'entreprise.
const RULES: { match: RegExp; category: MoneyCategory }[] = [
  { match: /charge[s]? sociale|avs|ocas|lpp|laa/, category: "social" },
  { match: /logement|maison|loyer|electricite|energie/, category: "logement" },
  { match: /assurance|lamal|mutuelle|3b|prevoyance/, category: "assurance" },
  { match: /sante|medecin|pharmacie|dentiste/, category: "sante" },
  { match: /impot|taxe|tva|serafe|redevance|fiscal/, category: "taxes" },
  { match: /telecom|internet|mobile|sunrise|swisscom|salt/, category: "telecom" },
  // « fais admin » : la faute de frappe existe en base, elle doit se ranger.
  { match: /banque|bancaire|f[ar]is admin|frais admin/, category: "banque" },
  { match: /formation|cours|sawi|cas\b/, category: "formation" },
  { match: /entreprise|sarl|societe|charge|abonnement|logiciel|outil/, category: "entreprise" },
];

/**
 * Range un libellé de catégorie historique dans la nomenclature.
 * Tout ce qui n'est pas reconnu tombe dans « autre » — jamais d'erreur, jamais
 * de perte : le texte d'origine reste lisible à côté.
 */
export function resolveMoneyCategory(raw?: string | null): MoneyCategory {
  if (!raw) return "autre";
  const value = fold(raw);
  if (!value) return "autre";
  if ((MONEY_CATEGORIES as string[]).includes(value)) return value as MoneyCategory;
  for (const rule of RULES) if (rule.match.test(value)) return rule.category;
  return "autre";
}

export interface CategoryTotal {
  category: MoneyCategory;
  label: string;
  amount: number;
  /** Part du total, entre 0 et 1. */
  share: number;
  count: number;
}

/**
 * Regroupe des montants par catégorie, du plus lourd au plus léger.
 * Les montants nuls ou négatifs sont ignorés : une barre de longueur zéro
 * n'apprend rien et allonge la liste.
 */
export function groupByCategory(
  rows: { category?: string | null; amount?: number | null }[],
): { totals: CategoryTotal[]; total: number } {
  const sums = new Map<MoneyCategory, { amount: number; count: number }>();
  let total = 0;

  for (const row of rows) {
    const amount = row.amount ?? 0;
    if (amount <= 0) continue;
    const category = resolveMoneyCategory(row.category);
    const entry = sums.get(category) ?? { amount: 0, count: 0 };
    entry.amount += amount;
    entry.count += 1;
    sums.set(category, entry);
    total += amount;
  }

  const totals = [...sums.entries()]
    .map(([category, { amount, count }]) => ({
      category,
      label: MONEY_CATEGORY_LABELS[category],
      amount,
      share: total === 0 ? 0 : amount / total,
      count,
    }))
    .sort((a, b) =>
      b.amount - a.amount ||
      MONEY_CATEGORIES.indexOf(a.category) - MONEY_CATEGORIES.indexOf(b.category));

  return { totals, total };
}
