// Shared constants for objective/subtask UI — single source of truth
import type { TodoPriority, TodoStatus } from "@/api/objectives";

export const STATUS_CONFIG: Record<TodoStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: "Non commencé", bg: "bg-gray-100",    text: "text-gray-700" },
  in_progress: { label: "En cours",     bg: "bg-blue-100",    text: "text-blue-800" },
  done:        { label: "Terminé",       bg: "bg-emerald-100", text: "text-emerald-800" },
  blocked:     { label: "Bloqué",        bg: "bg-red-100",     text: "text-red-800" },
};

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
