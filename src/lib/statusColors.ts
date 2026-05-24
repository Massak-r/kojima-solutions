// Single source of truth for status + priority colour tokens used across the
// app. Domain-local status configs that bake in icons (project-step locked /
// open / done in funnel/StepCard.tsx and steps/UnifiedStepCard.tsx) stay
// inline in those files — they're concept-specific, not just colour mappings.

import type { TodoPriority, TodoStatus } from "@/api/objectives";

// ── Project status (used on dashboards, project lists, kanban) ───────
export const PROJECT_STATUS = {
  draft:        { label: "Draft",    cls: "bg-muted text-muted-foreground border-border" },
  "in-progress":{ label: "Active",   cls: "bg-primary/15 text-primary border-primary/30" },
  completed:    { label: "Done",     cls: "bg-palette-sage/15 text-palette-sage border-palette-sage/30" },
  "on-hold":    { label: "On Hold",  cls: "bg-palette-amber/15 text-palette-amber border-palette-amber/30" },
} as const;

// ── Invoice / payment status ─────────────────────────────────────────
export const PAYMENT_STATUS = {
  unpaid:  { label: "Unpaid",  cls: "bg-destructive/10 text-destructive border-destructive/30" },
  partial: { label: "Partial", cls: "bg-palette-amber/15 text-palette-amber border-palette-amber/30" },
  paid:    { label: "Paid",    cls: "bg-palette-sage/15 text-palette-sage border-palette-sage/30" },
} as const;

// ── Objective / todo status ──────────────────────────────────────────
// Dark-mode partners use the /15 tint + -300 text pattern that the rest
// of the app standardised on (PROJECT_STATUS / PAYMENT_STATUS above).
export const STATUS_CONFIG: Record<TodoStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: "Non commencé", bg: "bg-gray-100    dark:bg-gray-500/15",    text: "text-gray-700  dark:text-gray-300" },
  in_progress: { label: "En cours",     bg: "bg-blue-100    dark:bg-blue-500/15",    text: "text-blue-800  dark:text-blue-300" },
  done:        { label: "Terminé",      bg: "bg-emerald-100 dark:bg-emerald-500/15", text: "text-emerald-800 dark:text-emerald-300" },
  blocked:     { label: "Bloqué",       bg: "bg-red-100     dark:bg-red-500/15",     text: "text-red-800   dark:text-red-300" },
};

// ── Priority (objectives + subtasks) ─────────────────────────────────
export const PRIORITY_BORDER: Record<TodoPriority, string> = {
  low:    "border-l-gray-300 dark:border-l-gray-600",
  medium: "border-l-amber-400 dark:border-l-amber-500",
  high:   "border-l-red-500 dark:border-l-red-400",
};

export const STATUS_OPTIONS: TodoStatus[] = ["not_started", "in_progress", "done", "blocked"];

export const PRIORITY_OPTIONS: { key: TodoPriority; label: string; color: string }[] = [
  { key: "low",    label: "Basse",   color: "bg-gray-100  dark:bg-gray-500/15  text-gray-700  dark:text-gray-300" },
  { key: "medium", label: "Moyenne", color: "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  { key: "high",   label: "Haute",   color: "bg-red-100   dark:bg-red-500/15   text-red-800   dark:text-red-300" },
];
