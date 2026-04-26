import type { SubtaskItem } from "@/api/todoSubtasks";
import type { ObjectiveSource } from "@/api/objectiveSource";

export const DAILY_COMMIT_KEY_PREFIX = "kojima-daily-commit-";
export const VIEW_MODE_KEY = "sprint-view-mode";

// Flagged subtasks that have been in the backlog longer than this are
// surfaced with a visible "stale" cue — signal to either finish or unflag.
export const STALE_THRESHOLD_DAYS = 7;

export type SprintViewMode = "today" | "week";

export function todayKey(): string {
  return DAILY_COMMIT_KEY_PREFIX + new Date().toISOString().slice(0, 10);
}

// localStorage key for "Friday review dismissed this ISO week".
// Status is encoded in the key suffix so presence alone is the signal.
export function weeklyReviewKey(d: Date): string {
  return `${isoWeekKey(d)}:seen`;
}

export function daysSinceFlagged(item: Pick<SubtaskItem, "flaggedAt" | "createdAt">): number {
  // Prefer the real flag timestamp; fall back to createdAt for rows from before
  // the flagged_at column existed.
  const raw = item.flaggedAt ?? item.createdAt;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}

// ISO week year + week number, e.g. "2026-W16". Used to throttle the Friday review
// dialog so it auto-shows once per week rather than every visit.
export function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

export function findActiveSessionKey(): { source: ObjectiveSource; objectiveId: string } | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const m = key.match(/^focus_session_(admin|personal)_(.+)$/);
      if (m) return { source: m[1] as ObjectiveSource, objectiveId: m[2] };
    }
  } catch {}
  return null;
}
