import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubtaskCompletions } from "@/hooks/useSubtaskCompletions";
import { recurrenceStreakCount } from "@/lib/streak";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { ObjectiveSource } from "@/api/objectiveSource";

/**
 * Compact "don't break the chain" streak — a flame + count for a recurring
 * subtask. Reuses the completion log. Hidden below 2 (a streak of 1 isn't a
 * chain worth defending yet). The full chain grid lives in RecurrenceStreak.
 */
export function StreakBadge({ subtask, className }: { subtask: SubtaskItem; className?: string }) {
  const { data: completionsMap } = useSubtaskCompletions(subtask.source as ObjectiveSource);
  if (!subtask.recurrence) return null;
  const streak = recurrenceStreakCount(subtask.recurrence, subtask.createdAt, completionsMap?.[subtask.id] ?? []);
  if (streak < 2) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-body font-semibold text-amber-700 dark:text-amber-400 shrink-0",
        className,
      )}
      title={`${streak} fois d'affilée — ne casse pas la chaîne !`}
    >
      <Flame size={10} className="fill-current" />
      {streak}
    </span>
  );
}
