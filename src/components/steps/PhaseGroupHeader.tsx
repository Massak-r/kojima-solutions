import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Trash2, ChevronRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectPhase } from "@/types/phase";

interface Props {
  phase: ProjectPhase;
  completedCount: number;
  totalCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onTitleChange: (title: string) => void;
  onBudgetChange: (budget: number) => void;
  onDelete: () => void;
}

export function PhaseGroupHeader({
  phase,
  completedCount,
  totalCount,
  collapsed,
  onToggleCollapse,
  onTitleChange,
  onBudgetChange,
  onDelete,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(phase.title);
  const [editingBudget, setEditingBudget] = useState(false);
  const [localBudget, setLocalBudget] = useState(String(phase.budget || ""));
  const [deleting, setDeleting] = useState(false);

  function commitTitle() {
    setEditingTitle(false);
    if (localTitle.trim() && localTitle !== phase.title) onTitleChange(localTitle.trim());
  }

  function commitBudget() {
    setEditingBudget(false);
    const val = parseFloat(localBudget) || 0;
    if (val !== (phase.budget ?? 0)) onBudgetChange(val);
  }

  return (
    <div className="flex items-center gap-2 py-3 px-3 group min-w-0 overflow-hidden bg-secondary/20 rounded-lg mt-4 first:mt-0">
      {/* Collapse toggle */}
      <button onClick={onToggleCollapse} className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors shrink-0">
        <ChevronRight size={14} className={cn("transition-transform", !collapsed && "rotate-90")} />
      </button>

      {/* Vertical accent line */}
      <div className="w-0.5 h-5 rounded-full bg-primary/40" />

      {/* Title */}
      {editingTitle ? (
        <Input
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === "Enter" && commitTitle()}
          autoFocus
          className="h-7 text-sm font-display font-bold w-48"
        />
      ) : (
        <button
          onClick={() => { setLocalTitle(phase.title); setEditingTitle(true); }}
          className="font-display text-sm font-bold text-foreground uppercase tracking-wider hover:text-primary transition-colors min-w-0 truncate"
        >
          {phase.title || "Sans titre"}
        </button>
      )}

      {/* Progress indicator */}
      {totalCount > 0 && (
        <span className="text-[11px] font-mono text-muted-foreground">
          {completedCount}/{totalCount}
        </span>
      )}

      {/* Budget + delete */}
      <div className="ml-auto flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
        {editingBudget ? (
          <div className="flex items-center gap-1">
            <Wallet size={11} className="text-muted-foreground" />
            <Input
              value={localBudget}
              onChange={(e) => setLocalBudget(e.target.value)}
              onBlur={commitBudget}
              onKeyDown={(e) => e.key === "Enter" && commitBudget()}
              autoFocus
              className="h-6 text-[11px] w-24 font-mono"
              placeholder="Budget CHF"
            />
          </div>
        ) : (
          <button
            onClick={() => { setLocalBudget(String(phase.budget || "")); setEditingBudget(true); }}
            className="text-[11px] font-body text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Wallet size={10} />
            {phase.budget ? `${phase.budget.toLocaleString("fr-CH")} CHF` : "Budget"}
          </button>
        )}

        {deleting ? (
          <div className="flex items-center gap-1">
            <button onClick={onDelete} className="px-2 py-0.5 rounded text-[10px] bg-destructive text-white font-semibold">
              Supprimer
            </button>
            <button onClick={() => setDeleting(false)} className="px-2 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground">
              Annuler
            </button>
          </div>
        ) : (
          <button onClick={() => setDeleting(true)} className="p-1 rounded text-muted-foreground/30 hover:text-destructive transition-colors">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
