export type CostFrequency = "weekly" | "monthly" | "bimonthly" | "quarterly" | "biannual" | "yearly";

export const FREQUENCY_MONTHLY_FACTOR: Record<CostFrequency, number> = {
  weekly:    52 / 12,  // ~4.33
  monthly:   1,
  bimonthly: 0.5,
  quarterly: 1 / 3,
  biannual:  1 / 6,
  yearly:    1 / 12,
};

export const FREQUENCY_DAYS: Record<CostFrequency, number> = {
  weekly:    7,
  monthly:   30,
  bimonthly: 61,
  quarterly: 91,
  biannual:  182,
  yearly:    365,
};

export const FREQUENCY_LABELS: Record<CostFrequency, string> = {
  weekly:    "Chaque semaine",
  monthly:   "Mensuel",
  bimonthly: "Tous les 2 mois",
  quarterly: "Trimestriel",
  biannual:  "Semestriel",
  yearly:    "Annuel",
};

export interface RecurringCost {
  id:        string;
  name:      string;
  amount:    number;
  frequency: CostFrequency;
  category?: string;
  lastPaid?: string; // YYYY-MM-DD
  createdAt: string;
}
