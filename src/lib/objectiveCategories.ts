// Unified category system for all objectives
import type { TodoPriority } from '@/api/objectives';

export const ADMIN_CATEGORIES = [
  "Général", "Comptabilité", "Administratif", "Légal", "Impôts", "Assurances", "Divers",
] as const;

export const PERSONAL_CATEGORIES = [
  "Perso", "Maison", "Famille", "Emploi", "Projets",
] as const;

export const KOJIMA_CATEGORIES = [
  "Kojima-Solutions",
] as const;

export const ALL_CATEGORIES = [
  ...KOJIMA_CATEGORIES,
  ...ADMIN_CATEGORIES,
  ...PERSONAL_CATEGORIES,
] as const;

export const PERSONAL_DOC_CATEGORIES = [
  "Assurance", "Garanties", "Factures", "Général",
] as const;

export type ObjectiveCategory = typeof ALL_CATEGORIES[number];

// Category colors for visual grouping
export const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "Kojima-Solutions": { bg: "bg-indigo-50",  border: "border-l-indigo-500",  text: "text-indigo-700",  dot: "bg-indigo-500" },
  "Général":          { bg: "bg-gray-50",    border: "border-l-gray-400",    text: "text-gray-600",    dot: "bg-gray-400" },
  "Comptabilité":     { bg: "bg-emerald-50", border: "border-l-emerald-500", text: "text-emerald-700", dot: "bg-emerald-500" },
  "Administratif":    { bg: "bg-blue-50",    border: "border-l-blue-500",    text: "text-blue-700",    dot: "bg-blue-500" },
  "Légal":            { bg: "bg-violet-50",  border: "border-l-violet-500",  text: "text-violet-700",  dot: "bg-violet-500" },
  "Impôts":           { bg: "bg-amber-50",   border: "border-l-amber-500",   text: "text-amber-700",   dot: "bg-amber-500" },
  "Assurances":       { bg: "bg-teal-50",    border: "border-l-teal-500",    text: "text-teal-700",    dot: "bg-teal-500" },
  "Divers":           { bg: "bg-slate-50",   border: "border-l-slate-400",   text: "text-slate-600",   dot: "bg-slate-400" },
  "Perso":            { bg: "bg-rose-50",    border: "border-l-rose-500",    text: "text-rose-700",    dot: "bg-rose-500" },
  "Maison":           { bg: "bg-orange-50",  border: "border-l-orange-500",  text: "text-orange-700",  dot: "bg-orange-500" },
  "Famille":          { bg: "bg-pink-50",    border: "border-l-pink-500",    text: "text-pink-700",    dot: "bg-pink-500" },
  "Emploi":           { bg: "bg-cyan-50",    border: "border-l-cyan-500",    text: "text-cyan-700",    dot: "bg-cyan-500" },
  "Projets":          { bg: "bg-purple-50",  border: "border-l-purple-500",  text: "text-purple-700",  dot: "bg-purple-500" },
};

const DEFAULT_CATEGORY_COLOR = { bg: "bg-gray-50", border: "border-l-gray-400", text: "text-gray-600", dot: "bg-gray-400" };

export function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] || DEFAULT_CATEGORY_COLOR;
}

// Sort objectives: overdue first → by due date asc → by priority desc
const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

export function sortObjectives<T extends { completed: boolean; dueDate?: string; priority: TodoPriority }>(
  items: T[],
  today: string,
): T[] {
  return [...items].sort((a, b) => {
    // Completed last
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    // Overdue first
    const aOver = !!a.dueDate && !a.completed && a.dueDate < today;
    const bOver = !!b.dueDate && !b.completed && b.dueDate < today;
    if (aOver !== bOver) return aOver ? -1 : 1;
    // By due date ascending (no date → end)
    const da = a.dueDate ?? '9999-99-99';
    const db = b.dueDate ?? '9999-99-99';
    if (da !== db) return da.localeCompare(db);
    // By priority descending
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });
}
