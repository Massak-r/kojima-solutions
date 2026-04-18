import { useState, useEffect } from "react";
import { Pencil, ArrowLeft, Calendar, AlertTriangle, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ObjectiveProgress } from "@/components/todos/ObjectiveProgress";
import { STATUS_CONFIG, STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/objectiveConstants";
import type { UnifiedObjective } from "@/api/objectiveSource";
import type { TodoPriority, TodoStatus } from "@/api/objectives";

interface ObjectiveHeaderProps {
  objective: UnifiedObjective;
  completedSubtasks: number;
  totalSubtasks: number;
  onBack: () => void;
  onTitleSave: (next: string) => void;
  onStatusChange: (s: TodoStatus) => void;
  onPriorityChange: (p: TodoPriority) => void;
  onDueDateChange: (d: string) => void;
}

export function ObjectiveHeader({
  objective,
  completedSubtasks,
  totalSubtasks,
  onBack,
  onTitleSave,
  onStatusChange,
  onPriorityChange,
  onDueDateChange,
}: ObjectiveHeaderProps) {
  const [editTitle, setEditTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(objective.text);

  useEffect(() => { setTitleDraft(objective.text); }, [objective.text]);

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !!objective.dueDate && !objective.completed && objective.dueDate < today;

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
        >
          <ArrowLeft size={15} />
          <span>Retour</span>
        </button>
        {objective.category && (
          <span className="text-[10px] bg-primary/10 text-primary font-semibold rounded-full px-2.5 py-0.5 font-body">
            {objective.category}
          </span>
        )}
      </div>

      {/* Title */}
      <div className="group/title">
        {editTitle ? (
          <input
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { onTitleSave(titleDraft.trim()); setEditTitle(false); }
              if (e.key === "Escape") { setTitleDraft(objective.text); setEditTitle(false); }
            }}
            onBlur={() => { onTitleSave(titleDraft.trim()); setEditTitle(false); }}
            autoFocus
            className="w-full text-2xl sm:text-3xl font-display font-bold text-foreground bg-transparent border-b-2 border-primary/40 focus:outline-none focus:border-primary pb-1"
          />
        ) : (
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground flex items-start gap-2 leading-tight">
            <Target className="text-primary shrink-0 mt-1" size={22} />
            <span className="break-words flex-1">{objective.text}</span>
            <Pencil
              size={16}
              className="opacity-0 group-hover/title:opacity-50 hover:!opacity-100 transition-opacity cursor-pointer text-muted-foreground mt-1.5 shrink-0"
              onClick={() => { setTitleDraft(objective.text); setEditTitle(true); }}
            />
          </h1>
        )}
      </div>

      {/* Status + Priority + Due date + Progress */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {/* Status pills */}
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_OPTIONS.map(s => {
            const cfg = STATUS_CONFIG[s];
            const active = objective.status === s;
            return (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={cn(
                  "text-[11px] font-body font-bold px-2.5 py-1 rounded-full transition-all",
                  active ? cn(cfg.bg, cfg.text) : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/40",
                )}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>

        <div className="w-px h-4 bg-border/50" />

        {/* Priority pills */}
        <div className="flex items-center gap-1">
          {PRIORITY_OPTIONS.map(p => {
            const active = objective.priority === p.key;
            return (
              <button
                key={p.key}
                onClick={() => onPriorityChange(p.key)}
                className={cn(
                  "text-[11px] font-body font-bold px-2.5 py-1 rounded-full transition-all",
                  active ? p.color : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/40",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Due date + progress */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs font-body text-muted-foreground">
          <Calendar size={13} />
          <input
            type="date"
            value={objective.dueDate ?? ""}
            onChange={e => onDueDateChange(e.target.value)}
            className={cn(
              "bg-transparent border-none focus:outline-none focus:ring-0 font-mono tabular-nums px-1 py-0.5 rounded",
              isOverdue && "text-destructive font-bold",
            )}
          />
          {isOverdue && <AlertTriangle size={12} className="text-destructive" />}
        </label>

        {totalSubtasks > 0 && (
          <ObjectiveProgress
            completed={completedSubtasks}
            total={totalSubtasks}
            className="flex-1 min-w-[140px] max-w-[320px]"
          />
        )}
      </div>
    </div>
  );
}
