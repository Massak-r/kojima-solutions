import { Pencil, Trash2, ListChecks, CheckCircle2, Plus, GitBranch } from "lucide-react";
import { TimelineTask } from "@/types/timeline";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";

interface TimelineCardProps {
  task: TimelineTask;
  index: number;
  onEdit: (task: TimelineTask) => void;
  onDelete: (id: string) => void;
  onManageSubtasks?: (task: TimelineTask) => void;
  onToggleComplete?: (id: string) => void;
  onAddSubtask?: (taskId: string, title: string) => void;
  phaseName?: string;
  onPhaseClick?: () => void;
}

const colorMap = {
  primary: {
    card: "bg-primary text-primary-foreground",
    badge: "bg-primary-foreground/15 text-primary-foreground",
    dot: "bg-primary border-primary-foreground/30",
    icon: "text-primary-foreground/60 hover:text-primary-foreground",
    order: "text-primary-foreground/50",
    desc: "text-primary-foreground/75",
    input: "bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40",
  },
  accent: {
    card: "bg-accent text-accent-foreground",
    badge: "bg-accent-foreground/15 text-accent-foreground",
    dot: "bg-accent border-accent-foreground/30",
    icon: "text-accent-foreground/60 hover:text-accent-foreground",
    order: "text-accent-foreground/50",
    desc: "text-accent-foreground/75",
    input: "bg-accent-foreground/10 border-accent-foreground/20 text-accent-foreground placeholder:text-accent-foreground/40",
  },
  secondary: {
    card: "bg-card text-card-foreground border border-border",
    badge: "bg-secondary text-secondary-foreground",
    dot: "bg-secondary border-border",
    icon: "text-muted-foreground hover:text-foreground",
    order: "text-muted-foreground",
    desc: "text-foreground/70",
    input: "bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground",
  },
  rose: {
    card: "bg-palette-rose text-palette-rose-foreground",
    badge: "bg-palette-rose-foreground/15 text-palette-rose-foreground",
    dot: "bg-palette-rose border-palette-rose-foreground/30",
    icon: "text-palette-rose-foreground/60 hover:text-palette-rose-foreground",
    order: "text-palette-rose-foreground/50",
    desc: "text-palette-rose-foreground/75",
    input: "bg-palette-rose-foreground/10 border-palette-rose-foreground/20 text-palette-rose-foreground placeholder:text-palette-rose-foreground/40",
  },
  sage: {
    card: "bg-palette-sage text-palette-sage-foreground",
    badge: "bg-palette-sage-foreground/15 text-palette-sage-foreground",
    dot: "bg-palette-sage border-palette-sage-foreground/30",
    icon: "text-palette-sage-foreground/60 hover:text-palette-sage-foreground",
    order: "text-palette-sage-foreground/50",
    desc: "text-palette-sage-foreground/75",
    input: "bg-palette-sage-foreground/10 border-palette-sage-foreground/20 text-palette-sage-foreground placeholder:text-palette-sage-foreground/40",
  },
  amber: {
    card: "bg-palette-amber text-palette-amber-foreground",
    badge: "bg-palette-amber-foreground/15 text-palette-amber-foreground",
    dot: "bg-palette-amber border-palette-amber-foreground/30",
    icon: "text-palette-amber-foreground/60 hover:text-palette-amber-foreground",
    order: "text-palette-amber-foreground/50",
    desc: "text-palette-amber-foreground/75",
    input: "bg-palette-amber-foreground/10 border-palette-amber-foreground/20 text-palette-amber-foreground placeholder:text-palette-amber-foreground/40",
  },
  violet: {
    card: "bg-palette-violet text-palette-violet-foreground",
    badge: "bg-palette-violet-foreground/15 text-palette-violet-foreground",
    dot: "bg-palette-violet border-palette-violet-foreground/30",
    icon: "text-palette-violet-foreground/60 hover:text-palette-violet-foreground",
    order: "text-palette-violet-foreground/50",
    desc: "text-palette-violet-foreground/75",
    input: "bg-palette-violet-foreground/10 border-palette-violet-foreground/20 text-palette-violet-foreground placeholder:text-palette-violet-foreground/40",
  },
};

export function TimelineCard({ task, index, onEdit, onDelete, onManageSubtasks, onToggleComplete, onAddSubtask, phaseName, onPhaseClick }: TimelineCardProps) {
  const isLeft = index % 2 === 0;
  const colors = colorMap[task.color ?? "primary"];

  return (
    <div className="relative flex items-start gap-0 w-full animate-fade-up" style={{ animationDelay: `${index * 80}ms` }}>
      <div className={cn("flex-1 flex", isLeft ? "justify-end pr-8" : "invisible pr-8")}>
        {isLeft && (
          <TaskCard task={task} colors={colors} onEdit={onEdit} onDelete={onDelete} onManageSubtasks={onManageSubtasks} onToggleComplete={onToggleComplete} onAddSubtask={onAddSubtask} align="right" phaseName={phaseName} onPhaseClick={onPhaseClick} />
        )}
      </div>

      <div className="flex flex-col items-center z-10 shrink-0">
        <div
          className={cn(
            "w-5 h-5 rounded-full border-2 border-background shadow-sm flex items-center justify-center transition-transform hover:scale-110",
            task.completed ? "bg-palette-sage border-palette-sage/30" : colors.dot
          )}
        >
          {task.completed && <CheckCircle2 size={11} className="text-white" />}
        </div>
      </div>

      <div className={cn("flex-1 flex pl-8", !isLeft ? "justify-start" : "invisible pl-8")}>
        {!isLeft && (
          <TaskCard task={task} colors={colors} onEdit={onEdit} onDelete={onDelete} onManageSubtasks={onManageSubtasks} onToggleComplete={onToggleComplete} onAddSubtask={onAddSubtask} align="left" phaseName={phaseName} onPhaseClick={onPhaseClick} />
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  colors,
  onEdit,
  onDelete,
  onManageSubtasks,
  onToggleComplete,
  onAddSubtask,
  align,
  phaseName,
  onPhaseClick,
}: {
  task: TimelineTask;
  colors: typeof colorMap["primary"];
  onEdit: (t: TimelineTask) => void;
  onDelete: (id: string) => void;
  onManageSubtasks?: (t: TimelineTask) => void;
  onToggleComplete?: (id: string) => void;
  onAddSubtask?: (taskId: string, title: string) => void;
  align: "left" | "right";
  phaseName?: string;
  onPhaseClick?: () => void;
}) {
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");

  const subtasks = task.subtasks || [];
  const completedCount = subtasks.filter((s) => s.completed).length;
  const progress = task.completed ? 100 : (subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0);
  const showProgress = task.completed || subtasks.length > 0;

  function handleAddSubtask() {
    if (!subtaskTitle.trim() || !onAddSubtask) return;
    onAddSubtask(task.id, subtaskTitle.trim());
    setSubtaskTitle("");
    setAddingSubtask(false);
  }

  return (
    <div
      className={cn(
        "group relative rounded-xl p-5 shadow-card hover:shadow-card-hover transition-shadow duration-300 max-w-sm w-full",
        colors.card,
        task.completed && "opacity-80"
      )}
    >
      {/* Actions */}
      <div className={cn("absolute top-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity", align === "right" ? "left-4" : "right-4")}>
        <button onClick={() => onEdit(task)} className={cn("p-1 rounded transition-colors", colors.icon)} title="Edit">
          <Pencil size={13} />
        </button>
        {onManageSubtasks && (
          <button onClick={() => onManageSubtasks(task)} className={cn("p-1 rounded transition-colors", colors.icon)} title="Manage subtasks">
            <ListChecks size={13} />
          </button>
        )}
        {onToggleComplete && (
          <button
            onClick={() => onToggleComplete(task.id)}
            className={cn(
              "p-1 rounded transition-colors",
              task.completed ? "text-white bg-palette-sage/40 opacity-100" : colors.icon
            )}
            title={task.completed ? "Mark incomplete" : "Mark as done"}
          >
            <CheckCircle2 size={13} />
          </button>
        )}
        <button onClick={() => onDelete(task.id)} className={cn("p-1 rounded transition-colors", colors.icon)} title="Delete">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Badge */}
      <span className={cn("inline-block text-xs font-body font-semibold px-2.5 py-0.5 rounded-full mb-3 tracking-wide", colors.badge)}>
        {task.dateLabel}
      </span>

      <div className="flex items-start gap-2 mb-1">
        <span className={cn("font-display text-base font-bold mt-0.5 shrink-0", colors.order)}>
          {String(task.order).padStart(2, "0")}
        </span>
        <h3 className={cn("font-display text-lg leading-snug", task.completed && "line-through opacity-60")}>{task.title}</h3>
      </div>
      {phaseName && (
        <button
          onClick={(e) => { e.stopPropagation(); onPhaseClick?.(); }}
          className="flex items-center gap-1 text-[10px] font-body opacity-60 hover:opacity-100 transition-opacity mb-1"
        >
          <GitBranch size={10} /> {phaseName}
        </button>
      )}

      {task.description && (
        <RichText text={task.description} className={cn("mt-2", colors.desc)} />
      )}

      {/* Progress bar */}
      {showProgress && (
        <div className="mt-3 pt-2 border-t border-current/10">
          <div className="flex items-center gap-2">
            <Progress value={progress} className="h-1.5 flex-1" />
            <span className="font-body text-[10px] opacity-70">
              {task.completed ? "Done" : `${completedCount}/${subtasks.length}`}
            </span>
          </div>
        </div>
      )}

      {/* Inline subtask quick-add */}
      {onAddSubtask && (
        <div className="mt-2 pt-2 border-t border-current/10">
          {addingSubtask ? (
            <div className="flex gap-1.5 items-center">
              <input
                autoFocus
                value={subtaskTitle}
                onChange={(e) => setSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSubtask();
                  if (e.key === "Escape") { setAddingSubtask(false); setSubtaskTitle(""); }
                }}
                placeholder="Subtask title…"
                className={cn(
                  "flex-1 text-xs px-2 py-1 rounded border outline-none font-body",
                  colors.input
                )}
              />
              <button
                onClick={handleAddSubtask}
                disabled={!subtaskTitle.trim()}
                className={cn("p-1 rounded transition-colors disabled:opacity-40", colors.icon)}
              >
                <Plus size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingSubtask(true)}
              className={cn("flex items-center gap-1 text-[11px] font-body opacity-50 hover:opacity-80 transition-opacity", colors.icon)}
            >
              <Plus size={11} /> Add subtask
            </button>
          )}
        </div>
      )}
    </div>
  );
}
