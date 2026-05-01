import type { SubtaskItem } from "@/api/todoSubtasks";

export const DAILY_SPRINT_CAP = 5;

export function isSprintFull(pendingCount: number): boolean {
  return pendingCount >= DAILY_SPRINT_CAP;
}

/** Counts non-completed flagged subtasks across all subtasks. */
export function countSprintPending(allSubtasks: SubtaskItem[]): number {
  return allSubtasks.filter(s => s.flaggedToday && !s.completed).length;
}

/** Returns true if the subtask should appear in "À ne pas oublier":
 *  urgent, not yet flagged, not completed. */
export function urgentSubtaskFilter(s: SubtaskItem, today: string): boolean {
  if (s.flaggedToday || s.completed) return false;
  if (s.priority === "high") return true;
  if (!s.dueDate) return false;
  // overdue or due within 3 days
  const inThreeDays = new Date(today);
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  const due = new Date(s.dueDate);
  return due <= inThreeDays;
}
