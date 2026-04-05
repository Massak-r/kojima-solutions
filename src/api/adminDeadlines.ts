import { apiFetch } from "./client";
import type { DeadlineRecurrence } from "@/types/adminDeadline";

export interface AdminDeadlineItem {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  category: string;
  recurring: DeadlineRecurrence | null;
  remindDays: number;
  completed: boolean;
  completedAt: string | null;
  notified: boolean;
  createdAt: string;
}

export function listDeadlines() {
  return apiFetch<AdminDeadlineItem[]>("admin_deadlines.php");
}

export function createDeadline(
  data: Omit<AdminDeadlineItem, "id" | "completedAt" | "notified" | "createdAt">
) {
  return apiFetch<AdminDeadlineItem>("admin_deadlines.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateDeadline(
  id: string,
  data: Partial<Omit<AdminDeadlineItem, "id" | "createdAt">>
) {
  return apiFetch<AdminDeadlineItem>(`admin_deadlines.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteDeadline(id: string) {
  return apiFetch<void>(`admin_deadlines.php?id=${id}`, { method: "DELETE" });
}
