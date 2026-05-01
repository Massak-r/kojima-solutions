import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Star, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import type { SubtaskItem } from "@/api/todoSubtasks";
import { useSprintCapContext } from "@/components/sprint/SprintCapProvider";
import { useUpdateSubtask } from "@/hooks/useSubtasks";
import { useObjectives } from "@/hooks/useObjectives";

export function SprintCapOverloadDialog() {
  const { data: allObjectives = [] } = useObjectives();
  const objectivesById = useMemo(() => {
    const m: Record<string, { text: string }> = {};
    for (const o of allObjectives) m[o.id] = o;
    return m;
  }, [allObjectives]);
  const { dialogState, closeDialog } = useSprintCapContext();
  const { open, candidate, currentSprint } = dialogState;
  const updateSubtask = useUpdateSubtask();

  const [selectedToRemove, setSelectedToRemove] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelectedToRemove(null);
  }, [open]);

  const grouped = useMemo(() => {
    const map = new Map<string, SubtaskItem[]>();
    for (const s of currentSprint) {
      const arr = map.get(s.parentId) ?? [];
      arr.push(s);
      map.set(s.parentId, arr);
    }
    return [...map.entries()];
  }, [currentSprint]);

  function handleReplace() {
    if (!candidate || !selectedToRemove) return;
    updateSubtask.mutate({ id: selectedToRemove, patch: { flaggedToday: false } });
    updateSubtask.mutate({ id: candidate.id, patch: { flaggedToday: true } });
    closeDialog();
  }

  function handleForceAdd() {
    if (!candidate) return;
    updateSubtask.mutate({ id: candidate.id, patch: { flaggedToday: true } });
    closeDialog();
  }

  if (!candidate) return null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Sprint complet — 5/5
          </DialogTitle>
          <DialogDescription>
            Tu veux ajouter{" "}
            <span className="font-semibold text-foreground">"{candidate.text}"</span>{" "}
            mais ton sprint est déjà à 5 items. Lequel tu retires ?
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[40vh] overflow-y-auto -mx-6 px-6 py-2 space-y-3">
          {grouped.map(([parentId, subs]) => (
            <div key={parentId}>
              <div className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5 truncate">
                {objectivesById[parentId]?.text ?? "(objectif inconnu)"}
              </div>
              <ul className="space-y-1">
                {subs.map(item => {
                  const isSelected = selectedToRemove === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedToRemove(isSelected ? null : item.id)}
                        className={cn(
                          "w-full text-left rounded-xl border flex items-center gap-2.5 px-3 py-2 transition-all",
                          isSelected
                            ? "border-destructive/50 bg-destructive/5"
                            : "border-border/40 bg-muted/20 hover:border-muted-foreground/30",
                        )}
                      >
                        <span
                          className={cn(
                            "shrink-0 w-4 h-4 rounded-md border flex items-center justify-center transition-colors",
                            isSelected
                              ? "bg-destructive/80 border-destructive/80 text-white"
                              : "border-muted-foreground/40",
                          )}
                        >
                          {isSelected && <Check size={11} strokeWidth={3} />}
                        </span>
                        <Star
                          size={11}
                          className={cn(
                            "shrink-0",
                            isSelected ? "text-destructive/60" : "fill-amber-400 text-amber-400",
                          )}
                        />
                        <span className={cn(
                          "flex-1 text-sm font-body font-medium break-words",
                          isSelected ? "text-destructive line-through" : "text-foreground",
                        )}>
                          {item.text}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" size="sm" onClick={closeDialog} className="sm:mr-auto">
            Annuler
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleForceAdd}
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
          >
            Garder les 6
          </Button>
          <Button
            size="sm"
            onClick={handleReplace}
            disabled={!selectedToRemove}
          >
            Remplacer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
