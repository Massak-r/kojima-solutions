import { useState } from "react";
import { Input } from "@/components/ui/input";
import { GripVertical, Trash2, ChevronDown, Wallet, ChevronRight, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  budget: number;
  approvedCount: number;
  totalCount: number;
  onTitleChange: (title: string) => void;
  onBudgetChange: (budget: number) => void;
  onDelete: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  linkedTaskCount?: number;
  onNavigateToTasks?: () => void;
}

export function GroupHeader({
  title,
  budget,
  approvedCount,
  totalCount,
  onTitleChange,
  onBudgetChange,
  onDelete,
  dragHandleProps,
  collapsed,
  onToggleCollapse,
  linkedTaskCount,
  onNavigateToTasks,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [editingBudget, setEditingBudget] = useState(false);
  const [localBudget, setLocalBudget] = useState(String(budget || ""));
  const [deleting, setDeleting] = useState(false);

  function commitTitle() {
    setEditingTitle(false);
    if (localTitle.trim() && localTitle !== title) onTitleChange(localTitle.trim());
  }

  function commitBudget() {
    setEditingBudget(false);
    const val = parseFloat(localBudget) || 0;
    if (val !== budget) onBudgetChange(val);
  }

  return (
    <div className="flex items-center gap-2 py-3 px-3 group min-w-0 overflow-hidden bg-secondary/20 rounded-lg mt-4 first:mt-0">
      {/* Drag handle */}
      <button
        {...dragHandleProps}
        className="p-1 rounded text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-colors opacity-60 md:opacity-0 md:group-hover:opacity-100"
      >
        <GripVertical size={14} />
      </button>

      {/* Collapse toggle */}
      {onToggleCollapse && (
        <button onClick={onToggleCollapse} className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors shrink-0">
          <ChevronRight size={14} className={cn("transition-transform", !collapsed && "rotate-90")} />
        </button>
      )}

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
          onClick={() => { setLocalTitle(title); setEditingTitle(true); }}
          className="font-display text-sm font-bold text-foreground uppercase tracking-wider hover:text-primary transition-colors min-w-0 truncate"
        >
          {title || "Sans titre"}
        </button>
      )}

      {/* Progress indicator */}
      {totalCount > 0 && (
        <span className="text-[11px] font-mono text-muted-foreground">
          {approvedCount}/{totalCount}
        </span>
      )}

      {/* Linked tasks badge */}
      {linkedTaskCount != null && linkedTaskCount > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigateToTasks?.(); }}
          className="flex items-center gap-1 text-[10px] font-body text-muted-foreground/50 hover:text-primary transition-colors"
          title="Voir les tâches liées"
        >
          <ListTodo size={10} />
          {linkedTaskCount} tâche{linkedTaskCount > 1 ? "s" : ""}
        </button>
      )}

      {/* Budget */}
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
            onClick={() => { setLocalBudget(String(budget || "")); setEditingBudget(true); }}
            className="text-[11px] font-body text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Wallet size={10} />
            {budget ? `${budget.toLocaleString("fr-CH")} CHF` : "Budget"}
          </button>
        )}

        {/* Delete */}
        {deleting ? (
          <div className="flex items-center gap-1">
            <button
              onClick={onDelete}
              className="px-2 py-0.5 rounded text-[10px] bg-destructive text-white font-semibold"
            >
              Supprimer
            </button>
            <button
              onClick={() => setDeleting(false)}
              className="px-2 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            onClick={() => setDeleting(true)}
            className="p-1 rounded text-muted-foreground/30 hover:text-destructive transition-colors"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
