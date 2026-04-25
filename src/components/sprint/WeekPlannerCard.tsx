import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Repeat, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubtaskItem } from "@/api/todoSubtasks";

const OBJECTIVE_COLORS = [
  "bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  "bg-violet-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500",
];

export function objectiveColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return OBJECTIVE_COLORS[Math.abs(hash) % OBJECTIVE_COLORS.length];
}

interface WeekPlannerCardProps {
  sub: SubtaskItem;
  /** Objective text shown below the task title (pool hides it since it's already grouped). */
  objectiveText?: string;
  locked?: boolean;
  onOpen: (sub: SubtaskItem) => void;
}

export function WeekPlannerCard({ sub, objectiveText, locked, onOpen }: WeekPlannerCardProps) {
  const draggable = useDraggable({ id: sub.id, disabled: locked || sub.completed });
  const style = {
    transform: CSS.Translate.toString(draggable.transform),
    opacity: draggable.isDragging ? 0.35 : undefined,
    zIndex: draggable.isDragging ? 50 : undefined,
  };

  const dotColor = objectiveColor(sub.parentId);
  const isDraggable = !locked && !sub.completed;

  const dragBind = isDraggable
    ? { ref: draggable.setNodeRef, ...draggable.listeners, ...draggable.attributes }
    : { ref: draggable.setNodeRef };

  return (
    <div
      {...dragBind}
      style={style}
      className={cn(
        "group relative rounded-lg border bg-card transition-all",
        isDraggable && "cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-sm",
        sub.completed ? "opacity-50 border-border/30" : "border-border/50",
        sub.flaggedToday && !sub.completed && "border-amber-400/60 bg-amber-50/40 dark:bg-amber-500/5",
      )}
    >
      <div className="flex items-start gap-2 p-2">
        {/* Objective color dot (quick visual cue) */}
        <span className={cn("shrink-0 w-2 h-2 rounded-full mt-1.5", dotColor)} aria-hidden />

        {/* Title (full, wraps freely). Click-through opens objective; drag activates after 4px motion. */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen(sub); }}
          className="flex-1 min-w-0 text-left space-y-0.5"
        >
          <div className={cn(
            "text-[13px] font-body leading-snug break-words",
            sub.completed ? "line-through text-muted-foreground" : "text-foreground",
          )}>
            {sub.text}
          </div>
          {objectiveText && (
            <div className="text-[10px] font-body text-muted-foreground/70 line-clamp-1">
              {objectiveText}
            </div>
          )}
        </button>

        {/* Right-side status icons (no action on click — just visual) */}
        <div className="shrink-0 flex items-center gap-1 mt-0.5">
          {sub.recurrence && (
            <Repeat size={11} className="text-sky-500/80" aria-label="Récurrente" />
          )}
          {sub.flaggedToday && !sub.completed && (
            <Star size={12} className="fill-amber-400 text-amber-400" aria-label="Sprint du jour" />
          )}
        </div>
      </div>
    </div>
  );
}
