import { apiFetch } from "./client";

export type DeadlineRecurrence = "weekly" | "monthly" | "quarterly" | "biannual" | "yearly";

export interface AdminDeadline {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;        // YYYY-MM-DD
  category: string;
  recurring: DeadlineRecurrence | null;
  remindDays: number;
  completed: boolean;
  completedAt: string | null;
  notified: boolean;
  createdAt: string;
}

export interface NewDeadline {
  title: string;
  dueDate: string;
  category?: string;
  recurring?: DeadlineRecurrence | null;
  remindDays?: number;
  description?: string | null;
}

/** List deadlines. The GET also triggers the server-side reminder check
 *  (checkAndNotify) — same as the daily cron, so opening the page nudges. */
export function listDeadlines(): Promise<AdminDeadline[]> {
  return apiFetch<AdminDeadline[]>("admin_deadlines.php");
}

export function createDeadline(data: NewDeadline): Promise<AdminDeadline> {
  return apiFetch<AdminDeadline>("admin_deadlines.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateDeadline(
  id: string,
  data: Partial<NewDeadline> & { completed?: boolean },
): Promise<AdminDeadline> {
  return apiFetch<AdminDeadline>(`admin_deadlines.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteDeadline(id: string): Promise<void> {
  return apiFetch<void>(`admin_deadlines.php?id=${id}`, { method: "DELETE" });
}
