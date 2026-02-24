import { useParams } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichText } from "@/components/RichText";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  FileUp,
  MessageSquarePlus,
  Send,
  CalendarDays,
  User,
  Clock,
  FileText,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { FeedbackRequest } from "@/types/timeline";
import { ProjectData } from "@/types/project";
import { cn } from "@/lib/utils";

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
  primary: "border-l-primary",
  accent: "border-l-accent",
  secondary: "border-l-border",
  rose: "border-l-palette-rose",
  sage: "border-l-palette-sage",
  amber: "border-l-palette-amber",
  violet: "border-l-palette-violet",
};

const STATUS_BADGE: Record<ProjectData["status"], { label: string; className: string }> = {
  draft:        { label: "Draft",       className: "bg-muted text-muted-foreground border-border" },
  "in-progress":{ label: "In Progress", className: "bg-primary/10 text-primary border-primary/30" },
  completed:    { label: "Completed",   className: "bg-palette-sage/20 text-palette-sage border-palette-sage/30" },
  "on-hold":    { label: "On Hold",     className: "bg-palette-amber/20 text-palette-amber border-palette-amber/30" },
};

// ─── File Drop Zone ─────────────────────────────────────────────────────────

function FileDropZone({ onFile }: { onFile: (name: string) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) { setFileName(file.name); onFile(file.name); }
  }, [onFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setFileName(file.name); onFile(file.name); }
  }, [onFile]);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
        isDragging ? "border-palette-amber bg-palette-amber/10" : "border-border hover:border-palette-amber/50 hover:bg-secondary/30"
      )}
    >
      <input ref={inputRef} type="file" className="hidden" onChange={handleChange} />
      {fileName ? (
        <div className="flex items-center justify-center gap-2 text-xs font-body text-palette-sage">
          <CheckCircle2 size={14} />
          <span className="font-medium">{fileName}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <FileUp size={20} className="text-muted-foreground" />
          <p className="font-body text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Drop file here</span> or click to browse
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Blocking Request Card ────────────────────────────────────────────────────

function BlockingRequestCard({
  request,
  taskTitle,
  stepNumber,
  onRespond,
}: {
  request: FeedbackRequest;
  taskTitle: string;
  stepNumber: number;
  onRespond: (response: string) => void;
}) {
  const [textResponse, setTextResponse] = useState("");
  const [fileResponse, setFileResponse] = useState("");

  const canSubmit = request.type === "file" ? !!fileResponse : !!textResponse.trim();

  return (
    <div className="bg-card border-2 border-palette-amber/40 rounded-xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-palette-amber/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={16} className="text-palette-amber" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className="text-[10px] bg-palette-amber/10 text-palette-amber border-palette-amber/30 font-semibold">
              BLOCKING
            </Badge>
            <span className="font-body text-xs text-muted-foreground">Step {stepNumber} — {taskTitle}</span>
          </div>
          <p className="font-display text-sm font-semibold text-foreground">{request.message}</p>
        </div>
      </div>

      {/* Response area */}
      {request.type === "file" ? (
        <div className="space-y-3">
          <FileDropZone onFile={setFileResponse} />
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="font-body text-xs text-muted-foreground">or paste a link</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="https://drive.google.com/..."
              value={fileResponse}
              onChange={(e) => setFileResponse(e.target.value)}
              className="text-xs h-9"
            />
            <Button
              size="sm"
              disabled={!canSubmit}
              onClick={() => { onRespond(fileResponse || `[file: ${fileResponse}]`); setFileResponse(""); }}
              className="h-9 gap-1.5 shrink-0"
            >
              <Send size={12} /> Submit
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="Your response..."
            value={textResponse}
            onChange={(e) => setTextResponse(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) { onRespond(textResponse); setTextResponse(""); } }}
            className="text-xs h-9"
          />
          <Button
            size="sm"
            disabled={!canSubmit}
            onClick={() => { onRespond(textResponse); setTextResponse(""); }}
            className="h-9 gap-1.5 shrink-0"
          >
            <Send size={12} /> Send
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Client Dashboard ────────────────────────────────────────────────────

export default function ClientDashboard() {
  const { id } = useParams<{ id: string }>();
  const { getProject, respondToFeedbackRequest } = useProjects();
  const { toast } = useToast();
  const project = getProject(id!);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (taskId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  const handleRespond = useCallback((taskId: string, requestId: string, response: string) => {
    respondToFeedbackRequest(id!, taskId, requestId, response);
    toast({ title: "Response submitted!", description: "The team has been notified." });
  }, [id, respondToFeedbackRequest, toast]);

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-muted-foreground" />
          </div>
          <p className="font-display text-xl text-foreground font-bold mb-2">Project not found</p>
          <p className="font-body text-sm text-muted-foreground">This link may be invalid or the project has been removed.</p>
        </div>
      </div>
    );
  }

  const sorted = [...project.tasks].sort((a, b) => a.order - b.order);

  // Overall progress: % of subtasks completed
  const allSubtasks = sorted.flatMap((t) => t.subtasks || []);
  const completedSubtasks = allSubtasks.filter((s) => s.completed).length;
  const overallProgress = allSubtasks.length > 0
    ? Math.round((completedSubtasks / allSubtasks.length) * 100)
    : 0;

  // All blocking (unresolved) requests
  const blockingRequests = sorted.flatMap((task, i) =>
    (task.feedbackRequests || [])
      .filter((r) => !r.resolved)
      .map((r) => ({ request: r, task, stepNumber: i + 1 }))
  );

  const statusBadge = STATUS_BADGE[project.status];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar — clean, no admin nav */}
      <div className="bg-primary text-primary-foreground py-4 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="font-display font-semibold text-lg tracking-tight">
            Kojima<span className="opacity-60">.</span>Solutions
          </span>
          <span className="font-body text-xs text-primary-foreground/60">Client Portal</span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* ── Section A: Blocking Actions ── */}
        {blockingRequests.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-palette-amber/20 flex items-center justify-center">
                <AlertTriangle size={16} className="text-palette-amber" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-foreground">
                  {blockingRequests.length} action{blockingRequests.length > 1 ? "s" : ""} required
                </h2>
                <p className="font-body text-xs text-muted-foreground">
                  Your input is needed before the project can continue
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {blockingRequests.map(({ request, task, stepNumber }) => (
                <BlockingRequestCard
                  key={request.id}
                  request={request}
                  taskTitle={task.title}
                  stepNumber={stepNumber}
                  onRespond={(response) => handleRespond(task.id, request.id, response)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Section B: Project Overview ── */}
        <section className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">{project.title}</h1>
              {project.client && (
                <div className="flex items-center gap-1.5 font-body text-sm text-muted-foreground mb-2">
                  <User size={13} /> <span>{project.client}</span>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs gap-1 ${statusBadge.className}`}>
                  {statusBadge.label}
                </Badge>
                {(project.startDate || project.endDate) && (
                  <span className="font-body text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays size={11} />
                    {project.startDate && new Date(project.startDate).toLocaleDateString()}
                    {project.startDate && project.endDate && " → "}
                    {project.endDate && new Date(project.endDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            {sorted.length > 0 && (
              <div className="text-right shrink-0">
                <p className="font-display text-3xl font-bold text-primary">{overallProgress}%</p>
                <p className="font-body text-xs text-muted-foreground">complete</p>
              </div>
            )}
          </div>

          {allSubtasks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-body text-xs text-muted-foreground">Overall Progress</span>
                <span className="font-body text-xs text-muted-foreground">{completedSubtasks}/{allSubtasks.length} subtasks</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}
        </section>

        {/* ── Section C: Timeline Steps ── */}
        {sorted.length > 0 && (
          <section>
            <h2 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
              Project Timeline
            </h2>
            <div className="space-y-3">
              {sorted.map((task, i) => {
                const subtasks = task.subtasks || [];
                const completedCount = subtasks.filter((s) => s.completed).length;
                const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;
                const isExpanded = expandedSteps.has(task.id);
                const resolvedRequests = (task.feedbackRequests || []).filter((r) => r.resolved);
                const pendingCount = (task.feedbackRequests || []).filter((r) => !r.resolved).length;

                // Step status
                const isComplete = subtasks.length > 0 && completedCount === subtasks.length;
                const isBlocking = pendingCount > 0;

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "bg-card border rounded-xl overflow-hidden border-l-4 transition-shadow",
                      COLOR_BORDER[task.color || "primary"],
                      isBlocking ? "ring-2 ring-palette-amber/30" : ""
                    )}
                  >
                    <button
                      onClick={() => toggleStep(task.id)}
                      className="w-full text-left p-4 flex items-center gap-3 hover:bg-secondary/20 transition-colors"
                    >
                      {/* Step dot */}
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0",
                        COLOR_MAP[task.color || "primary"]
                      )}>
                        {isComplete ? <CheckCircle2 size={14} /> : String(i + 1)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-display text-sm font-semibold text-foreground">{task.title}</h3>
                          <div className="flex items-center gap-2 shrink-0">
                            {isBlocking && (
                              <Badge variant="outline" className="text-[10px] bg-palette-amber/10 text-palette-amber border-palette-amber/30">
                                Action needed
                              </Badge>
                            )}
                            {isComplete && !isBlocking && (
                              <Badge variant="outline" className="text-[10px] bg-palette-sage/10 text-palette-sage border-palette-sage/30">
                                Complete
                              </Badge>
                            )}
                            <span className="font-body text-xs text-muted-foreground hidden sm:inline">{task.dateLabel}</span>
                            {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                          </div>
                        </div>
                        {subtasks.length > 0 && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <Progress value={progress} className="h-1.5 flex-1" />
                            <span className="font-body text-[10px] text-muted-foreground whitespace-nowrap">{completedCount}/{subtasks.length}</span>
                          </div>
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border">
                        {task.description && (
                          <div className="px-4 pt-3 pb-2">
                            <RichText text={task.description} className="text-foreground/70 text-xs" />
                          </div>
                        )}

                        {subtasks.length > 0 && (
                          <div className="px-4 py-3 space-y-2 border-t border-border/50">
                            <p className="font-display text-xs font-semibold text-muted-foreground mb-2">Deliverables</p>
                            {subtasks.map((st) => (
                              <div key={st.id} className="flex items-center gap-2">
                                {st.completed
                                  ? <CheckCircle2 size={14} className="text-palette-sage flex-shrink-0" />
                                  : <Circle size={14} className="text-muted-foreground flex-shrink-0" />}
                                <span className={cn(
                                  "font-body text-xs",
                                  st.completed ? "text-foreground/50 line-through" : "text-foreground"
                                )}>
                                  {st.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {resolvedRequests.length > 0 && (
                          <div className="px-4 py-3 border-t border-border/50 space-y-1">
                            <p className="font-display text-xs font-semibold text-muted-foreground mb-2">Your Responses</p>
                            {resolvedRequests.map((req) => (
                              <div key={req.id} className="flex items-start gap-2 text-xs font-body">
                                <CheckCircle2 size={13} className="text-palette-sage mt-0.5 shrink-0" />
                                <span className="text-foreground/70">{req.message}: <em className="text-foreground">{req.response}</em></span>
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
          </section>
        )}

        {/* ── Section D: Footer ── */}
        <footer className="text-center py-6 border-t border-border">
          <p className="font-body text-xs text-muted-foreground">
            Powered by{" "}
            <span className="font-semibold text-foreground">Kojima.Solutions</span>
          </p>
        </footer>

      </main>
    </div>
  );
}
