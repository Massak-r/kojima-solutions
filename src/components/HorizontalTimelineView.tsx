import { TimelineTask } from "@/types/timeline";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";

export interface HorizontalTimelineViewProps {
  tasks: TimelineTask[];
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

export function HorizontalTimelineView({ tasks, onEdit, onDelete, onManageSubtasks, onRequestFeedback }: HorizontalTimelineViewProps) {
  const sorted = [...tasks].sort((a, b) => a.order - b.order);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </div>
        <p className="font-display text-xl text-foreground/50 mb-1">No tasks yet</p>
        <p className="font-body text-sm text-muted-foreground max-w-xs">
          Add your first task using the form to start building your project timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-6">
      {/* Use CSS Grid for perfect alignment: top-cards | spine | bottom-cards */}
      <div
        className="relative min-w-max grid"
        style={{
          gridTemplateColumns: `repeat(${sorted.length}, 14rem)`,
          gridTemplateRows: "1fr auto 1fr",
          gap: "0",
        }}
      >
        {/* Horizontal spine line — spans full width at the middle row */}
        <div
          className="timeline-connector rounded-full"
          style={{
            gridColumn: `1 / -1`,
            gridRow: "2 / 3",
            height: "2px",
            alignSelf: "center",
          }}
        />

        {sorted.map((task, i) => {
          const colors = colorMap[task.color ?? "primary"];
          const isTop = i % 2 === 0;

          return (
            <>
              {/* Row 1: top card or empty */}
              <div
                key={`top-${task.id}`}
                className="flex items-end justify-center px-2 pb-3"
                style={{ gridColumn: i + 1, gridRow: 1 }}
              >
                {isTop && (
                  <Card task={task} colors={colors} onEdit={onEdit} onDelete={onDelete} index={i} />
                )}
              </div>

              {/* Row 2: dot */}
              <div
                key={`dot-${task.id}`}
                className="flex items-center justify-center"
                style={{ gridColumn: i + 1, gridRow: 2 }}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 border-background shadow-sm z-10 shrink-0 transition-transform hover:scale-125",
                    colors.dot
                  )}
                />
              </div>

              {/* Row 3: bottom card or empty */}
              <div
                key={`bot-${task.id}`}
                className="flex items-start justify-center px-2 pt-3"
                style={{ gridColumn: i + 1, gridRow: 3 }}
              >
                {!isTop && (
                  <Card task={task} colors={colors} onEdit={onEdit} onDelete={onDelete} index={i} />
                )}
              </div>
            </>
          );
        })}
      </div>
    </div>
  );
}

function Card({
  task,
  colors,
  onEdit,
  onDelete,
  index,
}: {
  task: TimelineTask;
  colors: (typeof colorMap)["primary"];
  onEdit: (t: TimelineTask) => void;
  onDelete: (id: string) => void;
  index: number;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-xl p-4 shadow-card hover:shadow-card-hover transition-shadow duration-300 w-52 animate-fade-up",
        colors.card
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(task)} className={cn("p-1 rounded transition-colors", colors.icon)} title="Edit">
          <Pencil size={12} />
        </button>
        <button onClick={() => onDelete(task.id)} className={cn("p-1 rounded transition-colors", colors.icon)} title="Delete">
          <Trash2 size={12} />
        </button>
      </div>
      <span className={cn("inline-block text-xs font-body font-semibold px-2 py-0.5 rounded-full mb-2 tracking-wide", colors.badge)}>
        {task.dateLabel}
      </span>
      <div className="flex items-start gap-1.5 mb-1">
        <span className={cn("font-display text-sm font-bold mt-0.5 shrink-0", colors.order)}>
          {String(task.order).padStart(2, "0")}
        </span>
        <h3 className="font-display text-base leading-snug">{task.title}</h3>
      </div>
      {task.description && (
        <RichText text={task.description} className={cn("mt-1.5", colors.desc)} />
      )}
    </div>
  );
}
