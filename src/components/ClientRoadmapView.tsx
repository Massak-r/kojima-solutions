import { TimelineTask, FeedbackRequest } from "@/types/timeline";
import { TaskFeedback } from "@/contexts/ProjectsContext";
import { RichText } from "@/components/RichText";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  Circle,
  MessageSquarePlus,
  FileUp,
  Send,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";

const COLOR_MAP: Record<string, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  secondary: "bg-secondary",
  rose: "bg-palette-rose",
  sage: "bg-palette-sage",
  amber: "bg-palette-amber",
  violet: "bg-palette-violet",
};

const COLOR_BORDER: Record<string, string> = {
  primary: "border-primary/30",
  accent: "border-accent/30",
  secondary: "border-border",
  rose: "border-palette-rose/30",
  sage: "border-palette-sage/30",
  amber: "border-palette-amber/30",
  violet: "border-palette-violet/30",
};

interface ClientRoadmapViewProps {
  tasks: TimelineTask[];
  feedbacks: TaskFeedback[];
  onRespondToRequest: (taskId: string, requestId: string, response: string) => void;
}

export function ClientRoadmapView({ tasks, feedbacks, onRespondToRequest }: ClientRoadmapViewProps) {
  const sorted = [...tasks].sort((a, b) => a.order - b.order);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {sorted.map((task, i) => {
        const subtasks = task.subtasks || [];
        const completedCount = subtasks.filter((s) => s.completed).length;
        const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;
        const isExpanded = expandedTask === task.id;
        const requests = (task.feedbackRequests || []).filter((r) => !r.resolved);
        const taskFeedbacks = feedbacks.filter((f) => f.taskId === task.id);

        return (
          <div
            key={task.id}
            className={`bg-card border rounded-lg overflow-hidden transition-all ${COLOR_BORDER[task.color || "primary"]}`}
          >
            <button
              onClick={() => setExpandedTask(isExpanded ? null : task.id)}
              className="w-full text-left p-4 flex items-start gap-3 hover:bg-secondary/20 transition-colors"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0 ${COLOR_MAP[task.color || "primary"]}`}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="font-display text-sm font-semibold text-foreground">{task.title}</h3>
                  <div className="flex items-center gap-2">
                    {requests.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-palette-amber/10 text-palette-amber border-palette-amber/30 gap-1">
                        <MessageSquarePlus size={10} />
                        {requests.length} pending
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{task.dateLabel}</span>
                    {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                  </div>
                </div>

                {subtasks.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <Progress value={progress} className="h-1.5 flex-1" />
                    <span className="font-body text-[10px] text-muted-foreground whitespace-nowrap">
                      {completedCount}/{subtasks.length}
                    </span>
                  </div>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border">
                {task.description && (
                  <div className="px-4 pt-3 pb-2">
                    <RichText text={task.description} className="text-foreground/70" />
                  </div>
                )}

                {subtasks.length > 0 && (
                  <div className="px-4 py-3 space-y-1.5">
                    <p className="font-display text-xs font-semibold text-foreground mb-2">Progress</p>
                    {subtasks.map((st) => (
                      <div key={st.id} className="flex items-center gap-2 text-sm font-body">
                        {st.completed ? (
                          <CheckCircle2 size={14} className="text-palette-sage flex-shrink-0" />
                        ) : (
                          <Circle size={14} className="text-muted-foreground flex-shrink-0" />
                        )}
                        <span className={st.completed ? "text-foreground/50 line-through" : "text-foreground"}>
                          {st.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {requests.length > 0 && (
                  <div className="px-4 py-3 space-y-3 bg-palette-amber/5">
                    <p className="font-display text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <MessageSquarePlus size={13} className="text-palette-amber" />
                      Action Required
                    </p>
                    {requests.map((req) => (
                      <FeedbackRequestCard
                        key={req.id}
                        request={req}
                        onRespond={(response) => onRespondToRequest(task.id, req.id, response)}
                      />
                    ))}
                  </div>
                )}

                {taskFeedbacks.length > 0 && (
                  <div className="px-4 py-3 space-y-2 bg-secondary/10">
                    <p className="font-display text-xs font-semibold text-muted-foreground">Reviews</p>
                    {taskFeedbacks.map((fb) => (
                      <div key={fb.id} className="bg-card border border-border rounded p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-body text-xs font-medium text-foreground">{fb.author}</span>
                          <span className="font-body text-[10px] text-muted-foreground">
                            {new Date(fb.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="font-body text-xs text-foreground/70">{fb.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FeedbackRequestCard({
  request,
  onRespond,
}: {
  request: FeedbackRequest;
  onRespond: (response: string) => void;
}) {
  const [response, setResponse] = useState("");

  return (
    <div className="bg-card border border-palette-amber/20 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2">
        {request.type === "file" ? (
          <FileUp size={12} className="text-palette-amber" />
        ) : (
          <MessageSquarePlus size={12} className="text-palette-amber" />
        )}
        <span className="font-body text-xs font-medium text-foreground">
          {request.type === "file" ? "File Requested" : "Feedback Requested"}
        </span>
      </div>
      <p className="font-body text-xs text-foreground/70 mb-2">{request.message}</p>
      <div className="flex gap-2">
        <Input
          placeholder={request.type === "file" ? "Paste link or describe file..." : "Your response..."}
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          className="text-xs h-8"
        />
        <Button
          size="sm"
          disabled={!response.trim()}
          onClick={() => {
            onRespond(response.trim());
            setResponse("");
          }}
          className="h-8 text-xs gap-1"
        >
          <Send size={10} />
          Send
        </Button>
      </div>
    </div>
  );
}
