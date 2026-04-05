export type DeadlineRecurrence = "monthly" | "quarterly" | "yearly";

export const RECURRENCE_LABELS: Record<DeadlineRecurrence, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  yearly: "Annuel",
};

export const REMIND_OPTIONS = [
  { value: 7, label: "7 jours avant" },
  { value: 14, label: "14 jours avant" },
  { value: 30, label: "30 jours avant" },
  { value: 60, label: "60 jours avant" },
] as const;

export const DEADLINE_CATEGORIES = [
  "Général", "Comptabilité", "Administratif", "Légal", "Impôts", "Assurances", "Divers",
] as const;

export interface AdminDeadline {
  id: string;
  title: string;
  description: string | null;
  dueDate: string; // YYYY-MM-DD
  category: string;
  recurring: DeadlineRecurrence | null;
  remindDays: number;
  completed: boolean;
  completedAt: string | null;
  notified: boolean;
  createdAt: string;
}

/** Days until due (negative = overdue) */
export function getDaysUntilDue(deadline: Pick<AdminDeadline, "dueDate">): number {
  const due = new Date(deadline.dueDate + "T00:00:00").getTime();
  const now = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.round((due - now) / (1000 * 60 * 60 * 24));
}

/** Color class based on days until due */
export function deadlineUrgencyColor(days: number): string {
  if (days < 0)  return "text-destructive";
  if (days <= 3) return "text-amber-600";
  if (days <= 7) return "text-amber-500";
  return "text-muted-foreground";
}

/** Badge color for urgency */
export function deadlineBadgeClass(days: number): string {
  if (days < 0)   return "bg-red-100 text-red-700 border-red-300";
  if (days <= 7)  return "bg-amber-100 text-amber-700 border-amber-300";
  if (days <= 30) return "bg-blue-100 text-blue-700 border-blue-300";
  return "bg-muted text-muted-foreground border-border";
}

/** Human-readable label for days remaining */
export function daysLabel(days: number): string {
  if (days < 0)  return `En retard ${Math.abs(days)}j`;
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  if (days <= 7) return `${days}j`;
  if (days <= 30) return `${Math.round(days / 7)} sem`;
  return `${Math.round(days / 30)} mois`;
}

/** Advance a due date to the next recurrence cycle */
export function advanceDueDate(dueDate: string, recurrence: DeadlineRecurrence): string {
  const d = new Date(dueDate + "T00:00:00");
  switch (recurrence) {
    case "monthly":   d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "yearly":    d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}
