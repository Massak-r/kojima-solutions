import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Star, Check, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  useSprintCapContext,
  sprintItemId, sprintItemText, sprintItemParentId,
  type SprintItem,
} from "@/components/sprint/SprintCapProvider";
import { useUpdateSubtask } from "@/hooks/useSubtasks";
import { useObjectives } from "@/hooks/useObjectives";
import { useProjects } from "@/contexts/ProjectsContext";

export function SprintCapOverloadDialog() {
  const { dialogState, closeDialog } = useSprintCapContext();
  const { open, candidate, currentSprint } = dialogState;

  const { data: allObjectives = [] } = useObjectives();
  const { projects, updateProjectTask } = useProjects();
  const updateSubtask = useUpdateSubtask();

  const titleByParent = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of allObjectives) m[o.id] = o.text;
    for (const p of projects) m[p.id] = `Projet · ${p.title}`;
    return m;
  }, [allObjectives, projects]);

  const [selectedToRemove, setSelectedToRemove] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelectedToRemove(null);
  }, [open]);

  const grouped = useMemo(() => {
    const map = new Map<string, SprintItem[]>();
    for (const item of currentSprint) {
      const key = sprintItemParentId(item);
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [currentSprint]);

  function applyFlag(item: SprintItem, flagged: boolean) {
    // When adding to sprint, reset tier to 'nice' (fresh start). When removing, no tier change.
    const patch = flagged ? { flaggedToday: true, sprintTier: "nice" as const } : { flaggedToday: false };
    if (item.kind === "subtask") {
      updateSubtask.mutate({ id: item.subtask.id, patch });
    } else {
      updateProjectTask(item.projectId, item.task.id, patch);
    }
  }

  function handleReplace() {
    if (!candidate || !selectedToRemove) return;
    const toRemove = currentSprint.find(i => sprintItemId(i) === selectedToRemove);
    if (!toRemove) return;
    applyFlag(toRemove, false);
    applyFlag(candidate, true);
    closeDialog();
  }

  function handleForceAdd() {
    if (!candidate) return;
    applyFlag(candidate, true);
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
            <span className="font-semibold text-foreground">"{sprintItemText(candidate)}"</span>{" "}
            mais ton sprint est déjà à 5 items. Lequel tu retires ?
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[40vh] overflow-y-auto -mx-6 px-6 py-2 space-y-3">
          {grouped.map(([parentId, items]) => {
            const isProject = items[0]?.kind === "task";
            return (
              <div key={parentId}>
                <div className="flex items-center gap-1.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5 truncate">
                  {isProject && <FolderKanban size={10} />}
                  {titleByParent[parentId] ?? "(stream inconnu)"}
                </div>
                <ul className="space-y-1">
                  {items.map(item => {
                    const id = sprintItemId(item);
                    const isSelected = selectedToRemove === id;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => setSelectedToRemove(isSelected ? null : id)}
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
                            {sprintItemText(item)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
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
