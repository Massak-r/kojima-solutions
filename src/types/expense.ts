export type ExpenseCategory =
  | "software"
  | "hardware"
  | "office"
  | "travel"
  | "marketing"
  | "services"
  | "bank"
  | "other";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  software:  "Logiciels & Outils",
  hardware:  "Matériel",
  office:    "Bureau",
  travel:    "Déplacements",
  marketing: "Marketing",
  services:  "Services Pro",
  bank:      "Banque & Frais",
  other:     "Autres",
};

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  software:  "#6366f1",
  hardware:  "#8b5cf6",
  office:    "#06b6d4",
  travel:    "#f59e0b",
  marketing: "#ec4899",
  services:  "#10b981",
  bank:      "#ef4444",
  other:     "#6b7280",
};

export interface Expense {
  id: string;
  date: string;          // YYYY-MM-DD
  amount: number;
  description: string;
  category: ExpenseCategory;
  notes?: string;
  createdAt: string;     // ISO timestamp
}
