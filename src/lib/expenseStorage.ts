import { Expense } from "@/types/expense";

const KEY = "kojima-expenses";

export function loadExpenses(): Expense[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveExpenses(expenses: Expense[]): void {
  localStorage.setItem(KEY, JSON.stringify(expenses));
}
