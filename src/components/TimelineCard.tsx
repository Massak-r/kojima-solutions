import { Pencil, Trash2, ListChecks, MessageSquarePlus } from "lucide-react";
import { TimelineTask } from "@/types/timeline";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { Progress } from "@/components/ui/progress";

interface TimelineCardProps {
  task: TimelineTask;
  index: number;
  onEdit: (task: TimelineTask) => void;
  onDelete: (id: string) => void;
  onManageSubtasks?: (task: TimelineTask) => void;
  onRequestFeedback?: (task: TimelineTask) => void;
}

const colorMap = {
  primary: {
    card: "bg-primary text-primary-foreground",
    badge: "bg-primary-foreground/15 text-primary-foreground",
    dot: "bg-primary border-primary-foreground/30",
    icon: "text-primary-foreground/60 hover:text-primary-foreground",
    order: "text-primary-foreground/50",
    desc: "text-primary-foreground/75",
  },
  accent: {
    card: "bg-accent text-accent-foreground",
    badge: "bg-accent-foreground/15 text-accent-foreground",
    dot: "bg-accent border-accent-foreground/30",
    icon: "text-accent-foreground/60 hover:text-accent-foreground",
    order: "text-accent-foreground/50",
    desc: "text-accent-foreground/75",
  },
  secondary: {
    card: "bg-card text-card-foreground border border-border",
    badge: "bg-secondary text-secondary-foreground",
    dot: "bg-secondary border-border",
    icon: "text-muted-foreground hover:text-foreground",
    order: "text-muted-foreground",
    desc: "text-foreground/70",
  },
  rose: {
    card: "bg-palette-rose text-palette-rose-foreground",
    badge: "bg-palette-rose-foreground/15 text-palette-rose-foreground",
    dot: "bg-palette-rose border-palette-rose-foreground/30",
    icon: "text-palette-rose-foreground/60 hover:text-palette-rose-foreground",
    order: "text-palette-rose-foreground/50",
    desc: "text-palette-rose-foreground/75",
  },
  sage: {
    card: "bg-palette-sage text-palette-sage-foreground",
    badge: "bg-palette-sage-foreground/15 text-palette-sage-foreground",
    dot: "bg-palette-sage border-palette-sage-foreground/30",
    icon: "text-palette-sage-foreground/60 hover:text-palette-sage-foreground",
    order: "text-palette-sage-foreground/50",
    desc: "text-palette-sage-foreground/75",
  },
  amber: {
    card: "bg-palette-amber text-palette-amber-foreground",
    badge: "bg-palette-amber-foreground/15 text-palette-amber-foreground",
    dot: "bg-palette-amber border-palette-amber-foreground/30",
    icon: "text-palette-amber-foreground/60 hover:text-palette-amber-foreground",
    order: "text-palette-amber-foreground/50",
    desc: "text-palette-amber-foreground/75",
  },
  violet: {
    card: "bg-palette-violet text-palette-violet-foreground",
    badge: "bg-palette-violet-foreground/15 text-palette-violet-foreground",
    dot: "bg-palette-violet border-palette-violet-foreground/30",
    icon: "text-palette-violet-foreground/60 hover:text-palette-violet-foreground",
    order: "text-palette-violet-foreground/50",
    desc: "text-palette-violet-foreground/75",
  },
};

export function TimelineCard({ task, index, onEdit, onDelete, onManageSubtasks, onRequestFeedback }: TimelineCardProps) {
  const isLeft = index % 2 === 0;
  const colors = colorMap[task.color ?? "primary"];

  return (
    <div className="relative flex items-start gap-0 w-full animate-fade-up" style={{ animationDelay: `${index * 80}ms` }}>
      <div className={cn("flex-1 flex", isLeft ? "justify-end pr-8" : "invisible pr-8")}>
        {isLeft && (
          <TaskCard task={task} colors={colors} onEdit={onEdit} onDelete={onDelete} onManageSubtasks={onManageSubtasks} onRequestFeedback={onRequestFeedback} align="right" />
        )}
      </div>

      <div className="flex flex-col items-center z-10 shrink-0">
        <div
          className={cn(
            "w-5 h-5 rounded-full border-2 border-background shadow-sm flex items-center justify-center transition-transform hover:scale-110",
            colors.dot
          )}
        />
      </div>

      <div className={cn("flex-1 flex pl-8", !isLeft ? "justify-start" : "invisible pl-8")}>
        {!isLeft && (
          <TaskCard task={task} colors={colors} onEdit={onEdit} onDelete={onDelete} onManageSubtasks={onManageSubtasks} onRequestFeedback={onRequestFeedback} align="left" />
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
  onRequestFeedback,
  align,
}: {
  task: TimelineTask;
  colors: typeof colorMap["primary"];
  onEdit: (t: TimelineTask) => void;
  onDelete: (id: string) => void;
  onManageSubtasks?: (t: TimelineTask) => void;
  onRequestFeedback?: (t: TimelineTask) => void;
  align: "left" | "right";
}) {
  const subtasks = task.subtasks || [];
  const completedCount = subtasks.filter((s) => s.completed).length;
  const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;
  const pendingRequests = (task.feedbackRequests || []).filter((r) => !r.resolved).length;

  return (
    <div
      className={cn(
        "group relative rounded-xl p-5 shadow-card hover:shadow-card-hover transition-shadow duration-300 max-w-sm w-full",
        colors.card
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
        {onRequestFeedback && (
          <button onClick={() => onRequestFeedback(task)} className={cn("p-1 rounded transition-colors", colors.icon)} title="Request feedback">
            <MessageSquarePlus size={13} />
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
        <h3 className="font-display text-lg leading-snug">{task.title}</h3>
      </div>

      {task.description && (
        <RichText text={task.description} className={cn("mt-2", colors.desc)} />
      )}

      {/* Subtask progress */}
      {subtasks.length > 0 && (
        <div className="mt-3 pt-2 border-t border-current/10">
          <div className="flex items-center gap-2">
            <Progress value={progress} className="h-1.5 flex-1" />
            <span className="font-body text-[10px] opacity-70">{completedCount}/{subtasks.length}</span>
          </div>
        </div>
      )}

      {/* Pending requests indicator */}
      {pendingRequests > 0 && (
        <div className="mt-2 flex items-center gap-1 opacity-70">
          <MessageSquarePlus size={11} />
          <span className="font-body text-[10px]">{pendingRequests} pending request{pendingRequests > 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}
