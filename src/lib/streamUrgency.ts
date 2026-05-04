import type { SubtaskItem } from "@/api/todoSubtasks";
import type { TimelineTask } from "@/types/timeline";
import type { StoredProject } from "@/contexts/ProjectsContext";
import type { UnifiedObjective } from "@/api/objectiveSource";

/**
 * Stream urgency model — used by Home > Streams to group projects/objectives
 * by what genuinely needs attention.
 *
 * - "urgent" : at least one flagged / overdue / high-priority / soon-due item.
 * - "active" : at least one open item, none urgent.
 * - "idle"   : nothing open and the stream itself is not marked completed.
 * - "done"   : stream.completed === true.
 */
export type UrgencyBucket = "urgent" | "active" | "idle" | "done";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateAhead(days: number): string {
  const d = new Date(todayISO());
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isSubtaskUrgent(s: SubtaskItem): boolean {
  if (s.completed) return false;
  if (s.flaggedToday) return true;
  if (s.priority === "high") return true;
  if (s.recurrence) return true;
  if (s.dueDate && s.dueDate <= dateAhead(3)) return true;
  return false;
}

export function isTaskUrgent(t: TimelineTask): boolean {
  if (t.status === "completed" || t.completed) return false;
  if (t.flaggedToday) return true;
  if (t.deadline && t.deadline.slice(0, 10) <= dateAhead(3)) return true;
  return false;
}

export function isTaskOpen(t: TimelineTask): boolean {
  return t.status !== "completed" && !t.completed;
}

export function computeProjectBucket(p: StoredProject): UrgencyBucket {
  if (p.status === "completed") return "done";
  const tasks = p.tasks ?? [];
  if (tasks.some(isTaskUrgent)) return "urgent";
  if (tasks.some(isTaskOpen)) return "active";
  return "idle";
}

export function computeObjectiveBucket(o: UnifiedObjective, subs: SubtaskItem[]): UrgencyBucket {
  if (o.completed) return "done";
  if (subs.some(isSubtaskUrgent)) return "urgent";
  if (subs.some(s => !s.completed)) return "active";
  return "idle";
}

/** Pick the next actionable task in a project. Open + urgent first, then by order. */
export function pickNextTask(p: StoredProject): TimelineTask | null {
  const candidates = (p.tasks ?? [])
    .filter(isTaskOpen)
    .slice()
    .sort((a, b) => {
      const ua = isTaskUrgent(a) ? 0 : 1;
      const ub = isTaskUrgent(b) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      const oa = a.status === "open" ? 0 : 1;
      const ob = b.status === "open" ? 0 : 1;
      if (oa !== ob) return oa - ob;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  return candidates[0] ?? null;
}

/** Pick the next actionable subtask. Urgency first, then high → med → low, then order. */
export function pickNextSubtask(subs: SubtaskItem[]): SubtaskItem | null {
  const open = subs
    .filter(s => !s.completed)
    .slice()
    .sort((a, b) => {
      const ua = isSubtaskUrgent(a) ? 0 : 1;
      const ub = isSubtaskUrgent(b) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      const pa = a.priority === "high" ? 0 : a.priority === "medium" ? 1 : 2;
      const pb = b.priority === "high" ? 0 : b.priority === "medium" ? 1 : 2;
      if (pa !== pb) return pa - pb;
      return a.order - b.order;
    });
  return open[0] ?? null;
}

/** N actionable items inside one stream, ordered like pickNextTask/Subtask. */
export function pickActionableTasks(p: StoredProject, limit: number): TimelineTask[] {
  return (p.tasks ?? [])
    .filter(isTaskOpen)
    .slice()
    .sort((a, b) => {
      const ua = isTaskUrgent(a) ? 0 : 1;
      const ub = isTaskUrgent(b) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      const oa = a.status === "open" ? 0 : 1;
      const ob = b.status === "open" ? 0 : 1;
      if (oa !== ob) return oa - ob;
      return (a.order ?? 0) - (b.order ?? 0);
    })
    .slice(0, limit);
}

export function pickActionableSubtasks(subs: SubtaskItem[], limit: number): SubtaskItem[] {
  return subs
    .filter(s => !s.completed)
    .slice()
    .sort((a, b) => {
      const ua = isSubtaskUrgent(a) ? 0 : 1;
      const ub = isSubtaskUrgent(b) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      const pa = a.priority === "high" ? 0 : a.priority === "medium" ? 1 : 2;
      const pb = b.priority === "high" ? 0 : b.priority === "medium" ? 1 : 2;
      if (pa !== pb) return pa - pb;
      return a.order - b.order;
    })
    .slice(0, limit);
}

export const URGENCY_LABEL: Record<UrgencyBucket, string> = {
  urgent: "Urgent",
  active: "En cours",
  idle:   "Au repos",
  done:   "Terminé",
};
