import { Circle, CheckCircle2, Sun, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { ObjectiveItem } from "@/api/objectives";

interface DailyFocusProps {
  /** All subtasks that have flaggedToday=true */
  flaggedSubtasks: SubtaskItem[];
  /** All objectives (to look up parent names) */
  objectives: ObjectiveItem[];
  /** Toggle completion of a subtask */
  onToggle: (subtaskId: string) => void;
  /** Remove from daily focus (unflag) */
  onUnflag: (subtaskId: string) => void;
  /** Clear all flags */
  onClearAll: () => void;
}

export function DailyFocus({ flaggedSubtasks, objectives, onToggle, onUnflag, onClearAll }: DailyFocusProps) {
  if (flaggedSubtasks.length === 0) return null;

  const completed = flaggedSubtasks.filter(s => s.completed).length;
  const total = flaggedSubtasks.length;
  const pct = Math.round((completed / total) * 100);

  // Group by parent objective
  const grouped = new Map<string, { objective: ObjectiveItem | undefined; subtasks: SubtaskItem[] }>();
  for (const sub of flaggedSubtasks) {
    if (!grouped.has(sub.parentId)) {
      grouped.set(sub.parentId, {
        objective: objectives.find(o => o.id === sub.parentId),
        subtasks: [],
      });
    }
    grouped.get(sub.parentId)!.subtasks.push(sub);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-5 mb-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Sun className="w-5 h-5 text-amber-500" />
        <span className="text-sm font-display font-bold text-foreground">
          Objectif du jour
        </span>
        <div className="flex-1 max-w-[200px]">
          <Progress value={pct} className="h-2 [&>div]:bg-amber-500" />
        </div>
        <span className="text-xs font-mono font-semibold text-amber-700">
          {completed}/{total}
        </span>
        {completed === total && total > 0 && (
          <button
            onClick={onClearAll}
            className="text-[10px] font-body text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded bg-secondary/50"
          >
            Vider la liste
          </button>
        )}
      </div>

      {/* Grouped subtasks */}
      <div className="space-y-3">
        {Array.from(grouped.entries()).map(([parentId, { objective, subtasks }]) => (
          <div key={parentId}>
            <p className="text-[11px] font-display font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">
              {objective?.text || "Objectif"}
            </p>
            <div className="space-y-1">
              <AnimatePresence>
                {subtasks.map(sub => (
                  <motion.div
                    key={sub.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl bg-white/70 border border-border/30 group",
                      sub.completed && "opacity-50",
                    )}
                  >
                    <button
                      onClick={() => onToggle(sub.id)}
                      className={cn(
                        "shrink-0 transition-all",
                        sub.completed ? "text-emerald-500" : "text-muted-foreground/60 hover:text-primary hover:scale-110",
                      )}
                    >
                      {sub.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <span className={cn(
                      "text-sm font-body font-medium flex-1",
                      sub.completed && "line-through text-muted-foreground",
                    )}>
                      {sub.text}
                    </span>
                    <button
                      onClick={() => onUnflag(sub.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                      title="Retirer du focus"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
