import { apiFetch } from './client';

export interface ChoreographyEntry {
  id: string;
  timestamp: number;      // seconds from start (1, 4, 7, 10, ...)
  orderNum: number;       // 1, 2, 3, 4...
  figure: string;         // editable text
  category: string;       // category id
  createdAt: string;
}

export interface CustomCategory {
  id: string;
  label: string;
}

export const CHOREO_CATEGORIES = [
  { id: 'sur_place',     label: 'Sur place',     color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  { id: 'transition',    label: 'Transition',    color: 'text-pink-600',    bg: 'bg-pink-50',     border: 'border-pink-200' },
  { id: 'energie_son',   label: 'Energie Son',   color: 'text-blue-800',    bg: 'bg-blue-50',     border: 'border-blue-200' },
  { id: 'break_solo',    label: 'Break solo',    color: 'text-red-600',     bg: 'bg-red-50',      border: 'border-red-200' },
  { id: 'break_couple',  label: 'Break Couple',  color: 'text-red-600',     bg: 'bg-red-50',      border: 'border-red-200' },
  { id: 'couple',        label: 'Couple',        color: 'text-purple-600',  bg: 'bg-purple-50',   border: 'border-purple-200' },
  { id: 'rumba',         label: 'Rumba',          color: 'text-amber-800',   bg: 'bg-amber-50',    border: 'border-amber-200' },
] as const;

export type ChoreoCategory = typeof CHOREO_CATEGORIES[number]['id'];

// ── Choreography entries ──

export function listChoreography() {
  return apiFetch<ChoreographyEntry[]>('choreography.php');
}

export function saveChoreography(entries: Omit<ChoreographyEntry, 'id' | 'createdAt'>[]) {
  return apiFetch<ChoreographyEntry[]>('choreography.php', {
    method: 'POST',
    body: JSON.stringify({ entries }),
  });
}

// ── Custom categories ──

export function listCustomCategories() {
  return apiFetch<CustomCategory[]>('choreo_categories.php');
}

export function addCustomCategory(label: string) {
  return apiFetch<CustomCategory>('choreo_categories.php', {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

export function deleteCustomCategory(id: string) {
  return apiFetch<{ deleted: boolean }>('choreo_categories.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  });
}
