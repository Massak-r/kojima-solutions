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
export const STATUS_CONFIG: Record<TodoStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: "Non commencé", bg: "bg-gray-100",    text: "text-gray-700" },
  in_progress: { label: "En cours",     bg: "bg-blue-100",    text: "text-blue-800" },
  done:        { label: "Terminé",       bg: "bg-emerald-100", text: "text-emerald-800" },
  blocked:     { label: "Bloqué",        bg: "bg-red-100",     text: "text-red-800" },
};

// ── Priority (objectives + subtasks) ─────────────────────────────────
export const PRIORITY_BORDER: Record<TodoPriority, string> = {
  low:    "border-l-gray-300",
  medium: "border-l-amber-400",
  high:   "border-l-red-500",
};

export const STATUS_OPTIONS: TodoStatus[] = ["not_started", "in_progress", "done", "blocked"];

export const PRIORITY_OPTIONS: { key: TodoPriority; label: string; color: string }[] = [
  { key: "low",    label: "Basse",   color: "bg-gray-100 text-gray-700" },
  { key: "medium", label: "Moyenne", color: "bg-amber-100 text-amber-800" },
  { key: "high",   label: "Haute",   color: "bg-red-100 text-red-800" },
];
