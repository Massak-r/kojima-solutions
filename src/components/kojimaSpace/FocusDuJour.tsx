import { Sun, CheckCircle2, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/objectiveCategories";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { UnifiedObjective } from "@/api/objectiveSource";

interface FocusDuJourProps {
  subtasksMap: Record<string, SubtaskItem[]>;
  todos: UnifiedObjective[];
  hiddenCats: Set<string>;
  onToggleSubtask: (parentId: string, subId: string) => void;
  onUnflagSubtask: (parentId: string, subId: string) => void;
}

export function FocusDuJour({ subtasksMap, todos, hiddenCats, onToggleSubtask, onUnflagSubtask }: FocusDuJourProps) {
  const allSubs = Object.values(subtasksMap).flat();
  const flagged = allSubs.filter((s: SubtaskItem & { flaggedToday?: boolean }) => s.flaggedToday).filter(sub => {
    const parent = todos.find(t => t.id === sub.parentId);
    const cat = parent?.category || "Général";
    return !hiddenCats.has(cat);
  });
  if (flagged.length === 0) return null;
  const flagDone = flagged.filter(s => s.completed).length;

  const grouped = new Map<string, SubtaskItem[]>();
  for (const sub of flagged) {
    const parent = todos.find(t => t.id === sub.parentId);
    const cat = parent?.category || "Général";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(sub);
  }

  return (
    <div className="rounded-xl bg-amber-50/50 border border-amber-200/40 mb-4 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200/30">
        <Sun size={14} className="text-amber-500 shrink-0" />
        <span className="text-xs font-display font-bold text-amber-800">Focus du jour</span>
        <span className="text-xs font-mono text-amber-600 font-semibold">{flagDone}/{flagged.length}</span>
        <div className="flex-1 h-1.5 bg-amber-200/40 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${(flagDone / flagged.length) * 100}%` }} />
        </div>
      </div>
      <div className="px-3 py-2.5 space-y-3">
        {Array.from(grouped.entries()).map(([cat, subs]) => {
          const colors = getCategoryColor(cat);
          return (
            <div key={cat}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className={cn("w-1.5 h-1.5 rounded-full", colors.dot)} />
                <span className={cn("text-[10px] font-display font-bold uppercase tracking-wider", colors.text)}>{cat}</span>
              </div>
              <div className="space-y-0.5">
                {subs.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/60 group transition-colors">
                    <button
                      onClick={() => onToggleSubtask(sub.parentId, sub.id)}
                      className={cn("shrink-0 transition-colors", sub.completed ? "text-emerald-500" : "text-muted-foreground/40 hover:text-primary")}
                    >
                      {sub.completed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                    </button>
                    <span className={cn("text-xs font-body flex-1", sub.completed && "line-through text-muted-foreground/50")}>
                      {sub.text}
                    </span>
                    <button
                      onClick={() => onUnflagSubtask(sub.parentId, sub.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-foreground transition-opacity shrink-0"
                      title="Retirer du focus"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
