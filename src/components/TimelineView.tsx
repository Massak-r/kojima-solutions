import { TimelineTask } from "@/types/timeline";
import { TimelineCard } from "@/components/TimelineCard";

interface TimelineViewProps {
  tasks: TimelineTask[];
  onEdit: (task: TimelineTask) => void;
  onDelete: (id: string) => void;
  onManageSubtasks?: (task: TimelineTask) => void;
  onToggleComplete?: (id: string) => void;
  onAddSubtask?: (taskId: string, title: string) => void;
  phaseMap?: Record<string, string>;
  onPhaseClick?: () => void;
}

export function TimelineView({ tasks, onEdit, onDelete, onManageSubtasks, onToggleComplete, onAddSubtask, phaseMap, onPhaseClick }: TimelineViewProps) {
  const sorted = [...tasks].sort((a, b) => a.order - b.order);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
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
    <div className="relative py-4">
      {/* Vertical spine */}
      <div
        className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 timeline-connector rounded-full"
        style={{ zIndex: 0 }}
      />

      <div className="relative flex flex-col gap-10" style={{ zIndex: 1 }}>
        {sorted.map((task, i) => (
          <TimelineCard
            key={task.id}
            task={task}
            index={i}
            onEdit={onEdit}
            onDelete={onDelete}
            onManageSubtasks={onManageSubtasks}
            onToggleComplete={onToggleComplete}
            onAddSubtask={onAddSubtask}
            phaseName={task.phaseId && phaseMap ? phaseMap[task.phaseId] : undefined}
            onPhaseClick={onPhaseClick}
          />
        ))}
      </div>
    </div>
  );
}
