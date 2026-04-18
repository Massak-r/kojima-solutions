import { useEffect, useMemo, useState } from "react";
import { Sun, Star, CornerDownRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import type { SubtaskItem } from "@/api/todoSubtasks";
import { EFFORT_CONFIG } from "@/components/todos/SubtaskCard";

interface DailyCommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SubtaskItem[];
  objectiveTextById: Record<string, string>;
  subtaskById: Record<string, SubtaskItem>;
  onCommit: (keptIds: Set<string>, deferredIds: Set<string>) => Promise<void>;
  onSkip: () => void;
}

export function DailyCommitDialog({
  open, onOpenChange, items, objectiveTextById, subtaskById, onCommit, onSkip,
}: DailyCommitDialogProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setChecked(new Set(items.filter(i => !i.completed).map(i => i.id)));
  }, [open, items]);

  const grouped = useMemo(() => {
    const map = new Map<string, SubtaskItem[]>();
    for (const it of items) {
      if (it.completed) continue;
      const arr = map.get(it.parentId) ?? [];
      arr.push(it);
      map.set(it.parentId, arr);
    }
    return [...map.entries()];
  }, [items]);

  const keptCount = checked.size;
  const deferredCount = items.filter(i => !i.completed).length - keptCount;

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCommit() {
    if (saving) return;
    setSaving(true);
    const kept = checked;
    const deferred = new Set<string>();
    for (const it of items) {
      if (!it.completed && !kept.has(it.id)) deferred.add(it.id);
    }
    try {
      await onCommit(kept, deferred);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sun size={18} className="text-amber-500" />
            Sprint du jour
          </DialogTitle>
          <DialogDescription>
            Choisissez les actions auxquelles vous vous engagez aujourd'hui. Les autres seront reportées (non supprimées).
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto -mx-6 px-6 py-2 space-y-4">
          {grouped.length === 0 ? (
            <p className="text-sm font-body text-muted-foreground italic py-4 text-center">
              Aucune étape flaggée. Revenez ici quand vous en avez.
            </p>
          ) : (
            grouped.map(([parentId, subs]) => (
              <div key={parentId}>
                <div className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5 truncate">
                  {objectiveTextById[parentId] ?? "(objectif inconnu)"}
                </div>
                <ul className="space-y-1">
                  {subs.map(item => {
                    const isChecked = checked.has(item.id);
                    const parentSub = item.parentSubtaskId ? subtaskById[item.parentSubtaskId] : null;
                    const effortCfg = item.effortSize ? EFFORT_CONFIG[item.effortSize] : null;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggle(item.id)}
                          className={cn(
                            "w-full text-left rounded-xl border flex items-start gap-2.5 px-3 py-2 transition-all",
                            isChecked
                              ? "border-amber-300/60 bg-amber-50/40 dark:bg-amber-500/5"
                              : "border-border/40 bg-muted/20 opacity-60 hover:opacity-80",
                          )}
                        >
                          <span
                            className={cn(
                              "shrink-0 mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-colors",
                              isChecked
                                ? "bg-amber-400 border-amber-400 text-white"
                                : "border-muted-foreground/40",
                            )}
                          >
                            {isChecked && <Check size={11} strokeWidth={3} />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-body font-medium text-foreground break-words flex items-center gap-1.5">
                              <Star size={11} className={cn("shrink-0", isChecked ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
                              {item.text}
                            </div>
                            {(parentSub || effortCfg) && (
                              <div className="flex items-center gap-1.5 text-[10px] font-body text-muted-foreground/70 mt-0.5 flex-wrap">
                                {parentSub && (
                                  <>
                                    <CornerDownRight size={9} className="text-muted-foreground/40" />
                                    <span className="truncate max-w-[220px]">{parentSub.text}</span>
                                  </>
                                )}
                                {effortCfg && (
                                  <span className={cn(
                                    "inline-flex items-center gap-0.5 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border",
                                    effortCfg.bg, effortCfg.text, effortCfg.border,
                                  )}>
                                    {effortCfg.short}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="text-[11px] font-body text-muted-foreground tabular-nums">
          {keptCount} garder · {deferredCount} reporter
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => { onSkip(); onOpenChange(false); }} disabled={saving}>
            Ignorer
          </Button>
          <Button onClick={handleCommit} disabled={saving || grouped.length === 0} className="gap-1.5">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Sun size={13} />}
            Confirmer le sprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
