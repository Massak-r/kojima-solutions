import { useState } from "react";
import {
  ChevronDown, Lock, CheckCircle2, Circle, MessageSquare,
  Image, Vote, FileUp, Type, CalendarDays, ListChecks, Pencil, Trash2,
  Unlock, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StepComments } from "./StepComments";
import { SubtaskManager } from "@/components/SubtaskManager";
import type { TimelineTask, SubTask, FeedbackRequest, StepComment } from "@/types/timeline";

const STATUS_CONFIG = {
  locked:    { icon: Lock,          dot: "bg-gray-300",    label: "Verrouille", badge: "bg-gray-100 text-gray-500 border-gray-200" },
  open:      { icon: Circle,        dot: "bg-blue-500",    label: "En cours",   badge: "bg-blue-50 text-blue-600 border-blue-200" },
  completed: { icon: CheckCircle2,  dot: "bg-emerald-500", label: "Termine",    badge: "bg-emerald-50 text-emerald-600 border-emerald-200" },
} as const;

const REQUEST_ICONS: Record<string, { icon: typeof Type; label: string; color: string }> = {
  text:       { icon: Type,          label: "Texte",       color: "text-blue-500" },
  file:       { icon: FileUp,        label: "Fichier",     color: "text-violet-500" },
  validation: { icon: Image,         label: "Validation",  color: "text-emerald-500" },
  vote:       { icon: Vote,          label: "Vote",        color: "text-amber-500" },
};

interface Props {
  task: TimelineTask;
  isLast?: boolean;
  onEdit: (task: TimelineTask) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: "locked" | "open" | "completed") => void;
  onSubtasksChange: (taskId: string, subtasks: SubTask[]) => void;
  onAddComment: (taskId: string, data: { message: string; authorName?: string; authorRole?: "client" | "admin" | "stakeholder" }) => void;
  onAddRequest: (taskId: string) => void;
  onDeleteRequest: (taskId: string, requestId: string) => void;
  deleteConfirmId: string | null;
  onDeleteConfirm: (taskId: string) => void;
  onCancelDelete: () => void;
}

export function UnifiedStepCard({
  task,
  isLast,
  onEdit,
  onDelete,
  onStatusChange,
  onSubtasksChange,
  onAddComment,
  onAddRequest,
  onDeleteRequest,
  deleteConfirmId,
  onDeleteConfirm,
  onCancelDelete,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const status = task.status || "open";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  const StatusIcon = config.icon;
  const requests = task.feedbackRequests || [];
  const comments = task.comments || [];
  const subtasks = task.subtasks || [];
  const subtasksDone = subtasks.filter((s) => s.completed).length;
  const pendingRequests = requests.filter((r) => !r.resolved).length;

  // Deadline display
  const deadlineStr = task.deadline;
  let deadlineClass = "text-muted-foreground/50";
  if (deadlineStr) {
    const diff = Math.ceil((new Date(deadlineStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) deadlineClass = "text-red-500 font-semibold";
    else if (diff <= 3) deadlineClass = "text-amber-500";
    else deadlineClass = "text-muted-foreground/60";
  }

  return (
    <div className={cn("relative pl-8", !isLast && "pb-0")}>
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border/60" />
      )}

      {/* Status dot */}
      <div className={cn("absolute left-[7px] top-2 w-3.5 h-3.5 rounded-full border-2 border-background", config.dot)} />

      {/* Card */}
      <div
        className={cn(
          "bg-card border rounded-xl transition-all",
          status === "locked" ? "border-border/40 opacity-60" : "border-border",
          status === "completed" && "border-emerald-200/50",
          expanded && "shadow-sm",
        )}
      >
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2.5 p-3 text-left"
        >
          <StatusIcon size={14} className={cn(
            status === "locked" && "text-gray-400",
            status === "open" && "text-blue-500",
            status === "completed" && "text-emerald-500",
          )} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn(
                "font-display text-sm font-semibold truncate",
                status === "completed" && "line-through text-muted-foreground",
              )}>
                {task.title}
              </span>

              {/* Request type badges */}
              {requests.length > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  {requests.map((r) => {
                    const cfg = REQUEST_ICONS[r.type] || REQUEST_ICONS.text;
                    const Icon = cfg.icon;
                    return (
                      <span
                        key={r.id}
                        className={cn("flex items-center", cfg.color, r.resolved && "opacity-40")}
                        title={`${cfg.label}${r.resolved ? " (resolu)" : ""}`}
                      >
                        <Icon size={12} />
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Meta line */}
            <div className="flex items-center gap-2 mt-0.5 text-[10px] font-body text-muted-foreground/50">
              {subtasks.length > 0 && (
                <span className="flex items-center gap-0.5">
                  <ListChecks size={10} />
                  {subtasksDone}/{subtasks.length}
                </span>
              )}
              {pendingRequests > 0 && (
                <span className="text-amber-500 font-medium">
                  {pendingRequests} en attente
                </span>
              )}
              {comments.length > 0 && (
                <span className="flex items-center gap-0.5">
                  <MessageSquare size={10} />
                  {comments.length}
                </span>
              )}
              {deadlineStr && (
                <span className={cn("flex items-center gap-0.5", deadlineClass)}>
                  <CalendarDays size={10} />
                  {new Date(deadlineStr).toLocaleDateString("fr-CH")}
                </span>
              )}
            </div>
          </div>

          <ChevronDown size={14} className={cn("text-muted-foreground/40 transition-transform shrink-0", expanded && "rotate-180")} />
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="px-3 pb-3 space-y-4 border-t border-border/30 pt-3">
            {/* Description */}
            {task.description && (
              <p className="text-xs font-body text-foreground/60 whitespace-pre-wrap">{task.description}</p>
            )}

            {/* Status actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] font-body", config.badge)}>
                {config.label}
              </Badge>
              {status !== "locked" && status !== "completed" && (
                <Button
                  variant="ghost" size="sm"
                  className="h-6 text-[10px] gap-1 text-emerald-600 hover:text-emerald-700"
                  onClick={() => onStatusChange(task.id, "completed")}
                >
                  <CheckCircle2 size={11} /> Terminer
                </Button>
              )}
              {status === "completed" && (
                <Button
                  variant="ghost" size="sm"
                  className="h-6 text-[10px] gap-1 text-amber-600 hover:text-amber-700"
                  onClick={() => onStatusChange(task.id, "open")}
                >
                  <RotateCcw size={11} /> Rouvrir
                </Button>
              )}
              {status === "locked" && (
                <Button
                  variant="ghost" size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={() => onStatusChange(task.id, "open")}
                >
                  <Unlock size={11} /> Deverrouiller
                </Button>
              )}
              {status === "open" && (
                <Button
                  variant="ghost" size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={() => onStatusChange(task.id, "locked")}
                >
                  <Lock size={11} /> Verrouiller
                </Button>
              )}
            </div>

            {/* Requests summary */}
            {requests.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider">
                  Demandes client
                </p>
                {requests.map((r) => {
                  const cfg = REQUEST_ICONS[r.type] || REQUEST_ICONS.text;
                  const Icon = cfg.icon;
                  return (
                    <div key={r.id} className={cn(
                      "flex items-center gap-2 text-xs font-body p-2 rounded-lg border",
                      r.resolved ? "bg-emerald-50/50 border-emerald-200/50" : "bg-secondary/30 border-border/40"
                    )}>
                      <Icon size={13} className={cfg.color} />
                      <span className="flex-1 min-w-0 truncate text-foreground/70">{r.message}</span>
                      {r.resolved ? (
                        <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                      ) : (
                        <span className="text-[9px] text-amber-500 font-medium shrink-0">En attente</span>
                      )}
                      <button
                        onClick={() => onDeleteRequest(task.id, r.id)}
                        className="p-0.5 text-muted-foreground/30 hover:text-destructive transition-colors shrink-0"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add request button */}
            <Button
              variant="outline" size="sm"
              className="h-7 text-[10px] gap-1 w-full border-dashed"
              onClick={() => onAddRequest(task.id)}
            >
              + Ajouter une demande client
            </Button>

            {/* Subtasks */}
            {subtasks.length > 0 && (
              <div>
                <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Sous-taches
                </p>
                <SubtaskManager
                  subtasks={subtasks}
                  onChange={(updated) => onSubtasksChange(task.id, updated)}
                />
              </div>
            )}

            {/* Comments */}
            <StepComments
              comments={comments}
              onAdd={(data) => onAddComment(task.id, data)}
              isAdmin
            />

            {/* Admin actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/30">
              <Button
                variant="ghost" size="sm"
                className="h-6 text-[10px] gap-1"
                onClick={() => onEdit(task)}
              >
                <Pencil size={10} /> Modifier
              </Button>
              {deleteConfirmId === task.id ? (
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    variant="destructive" size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => onDelete(task.id)}
                  >
                    Supprimer
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-6 text-[10px]"
                    onClick={onCancelDelete}
                  >
                    Annuler
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => onDeleteConfirm(task.id)}
                  className="ml-auto p-1 text-muted-foreground/30 hover:text-destructive transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
